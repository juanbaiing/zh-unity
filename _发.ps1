# 改完页面就跑这个：查语法 → 打包 → 编译 → 重启（带调试端口）
# 以前总是漏掉「编译」那步，导致以为改了没效果，其实跑的是旧 exe。
Set-Location "D:\dswork\zh-csharp-lab"

node _查语法.js
if ($LASTEXITCODE -ne 0) { Write-Output "语法没过，停"; exit 1 }

node 打包单文件.js | Select-Object -Last 1

# 编译前必须先杀掉正在跑的那个 —— 它锁着 exe，MSB3027 就是它
Get-Process -Name "中文套式编辑器" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 800

$env:DOTNET_CLI_HOME = "D:\dswork\zh-csharp-lab\.dotnet"
$env:NUGET_PACKAGES = "D:\dswork\zh-csharp-lab\.nuget"
Push-Location "编辑器壳"
$build = dotnet build -v q --nologo 2>&1
Pop-Location
$build | Select-String -Pattern "error|已成功" | Select-Object -First 3
if ($build -match "error") { Write-Output "编译失败，停"; exit 1 }

Start-Sleep -Milliseconds 300
$env:ZH_EDITOR_DEBUG_PORT = "9222"
Start-Process "D:\dswork\zh-csharp-lab\编辑器壳\bin\Debug\net11.0-windows\中文套式编辑器.exe"
Start-Sleep -Seconds 5
Write-Output "重启好了，调试端口 9222"
