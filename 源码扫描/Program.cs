// 扫源码，把「脚本之间的依赖」挖出来。
//
// Unity 不存方法去向 —— 谁调了谁的哪个方法，Unity 完全不知道。
// 所以这块不需要问 Unity，直接读 .cs 的语法树。
//
// 用法：dotnet run --project 源码扫描 -- "D:\vs学习\My project"
// 产出：<项目>\.zh-bridge\代码.json

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace 源码扫描
{
    internal static class Program
    {
        // Unity 自己在背后调的方法 —— 它们没有调用点，但不是死代码
        private static readonly HashSet<string> 生命周期 = new HashSet<string>(StringComparer.Ordinal)
        {
            "Awake", "Start", "OnEnable", "Update", "FixedUpdate", "LateUpdate", "OnDisable", "OnDestroy",
            "OnTriggerEnter", "OnTriggerStay", "OnTriggerExit",
            "OnCollisionEnter", "OnCollisionStay", "OnCollisionExit",
            "OnTriggerEnter2D", "OnTriggerStay2D", "OnTriggerExit2D",
            "OnCollisionEnter2D", "OnCollisionStay2D", "OnCollisionExit2D",
            "OnMouseDown", "OnMouseUp", "OnMouseDrag", "OnBecameVisible", "OnBecameInvisible",
            "OnDrawGizmos", "OnDrawGizmosSelected", "OnApplicationQuit", "OnApplicationFocus", "OnApplicationPause",
        };

        // 会「拿到某个类型」的 Unity 方法
        private static readonly string[] 取类型的方法 =
        {
            "GetComponent", "GetComponents", "GetComponentInChildren", "GetComponentsInChildren",
            "GetComponentInParent", "GetComponentsInParent",
            "FindObjectOfType", "FindObjectsOfType", "FindFirstObjectByType", "FindAnyObjectByType",
            "FindObjectsByType", "AddComponent", "TryGetComponent",
        };

        // 这些不用推类型：Unity 自带的属性 / 静态类 / 语言内建
        private static readonly HashSet<string> 免检 = new HashSet<string>(StringComparer.Ordinal)
        {
            "this", "base", "transform", "gameObject", "rigidbody", "renderer", "collider", "camera",
            "animator", "audio", "name", "tag", "enabled", "material", "sharedMaterial", "position",
            "rotation", "scale", "localScale", "localPosition", "activeSelf",
            "string", "int", "float", "bool", "double", "long", "byte", "char", "object",
        };

        // Unity 的值类型和静态类 —— 分析到它们不算「依赖」，也不算「没看懂」
        private static readonly HashSet<string> 不当依赖 = new HashSet<string>(StringComparer.Ordinal)
        {
            "Vector2", "Vector3", "Vector4", "Quaternion", "Color", "Color32", "Rect", "Bounds", "Ray",
            "Mathf", "Time", "Random", "Debug", "KeyCode", "Input", "SceneManager", "Application",
            "Screen", "Physics", "LayerMask", "AnimationCurve", "Gradient", "Resources", "Cursor",
            "string", "int", "float", "bool", "double", "long", "byte", "char", "object", "void", "var",
        };

        private static int Main(string[] 参数)
        {
            var 根 = 参数.Length > 0 ? 参数[0] : Directory.GetCurrentDirectory();
            var assets = Path.Combine(根, "Assets");
            if (!Directory.Exists(assets))
            {
                Console.Error.WriteLine($"找不到 {assets}");
                return 2;
            }

            var 输出目录 = Path.Combine(根, ".zh-bridge");
            Directory.CreateDirectory(输出目录);

            // 从 Unity 那份数据里抄字段类型 —— 有它才能知道 playerData 是 GameData
            var 字段表 = 读字段表(Path.Combine(输出目录, "关系.json"));

            var 脚本们 = new List<脚本结果>();
            var 未识别 = new List<string>();
            var 文件们 = Directory.GetFiles(assets, "*.cs", SearchOption.AllDirectories)
                                  .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}Editor{Path.DirectorySeparatorChar}"))
                                  .OrderBy(f => f, StringComparer.Ordinal)
                                  .ToList();

            // 先全部解析一遍。要判断 `nearest.TakeDamage(atk)` 里的 TakeDamage 是不是
            // EnemyHp 的方法，得先知道整个项目有哪些类、每个类有哪些方法。
            var 已解析 = new List<(string 相对, SyntaxNode 根节点)>();
            var 全局方法 = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);

            foreach (var 文件 in 文件们)
            {
                var 相对 = Path.GetRelativePath(根, 文件).Replace('\\', '/');
                string 源码;
                try { 源码 = File.ReadAllText(文件); }
                catch (Exception 错)
                {
                    Console.Error.WriteLine($"读不了 {相对}：{错.Message}");
                    continue;
                }

                var 树 = CSharpSyntaxTree.ParseText(源码, new CSharpParseOptions(LanguageVersion.Latest));
                var 根节点 = 树.GetRoot();
                已解析.Add((相对, 根节点));

                foreach (var 类 in 根节点.DescendantNodes().OfType<ClassDeclarationSyntax>())
                {
                    var 名 = 类.Identifier.Text;
                    if (!全局方法.TryGetValue(名, out var 集))
                    {
                        集 = new HashSet<string>(StringComparer.Ordinal);
                        全局方法[名] = 集;
                    }
                    foreach (var 法 in 类.Members.OfType<MethodDeclarationSyntax>())
                        集.Add(法.Identifier.Text);
                }
            }

            foreach (var (相对, 根节点) in 已解析)
            {
                foreach (var 类 in 根节点.DescendantNodes().OfType<ClassDeclarationSyntax>())
                {
                    var 结果 = 扫类(类, 相对, 字段表, 未识别, 全局方法);
                    if (结果 != null) 脚本们.Add(结果);
                }
            }

            var 文 = 拼JSON(根, 脚本们, 未识别);
            var 输出 = Path.Combine(输出目录, "代码.json");
            File.WriteAllText(输出, 文, new UTF8Encoding(false));

            var 边 = 脚本们.Sum(s => s.依赖.Count);
            Console.WriteLine($"[源码扫描] {脚本们.Count} 个类 / {边} 条依赖 / {未识别.Count} 处没看懂 → {输出}");
            return 0;
        }

        // ══════════ 字段表：类名 → [(字段名, 类型)] ══════════
        private static Dictionary<string, Dictionary<string, string>> 读字段表(string 关系文件)
        {
            var 表 = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
            if (!File.Exists(关系文件)) return 表;
            try
            {
                using var 档 = JsonDocument.Parse(File.ReadAllText(关系文件));
                if (!档.RootElement.TryGetProperty("脚本", out var 脚本们)) return 表;
                foreach (var 脚本 in 脚本们.EnumerateArray())
                {
                    var 名 = 脚本.GetProperty("名").GetString();
                    if (string.IsNullOrEmpty(名)) continue;
                    var 字段表 = new Dictionary<string, string>(StringComparer.Ordinal);
                    if (脚本.TryGetProperty("字段", out var 字段们))
                        foreach (var 字段 in 字段们.EnumerateArray())
                        {
                            var 字段名 = 字段.GetProperty("名").GetString();
                            var 类型 = 字段.GetProperty("类型").GetString();
                            if (!string.IsNullOrEmpty(字段名) && !string.IsNullOrEmpty(类型))
                                字段表[字段名] = 类型;
                        }
                    表[名] = 字段表;
                }
            }
            catch (Exception 错)
            {
                // 降级要留痕
                Console.Error.WriteLine($"关系.json 读不动，字段类型推不出来：{错.Message}");
            }
            return 表;
        }

        private sealed class 依赖边
        {
            public string 自;
            public string 自方法;
            public string 到;
            public string 方式;
            public int 行;
            public string 原文;
        }

        private sealed class 方法结果
        {
            public string 名;
            public int 行;
            public bool 生命周期;
            public int 调用数;
        }

        private sealed class 脚本结果
        {
            public string 类;
            public string 文件;
            public string 基类;
            public List<方法结果> 方法 = new List<方法结果>();
            public List<依赖边> 依赖 = new List<依赖边>();
        }

        private static 脚本结果 扫类(ClassDeclarationSyntax 类, string 相对文件,
                                      Dictionary<string, Dictionary<string, string>> 字段表,
                                      List<string> 未识别,
                                      Dictionary<string, HashSet<string>> 全局方法)
        {
            var 结果 = new 脚本结果
            {
                类 = 类.Identifier.Text,
                文件 = 相对文件,
                基类 = 类.BaseList?.Types.FirstOrDefault()?.Type.ToString(),
            };

            // 本类的字段：名 → 类型（源码里声明的，比关系.json 更全，因为还有 private）
            var 本类字段 = new Dictionary<string, string>(StringComparer.Ordinal);
            if (字段表.TryGetValue(结果.类, out var 外部字段))
                foreach (var kv in 外部字段) 本类字段[kv.Key] = kv.Value;

            foreach (var 声明 in 类.Members.OfType<FieldDeclarationSyntax>())
            {
                var 类型 = 声明.Declaration.Type.ToString();
                foreach (var 变量 in 声明.Declaration.Variables)
                    if (!本类字段.ContainsKey(变量.Identifier.Text))
                        本类字段[变量.Identifier.Text] = 类型;
            }
            foreach (var 属性 in 类.Members.OfType<PropertyDeclarationSyntax>())
                if (!本类字段.ContainsKey(属性.Identifier.Text))
                    本类字段[属性.Identifier.Text] = 属性.Type.ToString();

            // 所有方法（含构造函数）
            var 方法们 = 类.Members.OfType<MethodDeclarationSyntax>().ToList();

            foreach (var 方法 in 方法们)
            {
                var 行 = 方法.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
                var 名 = 方法.Identifier.Text;
                var 局部类型 = new Dictionary<string, string>(StringComparer.Ordinal);
                var 边们 = new List<依赖边>();

                扫方法体(方法, 结果.类, 名, 本类字段, 局部类型, 边们, 未识别, 全局方法);

                结果.方法.Add(new 方法结果
                {
                    名 = 名,
                    行 = 行,
                    生命周期 = 生命周期.Contains(名),
                    调用数 = 边们.Count,
                });
                结果.依赖.AddRange(边们);
            }

            return 结果;
        }

        private static void 扫方法体(MethodDeclarationSyntax 方法, string 本类, string 方法名,
                                      Dictionary<string, string> 本类字段,
                                      Dictionary<string, string> 局部类型,
                                      List<依赖边> 边们,
                                      List<string> 未识别,
                                      Dictionary<string, HashSet<string>> 全局方法)
        {
            if (方法.Body == null) return;

            // 第一遍：认局部变量的类型（var x = GetComponent<T>() 这种靠调用推）
            foreach (var 声明 in 方法.Body.DescendantNodes().OfType<VariableDeclarationSyntax>())
            {
                var 写出类型 = 声明.Type.IsVar ? null : 声明.Type.ToString();
                var 值 = 声明.Variables.FirstOrDefault()?.Initializer?.Value;
                if (写出类型 == null && 值 != null) 写出类型 = 推表达式类型(值, 本类字段, 局部类型);
                if (string.IsNullOrEmpty(写出类型)) continue;
                foreach (var 变量 in 声明.Variables)
                    局部类型[变量.Identifier.Text] = 写出类型;
            }

            // foreach (EnemyHp e in 们) —— 循环变量也算
            foreach (var 循环 in 方法.Body.DescendantNodes().OfType<ForEachStatementSyntax>())
                局部类型[循环.Identifier.Text] = 循环.Type.ToString();

            // 第二遍：找依赖
            foreach (var 调用 in 方法.Body.DescendantNodes().OfType<InvocationExpressionSyntax>())
            {
                // a.GetComponent<T>() / FindObjectOfType<T>() / 普通调用 —— 三种形状
                string 调的方法;
                ExpressionSyntax 接收者 = null;
                if (调用.Expression is MemberAccessExpressionSyntax 成员)
                {
                    调的方法 = 成员.Name.Identifier.Text;
                    接收者 = 成员.Expression;
                }
                else if (调用.Expression is GenericNameSyntax 泛名)
                {
                    调的方法 = 泛名.Identifier.Text;      // FindObjectOfType<T>() 没有 a. 前缀
                    接收者 = null;
                }
                else if (调用.Expression is IdentifierNameSyntax 简单名)
                {
                    调的方法 = 简单名.Identifier.Text;
                    接收者 = null;
                }
                else continue;

                if (!取类型的方法.Contains(调的方法))
                {
                    // ── 普通方法调用：a.M() ──
                    // 这条最重要 —— 它才是「谁调用了谁」。
                    if (接收者 == null) continue;                       // 裸调用 = 本类方法，不画
                    var 左 = 接收者.ToString();
                    if (左 == "this" || 左 == "base") continue;          // 本类方法，不画
                    if (左.Contains('.') || 左.Contains('(')) continue;  // 嵌套 e.transform.M()，推不动

                    string 接收类型 = null;
                    if (本类字段.TryGetValue(左, out var 段类型)) 接收类型 = 段类型;
                    else if (局部类型.TryGetValue(左, out var 局)) 接收类型 = 局;
                    if (string.IsNullOrEmpty(接收类型)) continue;

                    接收类型 = 去泛型(接收类型);
                    if (接收类型 == 本类) continue;                      // 拿到自己身上，还是本类
                    if (不当依赖.Contains(接收类型)) continue;

                    // 目标类上真有这个方法才算数，不然就是我没看懂的调用
                    if (!全局方法.TryGetValue(接收类型, out var 那类方法) ||
                        !那类方法.Contains(调的方法)) continue;

                    边们.Add(new 依赖边
                    {
                        自 = 本类,
                        自方法 = 方法名,
                        到 = 接收类型 + "." + 调的方法,    // 到的是方法，不是类型
                        方式 = "调用",
                        行 = 调用.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                        原文 = 压一行(调用.ToString()),
                    });
                    continue;
                }

                var 泛型 = 调用.DescendantNodes().OfType<TypeArgumentListSyntax>().FirstOrDefault();
                if (泛型 == null || 泛型.Arguments.Count == 0) continue;
                var 目标类型 = 泛型.Arguments[0].ToString();
                if (目标类型.Contains('<')) 目标类型 = 目标类型.Substring(0, 目标类型.IndexOf('<'));
                if (不当依赖.Contains(目标类型)) continue;

                var 谁 = 接收者?.ToString();
                var 是他自己 = 谁 == null || 谁 == "this" || 谁 == "gameObject" || 谁 == "transform";
                边们.Add(new 依赖边
                {
                    自 = 本类,
                    自方法 = 方法名,
                    到 = 目标类型,
                    方式 = 调的方法 + (是他自己 ? "（自己）" : "（别人）"),
                    行 = 调用.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    原文 = 压一行(调用.ToString()),
                });
            }

            // 第三遍：成员访问 —— playerData.hp 这类
            foreach (var 访问 in 方法.Body.DescendantNodes().OfType<MemberAccessExpressionSyntax>())
            {
                if (访问.Parent is InvocationExpressionSyntax) continue;     // 调用已在上面处理
                var 左 = 访问.Expression.ToString();
                if (左 == "this" || 左 == "base") continue;
                // 嵌套访问 rend.material.color —— 里层那一步已经记过了，外层不重复记
                if (左.Contains('.') || 左.Contains('(')) continue;
                // Unity 自带属性 / 静态类，不用推类型
                if (免检.Contains(左)) continue;
                if (不当依赖.Contains(左)) continue;

                string 目标类型 = null;
                if (本类字段.TryGetValue(左, out var 字段类型)) 目标类型 = 字段类型;
                else if (局部类型.TryGetValue(左, out var 局部)) 目标类型 = 局部;

                if (string.IsNullOrEmpty(目标类型))
                {
                    // 认不出来就记下来，不装作没事
                    var 行号 = 访问.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
                    var 记 = $"{本类}.{方法名} 第 {行号} 行：搞不清 `{左}` 是什么类型（{压一行(访问.ToString())}）";
                    if (!未识别.Contains(记)) 未识别.Add(记);
                    continue;
                }

                var 到 = 去泛型(目标类型);
                if (到 == 本类) continue;              // 自己跟自己不算依赖
                if (不当依赖.Contains(到)) continue;    // Vector3 / Time 这类不算依赖

                边们.Add(new 依赖边
                {
                    自 = 本类,
                    自方法 = 方法名,
                    到 = 到,
                    方式 = "字段",
                    行 = 访问.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    原文 = 压一行(访问.ToString()),
                });
            }
        }

        private static string 推表达式类型(ExpressionSyntax 值, Dictionary<string, string> 本类字段,
                                          Dictionary<string, string> 局部类型)
        {
            if (值 is InvocationExpressionSyntax 调用)
            {
                string 方法名 = null;
                if (调用.Expression is MemberAccessExpressionSyntax 成员) 方法名 = 成员.Name.Identifier.Text;
                else if (调用.Expression is GenericNameSyntax 泛名) 方法名 = 泛名.Identifier.Text;  // FindObjectOfType<T>()
                else if (调用.Expression is IdentifierNameSyntax 简单名) 方法名 = 简单名.Identifier.Text;

                if (方法名 != null && 取类型的方法.Contains(方法名))
                {
                    var 泛型 = 调用.DescendantNodes().OfType<TypeArgumentListSyntax>().FirstOrDefault();
                    if (泛型 != null && 泛型.Arguments.Count > 0)
                        return 泛型.Arguments[0].ToString().TrimEnd('[', ']');
                }
            }
            if (值 is IdentifierNameSyntax 名)
            {
                if (本类字段.TryGetValue(名.Identifier.Text, out var a)) return a;
                if (局部类型.TryGetValue(名.Identifier.Text, out var b)) return b;
            }
            if (值 is ObjectCreationExpressionSyntax 新建) return 新建.Type.ToString();
            if (值 is CastExpressionSyntax 转型) return 转型.Type.ToString();
            return null;
        }

        private static string 去泛型(string 类型名)
        {
            var i = 类型名.IndexOf('<');
            return i > 0 ? 类型名.Substring(0, i) : 类型名.TrimEnd('[', ']');
        }

        private static string 压一行(string s) =>
            s.Replace("\r", "").Replace("\n", " ").Replace("\t", " ").Trim() is var t && t.Length > 120
                ? t.Substring(0, 120) + "…" : t;

        // ══════════ JSON ══════════
        private static string 拼JSON(string 根, List<脚本结果> 脚本们, List<string> 未识别)
        {
            var j = new StringBuilder();
            j.Append("{\n");
            j.Append("  \"项目\": ").Append(串(Path.GetFileName(根))).Append(",\n");
            j.Append("  \"扫描时间\": ").Append(串(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))).Append(",\n");

            j.Append("  \"脚本\": [");
            for (var i = 0; i < 脚本们.Count; i++)
            {
                if (i > 0) j.Append(',');
                var s = 脚本们[i];
                j.Append("\n    {\"类\": ").Append(串(s.类));
                j.Append(", \"文件\": ").Append(串(s.文件));
                j.Append(", \"基类\": ").Append(s.基类 == null ? "null" : 串(s.基类));
                j.Append(", \"方法\": [");
                for (var k = 0; k < s.方法.Count; k++)
                {
                    if (k > 0) j.Append(", ");
                    var m = s.方法[k];
                    j.Append("{\"名\": ").Append(串(m.名))
                     .Append(", \"行\": ").Append(m.行)
                     .Append(", \"生命周期\": ").Append(m.生命周期 ? "true" : "false").Append('}');
                }
                j.Append("]}");
            }
            j.Append(脚本们.Count > 0 ? "\n  ],\n" : "],\n");

            j.Append("  \"依赖\": [");
            var 全部 = 脚本们.SelectMany(s => s.依赖).ToList();
            for (var i = 0; i < 全部.Count; i++)
            {
                if (i > 0) j.Append(',');
                var e = 全部[i];
                j.Append("\n    {\"自\": ").Append(串(e.自))
                 .Append(", \"自方法\": ").Append(串(e.自方法))
                 .Append(", \"到\": ").Append(串(e.到))
                 .Append(", \"方式\": ").Append(串(e.方式))
                 .Append(", \"行\": ").Append(e.行)
                 .Append(", \"原文\": ").Append(串(e.原文)).Append('}');
            }
            j.Append(全部.Count > 0 ? "\n  ],\n" : "],\n");

            j.Append("  \"没看懂\": [");
            for (var i = 0; i < 未识别.Count; i++)
            {
                if (i > 0) j.Append(", ");
                j.Append(串(未识别[i]));
            }
            j.Append("]\n}\n");
            return j.ToString();
        }

        private static string 串(string s)
        {
            if (s == null) return "null";
            var b = new StringBuilder(s.Length + 8);
            b.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': b.Append("\\\""); break;
                    case '\\': b.Append("\\\\"); break;
                    case '\n': b.Append("\\n"); break;
                    case '\r': b.Append("\\r"); break;
                    case '\t': b.Append("\\t"); break;
                    default:
                        if (c < 0x20) b.Append("\\u").Append(((int)c).ToString("x4"));
                        else b.Append(c);
                        break;
                }
            }
            b.Append('"');
            return b.ToString();
        }
    }
}
