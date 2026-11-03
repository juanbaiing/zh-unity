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
  public const uint 下 = 0x0002, 上 = 0x0004, 滚 = 0x0800;
}
"@

$proc = Get-Process -Name "中文套式编辑器" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($proc) { [鼠]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null; Start-Sleep -Milliseconds 300 }

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
    移到 $x1 $y1
    Start-Sleep -Milliseconds 100
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
    Write-Output "拖 ($x1,$y1) → ($x2,$y2)"
  }
  '滚' {
    $x, $y, $次 = $数[0], $数[1], $数[2]
    移到 $x $y
    Start-Sleep -Milliseconds 80
    # 第 4 个参数在 Win32 里是 uint。往下滚是 -120，直接传 Int32 负值会
    # 在 PowerShell→UInt32 的隐式转换里失败，整段 roll 就不生效 —— 显式绕成 uint。
    $方向 = if ($次 -gt 0) { 120 } else { -120 }
    for ($i = 0; $i -lt [Math]::Abs($次); $i++) {
      [鼠]::mouse_event([鼠]::滚, 0, 0, $方向, [IntPtr]::Zero)
      Start-Sleep -Milliseconds 40
    }
    Write-Output "滚 ($x,$y) x$次"
  }
  default { Write-Output "不认识的动作：$动作（点/拖/滚）" }
}
