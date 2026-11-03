// 把命中的那几帧**完整**导出成文件 —— 上一步被终端截断了，看不全。
// 用法: node _导原文.js 输出文件 "词1" "词2"
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ZSTD_MAGIC = 4247762216;

function scanZstdFrames(buffer) {
  const frames = []; let offset = 0;
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

const [出文件, ...词] = process.argv.slice(2);
if (!出文件 || !词.length) { console.log('用法: node _导原文.js 输出文件 词...'); process.exit(2); }

const 根 = path.join(process.env.USERPROFILE, '.dsh', 'sessions', '--D-dswork--');
function 走(d) { const 出 = []; let 项们; try { 项们 = fs.readdirSync(d, { withFileTypes: true }); } catch { return 出; }
  for (const n of 项们) { const p = path.join(d, n.name);
    if (n.isDirectory()) 出.push(...走(p)); else if (n.name.endsWith('.jsonl.zstd')) 出.push(p); } return 出; }

const 文件们 = 走(根).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
const 段 = [];
for (const 文 of 文件们) {
  const 原 = fs.readFileSync(文);
  const 帧们 = scanZstdFrames(原);
  for (let i = 0; i < 帧们.length; i++) {
    let 文本; try { 文本 = zlib.zstdDecompressSync(原.subarray(帧们[i].start, 帧们[i].end)).toString('utf8'); } catch { continue; }
    let 平面 = 文本; try { 平面 = 找字(JSON.parse(文本.trim()), 0); } catch { }
    if (!词.every(w => 平面.includes(w))) continue;
    段.push(`\n\n${'='.repeat(70)}\n会话 ${path.basename(path.dirname(文))} 帧${i}  文件 ${(原.length/1024).toFixed(0)}KB\n${'='.repeat(70)}\n${平面}`);
  }
}
fs.writeFileSync(出文件, 段.join(''), 'utf8');
console.log(`写出 ${出文件}：${段.length} 段，${fs.statSync(出文件).size} 字节`);
