// 统计某个会话的事件类型，并抽一条用户消息看结构。
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

const 根 = path.join(process.env.USERPROFILE, '.dsh', 'sessions', '--D-dswork--');
const 目录 = fs.readdirSync(根).find(d => d.includes(process.argv[2]));
const 原 = fs.readFileSync(path.join(根, 目录, 'session.jsonl.zstd'));
const 帧们 = scanZstdFrames(原);
console.log(`帧数 ${帧们.length}`);

const 类型 = new Map();
let 样本 = null;
for (let i = 0; i < 帧们.length; i++) {
  let 文本; try { 文本 = zlib.zstdDecompressSync(原.subarray(帧们[i].start, 帧们[i].end)).toString('utf8'); } catch { continue; }
  for (const 行 of 文本.split('\n')) {
    const t = 行.trim(); if (!t) continue;
    let o; try { o = JSON.parse(t); } catch { continue; }
    类型.set(o.type, (类型.get(o.type) || 0) + 1);
    // 找一条不像 tool/result 的用户输入
    if (!样本 && o.type && /user/i.test(o.type) && !String(o.type).includes('tool')) 样本 = o;
  }
}
[...类型.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(6)}  ${k}`));
if (样本) {
  console.log('\n=== 一条用户事件的结构（截断） ===');
  console.log(JSON.stringify(样本).slice(0, 1500));
} else console.log('\n没找到用户事件');
