// 直接调 代码转块 跑一遍，看真能不能转出块来。
// 不走界面 —— 界面出问题时，先确认这一层是好的。

using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace 转块测试
{
    internal static class Program
    {
        private static int Main(string[] 参数)
        {
            var 根 = 参数.Length > 0 ? 参数[0] : @"D:\vs学习\My project\Assets";
            var 文件们 = Directory.GetFiles(根, "*.cs", SearchOption.AllDirectories);

            Console.WriteLine("扫描 " + 根 + " → " + 文件们.Length + " 个 .cs");
            Console.WriteLine();

            var 成 = 0;
            var 败 = 0;

            foreach (var 文件 in 文件们)
            {
                if (文件.Contains(@"\Editor\")) continue;
                var 名 = Path.GetFileName(文件);
                try
                {
                    var 源码 = File.ReadAllText(文件);
                    var 块们 = ZhEditorShell.代码转块.转脚本(源码, out var 项目名);
                    if (string.IsNullOrEmpty(项目名)) { Console.WriteLine("空  " + 名 + "  （没有 class）"); continue; }

                    var 数 = 数块(块们);
                    Console.WriteLine("✓  " + 名 + " → " + 项目名 + "  " + 数 + " 个块");
                    成++;

                    if (参数.Length > 1 && 参数[1] == "详")
                    {
                        var json = JsonSerializer.Serialize(块们, new JsonSerializerOptions
                        {
                            WriteIndented = true,
                            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
                        });
                        Console.WriteLine(json.Length > 2000 ? json.Substring(0, 2000) + "\n…" : json);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("✗  " + 名 + " —— " + ex.GetType().Name + ": " + ex.Message);
                    败++;
                }
            }

            Console.WriteLine();
            Console.WriteLine("成了 " + 成 + " 个，败了 " + 败 + " 个");
            return 败 == 0 ? 0 : 1;
        }

        private static int 数块(List<object> 块们)
        {
            var n = 0;
            void 走(List<object> 列)
            {
                foreach (var b in 列)
                {
                    n++;
                    var d = (Dictionary<string, object>)b;
                    if (d["子"] is List<object> 子) 走(子);
                    if (d["分支"] is List<object> 分支) 走(分支);
                }
            }
            走(块们);
            return n;
        }
    }
}
