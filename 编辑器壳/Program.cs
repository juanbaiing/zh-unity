using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Windows.Forms;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.Data.Sqlite;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ZhEditorShell
{
    internal static class Program
    {
        // 记住「上次存到哪个 Unity 目录」，下次不用再选
        private static string 设置文件 =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                         "中文套式编辑器", "设置.json");

        private static string? 读目录()
        {
            try
            {
                if (!File.Exists(设置文件)) return null;
                using var 档 = JsonDocument.Parse(File.ReadAllText(设置文件));
                if (档.RootElement.TryGetProperty("Unity目录", out var v))
                {
                    var 路 = v.GetString();
                    if (string.IsNullOrWhiteSpace(路) || !Directory.Exists(路)) return null;
                    // 老版本可能把「项目根」存进来了（换目录那条路以前不规整）。
                    // 读的时候统一折算成 Assets —— 否则扫描那边会按「上一层是项目根」
                    // 反推，把装项目的父目录当成项目，旁边的项目全被扫进来。
                    return 规整成Assets(路) ?? 路;
                }
            }
            catch { /* 设置文件坏了就当没设过 */ }
            return null;
        }

        private static void 存目录(string 路)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(设置文件)!);
                File.WriteAllText(设置文件, JsonSerializer.Serialize(new { Unity目录 = 路 }));
            }
            catch { /* 记不住就算了，下次再问一遍 */ }
        }

        // 新手不知道 Assets 在哪，也记不住项目放在哪个盘。
        // Unity/团结引擎启动时会把项目路径写进 Editor.log 的头几行 —— 直接读它。
        // 优先于让用户自己找：找到了就把选择框预填到那个目录，他一眼看到自己的项目名。
        private static string? 找最近项目(out string 说明, bool 要求有脚本 = true)
        {
            说明 = "没找到 Editor.log";
            var 本地 = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var 日志们 = new[]
            {
                Path.Combine(本地, "Tuanjie", "Editor", "Editor.log"),
                Path.Combine(本地, "Tuanjie", "Editor", "Editor-prev.log"),
                Path.Combine(本地, "Unity", "Editor", "Editor.log"),
                Path.Combine(本地, "Unity", "Editor", "Editor-prev.log"),
            };
            foreach (var 日志 in 日志们)
            {
                if (!File.Exists(日志)) continue;
                try
                {
                    // ⚠️ Unity 开着的时候这个日志被它占着，File.ReadLines 会直接抛异常。
                    //    必须自己开 FileStream 声明共享读写 —— 不然下面的 catch 会把
                    //    「打不开」静默当成「没找到」，用户就以为自动识别不好使。
                    using var 流 = new FileStream(日志, FileMode.Open, FileAccess.Read,
                        FileShare.ReadWrite | FileShare.Delete);
                    using var 读 = new StreamReader(流, System.Text.Encoding.UTF8);
                    for (var i = 0; i < 300 && !读.EndOfStream; i++)
                    {
                        var 候选 = (读.ReadLine() ?? "").Trim();
                        if (候选.Length < 4 || 候选.Length > 240) continue;
                        if (候选[0] < 'A' || 候选[0] > 'Z') continue;
                        if (候选[1] != ':') continue;
                        if (候选.IndexOfAny(new[] { '*', '?', '<', '>', '|', '"' }) >= 0) continue;
                        // 项目根的特征：它下面有 Assets
                        var 资源 = Path.Combine(候选, "Assets");
                        if (!Directory.Exists(资源)) continue;
                        // ⚠️ 光有 Assets 不够。Unity 里新建的空项目也有 Assets，但里面只有场景、
                        //    一个脚本都没有 —— 认它等于把人引到空项目上，扫完一片空白，
                        //    他会以为工具坏了。必须有 .cs 才算「他在写的那个项目」。
                        var 有脚本 = false;
                        try
                        {
                            if (Directory.GetFiles(资源, "*.cs", SearchOption.TopDirectoryOnly).Length > 0) 有脚本 = true;
                            else
                                foreach (var 子 in Directory.GetDirectories(资源))
                                {
                                    if (Directory.GetFiles(子, "*.cs", SearchOption.TopDirectoryOnly).Length > 0) { 有脚本 = true; break; }
                                }
                        }
                        catch { }
                        if (要求有脚本 && !有脚本) continue;
                        说明 = "从 " + Path.GetFileName(日志) + " 认出：" + 候选;
                        return 候选;
                    }
                    说明 = "读了 " + Path.GetFileName(日志) + " 前 300 行，没有像项目路径的";
                }
                catch (Exception e) { 说明 = "读 " + Path.GetFileName(日志) + " 失败：" + e.Message; }
            }
            return null;
        }

        // 用户可能选的是项目根（My project），也可能是里面的 Assets —— 两种都认。
        // 新手记的是项目名，不是 Assets，所以别再逼他往里点一层。
        //
        // ⚠️ 不能拿「目录存在」当通过条件：D:\vs学习 这种「装着一堆项目的那一层」
        //    也存在，放过去的话扫描会把它当项目根，往下反推出项目根是 D:\，
        //    然后把旁边几个项目的场景全扫进来 —— 表现为「新项目里冒出一堆别人的物体」。
        //    判据收紧到：要么下面有个 Assets，要么它自己就叫 Assets。
        private static string? 规整成Assets(string 选的)
        {
            var 根 = 选的.TrimEnd('\\', '/');
            var 内层 = Path.Combine(根, "Assets");
            if (Directory.Exists(内层)) return 内层;
            if (string.Equals(Path.GetFileName(根), "Assets", StringComparison.OrdinalIgnoreCase)) return 根;
            return null;
        }

        // 只看设置里记着的那条路径，不管它现在还在不在。
        // 用来给选择框定个起点 —— 目录被删了也照样能用它的上一层。
        private static string? 读旧目录()
        {
            try
            {
                if (!File.Exists(设置文件)) return null;
                using var 档 = JsonDocument.Parse(File.ReadAllText(设置文件));
                if (档.RootElement.TryGetProperty("Unity目录", out var v)) return v.GetString();
            }
            catch { }
            return null;
        }

        // 选择框该从哪一格开始？
        //
        // 给的是**项目根**（My project 这一层）。FolderBrowserDialog 设了 SelectedPath 之后，
        // 打开时会停在它的**父目录**、把它高亮 —— 所以他看到的是「D:\vs学习 里面，
        // My project 被选中，旁边就是 My project (1)」，一眼分得清哪个是自己那个。
        //
        // ⚠️ 别给「父目录」：那样反而停在再上一级（D:\），两个项目都看不见。
        private static string? 猜起点()
        {
            var 日志里 = 找最近项目(out _);
            if (日志里 != null) return 日志里;   // 日志里那条就是项目根

            var 旧 = 读旧目录();
            if (string.IsNullOrEmpty(旧)) return null;
            // 记的一般是 .../My project/Assets —— 上一级就是项目根
            var 项目根 = Directory.GetParent(旧.TrimEnd('\\', '/'))?.FullName;
            if (项目根 != null && Directory.Exists(项目根)) return 项目根;
            return null;
        }

        // Unity/团结引擎现在开着哪个项目？
        // 用户心里想的是「我最后打开的那个」，而设置里记的是「上次在编辑器里选的那个」——
        // 两者经常不是同一个。读日志拿到真的那个，好让顶栏提醒他。
        // 这里**不能**要求「项目里有 .cs」：Unity 新开的空项目一个脚本都没有，
        // 正是这种情况最需要提醒用户「你写向的项目和开着的不是同一个」。
        private static string? Unity当前项目() => 找最近项目(out _, false);

        // 把 Unity 插件写进项目里（Assets/Editor/ZhBridge.cs）。
        //
        // 以前要用户自己把 .cs 拷过去 —— 换项目就得再拷一次，忘了就是
        // 「Unity 菜单里没有中文套式」。插件就在 exe 里，连上项目直接写出去。
        //
        // 已经有了就不动：用户可能改过它。
        private static bool 确保插件(string 资源目录, Action<string> 记)
        {
            try
            {
                var 目标 = Path.Combine(资源目录, "Editor", "ZhBridge.cs");
                if (File.Exists(目标)) return false;
                using var 流 = typeof(Program).Assembly.GetManifestResourceStream("ZhEditorShell.ZhBridge.cs");
                if (流 == null) { 记("exe 里没找到内置插件"); return false; }
                using var 读 = new StreamReader(流, System.Text.Encoding.UTF8);
                var 源码 = 读.ReadToEnd();
                var 目录 = Path.GetDirectoryName(目标);
                if (!string.IsNullOrEmpty(目录)) Directory.CreateDirectory(目录);
                File.WriteAllText(目标, 源码, new System.Text.UTF8Encoding(false));
                记("已把 Unity 插件写进 " + 目标);
                return true;
            }
            catch (Exception e) { 记("装插件失败：" + e.Message); return false; }
        }

        // 有插件导出的 关系.json 就用它。
        // 它读的是 Unity 内存里的场景，**不管有没有存盘都准**，
        // 比解析 .scene 文件强 —— 那个只能看到硬盘上最后一次保存的样子。
        private static List<object>? 从关系json装实例(string 项目根, string 资源目录, Action<string> 记)
        {
            try
            {
                var 路 = Path.Combine(项目根, ".zh-bridge", "关系.json");
                if (!File.Exists(路)) return null;
                using var 档 = JsonDocument.Parse(File.ReadAllText(路));
                if (!档.RootElement.TryGetProperty("物体", out var 物体们)) return null;

                var 出 = new List<object>();
                foreach (var 物 in 物体们.EnumerateArray())
                {
                    var 组件们 = new List<object>();
                    if (物.TryGetProperty("组件", out var 件们) && 件们.ValueKind == JsonValueKind.Array)
                        foreach (var 件 in 件们.EnumerateArray())
                        {
                            var 脚本 = 件.TryGetProperty("脚本", out var s) ? s.GetString() : null;
                            var 字段 = 件.TryGetProperty("字段", out var f) && f.ValueKind == JsonValueKind.Object
                                ? f.GetRawText() : "{}";
                            组件们.Add(new { 脚本, 字段 });
                        }
                    出.Add(new
                    {
                        文件 = 物.TryGetProperty("文件", out var w) ? w.GetString() ?? "" : "",
                        物体 = 物.TryGetProperty("名", out var n) ? n.GetString() ?? "" : "",
                        tag = 物.TryGetProperty("tag", out var t) ? t.GetString() ?? "" : "",
                        组件 = 组件们,
                    });
                }
                记("用插件的 关系.json：" + 出.Count + " 个物体");
                return 出;
            }
            catch (Exception e) { 记("读 关系.json 失败：" + e.Message); return null; }
        }

        private static string? 问目录(string? 预填 = null)
        {
            using var 框 = new FolderBrowserDialog
            {
                Description = "选 Unity 项目文件夹（就是里面有 Assets 和 ProjectSettings 的那个）",
                UseDescriptionForTitle = true,
                ShowNewFolderButton = false,
            };
            // 自动找到的项目先摆进去，用户点头就行，不用自己翻盘
            if (!string.IsNullOrEmpty(预填) && Directory.Exists(预填)) 框.SelectedPath = 预填;
            return 框.ShowDialog() == DialogResult.OK ? 框.SelectedPath : null;
        }

        // 同一个类名可能被挪到了子文件夹 —— 存之前先把它找出来，别在老地方又造一个
        private static string? 找已有脚本(string assets根, string 文件名)
        {
            try
            {
                var 候选 = Directory.GetFiles(assets根, 文件名, SearchOption.AllDirectories);
                if (候选.Length == 0) return null;
                // 路径短的优先（离 Assets 根最近的那个）
                Array.Sort(候选, (a, b) => a.Length.CompareTo(b.Length));
                return 候选[0];
            }
            catch { return null; }
        }

        // 找 Unity/团结引擎的 Managed 目录 —— 编译时要引用里面的 dll，不然满屏 CS0246
        private static string? 找引擎目录()
        {
            try
            {
                if (!File.Exists(设置文件)) return null;
                using var 档 = JsonDocument.Parse(File.ReadAllText(设置文件));
                if (档.RootElement.TryGetProperty("引擎目录", out var v))
                {
                    var 路 = v.GetString();
                    if (!string.IsNullOrWhiteSpace(路) && Directory.Exists(路)) return 路;
                }
            }
            catch { }

            // 直接试几个确切位置（最快，也最不容易被目录权限绊倒）
            foreach (var 死 in new[]
            {
                @"D:\unity\unitybianji\2022.3.62t14\Editor\Data\Managed\UnityEngine",
            })
            {
                if (Directory.Exists(死)) return 死;
            }

            // 没设过就猜：在几个常见的安装盘里往下找
            foreach (var 起 in new[] { @"D:\unity", @"C:\Program Files\Unity\Hub\Editor", @"C:\Program Files\Unity", @"D:\Program Files\Unity" })
            {
                var 找到 = 往下找(起, 4);
                if (找到 != null) return 找到;
            }
            return null;
        }

        // 一层层往下找 Editor\Data\Managed\UnityEngine。
        // 不能用 SearchOption.AllDirectories —— 里面碰到一个没权限的目录，整棵树直接抛异常，
        // 结果就是「明明装着 Unity 却说找不到」。
        private static string? 往下找(string 目录, int 还能往下几层)
        {
            try
            {
                if (!Directory.Exists(目录)) return null;
                var 命中 = Path.Combine(目录, "Editor", "Data", "Managed", "UnityEngine");
                if (Directory.Exists(命中)) return 命中;
                if (还能往下几层 <= 0) return null;
            }
            catch { return null; }

            // 单独列子目录：列这一个就抛异常的话，不能连累整个搜索
            string[] 子们;
            try { 子们 = Directory.GetDirectories(目录); }
            catch { return null; }

            foreach (var 子 in 子们)
            {
                var r = 往下找(子, 还能往下几层 - 1);
                if (r != null) return r;
            }
            return null;
        }

        private static void 存引擎目录(string 路)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(设置文件)!);
                var 旧 = new Dictionary<string, string>();
                if (File.Exists(设置文件))
                {
                    using var 档 = JsonDocument.Parse(File.ReadAllText(设置文件));
                    foreach (var p in 档.RootElement.EnumerateObject())
                        if (p.Value.ValueKind == JsonValueKind.String) 旧[p.Name] = p.Value.GetString() ?? "";
                }
                旧["引擎目录"] = 路;
                File.WriteAllText(设置文件, JsonSerializer.Serialize(旧));
            }
            catch { }
        }

        // 真编译一遍（不生成文件），把编译器的错原样报回来 —— 跟 VS 里看到的是同一套
        // 递归找文件，但进目录时就跳过 Library / Temp / obj ——
        // 用 Directory.GetFiles(AllDirectories) 的话会先把 Library 几万个文件全走一遍，卡死。
        private static List<string> 递归找(string 底, string 模式, string[] 跳过)
        {
            var 结果 = new List<string>();
            var 栈 = new Stack<string>();
            栈.Push(底);
            while (栈.Count > 0)
            {
                var 当前 = 栈.Pop();
                try
                {
                    foreach (var d in Directory.GetDirectories(当前))
                    {
                        var n = Path.GetFileName(d);
                        if (System.Array.IndexOf(跳过, n) >= 0) continue;
                        栈.Push(d);
                    }
                    foreach (var f in Directory.GetFiles(当前, 模式)) 结果.Add(f);
                }
                catch { /* 没权限的目录跳过 */ }
            }
            结果.Sort(StringComparer.Ordinal);
            return 结果;
        }

        // ---- 从 .cs 里抠出 public 字段名 ----
        private static readonly System.Text.RegularExpressions.Regex 字段正则 =
            new(@"public\s+(?:static\s+|readonly\s+)*(?:[\w.]+(?:<[^>]*>)?(?:\[\])?)\s+(\w+)\s*[=;]",
                System.Text.RegularExpressions.RegexOptions.Compiled);

        private static Dictionary<string, HashSet<string>> 各脚本字段(string 资源目录, IEnumerable<string> 脚本们)
        {
            var 表 = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            foreach (var 相对 in 脚本们)
            {
                var 全 = Path.Combine(资源目录, 相对.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(全)) continue;
                var 文 = File.ReadAllText(全);
                var 名 = Path.GetFileNameWithoutExtension(全);
                var 集 = new HashSet<string>(StringComparer.Ordinal);
                foreach (System.Text.RegularExpressions.Match m in 字段正则.Matches(文))
                {
                    var f = m.Groups[1].Value;
                    // 后面跟括号的是方法，不是字段
                    if (System.Text.RegularExpressions.Regex.IsMatch(文, @"" + f + @"\s*\(")) continue;
                    集.Add(f);
                }
                表[名] = 集;
            }
            return 表;
        }

        // ---- 从场景 / 预制体里抠出「哪个物体挂了哪个脚本」----
        // ⚠️ 团结引擎的 GUID 是两套：.meta 里是 base64，场景里是 32 位 hex，
        // 对不上（Library/ArtifactDB 里也只有 hex 索引，没有到 base64 的映射）。
        // 所以改用「字段名反推」：MonoBehaviour 块里存着脚本的公开字段，
        // 拿这堆字段名去比对每个脚本的公开字段，能全覆盖的就是它。
        private static List<object> 解析实例(string 项目根, string 资源目录,
            List<string> 场景们, List<string> 预制们)
        {
            var 结果 = new List<object>();
            var 字段表 = 各脚本字段(资源目录, Directory.GetFiles(资源目录, "*.cs", SearchOption.AllDirectories)
                .Select(p => p.Substring(资源目录.Length).TrimStart('\\', '/').Replace('\\', '/')));

            foreach (var 相对 in 场景们.Concat(预制们))
            {
                var 全 = Path.Combine(项目根, 相对.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(全)) continue;
                string 文;
                try { 文 = File.ReadAllText(全); } catch { continue; }

                var 片段们 = System.Text.RegularExpressions.Regex.Split(文, @"^--- ", System.Text.RegularExpressions.RegexOptions.Multiline);

                // 先把 GameObject 的 fileID → 名字、tag 记下来
                var 物体名 = new Dictionary<string, string>();
                var 物体Tag = new Dictionary<string, string>();
                foreach (var 段 in 片段们)
                {
                    if (!段.StartsWith("!u!1 ")) continue;
                    var id = System.Text.RegularExpressions.Regex.Match(段, @"&(\d+)").Groups[1].Value;
                    var n = System.Text.RegularExpressions.Regex.Match(段, @"^  m_Name: (.*)$",
                        System.Text.RegularExpressions.RegexOptions.Multiline).Groups[1].Value.Trim();
                    var t = System.Text.RegularExpressions.Regex.Match(段, @"^  m_TagString: (.*)$",
                        System.Text.RegularExpressions.RegexOptions.Multiline).Groups[1].Value.Trim();
                    if (id != "") { 物体名[id] = n; 物体Tag[id] = t; }
                }

                // 再扫 MonoBehaviour
                var 组件们 = new Dictionary<string, List<object>>();   // 物体 id → 组件列表
                foreach (var 段 in 片段们)
                {
                    if (!段.StartsWith("!u!114 ")) continue;
                    var 主 = System.Text.RegularExpressions.Regex.Match(段, @"m_GameObject: \{fileID: (\d+)\}");
                    if (!主.Success) continue;
                    var 物id = 主.Groups[1].Value;

                    // 这一块的字段（顶格两空格的 key），排除 m_ 开头的引擎字段
                    var 字段 = new HashSet<string>(StringComparer.Ordinal);
                    var 值们 = new Dictionary<string, string>(StringComparer.Ordinal);
                    foreach (System.Text.RegularExpressions.Match kv in
                        System.Text.RegularExpressions.Regex.Matches(段, @"^  (?!m_)(\w+): *(.*)$",
                            System.Text.RegularExpressions.RegexOptions.Multiline))
                    {
                        字段.Add(kv.Groups[1].Value);
                        var v = kv.Groups[2].Value.Trim();
                        if (v != "") 值们[kv.Groups[1].Value] = v;
                    }

                    string 匹配 = null;
                    string 备注 = null;
                    if (字段.Count > 0)
                    {
                        var 候选 = 字段表.Where(kv => 字段.IsSubsetOf(kv.Value)).Select(kv => kv.Key).ToList();
                        if (候选.Count == 1) 匹配 = 候选[0];
                        else if (候选.Count > 1) { 匹配 = 候选[0]; 备注 = "可能是：" + string.Join(" / ", 候选); }
                        else 备注 = "没有脚本能对上这组字段：" + string.Join(",", 字段);
                    }
                    else 备注 = "这个组件没有公开字段，认不出来";

                    if (!组件们.ContainsKey(物id)) 组件们[物id] = new List<object>();
                    组件们[物id].Add(new { 脚本 = 匹配, 字段 = 值们, 备注 });
                }

                // 遍历**所有物体**，不是只遍历「挂了脚本的物体」。
                // Unity 新建场景就是 Main Camera + Directional Light + Cube，一个脚本都没挂 ——
                // 只输出挂了脚本的话，新项目打开是一片空白，看着像工具坏了。
                // 没挂脚本的物体照样给一个框（组件为空），一眼就知道那是「还没挂东西」。
                foreach (var kv in 物体名)
                {
                    结果.Add(new
                    {
                        文件 = 相对,
                        物体 = kv.Value,
                        tag = 物体Tag.TryGetValue(kv.Key, out var tg) ? tg : "",
                        组件 = 组件们.TryGetValue(kv.Key, out var cs) ? cs : new List<object>(),
                    });
                }
            }
            return 结果;
        }

        private static List<object> 编译检查(string 代码)
        {
            var 错 = new List<object>();
            var 语法 = CSharpSyntaxTree.ParseText(代码, new CSharpParseOptions(LanguageVersion.CSharp9));

            var 引用 = new List<MetadataReference>();
            var 引擎 = 找引擎目录();
            上次引擎 = 引擎;
            if (引擎 != null && Directory.Exists(引擎))
            {
                // Unity 自己的程序集（MonoBehaviour、Debug、Transform…）
                foreach (var dll in Directory.GetFiles(引擎, "UnityEngine*.dll"))
                {
                    try { 引用.Add(MetadataReference.CreateFromFile(dll)); } catch { }
                }
                // .NET 的基础类型（Void、Object、String…）走 Unity 自带的 netstandard 引用集
                try
                {
                    var 数据 = Path.GetDirectoryName(Path.GetDirectoryName(引擎));   // …\Editor\Data
                    var ns = Path.Combine(数据!, "NetStandard", "ref", "2.1.0", "netstandard.dll");
                    if (File.Exists(ns)) 引用.Add(MetadataReference.CreateFromFile(ns));
                }
                catch { }
            }
            // 框架自带的（System、Collections 那些）
            // ⚠ 单文件发布里 Assembly.Location 恒为空，必须走 TRUSTED_PLATFORM_ASSEMBLIES
            var 框架表 = (string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES");
            if (!string.IsNullOrEmpty(框架表))
            {
                foreach (var 路 in 框架表.Split(Path.PathSeparator))
                {
                    if (string.IsNullOrWhiteSpace(路) || !File.Exists(路)) continue;
                    try { 引用.Add(MetadataReference.CreateFromFile(路)); } catch { }
                }
            }

            var 编译 = CSharpCompilation.Create(
                "检查",
                new[] { 语法 },
                引用,
                new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));

            foreach (var d in 编译.GetDiagnostics())
            {
                if (d.Severity != DiagnosticSeverity.Error && d.Severity != DiagnosticSeverity.Warning) continue;
                var 位 = d.Location.GetLineSpan();
                错.Add(new
                {
                    严重 = d.Severity == DiagnosticSeverity.Error ? "错误" : "警告",
                    行 = 位.StartLinePosition.Line + 1,
                    列 = 位.StartLinePosition.Character + 1,
                    码 = d.Id,
                    说 = d.GetMessage(System.Globalization.CultureInfo.GetCultureInfo("zh-CN")),
                });
            }
            上次引用数 = 引用.Count;
            var 盘 = @"D:\unity";
            string 盘信息;
            try { 盘信息 = Directory.Exists(盘) ? ("有 " + Directory.GetDirectories(盘).Length + " 个子目录") : "不存在"; }
            catch (Exception ex) { 盘信息 = "列目录出错：" + ex.GetType().Name; }
            上次诊断 = "D盘=" + 盘信息 + " | 引擎=" + (引擎 ?? "null")
                     + " | 框架表=" + (框架表 == null ? "null" : 框架表.Split(Path.PathSeparator).Length + " 项")
                     + " | 引用=" + 引用.Count;
            return 错;
        }

        private static int 上次引用数 = 0;
        private static string? 上次引擎 = null;
        private static string 上次诊断 = "";

        [STAThread]
        private static void Main()
        {
            ApplicationConfiguration.Initialize();

            var 窗体 = new Form
            {
                Text = "中文套式编辑器",
                Width = 1400,
                Height = 900,
                MinimumSize = new System.Drawing.Size(900, 620),
                StartPosition = FormStartPosition.CenterScreen,
                // 四列并排（托盘 / 画布 / 中间层 / C#），窗口不开大点会挤成一团
                WindowState = FormWindowState.Maximized,
            };

            var 网页 = new WebView2 { Dock = DockStyle.Fill };
            窗体.Controls.Add(网页);

            窗体.Load += async (_, _) =>
            {
                try
                {
                    // 平时不给调试端口；设了环境变量才开 —— 我好用它自动验证「存到 Unity」这条链路
                    var 参数 = new CoreWebView2EnvironmentOptions();
                    var 调试端口 = Environment.GetEnvironmentVariable("ZH_EDITOR_DEBUG_PORT");
                    if (!string.IsNullOrEmpty(调试端口))
                        参数.AdditionalBrowserArguments = "--remote-debugging-port=" + 调试端口;
                    var 环境 = await CoreWebView2Environment.CreateAsync(null, null, 参数);
                    await 网页.EnsureCoreWebView2Async(环境);

                    // 把内嵌的页面写到临时目录，再用「虚拟域名」加载它。
                    // 直接 NavigateToString 的话源是 about:blank，localStorage 用不了 ——
                    // 存档就没了，那等于白做。
                    var 目录 = Path.Combine(Path.GetTempPath(), "zh-editor-shell");
                    Directory.CreateDirectory(目录);

                    var 程序集 = typeof(Program).Assembly;
                    using var 流 = 程序集.GetManifestResourceStream("ZhEditorShell.index.html");
                    if (流 == null) throw new InvalidOperationException("页面资源没打进去");
                    using var 读 = new StreamReader(流);
                    var 页面路径 = Path.Combine(目录, "index.html");
                    File.WriteAllText(页面路径, 读.ReadToEnd());

                    网页.CoreWebView2.WebMessageReceived += (_, e) =>
                    {
                        try
                        {
                            using var 档 = JsonDocument.Parse(e.WebMessageAsJson);
                            var 根 = 档.RootElement;
                            var 命令 = 根.TryGetProperty("命令", out var c) ? c.GetString() : null;

                            // 「现在存到哪」—— 页面一打开就问一次，显示在顶栏
                            if (命令 == "问目录")
                            {
                                var 开着的 = Unity当前项目();
                                var 开着的资源 = 开着的 == null ? null : 规整成Assets(开着的);
                                var 现在的 = 读目录();

                                // 启动时直接跟到 Unity 现在开着的项目上。
                                // 用户心里想的是「我最后打开的那个」，不是「上次在编辑器里选的那个」。
                                // 只提示不切等于没解决 —— 标一句「开的是另一个」，人还得自己点。
                                //
                                // ZH_NO_FOLLOW=1 关掉跟随：跑自动化测试时要钉住某个固定项目，
                                // 不然测试跟着 Unity 当前项目跑，验证结果每次都不一样。
                                var 跟随 = Environment.GetEnvironmentVariable("ZH_NO_FOLLOW") != "1";
                                if (跟随 && 开着的资源 != null && 现在的 != 开着的资源)
                                {
                                    存目录(开着的资源);
                                    回话(网页, new { 命令 = "目录", 路径 = 开着的资源, Unity开着 = 开着的,
                                        跟过去了 = true, 原来 = 现在的 });
                                    return;
                                }

                                回话(网页, new { 命令 = "目录", 路径 = 现在的, Unity开着 = 开着的 });
                                return;
                            }

                            // 点顶栏那个牌子 → 重新选
                            if (命令 == "换目录")
                            {
                                var 选了 = 问目录(猜起点());
                                if (选了 != null)
                                {
                                    // 必须规整成 Assets 再存。直接存「项目根」的话，
                                    // 扫描那边会按「Assets 的上一级」反推，退成装项目的父目录，
                                    // 把旁边几个项目一起扫进来。
                                    var 规整 = 规整成Assets(选了);
                                    if (规整 == null)
                                    {
                                        回话(网页, new { 命令 = "出错", 说 = "这个文件夹不对：要选 Unity 项目那一层（里面有 Assets 的），或者直接选 Assets" });
                                        return;
                                    }
                                    存目录(规整);
                                }
                                回话(网页, new { 命令 = "目录", 路径 = 读目录() });
                                return;
                            }

                            if (命令 == "编译检查")
                            {
                                var 待查 = 根.GetProperty("代码").GetString() ?? "";
                                List<object> 结果;
                                try { 结果 = 编译检查(待查); }
                                catch (Exception ex) { 结果 = new List<object> { new { 严重 = "错误", 行 = 1, 列 = 1, 码 = "工具", 说 = "检查器自己出错：" + ex.Message } }; }
                                回话(网页, new { 命令 = "编译结果", 列表 = 结果, 引擎 = 上次引擎, 引用数 = 上次引用数, 诊断 = 上次诊断 });
                                return;
                            }

                            if (命令 == "选引擎目录")
                            {
                                using var 框 = new FolderBrowserDialog
                                {
                                    Description = @"选 Unity 安装目录里的 Editor\Data\Managed 文件夹（用来找 UnityEngine.dll）",
                                    UseDescriptionForTitle = true,
                                };
                                if (框.ShowDialog() == DialogResult.OK) 存引擎目录(框.SelectedPath);
                                回话(网页, new { 命令 = "引擎目录", 路径 = 找引擎目录() });
                                return;
                            }

                            // 关系图要的数据。库是数据层建的，这儿只读不写。
                            if (命令 == "关系图数据")
                            {
                                var 资源 = 读目录();
                                if (资源 == null)
                                {
                                    回话(网页, new { 命令 = "出错", 说 = "还没选 Assets 目录" });
                                    return;
                                }
                                var 项目根 = Directory.GetParent(资源.TrimEnd('\\', '/'))?.FullName ?? 资源;
                                var 库 = Path.Combine(项目根, ".zh-bridge", "关系.db");

                                if (!File.Exists(库))
                                {
                                    回话(网页, new
                                    {
                                        命令 = "关系图数据",
                                        图 = (object?)null,
                                        说 = "还没有关系库。先点「扫描项目」，再跑一次数据层灌库。",
                                    });
                                    return;
                                }

                                try
                                {
                                    using var 连 = new SqliteConnection($"Data Source={库};Mode=ReadWrite");
                                    连.Open();
                                    // 用实验稿那套格式（实例们 / 脚本 / 槽 / 入口 / 出口 / 线）
                                    var (场景, 实例数) = 图数据.组装.组装画布(连, Path.GetFileName(项目根));
                                    回话(网页, new { 命令 = "关系图数据", 图 = 场景, 实例数 });
                                }
                                catch (Exception ex)
                                {
                                    回话(网页, new { 命令 = "出错", 说 = "读关系库失败：" + ex.Message });
                                }
                                return;
                            }

                            // 拖完位置存下来。只写 布局 表，不碰扫描出来的东西。
                            if (命令 == "存布局")
                            {
                                var 资源 = 读目录();
                                if (资源 == null) return;
                                var 项目根 = Directory.GetParent(资源.TrimEnd('\\', '/'))?.FullName ?? 资源;
                                var 库 = Path.Combine(项目根, ".zh-bridge", "关系.db");
                                if (!File.Exists(库)) return;

                                try
                                {
                                    var 项们 = 根.GetProperty("项");
                                    using var 连 = new SqliteConnection($"Data Source={库};Mode=ReadWrite");
                                    连.Open();
                                    using var 务 = 连.BeginTransaction();
                                    foreach (var 项 in 项们.EnumerateArray())
                                    {
                                        using var 命 = 连.CreateCommand();
                                        命.Transaction = 务;
                                        命.CommandText =
                                            "INSERT INTO 布局(id, x, y) VALUES($id, $x, $y) " +
                                            "ON CONFLICT(id) DO UPDATE SET x = $x, y = $y";
                                        命.Parameters.AddWithValue("$id", 项.GetProperty("id").GetString());
                                        命.Parameters.AddWithValue("$x", 项.GetProperty("x").GetDouble());
                                        命.Parameters.AddWithValue("$y", 项.GetProperty("y").GetDouble());
                                        命.ExecuteNonQuery();
                                    }
                                    务.Commit();
                                    回话(网页, new { 命令 = "布局存好了" });
                                }
                                catch (Exception ex)
                                {
                                    回话(网页, new { 命令 = "出错", 说 = "存布局失败：" + ex.Message });
                                }
                                return;
                            }

                            // 大注释框：你按住右键拖出来的那块地方。
                            //
                            // 全删全插，不做增量 —— 框的数量是个位数，省得写 diff。
                            // 跟 布局 一样，重灌数据不动这张表：那是你画的，不是扫出来的。
                            if (命令 == "存注释框")
                            {
                                var 资源 = 读目录();
                                if (资源 == null) return;
                                var 项目根 = Directory.GetParent(资源.TrimEnd('\\', '/'))?.FullName ?? 资源;
                                var 库 = Path.Combine(项目根, ".zh-bridge", "关系.db");
                                if (!File.Exists(库)) return;

                                try
                                {
                                    var 项们 = 根.GetProperty("项");
                                    using var 连 = new SqliteConnection($"Data Source={库};Mode=ReadWrite");
                                    连.Open();
                                    using var 务 = 连.BeginTransaction();
                                    using (var 清 = 连.CreateCommand())
                                    {
                                        清.Transaction = 务;
                                        清.CommandText = "DELETE FROM 注释框";
                                        清.ExecuteNonQuery();
                                    }
                                    foreach (var 项 in 项们.EnumerateArray())
                                    {
                                        using var 命 = 连.CreateCommand();
                                        命.Transaction = 务;
                                        命.CommandText =
                                            "INSERT INTO 注释框(id, 标题, x, y, 宽, 高, 色, 收起, 父) " +
                                            "VALUES($id, $标, $x, $y, $宽, $高, $色, $收, $父)";
                                        命.Parameters.AddWithValue("$id", 项.GetProperty("id").GetString() ?? "");
                                        命.Parameters.AddWithValue("$标", 项.TryGetProperty("标题", out var 标) ? 标.GetString() ?? "" : "");
                                        命.Parameters.AddWithValue("$x", 项.GetProperty("x").GetDouble());
                                        命.Parameters.AddWithValue("$y", 项.GetProperty("y").GetDouble());
                                        命.Parameters.AddWithValue("$宽", 项.GetProperty("宽").GetDouble());
                                        命.Parameters.AddWithValue("$高", 项.GetProperty("高").GetDouble());
                                        命.Parameters.AddWithValue("$色", 项.TryGetProperty("色", out var 色) ? 色.GetString() ?? "" : "");
                                        命.Parameters.AddWithValue("$收", 项.TryGetProperty("收起", out var 收) && 收.GetBoolean() ? 1 : 0);
                                        // 父 = 上级框 id，空 = 顶层。老页面可能不带这个字段，兜底当顶层。
                                        命.Parameters.AddWithValue("$父", 项.TryGetProperty("父", out var 父) ? 父.GetString() ?? "" : "");
                                        命.ExecuteNonQuery();
                                    }
                                    务.Commit();
                                    回话(网页, new { 命令 = "注释框存好了" });
                                }
                                catch (Exception ex)
                                {
                                    回话(网页, new { 命令 = "出错", 说 = "存注释框失败：" + ex.Message });
                                }
                                return;
                            }

                            // 断口的申诉：右键空头框 → 连到 / 正常 / 隐藏。
                            //
                            // 扫描说「这个槽是空的」，可它有时候是误报（运行时才赋值的引用），
                            // 有时候你知道它其实指谁。这两种话只有你能说，所以记在 申诉 表 ——
                            // 跟 布局 一样，重灌数据不动它：那是你说的话，不是扫出来的话。
                            if (命令 == "存申诉")
                            {
                                var 资源 = 读目录();
                                if (资源 == null) return;
                                var 项目根 = Directory.GetParent(资源.TrimEnd('\\', '/'))?.FullName ?? 资源;
                                var 库 = Path.Combine(项目根, ".zh-bridge", "关系.db");
                                if (!File.Exists(库)) return;

                                try
                                {
                                    var id = 根.GetProperty("id").GetString() ?? "";
                                    var 动作 = 根.GetProperty("动作").GetString() ?? "";
                                    var 目标 = 根.TryGetProperty("目标", out var 目) ? 目.GetString() : null;
                                    if (id.Length == 0) { 回话(网页, new { 命令 = "出错", 说 = "申诉缺 id" }); return; }

                                    using var 连 = new SqliteConnection($"Data Source={库};Mode=ReadWrite");
                                    连.Open();
                                    using var 命 = 连.CreateCommand();
                                    if (动作 == "撤销")
                                    {
                                        命.CommandText = "DELETE FROM 申诉 WHERE id = $id";
                                        命.Parameters.AddWithValue("$id", id);
                                    }
                                    else
                                    {
                                        命.CommandText =
                                            "INSERT INTO 申诉(id, 动作, 目标, 时间) VALUES($id, $动作, $目标, $时间) " +
                                            "ON CONFLICT(id) DO UPDATE SET 动作 = $动作, 目标 = $目标, 时间 = $时间";
                                        命.Parameters.AddWithValue("$id", id);
                                        命.Parameters.AddWithValue("$动作", 动作);
                                        命.Parameters.AddWithValue("$目标", (object?)目标 ?? DBNull.Value);
                                        命.Parameters.AddWithValue("$时间", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
                                    }
                                    命.ExecuteNonQuery();
                                    回话(网页, new { 命令 = "申诉存好了", id, 动作 });
                                }
                                catch (Exception ex)
                                {
                                    回话(网页, new { 命令 = "出错", 说 = "存申诉失败：" + ex.Message });
                                }
                                return;
                            }

                            // 一次把整个 Unity 项目里的脚本全转成块。
                            // 一个个选文件不现实 —— 一个项目几十个脚本。
                            if (命令 == "导入项目")
                            {
                                var 资源 = 读目录();
                                if (资源 == null)
                                {
                                    回话(网页, new { 命令 = "出错", 说 = "还没选 Assets 目录" });
                                    return;
                                }
                                try
                                {
                                    var 跳过目录 = new[] { "Library", "Temp", "obj", "Logs", "UserSettings", ".git", ".vs", "Editor" };
                                    var 文件们 = 递归找(资源, "*.cs", 跳过目录);
                                    var 列表 = new List<object>();
                                    var 转不动 = new List<string>();

                                    foreach (var 文件 in 文件们)
                                    {
                                        var 脚本相对 = 文件.StartsWith(资源)
                                            ? 文件.Substring(资源.Length).TrimStart('\\', '/').Replace('\\', '/')
                                            : 文件;
                                        try
                                        {
                                            var 源码 = File.ReadAllText(文件);
                                            var 块们 = 代码转块.转脚本(源码, out var 项目名);
                                            if (string.IsNullOrEmpty(项目名)) continue;   // 没有类，比如纯接口文件
                                            列表.Add(new { 项目名, 文件 = 脚本相对, 块们 });
                                        }
                                        catch (Exception ex)
                                        {
                                            转不动.Add(脚本相对 + " —— " + ex.Message);
                                        }
                                    }

                                    回话(网页, new
                                    {
                                        命令 = "导入项目",
                                        找到 = 文件们.Count,
                                        列表,
                                        转不动,
                                    });
                                }
                                catch (Exception ex)
                                {
                                    回话(网页, new { 命令 = "出错", 说 = "读项目失败：" + ex.Message });
                                }
                                return;
                            }

                            // 把一个已经写好的 .cs 转成块。Unity 项目里的脚本从来不是块画出来的，
                            // 转过来才能在图上看、在画布上改。
                            if (命令 == "导入脚本")
                            {
                                using var 框 = new OpenFileDialog
                                {
                                    Title = "选一个 C# 脚本，转成块",
                                    Filter = "C# 脚本 (*.cs)|*.cs",
                                };
                                if (框.ShowDialog() != DialogResult.OK) return;
                                try
                                {
                                    var 源码 = File.ReadAllText(框.FileName);
                                    var 块们 = 代码转块.转脚本(源码, out var 项目名);
                                    回话(网页, new
                                    {
                                        命令 = "导入脚本",
                                        项目名 = string.IsNullOrEmpty(项目名) ? "未命名" : 项目名,
                                        文件 = 框.FileName,
                                        块们,
                                    });
                                }
                                catch (Exception ex)
                                {
                                    回话(网页, new { 命令 = "出错", 说 = "转块失败：" + ex.Message });
                                }
                                return;
                            }

                            // 扫描一遍 Unity 项目：有哪些脚本、场景、预制体。
                            // 关系图要靠这个，不然就是空的。
                            if (命令 == "扫描项目")
                            {
                                var 日志路径 = Path.Combine(Path.GetTempPath(), "zh-scan.log");
                                void 记(string 话) { try { File.AppendAllText(日志路径, DateTime.Now.ToString("HH:mm:ss.fff") + " " + 话 + "\n"); } catch { } }
                                记("收到扫描命令");
                                try
                                {
                                    var 资源 = 读目录();
                                    if (资源 == null)
                                    {
                                        // 第一次用的人，第一步就是点「扫描项目」——这时候还没设过目录。
                                        // 光回一句「还没选 Assets 目录」等于让他自己去找那个能点的小标签，
                                        // 所以直接弹选择框：点扫描 = 选项目，一步到位。
                                        //
                                        // 关键是**框要开在对的地方**：预填项目根，FolderBrowserDialog 就会
                                        // 打开在它的父目录、把它高亮 —— 几个项目并排摆着，他直接点确认就行。
                                        // 只有真正要换项目时才会去动它。
                                        var 猜 = 猜起点();
                                        记(猜 == null ? "没有可用的起点" : "起点：" + 猜);
                                        var 选 = 问目录(猜);
                                        var 规整 = 选 == null ? null : 规整成Assets(选);
                                        if (规整 == null)
                                        {
                                            回话(网页, new { 命令 = "出错", 说 = "这个文件夹里没有 Assets，选 Unity 项目那一层。再点一次「扫描项目」" });
                                            return;
                                        }
                                        存目录(规整);
                                        回话(网页, new { 命令 = "目录", 路径 = 规整 });
                                        资源 = 规整;
                                        记("选好了：" + 规整);
                                    }
                                    // 选的是 Assets，项目根是它的上一级（那里有 ProjectSettings）
                                    var 项目根 = Directory.GetParent(资源.TrimEnd('\\', '/'))?.FullName ?? 资源;
                                    string 取相对(string 全, string 底) =>
                                        全.Substring(底.Length).TrimStart('\\', '/').Replace('\\', '/');

                                    // 进目录时就跳过 Library / Temp / obj。
                                    // 直接 GetFiles(AllDirectories) 会先把 Library 几万个文件走一遍，卡死。
                                    var 跳过 = new[] { "Library", "Temp", "obj", "Logs", "UserSettings", ".git", ".vs" };
                                    记("开始扫脚本");
                                    var 脚本 = 递归找(资源, "*.cs", 跳过).Select(p => 取相对(p, 资源)).ToList();
                                    记($"脚本 {脚本.Count}");
                                    // ⚠️ 团结引擎的场景是 .scene，标准 Unity 是 .unity —— 两种都得认。
                                    //    只认 .unity 的话，团结引擎的项目扫出来永远是「场景 0」，
                                    //    网里一个实例都没有，看着像工具坏了。
                                    var 场景 = new[] { "*.unity", "*.scene" }
                                        .SelectMany(模 => 递归找(项目根, 模, 跳过))
                                        .Distinct()
                                        .Select(p => 取相对(p, 项目根))
                                        .ToList();
                                    记($"场景 {场景.Count}");
                                    var 预制 = 递归找(项目根, "*.prefab", 跳过).Select(p => 取相对(p, 项目根)).ToList();
                                    记($"预制 {预制.Count}");

                                    记($"扫完：脚本{脚本.Count} 场景{场景.Count} 预制{预制.Count}");
                                    // 一个脚本、一个场景都没有 = 多半选错项目了。
                                    // ⚠️ 不能只看脚本：新建的 Unity 项目、或者还在搭场景没写脚本的项目，
                                    //    脚本数就是 0，可场景里有物体要画。那种要放行。
                                    if (脚本.Count == 0 && 场景.Count == 0 && 预制.Count == 0)
                                    {
                                        回话(网页, new { 命令 = "出错", 说 = $"这个项目里既没有 .cs 也没有 .unity（{资源}）—— 是不是选错项目了？再点一次「扫描项目」换一个" });
                                        return;
                                    }
                                    // 插件先装进去，再决定用哪份数据。
                                    // 装了它，Unity 那边保存场景就会自动导出 关系.json。
                                    var 新装 = 确保插件(资源, 记);
                                    var 从插件 = 从关系json装实例(项目根, 资源, 记);
                                    var 实例们 = 从插件 ?? 解析实例(项目根, 资源, 场景, 预制);
                                    记(从插件 != null
                                        ? $"用插件数据：{实例们.Count} 个物体"
                                        : $"插件还没导出过，退回读文件：{实例们.Count} 个物体");
                                    回话(网页, new { 命令 = "项目扫描", 项目根, 资源目录 = 资源,
                                        脚本, 场景, 预制, 实例们,
                                        插件刚装 = 新装, 用插件 = 从插件 != null });
                                    记("回话已发");
                                }
                                catch (Exception ex)
                                {
                                    记("炸了：" + ex.Message);
                                    回话(网页, new { 命令 = "出错", 说 = "扫描失败：" + ex.Message });
                                }
                                return;
                            }

                            if (命令 != "存到Unity") return;

                            var 文件名 = 根.GetProperty("文件名").GetString() ?? "未命名.cs";
                            var 内容 = 根.GetProperty("内容").GetString() ?? "";

                            var 目录路 = 读目录() ?? 问目录(猜起点());
                            if (目录路 == null)
                            {
                                回话(网页, new { 命令 = "出错", 说 = "没选目录，取消了" });
                                return;
                            }
                            存目录(目录路);

                            // 目标怎么定：
                            //   ① 上次存的那个文件还在 → 就写它（跟着你挪走的位置走）
                            //   ② 不在了 → 在 Assets 底下搜同名 .cs
                            //   ③ 也搜不到 → 才在 Assets 根新建
                            var 上次 = 根.TryGetProperty("上次路径", out var lp) ? lp.GetString() : null;
                            string 全路径;
                            string 说明;

                            if (!string.IsNullOrEmpty(上次) && File.Exists(上次))
                            {
                                全路径 = 上次!;
                                说明 = "更新了原来的文件";
                            }
                            else
                            {
                                var 找到 = 找已有脚本(目录路, 文件名);
                                if (找到 != null)
                                {
                                    全路径 = 找到;
                                    说明 = "它被挪过位置，跟着挪到新地方了";
                                }
                                else
                                {
                                    全路径 = Path.Combine(目录路, 文件名);
                                    说明 = "新建了文件";
                                }
                            }

                            // 整份覆盖 —— File.WriteAllText 本身就是覆盖，不会追加
                            File.WriteAllText(全路径, 内容, new System.Text.UTF8Encoding(false));
                            var 相对 = 全路径.StartsWith(目录路)
                                ? 全路径.Substring(目录路.Length).TrimStart('\\', '/')
                                : 全路径;
                            回话(网页, new { 命令 = "存好了", 文件名, 路径 = 全路径, 相对, 说明 });
                        }
                        catch (Exception ex)
                        {
                            回话(网页, new { 命令 = "出错", 说 = ex.Message });
                        }
                    };

                    网页.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "zh.editor", 目录, CoreWebView2HostResourceAccessKind.Allow);
                    网页.CoreWebView2.Navigate("https://zh.editor/index.html");
                }
                catch (Exception ex)
                {
                    MessageBox.Show("打不开页面：" + ex.Message, "出错了",
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            };

            Application.Run(窗体);
        }

        private static void 回话(WebView2 网页, object 数据)
        {
            var json = JsonSerializer.Serialize(数据);
            网页.CoreWebView2.PostWebMessageAsJson(json);
        }
    }
}
