# 真实鼠标操作：走 Windows 的输入管线，不是 dispatchEvent。
# WebView2 对合成事件和真实鼠标的处理不一样（elementFromPoint、hover、
# pointer capture 都只认真实输入），所以拖动测试必须用这个。
#
# 用法：
#   .\_鼠标.ps1 点   800 400
#   .\_鼠标.ps1 拖   800 400 1000 500
#   .\_鼠标.ps1 滚   800 400 -3        （负=往下滚缩小，正=往上滚放大）
param(
  [Parameter(Mandatory = $true)][string]$动作,
  [Parameter(ValueFromRemainingArguments = $true)][int[]]$数
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class 鼠 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint f, UIntPtr e);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool on);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  public const uint 下 = 0x0002, 上 = 0x0004, 滚 = 0x0800;
  public const uint 右下 = 0x0008, 右上 = 0x0010;

  public static bool 抢前台(IntPtr h) {
    if (GetForegroundWindow() == h) return true;
    // ① 最温和的：模拟 ALT 解前台锁
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    SetForegroundWindow(h);
    if (GetForegroundWindow() == h) return true;
    // ② 真正管用的：把自己挂着前台窗口的输入队列上，再抢。
    //    Windows 只允许「当前前台进程」把前台让给别人 —— AttachThreadInput
    //    把两个线程的输入队列并起来，就等于借了前台的资格。
    uint ignored;
    uint fgThread = GetWindowThreadProcessId(GetForegroundWindow(), out ignored);
    uint myThread = GetCurrentThreadId();
    if (fgThread != 0 && fgThread != myThread) {
      AttachThreadInput(myThread, fgThread, true);
      ShowWindow(h, 9);
      SetForegroundWindow(h);
      AttachThreadInput(myThread, fgThread, false);
      if (GetForegroundWindow() == h) return true;
    }
    // ③ 最后退一步：最小化再还原，把它顶到最前
    ShowWindow(h, 6);
    ShowWindow(h, 9);
    SetForegroundWindow(h);
    return GetForegroundWindow() == h;
  }
}
"@

# ⚠️ 抢不到前台就**直接失败退出**，别接着往下倒鼠标动作。
#    抢不到的时候光标照样会动、mouse_event 照样返回，但事件全落到别的窗口上 ——
#    页面连一个 mousemove 都收不到，看起来像「页面坏了」，其实是根本没点中它。
#    实测栽过：一轮滚轮测试全是 0 事件，我却去改 CSS。
$proc = Get-Process -Name "中文套式编辑器" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($proc) {
  if (-not [鼠]::抢前台($proc.MainWindowHandle)) {
    Write-Error "抢不到前台，鼠标动作会落到别的窗口上 —— 这次测试作废"
    exit 3
  }
  Start-Sleep -Milliseconds 200
} else {
  Write-Error "编辑器进程没在跑"
  exit 3
}

function 移到($x, $y) { [鼠]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds 8 }

