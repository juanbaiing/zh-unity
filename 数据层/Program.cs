// 数据层：建库、灌数据、查。
//
// 用法：
//   数据层 <项目根>              建库 + 报表
//   数据层 <项目根> 灌            建库 + 把两份 json 灌进去
//   数据层 <项目根> 查 "<SQL>"    直接查（写错会被打回来，不吞）
//
// 库落在 <项目根>\.zh-bridge\关系.db
// 数据来源：关系.json（Unity 扫出来的场景）+ 代码.json（Roslyn 扫出来的调用）
// 重灌不会动人工边和布局 —— 那是你说的东西，不是扫出来的东西。

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace 数据层
{
    internal static class 入口
    {
        // 身份证前缀。场景名和类名可能重名 —— 有个场景叫 Enemy、同时有个类叫 Enemy，
        // 一点都不奇怪。前缀只在库里用，显示时切掉。
        private const string 场景树 = "场景|";
        private const string 预制体树 = "预制体|";
        private const string 代码树 = "代码|";
        private const string 内置树 = "内置|";
        // 空头身份：边的「到」用这个前缀，就永远进不了节点表 ——
        // 组装画布靠「到不在节点表里」认出它是个断口，而不是新编一个记号。
        private const string 断头前缀 = "断|";

        private static int Main(string[] 参数)
        {
            if (参数.Length < 1)
            {
                Console.Error.WriteLine("用法：数据层 <项目根> [灌 | 查 <SQL>]");
                return 2;
            }

            var 根 = 参数[0];
            var 命令 = 参数.Length > 1 ? 参数[1] : "";
            var 目录 = Path.Combine(根, ".zh-bridge");
            var 库路径 = Path.Combine(目录, "关系.db");

            try
            {
                Directory.CreateDirectory(目录);
                using var 连 = new SqliteConnection($"Data Source={库路径};Mode=ReadWriteCreate");
                连.Open();
                准备(连);

                switch (命令)
                {
                    case "灌":
                        灌数据(连, 目录);
                        报表(连);
                        break;
                    case "看":
                        看实例(连);
                        break;
                    case "图":
                        导出图(连, 根, 参数.Length > 2 ? 参数[2] : null);
                        break;
                    case "查":
                        if (参数.Length < 3) { Console.Error.WriteLine("查什么？"); return 2; }
                        return 查询(连, 参数[2]);
                    default:
                        Console.WriteLine($"库：{库路径}");
                        报表(连);
                        break;
                }
            }
            catch (Exception 错)
            {
                // 不静默
                Console.Error.WriteLine("出错：" + 错.Message);
                return 1;
            }
            return 0;
        }

        // ══════════ 建表 ══════════

        private static void 准备(SqliteConnection 连)
        {
            var schema = 读Schema();
            foreach (var 条 in 切语句(schema))
            {
                using var 命 = 连.CreateCommand();
                命.CommandText = 条;
                命.ExecuteNonQuery();
            }
            补列(连, "注释框", "父", "TEXT");
            写元信息(连, "建库时间", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
        }

        // CREATE TABLE IF NOT EXISTS 不会给**已经存在**的表加列 ——
        // 老库里的 注释框 表没有 父 这一列，光改 schema.sql 是没用的。
        // 这里按 PRAGMA table_info 查一遍，缺了才 ALTER。
        //
        // 为什么不用「试一次 ALTER，失败就吞掉」：那样分不清
        // 「列已经有了」和「表根本没有 / 权限不对」，属于静默掩盖。
        private static void 补列(SqliteConnection 连, string 表, string 列, string 类型)
        {
            using (var 查 = 连.CreateCommand())
            {
                查.CommandText = $"PRAGMA table_info({表})";
                using var 读 = 查.ExecuteReader();
                while (读.Read())
                {
                    // 第 2 列（index 1）是列名
                    if (!读.IsDBNull(1) && 读.GetString(1).Equals(列, StringComparison.Ordinal)) return;
                    if (!读.IsDBNull(1) && 读.GetString(1).Equals(列, StringComparison.OrdinalIgnoreCase)) return;
                }
            }
            using var 改 = 连.CreateCommand();
            改.CommandText = $"ALTER TABLE {表} ADD COLUMN {列} {类型}";
            改.ExecuteNonQuery();
            Console.WriteLine($"补列：{表}.{列} {类型}");
        }

        private static IEnumerable<string> 切语句(string sql)
        {
            var 当前 = new StringBuilder();
            foreach (var c in sql)
            {
                if (c == ';')
                {
                    var t = 当前.ToString().Trim();
                    if (t.Length > 0) yield return t;
                    当前.Clear();
                }
                else 当前.Append(c);
            }
            var 尾 = 当前.ToString().Trim();
            if (尾.Length > 0) yield return 尾;
        }

        private static string 读Schema()
        {
            var 候选 = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "schema.sql"),
                Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "schema.sql"),
            };
            foreach (var 路 in 候选)
                if (File.Exists(路)) return File.ReadAllText(路);

            var 资源 = typeof(入口).Assembly.GetManifestResourceStream("schema.sql");
            if (资源 != null)
                using (var 读 = new StreamReader(资源, Encoding.UTF8))
                    return 读.ReadToEnd();

            throw new FileNotFoundException("找不到 schema.sql");
        }

        private static void 写元信息(SqliteConnection 连, string 键, string 值)
        {
            using var 命 = 连.CreateCommand();
            命.CommandText = "INSERT INTO 元信息(键, 值) VALUES($k, $v) " +
                             "ON CONFLICT(键) DO UPDATE SET 值 = $v";
            命.Parameters.AddWithValue("$k", 键);
            命.Parameters.AddWithValue("$v", 值);
            命.ExecuteNonQuery();
        }

        // ══════════ 灌数据 ══════════

        private static void 灌数据(SqliteConnection 连, string 目录)
        {
            var 关系路 = Path.Combine(目录, "关系.json");
            var 代码路 = Path.Combine(目录, "代码.json");

            if (!File.Exists(关系路) && !File.Exists(代码路))
                throw new FileNotFoundException("两份 json 都不在，先跑 Unity 插件和源码扫描。");

            using var 务 = 连.BeginTransaction();

            // 只清扫描出来的东西。人工边和布局是你的，不能碰。
            using (var 命 = 连.CreateCommand())
            {
                命.Transaction = 务;
                命.CommandText = "DELETE FROM 边 WHERE 来源 = '扫描'";
                命.ExecuteNonQuery();
            }
            // 节点全部重建；人工边如果指着旧 id，下面会报断头
            using (var 命 = 连.CreateCommand())
            {
                命.Transaction = 务;
                命.CommandText = "DELETE FROM 节点";
                命.ExecuteNonQuery();
            }

            var 计 = new 计数();
            var 有 = 0;
            var 脚本表 = new HashSet<string>(StringComparer.Ordinal);

            // 先代码后场景：场景里的引用要判断「指向的是用户脚本还是引擎组件」，
            // 而那要先知道有哪些脚本。
            if (File.Exists(代码路)) { 灌代码(连, 务, 代码路, 计, 脚本表); 有++; }
            else Console.Error.WriteLine("⚠ 没有 代码.json —— 调用那一半是空的");

            if (File.Exists(关系路)) { 灌场景(连, 务, 关系路, 计, 脚本表); 有++; }
            else Console.Error.WriteLine("⚠ 没有 关系.json —— 场景那一半是空的");

            写元信息(连, "灌数据时间", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            务.Commit();

            Console.WriteLine($"灌完：{有} 份 json");
            Console.WriteLine($"  节点 {计.节点}（新增 {计.新节点}，撞名加序号 {计.撞名}）");
            Console.WriteLine($"  边   {计.边}");
        }

        private sealed class 计数
        {
            public int 节点;
            public int 新节点;
            public int 撞名;
            public int 边;
            public readonly List<string> 断头清单 = new List<string>();
        }

        // ── 场景 / 预制体 ─────────────────────────────
        private static void 灌场景(SqliteConnection 连, SqliteTransaction 务, string 路, 计数 计,
                                    HashSet<string> 脚本表)
        {
            using var 档 = JsonDocument.Parse(File.ReadAllText(路));
            if (!档.RootElement.TryGetProperty("物体", out var 物体们)) return;

            foreach (var 物 in 物体们.EnumerateArray())
            {
                var 文件 = 取串(物, "文件") ?? "";
                var 是预制体 = 文件.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase);
                var 树名 = 是预制体 ? 预制体树 : 场景树;
                var 根名 = Path.GetFileNameWithoutExtension(文件);
                if (string.IsNullOrEmpty(根名)) 根名 = 取串(物, "名") ?? "?";

                // 根（场景或预制体本身）
                var 根id = 树名 + 根名;
                插节点(连, 务, 计, 根id, 是预制体 ? "预制体" : "场景", 根名, null, 文件, null);

                var 路径 = (取串(物, "路径") ?? "").Replace('/', '.');
                var 物id = 根id + (路径.Length > 0 ? "." + 路径 : "");
                插节点(连, 务, 计, 物id, "物体", 取串(物, "名") ?? "", 根id, 文件,
                        "{\"tag\":" + 引(取串(物, "tag")) + "}");

                if (!物.TryGetProperty("组件", out var 组件们)) continue;

                var 同名计 = new Dictionary<string, int>(StringComparer.Ordinal);
                foreach (var 件 in 组件们.EnumerateArray())
                {
                    var 脚本名 = 取串(件, "脚本") ?? "?";
                    同名计.TryGetValue(脚本名, out var 第几个);
                    同名计[脚本名] = 第几个 + 1;
                    if (第几个 > 0) 计.撞名++;

                    var 组件id = 物id + "." + 脚本名 + (第几个 > 0 ? $"[{第几个 + 1}]" : "");
                    // 面板里填的值存进附加 —— 这就是设计稿上的「数据槽」
                    var 槽 = "{}";
                    if (件.TryGetProperty("字段", out var 字段们) &&
                        字段们.ValueKind == JsonValueKind.Object)
                        槽 = 字段们.GetRawText();
                    插节点(连, 务, 计, 组件id, "组件", 脚本名, 物id, 文件, 槽);

                    // 组件是这个类的一个实例
                    插边(连, 务, 计, 组件id, 代码树 + 脚本名, "实例化", "扫描", null, null);

                    // 面板里连的引用
                    if (件.TryGetProperty("引用", out var 引用们) &&
                        引用们.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var r in 引用们.EnumerateObject())
                        {
                            var 目标 = r.Value.GetString() ?? "";
                            // 空引用：Unity 面板上那个槽是 None。
                            //
                            // 以前这里是 `continue` —— 注释写着「但记着」，其实什么也没记。
                            // 结果最要命的那种 bug 在图上完全隐形：预制体上的脚本被删掉，
                            // 引用变成 None，不报错、不打日志，跑起来功能集体失效，
                            // 人只能靠"逐一比对历史版本"才发现（痛点调研 §1.1）。
                            //
                            // 现在留一条到不了任何节点的边，身份是 断|组件.字段。
                            // 它进不了节点表，所以组装画布时会被当成"空头"画出来。
                            var 到id = 目标.Length > 0
                                ? 解析引用(目标, 树名, 根名, 脚本表)
                                : 断头前缀 + 组件id + "." + r.Name;
                            插边(连, 务, 计, 组件id, 到id, "引用", "扫描", null, r.Name);
                        }
                    }
                }
            }
        }

        // 「SampleScene:Cube#Transform」这种写法翻译成身份证。
        //
        // # 后面是用户脚本 → 停在组件上（Cube 身上的 GameData 是真实节点）。
        // # 后面是引擎组件（Transform / Rigidbody…）→ 落到物体本身，因为那类组件不建节点，
        //   硬指着就会悬空。模型追的是 Cube，不是 Cube 的 Transform。
        private static string 解析引用(string 目标, string 当前树, string 当前根,
                                        HashSet<string> 脚本表)
        {
            // 资产路径：Assets/Prefabs/enemy.prefab
            if (目标.StartsWith("Assets/", StringComparison.Ordinal))
            {
                var 名 = Path.GetFileNameWithoutExtension(目标);
                return (目标.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase) ? 预制体树 : 场景树) + 名;
            }

            var 场 = "";
            var 体 = 目标;
            var 冒 = 目标.IndexOf(':');
            if (冒 > 0) { 场 = 目标.Substring(0, 冒); 体 = 目标.Substring(冒 + 1); }

            string 组件名 = null;
            var 井 = 体.IndexOf('#');
            if (井 > 0)
            {
                var 名 = 体.Substring(井 + 1);
                if (脚本表.Contains(名)) 组件名 = 名;
                else if (!string.IsNullOrEmpty(名) && 名 != "Transform") 计数_引擎组件++;
                体 = 体.Substring(0, 井);
            }

            var 树 = 场.Length > 0 ? 场景树 : 当前树;
            var 根 = 场.Length > 0 ? 场 : 当前根;
            var id = 树 + 根 + (体.Length > 0 ? "." + 体.Replace('/', '.') : "");
            return 组件名 != null ? id + "." + 组件名 : id;
        }

        // 只是给报表看的，不用精确
        private static int 计数_引擎组件;

        // ── 代码 ──────────────────────────────────────
        private static void 灌代码(SqliteConnection 连, SqliteTransaction 务, string 路, 计数 计,
                                    HashSet<string> 脚本表)
        {
            using var 档 = JsonDocument.Parse(File.ReadAllText(路));

            if (档.RootElement.TryGetProperty("脚本", out var 脚本们))
            {
                foreach (var 本 in 脚本们.EnumerateArray())
                {
                    var 类 = 取串(本, "类");
                    if (string.IsNullOrEmpty(类)) continue;
                    脚本表.Add(类);

                    var 文件 = 取串(本, "文件");
                    var 类id = 代码树 + 类;
                    插节点(连, 务, 计, 类id, "脚本", 类, null, 文件,
                            "{\"基类\":" + 引(取串(本, "基类")) + "}");

                    if (!本.TryGetProperty("方法", out var 方法们)) continue;
                    foreach (var 法 in 方法们.EnumerateArray())
                    {
                        var 名 = 取串(法, "名");
                        if (string.IsNullOrEmpty(名)) continue;
                        var 生命 = false;
                        if (法.TryGetProperty("生命周期", out var 命) && 命.ValueKind == JsonValueKind.True) 生命 = true;

                        插节点(连, 务, 计, 类id + "." + 名, "方法", 名, 类id, 文件,
                                "{\"行\":" + 取数(法, "行") + ",\"生命周期\":" + (生命 ? "true" : "false") + "}");
                    }
                }
            }

            if (!档.RootElement.TryGetProperty("依赖", out var 依赖们)) return;

            // 边记录的 `自` 只有类名，要补上方法名才是方法的身份证
            foreach (var 依 in 依赖们.EnumerateArray())
            {
                var 自 = 取串(依, "自") ?? "";
                var 到 = 取串(依, "到") ?? "";
                if (自.Length == 0 || 到.Length == 0) continue;

                var 自方法 = 取串(依, "自方法");
                var 自id = 代码树 + 自 + (string.IsNullOrEmpty(自方法) ? "" : "." + 自方法);
                var 方式 = 取串(依, "方式") ?? "字段";

                string 到id;
                string 种类;
                if (方式 == "调用")
                {
                    // 调用边的「到」直接就是方法身份证（EnemyHp.TakeDamage），不用再猜类型
                    到id = 代码树 + 到;
                    种类 = "调用";
                }
                else
                {
                    到id = 脚本表.Contains(到) ? 代码树 + 到 : 内置树 + 到;

                    // 内置类型也要有节点，否则边指空
                    if (!脚本表.Contains(到))
                        插节点(连, 务, 计, 到id, "内置", 到, null, null, null);

                    种类 = 方式.StartsWith("GetComponent", StringComparison.Ordinal) ? "取组件"
                         : 方式.StartsWith("Find", StringComparison.Ordinal) ? "查找"
                         : 方式.StartsWith("AddComponent", StringComparison.Ordinal) ? "取组件"
                         : "引用";
                }

                插边(连, 务, 计, 自id, 到id, 种类, "扫描", 取数(依, "行"), 取串(依, "原文"));
            }
        }

        // ══════════ 写入 ══════════

        private static void 插节点(SqliteConnection 连, SqliteTransaction 务, 计数 计,
                                    string id, string 类型, string 名, string 父, string 文件, string 附加)
        {
            using var 命 = 连.CreateCommand();
            命.Transaction = 务;
            // 同名节点可能被同一次扫描里多处提到，重复就跳过，不报错
            命.CommandText = "INSERT INTO 节点(id, 树, 类型, 名字, 父, 文件, 附加) " +
                             "VALUES($id, $树, $类型, $名, $父, $文件, $附加) " +
                             "ON CONFLICT(id) DO NOTHING";
            命.Parameters.AddWithValue("$id", id);
            命.Parameters.AddWithValue("$树", id.Substring(0, id.IndexOf('|')));
            命.Parameters.AddWithValue("$类型", 类型);
            命.Parameters.AddWithValue("$名", 名);
            命.Parameters.AddWithValue("$父", (object)父 ?? DBNull.Value);
            命.Parameters.AddWithValue("$文件", (object)文件 ?? DBNull.Value);
            命.Parameters.AddWithValue("$附加", (object)附加 ?? DBNull.Value);

            var 动 = 命.ExecuteNonQuery();
            计.节点++;
            if (动 > 0) 计.新节点++;
        }

        private static void 插边(SqliteConnection 连, SqliteTransaction 务, 计数 计,
                                  string 自, string 到, string 种类, string 来源, long? 行, string 原文)
        {
            using var 命 = 连.CreateCommand();
            命.Transaction = 务;
            命.CommandText = "INSERT INTO 边(自, 到, 种类, 来源, 行, 原文) " +
                             "VALUES($自, $到, $种类, $来源, $行, $原文) " +
                             "ON CONFLICT(自, 到, 种类, 来源) DO NOTHING";
            命.Parameters.AddWithValue("$自", 自);
            命.Parameters.AddWithValue("$到", 到);
            命.Parameters.AddWithValue("$种类", 种类);
            命.Parameters.AddWithValue("$来源", 来源);
            命.Parameters.AddWithValue("$行", 行.HasValue ? 行.Value : DBNull.Value);
            命.Parameters.AddWithValue("$原文", (object)原文 ?? DBNull.Value);

            var 动 = 命.ExecuteNonQuery();
            if (动 > 0) 计.边++;
        }

        // ══════════ 查询 ══════════

        private static int 查询(SqliteConnection 连, string sql)
        {
            using var 命 = 连.CreateCommand();
            命.CommandText = sql;
            using var 读 = 命.ExecuteReader();

            var 列数 = 读.FieldCount;
            var 头 = new string[列数];
            for (var i = 0; i < 列数; i++) 头[i] = 读.GetName(i);

            var 行们 = new List<string[]>();
            while (读.Read())
            {
                var 值 = new string[列数];
                for (var i = 0; i < 列数; i++)
                    值[i] = 读.IsDBNull(i) ? "" : 读.GetValue(i)?.ToString() ?? "";
                行们.Add(值);
            }

            // 简单对齐
            var 宽 = new int[列数];
            for (var i = 0; i < 列数; i++)
            {
                宽[i] = 头[i].Length;
                foreach (var 行 in 行们)
                    宽[i] = Math.Max(宽[i], 取显示宽(行[i]));
            }

            Console.WriteLine(拼行(头, 宽));
            Console.WriteLine(string.Join("  ", Array.ConvertAll(宽, w => new string('─', w))));
            foreach (var 行 in 行们)
                Console.WriteLine(拼行(行, 宽));

            Console.WriteLine($"\n{行们.Count} 行");
            return 0;
        }

        private static string 拼行(string[] 列, int[] 宽)
        {
            var b = new StringBuilder();
            for (var i = 0; i < 列.Length; i++)
            {
                if (i > 0) b.Append("  ");
                b.Append(列[i]);
                var 差 = 宽[i] - 取显示宽(列[i]);
                if (差 > 0) b.Append(' ', 差);
            }
            return b.ToString();
        }

        // 中文占两个字符宽 —— 不然表格是斜的
        private static int 取显示宽(string s)
        {
            var 宽 = 0;
            foreach (var c in s) 宽 += c > 0x2E80 ? 2 : 1;
            return 宽;
        }

        // ══════════ 看实例 ══════════
        // 按设计稿的摆法：实例框里是脚本框，脚本框里是数据槽 + 入口（◀）+ 出口（▶）。
        // 这块不查 SQL，整张图读进内存再组织 —— 几十条边，怎么算都比 JOIN 快。

        private sealed class 节点行
        {
            public string id, 树, 类型, 名字, 父, 附加;
            public string 短;
        }

        private sealed class 边行
        {
            public string 自, 到, 种类, 原文;
            public long? 行;
        }

        private static void 看实例(SqliteConnection 连)
        {
            var 节点们 = new Dictionary<string, 节点行>(StringComparer.Ordinal);
            using (var 命 = 连.CreateCommand())
            {
                命.CommandText = "SELECT id, 树, 类型, 名字, 父, 附加 FROM 节点";
                using var 读 = 命.ExecuteReader();
                while (读.Read())
                {
                    var n = new 节点行
                    {
                        id = 读.GetString(0),
                        树 = 读.GetString(1),
                        类型 = 读.GetString(2),
                        名字 = 读.GetString(3),
                        父 = 读.IsDBNull(4) ? null : 读.GetString(4),
                        附加 = 读.IsDBNull(5) ? null : 读.GetString(5),
                    };
                    n.短 = n.id.Substring(n.id.IndexOf('|') + 1);
                    节点们[n.id] = n;
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
                        自 = 读.GetString(0),
                        到 = 读.GetString(1),
                        种类 = 读.GetString(2),
                        行 = 读.IsDBNull(3) ? null : 读.GetInt64(3),
                        原文 = 读.IsDBNull(4) ? null : 读.GetString(4),
                    });
            }

            边们.Sort((a, b) =>
            {
                var c = string.CompareOrdinal(a.自, b.自);
                return c != 0 ? c : string.CompareOrdinal(a.到, b.到);
            });

            var 出边 = 边们.ToLookup(e => e.自, StringComparer.Ordinal);
            var 入边 = 边们.ToLookup(e => e.到, StringComparer.Ordinal);

            string 短id(string id) => id == null ? "?" :
                节点们.TryGetValue(id, out var n) ? n.短 : id.Substring(id.IndexOf('|') + 1) + "（不在库里）";

            var 组件们 = 节点们.Values
                .Where(n => n.类型 == "组件")
                .OrderBy(n => n.id, StringComparer.Ordinal)
                .ToList();

            foreach (var 组 in 组件们)
            {
                var 层 = 组.短.Split('.').Length;
                var 缩 = new string(' ', Math.Max(0, (层 - 2) * 2));

                var 槽 = 读槽(组.附加);
                Console.WriteLine($"{缩}▣ {组.短}    {槽}");

                // 实例化边：它是哪个类的实例
                var 脚本id = 出边[组.id].FirstOrDefault(e => e.种类 == "实例化")?.到;
                if (脚本id == null)
                {
                    Console.WriteLine($"{缩}   ⚠ 没有实例化边 —— 不知道它是哪个脚本");
                    continue;
                }

                // 面板里连的引用
                foreach (var e in 出边[组.id].Where(e => e.种类 != "实例化"))
                    Console.WriteLine($"{缩}   · {e.原文 ?? "?"}  →  {短id(e.到)}   [{e.种类}]");

                var 方法们 = 节点们.Values
                    .Where(n => n.类型 == "方法" && n.父 == 脚本id)
                    .OrderBy(n => n.名字, StringComparer.Ordinal);

                foreach (var 法 in 方法们)
                {
                    var 进 = 入边[法.id].Where(e => e.种类 == "调用").ToList();
                    var 出 = 出边[法.id].ToList();
                    if (进.Count == 0 && 出.Count == 0) continue;

                    var 生命 = 法.附加 != null && 法.附加.Contains("\"生命周期\":true");
                    var 头 = 生命 ? "⚙" : (进.Count > 0 ? "◀" : "·");
                    Console.WriteLine($"{缩}   {头} {法.名字}");

                    foreach (var e in 进)
                        Console.WriteLine($"{缩}       ◀ 被调用：{短id(e.自)}   L{e.行}");
                    foreach (var e in 出)
                        Console.WriteLine($"{缩}       ▶ {e.种类}：{短id(e.到)}   L{e.行}   {e.原文}");
                }
            }

            // 场景里没有的脚本（写了但没挂）
            var 用到的脚本 = 边们.Where(e => e.种类 == "实例化").Select(e => e.到)
                                 .ToHashSet(StringComparer.Ordinal);
            var 没挂 = 节点们.Values
                .Where(n => n.类型 == "脚本" && !用到的脚本.Contains(n.id))
                .OrderBy(n => n.id, StringComparer.Ordinal)
                .ToList();

            if (没挂.Count > 0)
            {
                Console.WriteLine();
                Console.WriteLine("── 写了但场景里没挂的脚本 ──");
                foreach (var n in 没挂) Console.WriteLine($"  {n.短}   {n.父}");
                Console.WriteLine("（这些进不了实例图 —— 没有实例可挂）");
            }
        }

        private static string 读槽(string 附加)
        {
            if (string.IsNullOrEmpty(附加) || 附加 == "{}") return "";
            try
            {
                using var 档 = JsonDocument.Parse(附加);
                var 部 = new List<string>();
                foreach (var kv in 档.RootElement.EnumerateObject())
                    部.Add($"{kv.Name}={kv.Value.GetString()}");
                return 部.Count > 0 ? string.Join("  ", 部) : "";
            }
            catch { return 附加; }
        }

        // ══════════ 报表 ══════════

        private static void 报表(SqliteConnection 连)
        {
            Console.WriteLine();
            foreach (var (标题, sql) in new[]
            {
                ("按树和类型", "SELECT 树, 类型, count(*) AS 个数 FROM 节点 GROUP BY 树, 类型 ORDER BY 树, 个数 DESC"),
                ("边的种类",   "SELECT 种类, 来源, count(*) AS 个数 FROM 边 GROUP BY 种类, 来源 ORDER BY 个数 DESC"),
            })
            {
                Console.WriteLine($"── {标题} ──");
                查询(连, sql);
                Console.WriteLine();
            }

            // 断头：边指着的节点不在库里
            var 断 = new List<string>();
            using (var 命 = 连.CreateCommand())
            {
                命.CommandText =
                    "SELECT 边.自, 边.到, 边.种类 FROM 边 " +
                    "LEFT JOIN 节点 a ON 边.自 = a.id LEFT JOIN 节点 b ON 边.到 = b.id " +
                    "WHERE a.id IS NULL OR b.id IS NULL LIMIT 20";
                using var 读 = 命.ExecuteReader();
                while (读.Read())
                    断.Add($"{读.GetString(0)} --[{读.GetString(2)}]--> {读.GetString(1)}");
            }

            if (断.Count > 0)
            {
                Console.WriteLine("── ⚠ 断头的边（指着的节点不存在）──");
                foreach (var 行 in 断) Console.WriteLine("  " + 行);
                Console.WriteLine();
            }
            else Console.WriteLine("── 没有断头的边 ──\n");
        }

        // ══════════ 导出图 ══════════
        // 模板就是 unity-graph-lab/实例图.html 那个实验稿（去掉假数据换成 __数据__）。
        // 布局、切档、收起、窗户全是它自己的 —— 这边只喂数据，不重新发明。

        private static void 导出图(SqliteConnection 连, string 根, string 另存)
        {
            var (场景, 实例数) = 图数据.组装.组装画布(连, Path.GetFileName(根));
            var json = 图数据.组装.转JSON(场景);

            var 模板 = 读模板();
            var html = 模板.Replace("__数据__", json).Replace("__标题__", Path.GetFileName(根));

            var 输出 = 另存 ?? Path.Combine(Path.Combine(根, ".zh-bridge"), "关系图.html");
            Directory.CreateDirectory(Path.GetDirectoryName(输出));
            File.WriteAllText(输出, html, new UTF8Encoding(false));

            Console.WriteLine($"图已导出：{实例数} 个实例");
            Console.WriteLine($"  → {输出}");
        }

        private static string 读模板()
        {
            var 候选 = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "图模板.html"),
                Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "图模板.html"),
            };
            foreach (var 路 in 候选)
                if (File.Exists(路)) return File.ReadAllText(路);

            var 资源 = typeof(入口).Assembly.GetManifestResourceStream("图模板.html");
            if (资源 != null)
                using (var 读 = new StreamReader(资源, Encoding.UTF8))
                    return 读.ReadToEnd();

            throw new FileNotFoundException("找不到 图模板.html");
        }

        // ══════════ JSON 小工具 ══════════

        private static string 取串(JsonElement 节点, string 名)
            => 节点.TryGetProperty(名, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        private static long? 取数(JsonElement 节点, string 名)
            => 节点.TryGetProperty(名, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt64() : (long?)null;

        private static string 引(string s)
            => s == null ? "null" : JsonSerializer.Serialize(s);
    }
}
