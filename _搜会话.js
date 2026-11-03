// 在 DSH 会话存档里搜关键词。
//
// 会话是「多帧拼接的 zstd」：每帧一条记录，帧之间没有分隔符，
// 所以不能一次 decompress 完（只会解出第一帧）。这里照抄 DSH 自己的
// scanZstdFrames（node_modules/@deepseek-ai/dsh-session-persistence-jsonl）
// 来定位每帧的起止字节。
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
    const descriptor = buffer.readUInt8(offset);
    offset += 1;
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
      const blockHeader = buffer.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 3;
      const blockSize = blockHeader >>> 3;
      if (blockType === 3) { 断 = true; break; }
      const payloadBytes = blockType === 1 ? 1 : blockSize;
      if (buffer.length - offset < payloadBytes) { 断 = true; break; }
      offset += payloadBytes;
      if (lastBlock) break;
    }
    if (断) break;
    if (checksum) {
      if (buffer.length - offset < 4) break;
      offset += 4;
    }
    frames.push({ start, end: offset });
  }
  return frames;
}

function 找字(v, 深) {
  if (深 > 10) return '';
  if (typeof v === 'string') return v + '\n';
  if (Array.isArray(v)) return v.map(x => 找字(x, 深 + 1)).join('');
  if (v && typeof v === 'object') {
    let s = '';
    for (const k of Object.keys(v)) s += 找字(v[k], 深 + 1);
    return s;
  }
  return '';
}

const 词 = process.argv.slice(2);
if (!词.length) { console.log('用法: node _搜会话.js 词1 [词2]'); process.exit(2); }

const 根 = path.join(process.env.USERPROFILE, '.dsh', 'sessions');
function 走(目录) {
  const 出 = [];
  let 项们;
  try { 项们 = fs.readdirSync(目录, { withFileTypes: true }); } catch { return 出; }
  for (const 名 of 项们) {
    const p = path.join(目录, 名.name);
    if (名.isDirectory()) 出.push(...走(p));
    else if (名.name.endsWith('.jsonl.zstd')) 出.push(p);
  }
  return 出;
}

const 文件们 = 走(根).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
console.log('会话 ' + 文件们.length + ' 个，从大到小找');

let 命中 = 0;
for (const 文 of 文件们) {
  const 原 = fs.readFileSync(文);
  const 帧们 = scanZstdFrames(原);
  for (let i = 0; i < 帧们.length; i++) {
    let 文本;
    try { 文本 = zlib.zstdDecompressSync(原.subarray(帧们[i].start, 帧们[i].end)).toString('utf8'); }
    catch { continue; }

    // 解出来是 jsonl 一行，展开成纯文本再搜
    let 平面 = 文本;
    try { 平面 = 找字(JSON.parse(文本.trim()), 0); } catch { }

    if (!词.every(w => 平面.includes(w))) continue;
    命中++;
    const 位 = 平面.indexOf(词[0]);
    console.log('\n════ ' + path.basename(path.dirname(文)).slice(0, 24) + ' 帧' + i + ' ════');
    console.log(平面.slice(Math.max(0, 位 - 320), 位 + 520).replace(/\n{2,}/g, '\n').trim());
    if (命中 >= 8) { console.log('\n(够了)'); process.exit(0); }
  }
}
console.log('\n共命中 ' + 命中);