switch ($动作) {
  '移' {
    $x, $y = $数[0], $数[1]
    移到 $x $y
    Start-Sleep -Milliseconds 30
    # 抖一像素再抖回来 —— 光标本来就在原地时 Windows 不发 mousemove，
    # 页面就收不到这次移动，标定会读到旧值。
    移到 ($x + 1) $y
    Start-Sleep -Milliseconds 30
    移到 $x $y
    Write-Output "移 ($x,$y)"
  }
  '右' {
    # 右键单击。空头框的「误报申诉」菜单靠它 —— 这个必须是真的右键，
    # WM_RBUTTONDOWN 走系统输入管线，页面的 contextmenu 才会带着正确的坐标来。
    $x, $y = $数[0], $数[1]
    移到 $x $y
    Start-Sleep -Milliseconds 120
    [鼠]::mouse_event([鼠]::右下, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 90
    [鼠]::mouse_event([鼠]::右上, 0, 0, 0, [IntPtr]::Zero)
    Write-Output "右 ($x,$y)"
  }
  '点' {
    $x, $y = $数[0], $数[1]
    移到 $x $y
    Start-Sleep -Milliseconds 80
    [鼠]::mouse_event([鼠]::下, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 60
    [鼠]::mouse_event([鼠]::上, 0, 0, 0, [IntPtr]::Zero)
    Write-Output "点 ($x,$y)"
  }
  '拖' {
    $x1, $y1, $x2, $y2 = $数[0], $数[1], $数[2], $数[3]
    # 第 5 个参数：1 = 按住 Shift 拖（用来验「Shift 拖 = 挪外层」）
    $按Shift = ($数.Length -ge 5 -and $数[4] -eq 1)
    移到 $x1 $y1
    Start-Sleep -Milliseconds 100
    if ($按Shift) { [鼠]::keybd_event(0x10, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60 }
    [鼠]::mouse_event([鼠]::下, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    # 分 24 步走完 —— 一步跳到底的话浏览器的 pointermove 可能只收到一次，
    # 而真实的拖拽依赖连续的 move 事件（阈值判定、悬停盒子都靠它）。
    $步 = 24
    for ($i = 1; $i -le $步; $i++) {
      $x = [int]($x1 + ($x2 - $x1) * $i / $步)
      $y = [int]($y1 + ($y2 - $y1) * $i / $步)
      移到 $x $y
    }
    Start-Sleep -Milliseconds 120
    [鼠]::mouse_event([鼠]::上, 0, 0, 0, [IntPtr]::Zero)
    if ($按Shift) { [鼠]::keybd_event(0x10, 0, 2, [UIntPtr]::Zero) }
    Write-Output "拖 ($x1,$y1) → ($x2,$y2) 上下$(if($按Shift){' +Shift'})"
  }
  'Ctrl拖' {
    # 按住 Ctrl 拖 —— 画布上「拉出一个大注释框」是这个手势
    $x1, $y1, $x2, $y2 = $数[0], $数[1], $数[2], $数[3]
    移到 $x1 $y1
    Start-Sleep -Milliseconds 100
    [鼠]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 60
    [鼠]::mouse_event([鼠]::下, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    $步 = 24
    for ($i = 1; $i -le $步; $i++) {
      $x = [int]($x1 + ($x2 - $x1) * $i / $步)
      $y = [int]($y1 + ($y2 - $y1) * $i / $步)
      移到 $x $y
    }
    Start-Sleep -Milliseconds 120
    [鼠]::mouse_event([鼠]::上, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 60
    [鼠]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
    Write-Output "Ctrl拖 ($x1,$y1) → ($x2,$y2)"
  }
  '右拖' {
    # 右键按住拖 —— 画布上「拖出一个大注释框」是这个手势。
    $x1, $y1, $x2, $y2 = $数[0], $数[1], $数[2], $数[3]
    移到 $x1 $y1
    Start-Sleep -Milliseconds 100
    [鼠]::mouse_event([鼠]::右下, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    $步 = 24
    for ($i = 1; $i -le $步; $i++) {
      $x = [int]($x1 + ($x2 - $x1) * $i / $步)
      $y = [int]($y1 + ($y2 - $y1) * $i / $步)
      移到 $x $y
    }
    Start-Sleep -Milliseconds 120
    [鼠]::mouse_event([鼠]::右上, 0, 0, 0, [IntPtr]::Zero)
    Write-Output "右拖 ($x1,$y1) → ($x2,$y2)"
  }
  '滚' {
    $x, $y, $次 = $数[0], $数[1], $数[2]
    移到 $x $y
    Start-Sleep -Milliseconds 80
    # 第 4 个参数在 Win32 里是 uint。往下滚是 -120，直接传 Int32 负值会
    # 在 PowerShell→UInt32 的隐式转换里失败，整段 roll 就不生效 —— 显式绕成 uint。
    $方向 = if ($次 -gt 0) { 120 } else { -120 }
    # 第 5 个参数：1 = 按住 Shift 再滚（用来验「Shift 缩外层」那条通道）。
    # 不按住修饰键的话，真鼠标永远测不了带修饰键的分支。
    $按Shift = ($数.Length -ge 4 -and $数[3] -eq 1)
    if ($按Shift) { [鼠]::keybd_event(0x10, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60 }
    for ($i = 0; $i -lt [Math]::Abs($次); $i++) {
      [鼠]::mouse_event([鼠]::滚, 0, 0, $方向, [IntPtr]::Zero)
      Start-Sleep -Milliseconds 40
    }
    if ($按Shift) { [鼠]::keybd_event(0x10, 0, 2, [UIntPtr]::Zero) }
    Write-Output "滚 ($x,$y) x$次$(if($按Shift){' +Shift'})"
  }
  default { Write-Output "不认识的动作：$动作（移/点/拖/滚）" }
}
