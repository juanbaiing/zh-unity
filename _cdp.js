// 读 CDP 的 /json 列表，把每个页面的 title 打出来（真浏览器里页面上报的结果）
const http = require('http');

http.get('http://127.0.0.1:9222/json', res => {
  let s = '';
  res.on('data', c => s += c);
  res.on('end', () => {
    try {
      const list = JSON.parse(s);
      const t = list.filter(p => p.type === 'page').map(p => p.url.split('/').pop() + '  ->  ' + p.title);
      console.log(t.join('\n'));
    } catch (e) { console.log('解析失败：' + s.slice(0, 300)); }
  });
}).on('error', e => console.log('连不上 ' + e.message));
