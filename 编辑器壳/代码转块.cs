// C# 代码 → 块树。
//
// 给的是「已经写好的脚本」：Unity 项目里那些 .cs 从来不是块画出来的，
// 所以在关系图上只能显示「不是块画出来的」。这个把它转过来 ——
// 能认的认成块，认不出的整行塞进「手写一行」，不丢代码。
//
// 输出结构跟 blocks2.js 的 树.新() 对齐：
//   { 类型, 字段:{...}, 子:[...], 分支:[...] }
// id 和坐标由页面补。

using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace ZhEditorShell
{
    internal static class 代码转块
    {
        public static List<object> 转脚本(string 源码, out string 项目名)
        {
            var 树 = CSharpSyntaxTree.ParseText(源码, new CSharpParseOptions(LanguageVersion.Latest));
            var 根 = 树.GetRoot();
            var 外 = new List<object>();
            项目名 = null;

            foreach (var 类 in 根.DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                if (项目名 == null) 项目名 = 类.Identifier.Text;

                var 基 = 类.BaseList?.Types.FirstOrDefault()?.Type.ToString() ?? "MonoBehaviour";
                if (基 != "MonoBehaviour" && 基 != "ScriptableObject" && 基 != "StateMachineBehaviour")
                    基 = "MonoBehaviour";

                var 块 = 造("类", ("名", 类.Identifier.Text), ("继承", 基));
                var 子 = 子们(块);

                foreach (var 成员 in 类.Members)
                {
                    if (成员 is FieldDeclarationSyntax 字段) 子.AddRange(字段块(字段));
                    else if (成员 is PropertyDeclarationSyntax 属性) 子.Add(属性块(属性));
                    else if (成员 is MethodDeclarationSyntax 方法) 子.Add(方法块(方法));
                }
                外.Add(块);
            }
            return 外;
        }

        // ── 造块 ──
        private static object 造(string 类型, params (string k, string v)[] 字段)
        {
            var 字 = new Dictionary<string, string>();
            foreach (var (k, v) in 字段) 字[k] = v ?? "";
            // 用字典而不是匿名类：匿名对象没法递归往里塞子块
            return new Dictionary<string, object>
            {
                ["类型"] = 类型,
                ["字段"] = 字,
                ["子"] = new List<object>(),
                ["分支"] = new List<object>(),
            };
        }

        private static List<object> 子们(object 块)
            => (List<object>)((Dictionary<string, object>)块)["子"];

        private static List<object> 分支们(object 块)
            => (List<object>)((Dictionary<string, object>)块)["分支"];

        private static void 设(object 块, string k, string v)
        {
            var 字 = (Dictionary<string, string>)((Dictionary<string, object>)块)["字段"];
            字[k] = v ?? "";
        }

        // ── 字段 / 属性 ──
        private static IEnumerable<object> 字段块(FieldDeclarationSyntax 声明)
        {
            var 访问 = 访问名(声明.Modifiers);
            var 类型 = 类型名(声明.Declaration.Type.ToString());
            foreach (var 变量 in 声明.Declaration.Variables)
            {
                var 值 = 变量.Initializer == null ? "" : 压(变量.Initializer.Value.ToString());
                var 块 = 造("字段",
                    ("访问", 访问), ("数据类型", 类型),
                    ("名", 变量.Identifier.Text), ("值", 值));
                yield return 块;
            }
        }

        private static object 属性块(PropertyDeclarationSyntax 属性)
            => 造("属性",
                ("访问", 访问名(属性.Modifiers)),
                ("数据类型", 类型名(属性.Type.ToString())),
                ("名", 属性.Identifier.Text),
                ("读写", 属性.AccessorList?.Accessors.Any(a => a.IsKind(SyntaxKind.SetAccessorDeclaration)) == true
                    ? "可读可写" : "只读"));

        // ── 方法 ──
        private static object 方法块(MethodDeclarationSyntax 方法)
        {
            var 块 = 造("方法",
                ("访问", 访问名(方法.Modifiers)),
                ("返回什么", 返回名(方法.ReturnType.ToString())),
                ("名", 方法名(方法.Identifier.Text)),
                ("参数", 压(方法.ParameterList.ToString()).Trim('(', ')')));

            if (方法.Body != null)
            {
                var 子 = 子们(块);
                foreach (var 句 in 方法.Body.Statements) 子.AddRange(语句们(句));
            }
            return 块;
        }

        // ── 语句 ──
        private static IEnumerable<object> 语句们(StatementSyntax 句)
        {
            switch (句)
            {
                case BlockSyntax 块:
                    return 块.Statements.SelectMany(语句们).ToList();

                case IfStatementSyntax 如果:
                    return 如果们(如果);

                case ForStatementSyntax 循环:
                    {
                        var 次 = 循环.Condition?.ToString() ?? "";
                        var 数 = 数字上身(次) ?? "";
                        var b = 造("重复", ("次数", 数.Length > 0 ? 数 : 压(次)));
                        foreach (var s in 取语句(循环.Statement))
                            子们(b).AddRange(语句们(s));
                        return new[] { b };
                    }

                case ForEachStatementSyntax 遍历:
                    {
                        var b = 造("遍历",
                            ("列表", 压(遍历.Expression.ToString())),
                            ("元素", 遍历.Identifier.Text));
                        foreach (var s in 取语句(遍历.Statement))
                            子们(b).AddRange(语句们(s));
                        return new[] { b };
                    }

                case WhileStatementSyntax 当:
                    {
                        var b = 造("只要", ("条件", 压(当.Condition.ToString())));
                        foreach (var s in 取语句(当.Statement))
                            子们(b).AddRange(语句们(s));
                        return new[] { b };
                    }

                case ReturnStatementSyntax 返回:
                    return new[] { 造("返回", ("值", 返回.Expression == null ? "" : 压(返回.Expression.ToString()))) };

                case ExpressionStatementSyntax 表达式:
                    return 表达式句(表达式.Expression);

                case LocalDeclarationStatementSyntax 声明:
                    {
                        var 表 = new List<object>();
                        foreach (var v in 声明.Declaration.Variables)
                            表.Add(造("定义变量",
                                ("名", v.Identifier.Text),
                                ("值", v.Initializer == null ? "" : 压(v.Initializer.Value.ToString()))));
                        return 表;
                    }

                case BreakStatementSyntax:
                    return new[] { 造("跳出") };
                case ContinueStatementSyntax:
                    return new[] { 造("继续") };

                default:
                    return new[] { 手写(句.ToString()) };
            }
        }

        private static object 手写(string 原文)
            => 造("手写一行", ("内容", 一行(原文)));

        // if / else if / else 变成 设若 + 分支
        private static IEnumerable<object> 如果们(IfStatementSyntax 如果)
        {
            var 主 = 造("设若", ("条件", 压(如果.Condition.ToString())));
            foreach (var s in 取语句(如果.Statement))
                子们(主).AddRange(语句们(s));

            var 结果 = new List<object> { 主 };

            var 否则 = 如果.Else;
            while (否则 != null)
            {
                if (否则.Statement is IfStatementSyntax 否则若)
                {
                    var 段 = 造("否则若", ("条件", 压(否则若.Condition.ToString())));
                    foreach (var s in 取语句(否则若.Statement))
                        子们(段).AddRange(语句们(s));
                    分支们(主).Add(段);
                    否则 = 否则若.Else;
                }
                else
                {
                    var 段 = 造("否则");
                    foreach (var s in 取语句(否则.Statement))
                        子们(段).AddRange(语句们(s));
                    分支们(主).Add(段);
                    否则 = null;
                }
            }
            return 结果;
        }

        // 表达式语句：赋值 / 自增 / 调用
        private static IEnumerable<object> 表达式句(ExpressionSyntax 式)
        {
            switch (式)
            {
                case AssignmentExpressionSyntax 赋:
                    {
                        var 法 = 赋.Kind() switch
                        {
                            SyntaxKind.AddAssignmentExpression => "加",
                            SyntaxKind.SubtractAssignmentExpression => "减",
                            SyntaxKind.MultiplyAssignmentExpression => "乘",
                            SyntaxKind.DivideAssignmentExpression => "除",
                            SyntaxKind.ModuloAssignmentExpression => "求余",
                            _ => "赋值",
                        };
                        return new[] { 造("改变量",
                            ("名", 压(赋.Left.ToString())),
                            ("运算法", 法),
                            ("值", 压(赋.Right.ToString()))) };
                    }

                case PostfixUnaryExpressionSyntax 后缀 when 后缀.IsKind(SyntaxKind.PostIncrementExpression):
                    return new[] { 造("改变量", ("名", 压(后缀.Operand.ToString())), ("运算法", "加一"), ("值", "")) };
                case PostfixUnaryExpressionSyntax 后缀 when 后缀.IsKind(SyntaxKind.PostDecrementExpression):
                    return new[] { 造("改变量", ("名", 压(后缀.Operand.ToString())), ("运算法", "减一"), ("值", "")) };
                case PrefixUnaryExpressionSyntax 前缀 when 前缀.IsKind(SyntaxKind.PreIncrementExpression):
                    return new[] { 造("改变量", ("名", 压(前缀.Operand.ToString())), ("运算法", "加一"), ("值", "")) };
                case PrefixUnaryExpressionSyntax 前缀 when 前缀.IsKind(SyntaxKind.PreDecrementExpression):
                    return new[] { 造("改变量", ("名", 压(前缀.Operand.ToString())), ("运算法", "减一"), ("值", "")) };

                case InvocationExpressionSyntax 调用:
                    return new[] { 调用块(调用) };

                default:
                    return new[] { 手写(式.ToString()) };
            }
        }

        private static object 调用块(InvocationExpressionSyntax 调用)
        {
            var 原文 = 压(调用.ToString());

            // Debug.Log(x) → 打印
            if (原文.StartsWith("Debug.Log(", StringComparison.Ordinal) && 调用.ArgumentList.Arguments.Count == 1)
                return 造("打印", ("值", 压(调用.ArgumentList.Arguments[0].Expression.ToString())));

            // x.GetComponent<T>() → 获得组件（只有赋值语句里才好认，单独成句就记原样）
            if (调用.Expression is MemberAccessExpressionSyntax 成员)
            {
                return 造("调用",
                    ("名", 压(成员.ToString())),
                    ("参数", 压(调用.ArgumentList.ToString()).Trim('(', ')')));
            }

            return 造("调用",
                ("名", 压(调用.Expression.ToString())),
                ("参数", 压(调用.ArgumentList.ToString()).Trim('(', ')')));
        }

        // 语句可能是单个，也可能是 { } 里的一串
        private static IEnumerable<StatementSyntax> 取语句(StatementSyntax 句)
            => 句 is BlockSyntax b ? b.Statements : new[] { 句 };

        // ── 名字映射 ──
        private static string 访问名(SyntaxTokenList 修饰)
        {
            if (修饰.Any(m => m.IsKind(SyntaxKind.PublicKeyword))) return "公开";
            if (修饰.Any(m => m.IsKind(SyntaxKind.PrivateKeyword))) return "私有";
            if (修饰.Any(m => m.IsKind(SyntaxKind.ProtectedKeyword))) return "受保护";
            return "默认";
        }

        private static string 类型名(string t)
        {
            var 清 = t.Replace(" ", "").TrimEnd('[', ']');
            return 清 switch
            {
                "int" or "long" or "short" or "byte" or "Int32" => "整数",
                "float" or "double" or "decimal" => "小数",
                "string" or "String" => "文本",
                "bool" or "Boolean" => "布尔",
                "Vector2" or "Vector3" or "Vector4" => "向量",
                "GameObject" => "物体",
                "Transform" => "变换",
                "Rigidbody" or "Rigidbody2D" or "CharacterController" => "刚体",
                "Collider" or "Collider2D" or "BoxCollider" or "SphereCollider" or "CapsuleCollider" => "碰撞",
                "Color" => "颜色",
                "Sprite" => "精灵",
                _ => "组件",
            };
        }

        private static string 返回名(string t)
        {
            var 清 = t.Replace(" ", "");
            return 清 switch
            {
                "void" => "无返回",
                "int" or "long" => "整数",
                "float" or "double" => "小数",
                "string" => "文本",
                "bool" => "布尔",
                "Vector2" or "Vector3" or "Vector4" => "向量",
                "GameObject" => "物体",
                _ => "无返回",
            };
        }

        // Unity 的生命周期方法换成块里的中文名，别的保持原样
        private static string 方法名(string 名) => 名 switch
        {
            "Start" => "开始时",
            "Update" => "更新时",
            "FixedUpdate" => "物理更新时",
            "LateUpdate" => "晚更新时",
            "OnDestroy" => "销毁时",
            "OnEnable" => "启用时",
            "OnDisable" => "禁用时",
            "OnCollisionEnter" or "OnCollisionEnter2D" => "碰撞进入时",
            "OnTriggerEnter" or "OnTriggerEnter2D" => "触发进入时",
            _ => 名,
        };

        // for (int i = 0; i < 3; i++) → 次数 3
        private static string 数字上身(string 条件)
        {
            var 号 = 条件.IndexOf('<');
            if (号 < 0) return "";
            var 右 = 条件.Substring(号 + 1).Trim();
            var 等 = 右.IndexOf('=');
            if (等 >= 0) 右 = 右.Substring(0, 等).Trim();
            return int.TryParse(右, out var n) ? n.ToString() : null;
        }

        private static string 压(string s) => s.Replace("\r", "").Replace("\n", " ").Trim();

        private static string 一行(string s)
        {
            var t = 压(s);
            return t.Length > 160 ? t.Substring(0, 160) + "…" : t;
        }
    }
}
