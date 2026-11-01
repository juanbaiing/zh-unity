// 一条命令把编辑器打成独立 exe
//   node 打包.js          → 自包含版，约 50 MB，拷到任何 Windows 都能跑
//   node 打包.js 瘦身     → 只 1.4 MB，但目标机器得装 .NET 运行时
// （不用 .bat —— cmd 按 GBK 读 UTF-8 会乱码，中文命令全解析错）
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const 根 = __dirname;
process.env.DOTNET_CLI_HOME = path.join(根, '.dotnet');
process.env.NUGET_PACKAGES = path.join(根, '.nuget');

const 自包含 = process.argv[2] !== '瘦身';
const 出 = path.join(根, 自包含 ? '发布' : '发布-瘦身');

console.log('[1/2] 合成单文件页面…');
execFileSync(process.execPath, [path.join(根, '打包单文件.js')], { stdio: 'inherit' });

console.log('\n[2/2] 编译并发布 exe…（' + (自包含 ? '自包含，约 50 MB' : '瘦身，约 1.4 MB') + '）');
const 壳 = path.join(根, '编辑器壳');
execFileSync('dotnet', [
  'publish', '-c', 'Release', '-r', 'win-x64',
  '--self-contained', 自包含 ? 'true' : 'false',
  '-p:PublishSingleFile=true',
  '-p:IncludeNativeLibrariesForSelfExtract=true',
  '-p:IncludeAllContentForSelfExtract=true',
  ...(自包含 ? ['-p:EnableCompressionInSingleFile=true'] : []),
  '-o', 出, '--nologo', '-v', 'q',
], { cwd: 壳, stdio: 'inherit' });

// 文档和调试符号用不着
for (const f of fs.readdirSync(出)) {
  if (/\.(xml|pdb)$/i.test(f)) fs.unlinkSync(path.join(出, f));
}

const exe = path.join(出, '中文套式编辑器.exe');
if (!fs.existsSync(exe)) { console.error('\n没打出 exe，看上面的报错'); process.exit(1); }
const mb = (fs.statSync(exe).size / 1024 / 1024).toFixed(1);
console.log('\n完成 → ' + exe + '  (' + mb + ' MB)');
