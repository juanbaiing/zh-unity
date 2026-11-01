@echo off
rem 用 Edge 的「应用模式」打开编辑器：没有地址栏、没有标签页，看着就是个独立程序。
rem 这不是打包，是零成本的伪装 —— 改代码不用重新打包，刷新即可。
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" ^
  --app="file:///D:/dswork/zh-csharp-lab/free-canvas.html" ^
  --window-size=1600,1000
