// 把 PlayerAttack.cs 反推回块树，写成页面能直接塞进存档的 JSON。
//
// 起因：一份工程的块树被我的一次测试覆盖成空了，但 C# 还在 —— 代码转块能把结构还原，
// 还原的是「代码说了什么」，不是「当初怎么摆的」（位置、手动调过的布局回不来）。
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;

class 主
{
    static void Main(string[] 参数)
    {
        var 源 = 参数.Length > 0 ? 参数[0] : @"D:\vs学习\My project\Assets\PlayerAttack.cs";
        var 出 = 参数.Length > 1 ? 参数[1] : Path.Combine(AppContext.BaseDirectory, "PlayerAttack.块.json");

        var 源码 = File.ReadAllText(源);
        var 块们 = ZhEditorShell.代码转块.转脚本(源码, out var 项目名);
        Console.WriteLine("源文件: " + 源);
        Console.WriteLine("认出类名: " + (项目名 ?? "（没有）"));
        Console.WriteLine("块数: " + 块们.Count);

        if (string.IsNullOrEmpty(项目名))
        {
            Console.WriteLine("没认出类名，说明这份不是 MonoBehaviour 脚本，停下。");
            return;
        }

        var json = JsonSerializer.Serialize(块们, new JsonSerializerOptions
        {
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        });
        File.WriteAllText(出, json, new UTF8Encoding(false));
        Console.WriteLine("写到: " + 出);

        // 顺便把每个顶层块的类型数一遍，好核对有没有漏
        var 数 = new Dictionary<string, int>();
        void 收(List<object> 列)
        {
            foreach (var o in 列)
            {
                if (o is not Dictionary<string, object> 块) continue;
                var t = 块.TryGetValue("类型", out var v) ? v?.ToString() ?? "?" : "?";
                数[t] = 数.TryGetValue(t, out var n) ? n + 1 : 1;
                if (块.TryGetValue("子", out var 子) && 子 is List<object> 子列) 收(子列);
            }
        }
        收(块们);
        foreach (var kv in 数) Console.WriteLine("  " + kv.Key + " × " + kv.Value);
    }
}
