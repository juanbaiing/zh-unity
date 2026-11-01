# 用真实鼠标复现：从边栏拖块时，已有块会不会乱跑、从属关系会不会乱
# 步骤：连 CDP 准备场景 → 记下每个块的位置/从属 → 真实鼠标拖 → 再记一遍 → 对比

param([int]$Port = 9223)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class 鼠 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  public static void 前台(IntPtr h){ ShowWindow(h, 9); BringWindowToTop(h); SetForegroundWindow(h); }
  public static string 当前前台(){ return GetForegroundWindow().ToString(); }
  public struct POINT { public int X; public int Y; }
  public struct RECT { public int L; public int T; public int R; public int B; }
  public const uint 左按下 = 0x0002, 左抬起 = 0x0004;
  public static string 位置(){ POINT p; GetCursorPos(out p); return p.X + "," + p.Y; }
  public static void 移到(int x,int y){ SetCursorPos(x,y); mouse_event(0x0001,0,0,0,IntPtr.Zero); }
  public static void 按下(){ mouse_event(左按下,0,0,0,IntPtr.Zero); }
  public static void 抬起(){ mouse_event(左抬起,0,0,0,IntPtr.Zero); }
  public static int[] 客户区原点(IntPtr h){
    POINT p; p.X = 0; p.Y = 0;
    ClientToScreen(h, ref p);
    return new int[]{ p.X, p.Y };
  }
}
"@

# ---------- CDP ----------
$页 = (Invoke-RestMethod "http://127.0.0.1:$Port/json/list" | Where-Object { $_.url -like "*zh.editor*" } | Select-Object -First 1)
if (-not $页) { Write-Host "没找到页面，exe 起来了吗？"; exit 1 }

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ws.ConnectAsync([Uri]$页.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()

$脚本号 = 0
function CDP求值([string]$代码) {
    $global:脚本号++
    $id = $global:脚本号
    $报文 = @{ id = $id; method = 'Runtime.evaluate'; params = @{ expression = $代码; awaitPromise = $true; returnByValue = $true } } | ConvertTo-Json -Depth 10 -Compress
    $字节 = [Text.Encoding]::UTF8.GetBytes($报文)
    $段 = New-Object ArraySegment[byte] -ArgumentList @(,$字节)
    $ws.SendAsync($段, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()

    $缓冲 = New-Object byte[] 65536
    while ($true) {
        $收 = New-Object ArraySegment[byte] -ArgumentList @(,$缓冲)
        $t = $ws.ReceiveAsync($收, [Threading.CancellationToken]::None).Result
        $文本 = [Text.Encoding]::UTF8.GetString($缓冲, 0, $t.Count)
        try { $obj = $文本 | ConvertFrom-Json } catch { continue }
        if ($obj.id -eq $id) {
            return @{ 值 = $obj.result.result.value; 异常 = $obj.result.exceptionDetails }
        }
    }
}

function 求值([string]$代码) {
    $r = CDP求值 $代码
    if ($r.异常) { return "ERR: " + $r.异常.text }
    return $r.值
}

Start-Sleep -Milliseconds 800
Write-Host "页面标题：" (求值 "document.title")

# ---------- 窗口客户区原点 ----------
# FindWindow 对中文标题不稳，直接从进程拿主窗口句柄
$进程 = Get-Process -Name "中文套式编辑器" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $进程) { Write-Host "没找到带窗口的进程"; exit 1 }
$句柄 = [IntPtr]$进程.MainWindowHandle

# 先把它请到前台 —— 不然模拟的鼠标全打在 DSH 窗口上
[鼠]::前台($句柄)
Start-Sleep -Milliseconds 900
$前台句柄 = [鼠]::当前前台()
Write-Host "窗口句柄=$句柄  当前前台=$前台句柄  是它吗=$($前台句柄 -eq $句柄.ToString())"

# 截个屏，存下来
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$屏 = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$图 = New-Object System.Drawing.Bitmap($屏.Width, $屏.Height)
$画 = [System.Drawing.Graphics]::FromImage($图)
$画.CopyFromScreen($屏.X, $屏.Y, 0, 0, $图.Size)
$截屏路径 = "D:\dswork\zh-csharp-lab\_截屏-前台.png"
$图.Save($截屏路径, [System.Drawing.Imaging.ImageFormat]::Png)
$画.Dispose(); $图.Dispose()
Write-Host "截屏存到：$截屏路径" 
$原点 = [鼠]::客户区原点($句柄)
Write-Host "窗口客户区原点：$($原点[0]),$($原点[1])"

# ---------- 准备场景 ----------
求值 "localStorage.clear(); 'ok'" | Out-Null
求值 @"
(() => {
  document.getElementById('clearBtn').click();
  const 类 = 建('类', 40, 40); 类.字段.名 = '敌人';
  const 法 = 建('方法', 20, 20); 法.字段.名 = '更新时';
  const 印 = 建('打印', 20, 20); 印.字段.值 = '"里面"';
  法.子.push(印); 类.子.push(法);
  根块们 = [类]; 重画();
  return 'ok';
})()
"@ | Out-Null
Start-Sleep -Milliseconds 900

$快照 = {
    param($标签)
    $json = 求值 @"
(() => {
  const 描 = (列表, 父) => 列表.map(b => ({
    名: (b.字段.名 || b.字段.值 || b.类型),
    类型: b.类型,
    编号: b.id,
    父: 父 ? 父 : '(顶层)',
    x: Math.round(b.x || 0),
    y: Math.round(b.y || 0),
    x屏幕: Math.round((document.querySelector('.blk[data-id="' + b.id + '"]') || {getBoundingClientRect:()=>({left:-1,top:-1})}).getBoundingClientRect().left),
    y屏幕: Math.round((document.querySelector('.blk[data-id="' + b.id + '"]') || {getBoundingClientRect:()=>({left:-1,top:-1})}).getBoundingClientRect().top),
    子: 描(b.子 || [], b.类型),
    分支: (b.分支 || []).flatMap(s => 描(s.子 || [], b.类型))
  }));
  return JSON.stringify(描(根块们, null), null, 0);
})()
"@
    Write-Host ""
    Write-Host "===== $标签 ====="
    ($json | ConvertFrom-Json) | ForEach-Object {
        $深 = 0
        function 印节点($n, $缩) {
            Write-Host ("  " * $缩 + "$($n.类型)「$($n.名)」 父=$($n.父) 画布坐标=($($n.x),$($n.y)) 屏幕=($($n.x屏幕),$($n.y屏幕))")
            foreach ($c in $n.子) { 印节点 $c ($缩 + 1) }
            foreach ($c in $n.分支) { 印节点 $c ($缩 + 1) }
        }
        印节点 $_ 0
    }
    return $json
}

$前 = & $快照 "拖动之前"

# ---------- 拿 chip 的屏幕坐标 ----------
$chip点 = 求值 @"
(() => {
  const c = [...document.querySelectorAll('.chip')].find(x => x.textContent.startsWith('设若'));
  const r = c.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.left + 20), y: Math.round(r.top + r.height / 2) });
})()
"@ | ConvertFrom-Json

