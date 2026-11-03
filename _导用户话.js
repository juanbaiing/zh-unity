// 导出某个会话里**用户真正说的话**（type = "user/message"），按时间顺序。
// ⚠️ 不能按 "role":"user" 找 —— tool/result 的 message 里 role 也是 user，会混进工具输出。
// 用法: node _导用户话.js 会话前缀 输出文件
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

const [前缀, 出文件, 过滤] = process.argv.slice(2);
const 根 = path.join(process.env.USERPROFILE, '.dsh', 'sessions', '--D-dswork--');
const 目录 = fs.readdirSync(根).find(d => d.includes(前缀));
if (!目录) { console.error('找不到会话 ' + 前缀); process.exit(1); }
const 原 = fs.readFileSync(path.join(根, 目录, 'session.jsonl.zstd'));
const 帧们 = scanZstdFrames(原);

const 见 = new Set(); const 净 = [];
for (let i = 0; i < 帧们.length; i++) {
  let 文本; try { 文本 = zlib.zstdDecompressSync(原.subarray(帧们[i].start, 帧们[i].end)).toString('utf8'); } catch { continue; }
  for (const 行 of 文本.split('\n')) {
    const t = 行.trim(); if (!t.includes('"user/message"')) continue;
    let o; try { o = JSON.parse(t); } catch { continue; }
    if (o.type !== 'user/message') continue;
    const 内 = (o.data && o.data.content) || [];
    for (const c of 内) {
      if (!c || c.type !== 'text' || typeof c.text !== 'string') continue;
      const 文 = c.text.trim();
      if (!文 || 见.has(文)) continue;
      if (过滤 && !文.includes(过滤)) continue;
      见.add(文);
      净.push({ seq: o.seq, 文 });
    }
  }
}
净.sort((a, b) => a.seq - b.seq);
const 出 = 净.map((x, i) => `--- [${i + 1}] seq=${x.seq} ---\n${x.文}\n`).join('\n');
fs.writeFileSync(出文件, 出, 'utf8');
console.log(`写出 ${出文件}：${净.length} 条用户消息，${出.length} 字`);
