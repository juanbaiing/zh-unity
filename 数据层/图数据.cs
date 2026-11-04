// 从库里组装出「图」该有的样子。
//
// 这个文件被两个项目同时编译：
//   · 数据层     —— 导出成能双击打开的 html
//   · 编辑器壳   —— 直接把 JSON 塞给页面里的关系图
// 抄两份迟早会走样，所以放一个地方。

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace 图数据
{
    internal static class 组装
    {
        public const string 场景树 = "场景|";
        public const string 代码树 = "代码|";

        public sealed class 节点行
        {
            public string id, 树, 类型, 名字, 父, 附加, 短;
        }

        public sealed class 边行
        {
            public string 自, 到, 种类, 原文;
            public long? 行;
        }

        public static (List<节点行> 节点们, List<边行> 边们) 读整库(SqliteConnection 连)
        {
            var 节点们 = new List<节点行>();
            using (var 命 = 连.CreateCommand())
            {
                命.CommandText = "SELECT id, 树, 类型, 名字, 父, 附加 FROM 节点";
                using var 读 = 命.ExecuteReader();
                while (读.Read())
                {
                    var n = new 节点行
                    {
                        id = 读.GetString(0), 树 = 读.GetString(1), 类型 = 读.GetString(2),
                        名字 = 读.GetString(3),
                        父 = 读.IsDBNull(4) ? null : 读.GetString(4),
                        附加 = 读.IsDBNull(5) ? null : 读.GetString(5),
                    };
                    n.短 = n.id.Substring(n.id.IndexOf('|') + 1);
                    节点们.Add(n);
                }
            }

            var 边们 = new List<边行>();
            using (var 命 = 连.CreateCommand())
            {
                命.CommandText = "SELECT 自, 到, 种类, 行, 原文 FROM 边";
                using var 读 = 命.ExecuteReader();
                while (读.Read())
                    边们.Add(new 边行
                    {
                        自 = 读.GetString(0), 到 = 读.GetString(1), 种类 = 读.GetString(2),
                        行 = 读.IsDBNull(3) ? null : 读.GetInt64(3),
                        原文 = 读.IsDBNull(4) ? null : 读.GetString(4),
                    });
            }

            return (节点们, 边们);
        }

        // ── 实验稿（unity-graph-lab/实例图.html）要的格式 ──
        // 它自己会量高度、摆窗户、算档，这边只负责喂数据。
        // 那个稿子已经把布局和交互定死了，照它的形状喂，不自己发明。
        public static (object 场景, int 实例数) 组装画布(SqliteConnection 连, string 项目名)
        {
            var (节点列表, 边们) = 读整库(连);
            var 节点们 = 节点列表.ToDictionary(n => n.id, StringComparer.Ordinal);
            var 出边 = 边们.ToLookup(e => e.自, StringComparer.Ordinal);
            var 入边 = 边们.ToLookup(e => e.到, StringComparer.Ordinal);

            // 类型 → 场上的实例
            var 实例 = new Dictionary<string, List<string>>(StringComparer.Ordinal);
            foreach (var e in 边们.Where(e => e.种类 == "实例化"))
            {
                if (!e.自.StartsWith(场景树, StringComparison.Ordinal)) continue;
                var 类型 = e.到.Substring(e.到.IndexOf('|') + 1);
                if (!实例.TryGetValue(类型, out var 列)) { 列 = new List<string>(); 实例[类型] = 列; }
                if (!列.Contains(e.自)) 列.Add(e.自);
            }

            // 你拖过的位置优先。重灌数据库不动布局表（Program.cs 里就是这么说的），
            // 那这里就得真的读它 —— 不然每次重新组装，你摆好的框全被网格重算冲掉。
            var 存位 = new Dictionary<string, (double x, double y)>(StringComparer.Ordinal);
            try
            {
                using var 命 = 连.CreateCommand();
                命.CommandText = "SELECT id, x, y FROM 布局";
                using var 读位 = 命.ExecuteReader();
                while (读位.Read()) 存位[读位.GetString(0)] = (读位.GetDouble(1), 读位.GetDouble(2));
            }
            catch { /* 老库还没建布局表 —— 用网格默认位置就行 */ }

            var 实例们 = new List<object>();
            var 申诉 = 读申诉(连);
            var 空头们 = new List<(string id, string 自, string 组件, string 字段, string 种类, string 申诉)>();
            var 空头键 = new HashSet<string>(StringComparer.Ordinal);

            // 组件 id → 它挂在哪个实例身上。空头和线都按实例摆，不按组件。
            string 到实例id(string 组件id) =>
                节点们.TryGetValue(组件id, out var 节) && 节.父 != null ? 节.父 : 组件id;

            // 图上只画场景实例，预制体不画框。所以预制体上的断口没有落脚点 ——
            // 但它是被谁用的看得见：找场景里挂了同一个脚本的实例，落在它身上。
            // 找不到就照原样返回，画不出来是画不出来，别硬凑。
            string 落点(string 组件id)
            {
                var 父 = 到实例id(组件id);
                if (父.StartsWith(场景树, StringComparison.Ordinal)) return 父;
                var 类名 = 组件id.Split('.').Last();
                var 方 = 类名.IndexOf('[');
                if (方 > 0) 类名 = 类名.Substring(0, 方);   // EnemyHp[2] → EnemyHp
                if (实例.TryGetValue(类名, out var 们) && 们.Count > 0) return 到实例id(们[0]);
                return 父;
            }

            // 记一个「面板上该有东西，那儿是空」的口。
            // 申诉过的三种处理：
            //   连到 → 不记空头（改成一条正常的线）
            //   正常 → 照记，但标成误报，前端不标红
            //   隐藏 → 不记
            void 记空头(string 组件id, string 字段, string 种类)
            {
                var 口 = 断口(组件id, 字段, 种类);
                if (!空头键.Add(口)) return;
                申诉.TryGetValue(口, out var 答);
                if (答.动作 == "隐藏" || 答.动作 == "连到") return;
                空头们.Add((口, 落点(组件id), 组件id, 字段, 种类,
                            string.IsNullOrEmpty(答.动作) ? null : 答.动作));
            }

            var 组节点 = 节点列表
                .Where(n => n.类型 == "组件" && n.树 == "场景")
                .OrderBy(n => n.id, StringComparer.Ordinal);

            // 被引用得越多越靠中间
            var 被引 = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var e in 边们) 被引[e.到] = 被引.TryGetValue(e.到, out var v) ? v + 1 : 1;
            var 按物 = 组节点.GroupBy(n => n.父 ?? "").ToList();
            按物.Sort((a, b) => 组热度(b.Key, 被引).CompareTo(组热度(a.Key, 被引)));

            // 摆位：按网格，不用黄金角螺旋。
            // 螺旋的半径是 430×圈 —— 第 6 个就飞到 1290 外，而画布才 1400 宽，
            // 一半的框直接摆到画布外面。打开只看得见三个，看着像"东西少了"，
            // 其实是摆到看不见的地方去了（实测 6 个实例落在 x −757~1558、y −727~1500）。
            // 网格稳当：列数算得出来，每行多高也估得出来，不出界。
            var 估高 = 按物.Select(g => 44 + g.Count() * 215 + 8).ToList();
            var 列数 = Math.Max(1, (int)Math.Ceiling(Math.Sqrt(Math.Max(1, 按物.Count))));
            var 逐行高 = new List<double>();
            for (var i = 0; i < 按物.Count; i++)
            {
                var 行号 = i / 列数;
                while (逐行高.Count <= 行号) 逐行高.Add(0);
                逐行高[行号] = Math.Max(逐行高[行号], 估高[i]);
            }
            const double 格宽 = 470, 格缝 = 60;

            var 序号 = 0;
            foreach (var 组 in 按物)
            {
                var 物体 = 组.Key.Length > 0 && 节点们.TryGetValue(组.Key, out var o) ? o : null;
                var 短名 = 物体?.短 ?? 组.Key.Substring(Math.Max(0, 组.Key.IndexOf('|') + 1));
                var 名 = 短名.Contains('.') ? 短名.Split('.').Last() : 短名;

                var tag = "";
                if (物体?.附加 != null)
                {
                    try
                    {
                        using var 档 = JsonDocument.Parse(物体.附加);
                        if (档.RootElement.TryGetProperty("tag", out var t) && t.ValueKind == JsonValueKind.String)
                            tag = t.GetString() ?? "";
                    }
                    catch { }
                }

                // 摆位：网格。列 = 序号 % 列数，行 = 序号 / 列数。
                // 每行的 y 是前面各行高度的累加 —— 高的实例不会压到下一行的头。
                // 但如果你亲手拖过它（布局表里有），就用你的位置，网格只是默认值。
                var 列号 = 序号 % 列数;
                var 行序 = 序号 / 列数;
                double x = 90 + 列号 * 格宽;
                double y = 130;
                for (var r = 0; r < 行序; r++) y += 逐行高[r] + 格缝;
                if (存位.TryGetValue(组.Key, out var 存)) { x = 存.x; y = 存.y; }
                序号++;

                var 脚本们 = new List<object>();
                var 同名计 = new Dictionary<string, int>(StringComparer.Ordinal);

                foreach (var 组n in 组)
                {
                    同名计.TryGetValue(组n.名字, out var 第几个);
                    同名计[组n.名字] = 第几个 + 1;
                    var 显示名 = 组n.名字 + (第几个 > 0 ? $"[{第几个 + 1}]" : "");

                    var 槽们 = 读槽(组n.附加)
                        .Select(kv => new
                        {
                            k = kv.Key,
                            v = string.IsNullOrEmpty(kv.Value) ? null : kv.Value,
                            类型 = "",
                        })
                        .ToArray();

                    var 脚本id = 出边[组n.id].FirstOrDefault(e => e.种类 == "实例化")?.到;
                    var 入口们 = new List<object>();
                    var 出口们 = new List<object>();

                    if (脚本id != null)
                    {
                        var 方法们 = 节点列表
                            .Where(n => n.类型 == "方法" && n.父 == 脚本id)
                            .OrderBy(n => n.名字, StringComparer.Ordinal);

                        foreach (var 法 in 方法们)
                        {
                            var 来 = 入边[法.id].Where(e => e.种类 == "调用")
                                .Select(e => 方法归属组件(e.自, 节点列表, 出边))
                                .Where(z => z != null)
                                .Select(z => 节点们.TryGetValue(z, out var cn) ? cn.短.Split('.').Last() : z)
                                .Distinct().ToList();
                            foreach (var 者 in 来)
                                入口们.Add(new { 名 = 法.名字, 行 = "", 空头 = 者 });

                            foreach (var e in 出边[法.id])
                            {
                                // ⚠️ 这里原来写的是**类名**（"EnemyHp"），可模板画线要的是**实例 id**
                                //    （"场景|SampleScene.enemy"）。两边格式对不上，于是
                                //    场景.实例们.find(i => i.id === o.到) 永远查不到 —— 一条线都画不出来。
                                //    图上只剩几个孤立的框，看着就是"不好看"，其实线全丢了。
                                //    现在解析成挂着这个类的实例 id；场景里没有它（纯代码引用）
                                //    就留 null：画不出来就是画不出来，别假装连上了。
                                var 目标类型 = e.到.Substring(e.到.IndexOf('|') + 1);
                                var 点 = 目标类型.IndexOf('.');
                                if (点 > 0) 目标类型 = 目标类型.Substring(0, 点);   // 调用边到的是「类.方法」
                                string 到实例 = null;
                                if (实例.TryGetValue(目标类型, out var 目标们2) && 目标们2.Count > 0)
                                {
                                    // ⚠️ 实例表里存的是**脚本节点 id**（场景|SampleScene.enemy.EnemyHp），
                                    //    模板要比的却是**实例 id**（场景|SampleScene.enemy）——
                                    //    差这一层，线照样画不出来。往上取一层父。
                                    var 脚本id0 = 目标们2[0];
                                    到实例 = 节点们.TryGetValue(脚本id0, out var 目标节点) && 目标节点.父 != null
                                        ? 目标节点.父 : 脚本id0;
                                }
                                // ⚠️ 这里曾经按「到不了场景实例」判空头 —— 实测 19 条里 18 条是假的：
                                //    GetComponent&lt;Rigidbody&gt; / Slider / Text / Renderer 这些**引擎组件本来就不建节点**，
                                //    它们"找不到实例"是正常的，不是断链。误报率 95%，红色警告立刻不值钱。
                                //    所以空头只认 Program.cs 那条 断|组件.字段 —— 面板上该有东西、那儿是 None。
                                出口们.Add(new { 名 = 法.名字, 行 = "", 到 = 到实例, 到类型 = 目标类型, 条件 = e.原文 ?? "" });
                            }
                        }
                    }

                    脚本们.Add(new
                    {
                        名 = 显示名,
                        槽 = 槽们,
                        入口 = 入口们.ToArray(),
                        出口 = 出口们.ToArray(),
                        块树 = Array.Empty<object>(),   // 块树只有编辑器有，数据层给不了
                    });
                }

                实例们.Add(new
                {
                    id = 组.Key,
                    名,
                    tag,
                    层 = 0,
                    激活 = true,
                    x,
                    y,
                    w = 380,
                    组件 = "Transform · MonoBehaviour",
                    脚本 = 脚本们.ToArray(),
                });
            }

            // 空头：实验稿用来表示「来源没摆到画布上」。数据全的时候是空的。
            // 线：实验稿的连法是「出口的 到 写类型名，再自己找锚点」，
            //      这边直接给组件 → 组件的成对，省得它去猜。
            var 线们 = new List<object>();
            var 线键 = new HashSet<string>(StringComparer.Ordinal);
            void 加线(string a, string b, string 种类, string 条件)
            {
                if (a == b) return;
                if (!线键.Add(a + "\u0001" + b + "\u0001" + 种类)) return;
                线们.Add(new { 自 = a, 到 = b, 种类, 条件 = 条件 ?? "" });
            }

            foreach (var e in 边们.Where(e => e.自.StartsWith(场景树, StringComparison.Ordinal)))
            {
                if (e.种类 == "引用") { 加线(e.自, e.到, e.种类, e.原文); continue; }
                if (e.种类 != "调用" && e.种类 != "取组件" && e.种类 != "查找") continue;

                // 方法级的边：发出去的是方法，要落回它挂在的那个组件
                var 源 = 方法归属组件(e.自, 节点列表, 出边);
                if (源 == null) continue;

                var 目标类型 = e.到.Substring(e.到.IndexOf('|') + 1);
                var 点 = 目标类型.IndexOf('.');
                if (点 > 0) 目标类型 = 目标类型.Substring(0, 点);   // 调用边到的是「类.方法」

                if (!实例.TryGetValue(目标类型, out var 目标们)) continue;
                foreach (var 目标 in 目标们) 加线(源, 目标, e.种类, e.原文);
            }

            // 孤岛脚本：写好了、编得过，但场景里没有任何物体挂它。
            // 这种脚本在画面上原本会直接消失 —— 你看不见它们，也就不知道
            // 自己写了段死代码。单独给出来，前端会摆到空地上标红。
            var 孤岛们 = new List<object>();
            {
                var 已挂 = new HashSet<string>(StringComparer.Ordinal);
                foreach (var e in 边们.Where(e => e.种类 == "实例化")) 已挂.Add(e.到);
                var 序 = 0;
                var 孤岛列 = Math.Max(1, (int)Math.Ceiling(Math.Sqrt(Math.Max(1, 节点列表.Count(n => n.类型 == "脚本")))));
                foreach (var n in 节点列表.Where(n => n.类型 == "脚本").OrderBy(n => n.id, StringComparer.Ordinal))
                {
                    if (已挂.Contains(n.id)) continue;
                    var 短 = (n.短 ?? n.id);
                    短 = 短.Contains('.') ? 短.Split('.').Last() : 短;
                    // 摆在网格最后几列的右边，不跟实例框抢地方
                    孤岛们.Add(new
                    {
                        id = n.id,
                        名 = 短,
                        原因 = "场景里没有物体挂这个脚本",
                        // 网格排，不是一个接一个往下堆。
                        // 73 个脚本竖着排会拉成 13000 像素的一条线（实测），
                        // 屏幕上只看得见 9 个 —— 那等于没有图。
                        x = 90 + (序 % 孤岛列) * 格宽,
                        y = 130 + 逐行高.Sum() + 格缝 + (序 / 孤岛列) * 200,
                    });
                    序++;
                }
            }

            // 扫描出来的边里，指着的节点不在库里的，才是空头。
            // 主要来源是 Program.cs 那条 断|组件.字段（面板上槽是 None）。
            // ⚠️ 别把「到不了场景实例」当断链 —— 引擎组件（Rigidbody/Renderer…）本来就不建节点，
            //    实测 19 条里 18 条是这种假警报，红色一旦乱亮就不值钱了。
            foreach (var e in 边们)
            {
                if (节点们.ContainsKey(e.到)) continue;
                记空头(e.自, e.原文 ?? e.到, e.种类);
            }

            // 摆位：接在孤岛下面。孤岛占了几行，空头就往下让几行。
            var 孤岛列0 = Math.Max(1, (int)Math.Ceiling(Math.Sqrt(Math.Max(1, 节点列表.Count(n => n.类型 == "脚本")))));
            var 空头列 = Math.Max(1, (int)Math.Ceiling(Math.Sqrt(Math.Max(1, 空头们.Count))));
            var 空头起y = 130 + 逐行高.Sum() + 格缝
                        + (孤岛们.Count > 0 ? ((孤岛们.Count - 1) / 孤岛列0 + 1) * 200 : 0);
            var 空头出 = 空头们.Select((条, i) => new
            {
                条.id,
                条.自,
                条.组件,
                条.字段,
                条.种类,
                条.申诉,
                名 = 条.组件.Split('.').Last() + "." + 条.字段,
                x = 90 + (i % 空头列) * 格宽,
                y = 空头起y + (i / 空头列) * 150,
            }).ToArray();

            // 申诉成「它其实连到谁」的，接成一条线。
            // 用虚线画、跟扫描出来的线区分开：那些是扫出来的事实，这条是你说的。
            var 人线们 = new List<object>();
            foreach (var e in 边们)
            {
                var 口 = 断口(e.自, e.原文 ?? e.到, e.种类);
                if (!申诉.TryGetValue(口, out var 答)) continue;
                if (答.动作 != "连到" || string.IsNullOrEmpty(答.目标)) continue;
                人线们.Add(new { 自 = 落点(e.自), 到 = 答.目标, 说明 = e.原文 ?? "" });
            }

            // 大注释框：你按住右键在画布上拖出来的那块地方。存世界坐标，跟缩放无关。
            var 注释框们 = new List<object>();
            try
            {
                using var 命 = 连.CreateCommand();
                命.CommandText = "SELECT id, 标题, x, y, 宽, 高, 色, 收起, 父 FROM 注释框";
                using var 读 = 命.ExecuteReader();
                while (读.Read())
                    注释框们.Add(new
                    {
                        id = 读.GetString(0),
                        标题 = 读.IsDBNull(1) ? "" : 读.GetString(1),
                        x = 读.GetDouble(2), y = 读.GetDouble(3),
                        宽 = 读.GetDouble(4), 高 = 读.GetDouble(5),
                        色 = 读.IsDBNull(6) ? "" : 读.GetString(6),
                        收起 = 读.GetInt32(7) != 0,
                        // 父 = 上级框的 id；空 = 顶层。子框的 x/y 相对父框。
                        父 = 读.IsDBNull(8) ? "" : 读.GetString(8),
                    });
            }
            catch { /* 老库还没这张表 —— 当作一个框都没有 */ }

            return (new
            {
                实例们 = 实例们.ToArray(),
                空头们 = 空头出,
                孤岛们 = 孤岛们.ToArray(),
                线 = 线们.ToArray(),
                人线们 = 人线们.ToArray(),
                注释框们 = 注释框们.ToArray(),
                // 全量申诉，包括「隐藏」的 —— 那种连空头框都不出，图上没有地方撤销它。
                // 左栏要靠它列出来，不然误报一次就再也改不回来了。
                申诉们 = 申诉.Select(kv => new { id = kv.Key, 动作 = kv.Value.动作, 目标 = kv.Value.目标 })
                            .OrderBy(x => x.id, StringComparer.Ordinal).ToArray(),
            }, 实例们.Count);
        }

        private static int 组热度(string 物体id, Dictionary<string, int> 被引)
        {
            // 这个物体下所有组件的被引用次数之和
            var n = 0;
            foreach (var kv in 被引)
                if (kv.Key.StartsWith(物体id + ".", StringComparison.Ordinal)) n += kv.Value;
            return n;
        }

        // ── 断口 · 空头 ──────────────────────────────────────────
        //
        // 断口身份 = 组件 + 字段 + 种类。**故意不带行号** ——
        // 代码挪一行就换身份的话，你申诉过的「这个不用管」下次就不算数了。
        public static string 断口(string 自, string 字段, string 种类) => 自 + "|" + 字段 + "|" + 种类;

        public static Dictionary<string, (string 动作, string 目标)> 读申诉(SqliteConnection 连)
        {
            var 表 = new Dictionary<string, (string, string)>(StringComparer.Ordinal);
            try
            {
                using var 命 = 连.CreateCommand();
                命.CommandText = "SELECT id, 动作, 目标 FROM 申诉";
                using var 读 = 命.ExecuteReader();
                while (读.Read())
                    表[读.GetString(0)] = (读.GetString(1), 读.IsDBNull(2) ? null : 读.GetString(2));
            }
            catch { /* 老库还没建申诉表 —— 当作一条申诉都没有 */ }
            return 表;
        }

        // 关键一步：把「方法 → 类型」落到「组件 → 组件」。
        // 类型只是形状，数据活在挂在场景里那个组件身上。
        public static (object 图, int 物体数, int 线数) 组装图(SqliteConnection 连, string 项目名)
        {
            var (节点列表, 边们) = 读整库(连);
            var 节点们 = 节点列表.ToDictionary(n => n.id, StringComparer.Ordinal);
            var 出边 = 边们.ToLookup(e => e.自, StringComparer.Ordinal);
            var 入边 = 边们.ToLookup(e => e.到, StringComparer.Ordinal);

            // 类型 → 场上的实例（只要场景树里的；预制体里的模板不在场上）
            var 实例 = new Dictionary<string, List<string>>(StringComparer.Ordinal);
            foreach (var e in 边们.Where(e => e.种类 == "实例化"))
            {
                if (!e.自.StartsWith(场景树, StringComparison.Ordinal)) continue;
                var 类型 = e.到.Substring(e.到.IndexOf('|') + 1);
                if (!实例.TryGetValue(类型, out var 列)) { 列 = new List<string>(); 实例[类型] = 列; }
                if (!列.Contains(e.自)) 列.Add(e.自);
            }

            var 图线 = new List<object>();
            var 线键 = new HashSet<string>(StringComparer.Ordinal);

            void 加线(string a, string b, string 种类, string 条件)
            {
                if (a == b) return;
                if (!线键.Add(a + "\u0001" + b + "\u0001" + 种类)) return;
                图线.Add(new { 自 = a, 到 = b, 种类, 条件 });
            }

            var 物体们 = new List<object>();
            var 组节点 = 节点列表
                .Where(n => n.类型 == "组件" && n.树 == "场景")
                .OrderBy(n => n.id, StringComparer.Ordinal);

            foreach (var 组 in 组节点.GroupBy(n => n.父 ?? "").OrderBy(g => g.Key, StringComparer.Ordinal))
            {
                var 物体 = 组.Key.Length > 0 && 节点们.TryGetValue(组.Key, out var o) ? o : null;
                var 短名 = 物体?.短 ?? 组.Key.Substring(Math.Max(0, 组.Key.IndexOf('|') + 1));
                var tag = "";
                if (物体?.附加 != null)
                {
                    try
                    {
                        using var 档 = JsonDocument.Parse(物体.附加);
                        if (档.RootElement.TryGetProperty("tag", out var t) && t.ValueKind == JsonValueKind.String)
                            tag = t.GetString() ?? "";
                    }
                    catch { }
                }

                var 组件们 = new List<object>();
                var 同名计 = new Dictionary<string, int>(StringComparer.Ordinal);

                foreach (var 组n in 组)
                {
                    // 同一物体上挂了两个同名脚本（enemy 就有两个 EnemyHp），框上要分得开
                    同名计.TryGetValue(组n.名字, out var 第几个);
                    同名计[组n.名字] = 第几个 + 1;
                    var 显示名 = 组n.名字 + (第几个 > 0 ? $"[{第几个 + 1}]" : "");

                    var 槽 = 读槽(组n.附加);
                    var 脚本id = 出边[组n.id].FirstOrDefault(e => e.种类 == "实例化")?.到;
                    var 入口 = new List<object>();
                    var 出口 = new List<object>();
                    var 入口键 = new HashSet<string>(StringComparer.Ordinal);
                    var 出口键 = new HashSet<string>(StringComparer.Ordinal);

                    // 面板上连的引用，直接是 组件 → 组件
                    foreach (var e in 出边[组n.id].Where(e => e.种类 == "引用"))
                        加线(组n.id, e.到, e.种类, e.原文);

                    if (脚本id != null)
                    {
                        var 方法们 = 节点列表
                            .Where(n => n.类型 == "方法" && n.父 == 脚本id)
                            .OrderBy(n => n.名字, StringComparer.Ordinal);

                        foreach (var 法 in 方法们)
                        {
                            // ◀ 入口：谁调了我
                            var 来 = 入边[法.id]
                                .Where(e => e.种类 == "调用")
                                .Select(e =>
                                {
                                    var 调用者 = 方法归属组件(e.自, 节点列表, 出边);
                                    if (调用者 != null && 节点们.TryGetValue(调用者, out var cn))
                                        return cn.短.Split('.').Last();
                                    return e.自.Substring(e.自.IndexOf('|') + 1);
                                })
                                .Distinct().ToList();

                            if (来.Count > 0 && 入口键.Add(法.名字 + "\u0001" + string.Join("、", 来)))
                                入口.Add(new { 方法 = 法.名字, 来自 = 来.ToArray() });

                            // ▶ 出口：我伸到哪去
                            foreach (var e in 出边[法.id])
                            {
                                if (e.种类 == "引用")
                                {
                                    var 类型 = e.到.Substring(e.到.IndexOf('|') + 1);
                                    var 落了 = 实例.TryGetValue(类型, out var 那列) && 那列.Count > 0;
                                    if (落了) foreach (var 目标 in 那列) 加线(组n.id, 目标, e.种类, e.原文);

                                    if (出口键.Add(法.名字 + "\u0001" + 类型 + "\u0001" + (落了 ? "有" : "无")))
                                        出口.Add(new { 方法 = 法.名字, 到 = 类型 + (落了 ? "" : "（没实例）"),
                                                      条件 = e.原文, 种类 = e.种类 });
                                }
                                else if (e.种类 == "调用")
                                {
                                    var 目标方法 = e.到.Substring(e.到.IndexOf('|') + 1);
                                    var 目标类 = 目标方法.Contains('.')
                                        ? 目标方法.Substring(0, 目标方法.IndexOf('.')) : 目标方法;
                                    var 落了 = 实例.TryGetValue(目标类, out var 那列) && 那列.Count > 0;
                                    if (落了) foreach (var 目标 in 那列) 加线(组n.id, 目标, "调用", e.原文);

                                    if (出口键.Add(法.名字 + "\u0001" + 目标方法 + "\u0001" + (落了 ? "有" : "无")))
                                        出口.Add(new { 方法 = 法.名字, 到 = 目标方法 + (落了 ? "" : "（没实例）"),
                                                      条件 = e.原文, 种类 = "调用" });
                                }
                                else
                                {
                                    var 类型 = e.到.Substring(e.到.IndexOf('|') + 1);
                                    if (出口键.Add(法.名字 + "\u0001" + 类型 + "\u0001" + e.种类))
                                        出口.Add(new { 方法 = 法.名字, 到 = 类型, 条件 = e.原文, 种类 = e.种类 });
                                }
                            }
                        }
                    }

                    组件们.Add(new
                    {
                        id = 组n.id,
                        名字 = 显示名,
                        槽 = 槽.Select(kv => new[] { kv.Key, kv.Value }).ToArray(),
                        入口 = 入口.ToArray(),
                        出口 = 出口.ToArray(),
                    });
                }

                物体们.Add(new
                {
                    id = 组.Key,
                    名字 = 短名.Contains('.') ? 短名.Split('.').Last() : 短名,
                    tag,
                    组件 = 组件们.ToArray(),
                });
            }

            return (new { 标题 = 项目名, 物体 = 物体们.ToArray(), 线 = 图线.ToArray() },
                    物体们.Count, 图线.Count);
        }

        // 方法 id（代码|HpBar.Start）→ 它挂在哪个组件上
        public static string 方法归属组件(string 方法id, List<节点行> 节点们,
                                           ILookup<string, 边行> 出边)
        {
            var 类名 = 方法id.Substring(方法id.IndexOf('|') + 1);
            var 点 = 类名.IndexOf('.');
            if (点 > 0) 类名 = 类名.Substring(0, 点);
            var 类id = 代码树 + 类名;

            foreach (var n in 节点们)
                if (n.类型 == "组件" && n.树 == "场景")
                    if (出边[n.id].Any(e => e.种类 == "实例化" && e.到 == 类id))
                        return n.id;
            return null;
        }

        public static Dictionary<string, string> 读槽(string 附加)
        {
            var 表 = new Dictionary<string, string>(StringComparer.Ordinal);
            if (string.IsNullOrEmpty(附加)) return 表;
            try
            {
                using var 档 = JsonDocument.Parse(附加);
                if (档.RootElement.ValueKind != JsonValueKind.Object) return 表;
                foreach (var kv in 档.RootElement.EnumerateObject())
                    表[kv.Name] = kv.Value.ValueKind == JsonValueKind.String
                        ? kv.Value.GetString() : kv.Value.ToString();
            }
            catch { }
            return 表;
        }

        public static string 转JSON(object 图) =>
            JsonSerializer.Serialize(图, new JsonSerializerOptions
            {
                WriteIndented = false,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            });
    }
}
