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

            var 实例们 = new List<object>();
            var 组节点 = 节点列表
                .Where(n => n.类型 == "组件" && n.树 == "场景")
                .OrderBy(n => n.id, StringComparer.Ordinal);

            // 被引用得越多越靠中间
            var 被引 = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var e in 边们) 被引[e.到] = 被引.TryGetValue(e.到, out var v) ? v + 1 : 1;
            var 按物 = 组节点.GroupBy(n => n.父 ?? "").ToList();
            按物.Sort((a, b) => 组热度(b.Key, 被引).CompareTo(组热度(a.Key, 被引)));

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

                // 摆位：第一个放原点，其余按黄金角螺旋铺开
                double x = 90, y = 130;
                if (序号 > 0)
                {
                    var 圈 = Math.Ceiling(Math.Sqrt(序号));
                    var 角 = 序号 * 2.399963;
                    var 半径 = 圈 * 430;
                    x = Math.Round(90 + Math.Cos(角) * 半径);
                    y = Math.Round(130 + Math.Sin(角) * 半径);
                }
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
                                var 到 = e.到.Substring(e.到.IndexOf('|') + 1);
                                出口们.Add(new { 名 = 法.名字, 行 = "", 到, 条件 = e.原文 ?? "" });
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

            return (new
            {
                实例们 = 实例们.ToArray(),
                空头们 = Array.Empty<object>(),
                线 = 线们.ToArray(),
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
