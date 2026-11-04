
var list = new[] { 1, 2, 3, 4, 5 };

foreach (var x in list) {
    if (x > 2) {
        Console.WriteLine(x);
    } else {
        Console.WriteLine(0);
    }
}
