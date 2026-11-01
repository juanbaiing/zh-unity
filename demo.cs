// 中文套式实验 — 一一对应下面那段
// 给（数字列表 的 每一个 x）{ 打印(x * x); }
var 数字列表 = new[] { 1, 2, 3, 4 };
给(数字列表, x => Console.WriteLine(x * x));

// 若（x 大于 100）{ 打印("大了"); } 否则 { 打印("小了"); }
若(250 > 100, () => 打印("大了"), () => 打印("小了"));

void 给(int[] 列表, Action<int> 动作)
{
    foreach (var x in 列表) 动作(x);
}

void 若(bool 条件, Action 真, Action 假)
{
    if (条件) 真(); else 假();
}

void 打印(object 值) => Console.WriteLine(值);
