// 在指定目录的 DSH 会话存档里搜关键词，输出命中帧的上下文。
// 比 _搜会话.js 多的两件事：能只搜某个项目目录、一次可以给多组词（任一组命中即报）。
//
// 用法：
//   node _找原文.js "词A" "词B"            ← 两组都命中
//   node _找原文.js --目录=--D-dswork-- "2687093"
//   node _找原文.js --限=30 "一眼"
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ZSTD_MAGIC = 4247762216;

function scanZstdFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    const start = offset;
    if (buffer.length - offset < 4) break;
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break;
    offset += 4;
    if (offset === buffer.length) break;
    const descriptor = buffer.readUInt8(offset); offset += 1;
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 32) !== 0;
    const checksum = (descriptor & 4) !== 0;
    const dictionaryFlag = descriptor & 3;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : (1 << contentSizeFlag);
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buffer.length - offset < remainingHeaderBytes) break;
    offset += remainingHeaderBytes;
    let 断 = false;
    for (;;) {
      if (buffer.length - offset < 3) { 断 = true; break; }
      const blockHeader = buffer.readUIntLE(offset, 3); offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 3;
      const blockSize = blockHeader >>> 3;
      if (blockType === 3) { 断 = true; break; }
      offset += blockType === 1 ? 1 : blockSize;
      if (lastBlock) break;
    }
    if (断) break;
    if (checksum) { if (buffer.length - offset < 4) break; offset += 4; }
    frames.push({ start, end: offset });
  }
  return frames;
}

function 找字(v, 深) {
  if (深 > 12) return '';
  if (typeof v === 'string') return v + '\n';
  if (Array.isArray(v)) return v.map(x => 找字(x, 深 + 1)).join('');
  if (v && typeof v === 'object') { let s = ''; for (const k of Object.keys(v)) s += 找字(v[k], 深 + 1); return s; }
  return '';
}

const 参 = process.argv.slice(2);
let 目录 = null, 限 = 40, 宽 = 900;
const 词 = [];
for (const a of 参) {
  if (a.startsWith('--目录=')) 目录 = a.slice(5);
  else if (a.startsWith('--限=')) 限 = Number(a.slice(4));
  else if (a.startsWith('--宽=')) 宽 = Number(a.slice(4));
  else 词.push(a);
}
if (!词.length) { console.log('用法: node _找原文.js [--目录=名] [--限=N] [--宽=N] 词...'); process.exit(2); }

const 根 = path.join(process.env.USERPROFILE, '.dsh', 'sessions', 目录 || '');
function 走(d) {
  const 出 = [];
  let 项们; try { 项们 = fs.readdirSync(d, { withFileTypes: true }); } catch { return 出; }
  for (const 名 of 项们) {
    const p = path.join(d, 名.name);
    if (名.isDirectory()) 出.push(...走(p));
    else if (名.name.endsWith('.jsonl.zstd')) 出.push(p);
  }
  return 出;
}

const 文件们 = 走(根).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
console.log(`搜 ${文件们.length} 个会话，词 = ${词.join(' + ')}`);

let 命中 = 0;
for (const 文 of 文件们) {
  const 原 = fs.readFileSync(文);
  const 帧们 = scanZstdFrames(原);
  for (let i = 0; i < 帧们.length; i++) {
    let 文本;
    try { 文本 = zlib.zstdDecompressSync(原.subarray(帧们[i].start, 帧们[i].end)).toString('utf8'); } catch { continue; }
    let 平面 = 文本;
    try { 平面 = 找字(JSON.parse(文本.trim()), 0); } catch { }
    if (!词.every(w => 平面.includes(w))) continue;
    命中++;
    const 位 = 平面.indexOf(词[0]);
    const 会话 = path.basename(path.dirname(文)).slice(0, 8);
    const 大 = (原.length / 1024).toFixed(0);
    console.log(`\n════ ${会话} 帧${i} (${大}KB) ════`);
    console.log(平面.slice(Math.max(0, 位 - 200), 位 + 宽).replace(/\n{3,}/g, '\n\n').trim());
    if (命中 >= 限) { console.log(`\n(到上限 ${限})`); process.exit(0); }
  }
}
console.log(`\n共命中 ${命中} 帧`);