$画布点 = 求值 @"
(() => {
  const w = document.getElementById('world').getBoundingClientRect();
  return JSON.stringify({ x: Math.round(w.left + 520), y: Math.round(w.top + 260) });
})()
"@ | ConvertFrom-Json

# 页面里是 CSS 像素，鼠标 API 要物理像素 —— 中间隔着 DPI 缩放
$dpr = [double](求值 "window.devicePixelRatio")
Write-Host "缩放比 devicePixelRatio = $dpr"
$起x = [int]($原点[0] + $chip点.x * $dpr)
$起y = [int]($原点[1] + $chip点.y * $dpr)
$到x = [int]($原点[0] + $画布点.x * $dpr)
$到y = [int]($原点[1] + $画布点.y * $dpr)

# 先确认落点上到底是不是那个 chip
$落点 = 求值 "(() => { const e = document.elementFromPoint($($chip点.x), $($chip点.y)); return e ? (e.className || e.tagName) + '「' + (e.textContent||'').slice(0,8) + '」' : 'null'; })()"
Write-Host "chip 那个页面坐标上是什么：$落点"

Write-Host ""
Write-Host "真实鼠标：从 ($起x,$起y) 拖到 ($到x,$到y)"
$原鼠标 = [鼠]::位置()

# 慢慢拖，模拟人手
[鼠]::移到($起x, $起y)
Start-Sleep -Milliseconds 180
[鼠]::按下()
Start-Sleep -Milliseconds 120
for ($i = 1; $i -le 14; $i++) {
    $t = $i / 14.0
    [鼠]::移到([int]($起x + ($到x - $起x) * $t), [int]($起y + ($到y - $起y) * $t))
    Start-Sleep -Milliseconds 45
}
Start-Sleep -Milliseconds 250
[鼠]::抬起()
Start-Sleep -Milliseconds 900

$后 = & $快照 "拖动之后"
[鼠]::移到($原鼠标.Split(',')[0], $原鼠标.Split(',')[1])

# ---------- 对比 ----------
Write-Host ""
Write-Host "===== 对比 ====="
$a = $前 | ConvertFrom-Json
$b = $后 | ConvertFrom-Json
function 扁($列表, $出) {
    foreach ($n in $列表) {
        $出.Add([pscustomobject]@{ 键 = "$($n.类型)#$($n.编号)"; 名 = $n.名; 父 = $n.父; x = $n.x; y = $n.y })
        if ($n.子) { 扁 $n.子 $出 }
        if ($n.分支) { 扁 $n.分支 $出 }
    }
}
$甲 = New-Object Collections.Generic.List[object]; 扁 $a $甲
$乙 = New-Object Collections.Generic.List[object]; 扁 $b $乙

foreach ($项 in $甲) {
    $对应 = $乙 | Where-Object { $_.键 -eq $项.键 } | Select-Object -First 1
    if (-not $对应) { Write-Host "  没了：$($项.键)「$($项.名)」"; continue }
    $动 = @()
    if ($对应.父 -ne $项.父) { $动 += "父：$($项.父) → $($对应.父)" }
    if ($对应.x -ne $项.x -or $对应.y -ne $项.y) { $动 += "坐标：($($项.x),$($项.y)) → ($($对应.x),$($对应.y))" }
    if ($动.Count) { Write-Host "  ✗ $($项.键)「$($项.名)」 " ($动 -join "   ") } else { Write-Host "  ✓ $($项.键)「$($项.名)」 没动" }
}
foreach ($项 in $乙) {
    if (-not ($甲 | Where-Object { $_.键 -eq $项.键 })) { Write-Host "  新增：$($项.键)「$($项.名)」 父=$($项.父)" }
}

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", [Threading.CancellationToken]::None).Wait()
