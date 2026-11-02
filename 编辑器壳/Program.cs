using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Windows.Forms;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
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
                    if (!string.IsNullOrWhiteSpace(路) && Directory.Exists(路)) return 路;
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

        private static string? 问目录()
        {
            using var 框 = new FolderBrowserDialog
            {
                Description = "选 Unity 项目的 Assets 文件夹（脚本会直接写进去）",
                 UseDescriptionForTitle = true,
                ShowNewFolderButton = false,
            };
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

                foreach (var kv in 组件们)
                {
                    结果.Add(new
                    {
                        文件 = 相对,
                        物体 = 物体名.TryGetValue(kv.Key, out var nm) ? nm : "（无名字）",
                        tag = 物体Tag.TryGetValue(kv.Key, out var tg) ? tg : "",
                        组件 = kv.Value,
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
                                回话(网页, new { 命令 = "目录", 路径 = 读目录() });
                                return;
                            }

                            // 点顶栏那个牌子 → 重新选
                            if (命令 == "换目录")
                            {
                                var 选了 = 问目录();
                                if (选了 != null) 存目录(选了);
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
                                        回话(网页, new { 命令 = "出错", 说 = "还没选 Assets 目录" });
                                        return;
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
                                    var 场景 = 递归找(项目根, "*.unity", 跳过).Select(p => 取相对(p, 项目根)).ToList();
                                    记($"场景 {场景.Count}");
                                    var 预制 = 递归找(项目根, "*.prefab", 跳过).Select(p => 取相对(p, 项目根)).ToList();
                                    记($"预制 {预制.Count}");

                                    记($"扫完：脚本{脚本.Count} 场景{场景.Count} 预制{预制.Count}");
                                    var 实例们 = 解析实例(项目根, 资源, 场景, 预制);
                                    记($"解析出实例 {实例们.Count} 个，准备回话");
                                    回话(网页, new { 命令 = "项目扫描", 项目根, 资源目录 = 资源,
                                        脚本, 场景, 预制, 实例们 });
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

                            var 目录路 = 读目录() ?? 问目录();
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
