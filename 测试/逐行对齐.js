// 中间层与 C# 逐行对齐 + 四竖列宽度
const http=require('http');
const fs=require('fs');
const 睡=ms=>new Promise(r=>setTimeout(r,ms));
const 连=()=>new Promise((res,rej)=>{http.get('http://127.0.0.1:9223/json/list',r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{try{const p=JSON.parse(s).find(x=>x.type==='page'&&x.url.includes('zh.editor'));p?res(p.webSocketDebuggerUrl):rej(new Error('无'));}catch(e){rej(e);}});}).on('error',rej);});
(async()=>{
  let ws;for(let i=0;i<20;i++){try{ws=new WebSocket(await 连());break;}catch{await 睡(500);}}
  let id=0;const 等=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&等.has(m.id)){等.get(m.id)(m);等.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  const 发=(m,p={})=>new Promise(r=>{const i=++id;等.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  const 求值=async x=>{const r=await 发('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)return 'ERR '+r.result.exceptionDetails.text;return r.result?.result?.value;};
  for(let i=0;i<60;i++){const 就绪=await 求值("document.readyState + '|' + (typeof 根块们)");if(String(就绪).startsWith('complete|object'))break;await 睡(500);}
  await 发('Emulation.setDeviceMetricsOverride',{width:1500,height:950,deviceScaleFactor:1,mobile:false});
  await 睡(900);
  const 结果=[];const 判=(名,对,说)=>结果.push((对?'✓ ':'✗ ')+名+(对?'':'  → '+说));

  // 一个有点料的场景：类 + 方法 + 循环 + if 链 + 列表
  await 求值('localStorage.clear();"ok"');
  await 求值(`(()=>{
    document.getElementById('clearBtn').click();
    const b=(t,f)=>{const x=建(t,0,0);Object.assign(x.字段,f||{});return x;};
    const 类=b('类',{名:'敌人'});
    const 法=b('方法',{名:'更新时'});
    const 重=b('重复',{次数:'3'});
    重.子.push(b('平移'), b('打印',{值:'"x"'}));
    const 若=b('设若',{条件:'血量 大于 0'});
    若.子.push(b('打印',{值:'"活着"'}));
    树.加分支(若,{条件:'血量 小于 0'},false); 树.加分支(若,{},true);
    法.子.push(重, 若, b('改变量',{名:'血量',运算法:'减一'}));
    类.子.push(法);
    根块们=[类];
    重画(); return 'ok';
  })()`);
  await 睡(700);

  // 中间层逐行 → 行数与 C# 相同
  // 注意别用 click() —— 那是个 toggle，上一轮已经开着的话会把它点关掉，
  // 于是行数变 0，测出一堆假红。直接确认它开着。
  await 求值(`(()=>{const m=document.getElementById('midLayer');
    if(!m.classList.contains('开')) document.getElementById('midToggle').click();
    return m.className;})()`);
  await 睡(400);
  const 数=JSON.parse(await 求值(`JSON.stringify({
    中: document.querySelectorAll('#midOut .ln').length,
    码: document.querySelectorAll('#out .ln').length,
    中行: [...document.querySelectorAll('#midOut .ln .tx')].map(x=>x.textContent),
    码行: [...document.querySelectorAll('#out .ln .tx')].map(x=>x.textContent),
    中号: [...document.querySelectorAll('#midOut .ln .no')].map(x=>x.textContent).join(','),
    码号: [...document.querySelectorAll('#out .ln .no')].map(x=>x.textContent).join(',')
  })`));
  判('中间层行数 = C# 行数（'+数.中+' vs '+数.码+'）', 数.中===数.码 && 数.中>0, '行数不等');
  判('行号序列完全一致', 数.中号===数.码号, '行号不同');

  // 2. 每一行在同一高度：逐行比较 getBoundingClientRect().top
  const 高 = JSON.parse(await 求值(`(()=>{
    const a=[...document.querySelectorAll('#midOut .ln')].map(x=>Math.round(x.getBoundingClientRect().top));
    const c=[...document.querySelectorAll('#out .ln')].map(x=>Math.round(x.getBoundingClientRect().top));
    return JSON.stringify({a,c});
  })()`));
  let 齐 = 高.a.length===高.c.length && 高.a.length>0;
  for(let i=0;i<Math.min(高.a.length,高.c.length);i++) if(Math.abs(高.a[i]-高.c[i])>0) 齐=false;
  判('同号行在同一水平线上', 齐, '行高/行距不一致：'+JSON.stringify(高.a.slice(0,3))+' vs '+JSON.stringify(高.c.slice(0,3)));

  // 3. 空行两边都有，且位置相同
  let 空对=true;
  for(let i=0;i<数.中行.length;i++){
    const a=(数.中行[i]||'').trim()==='', c=(数.码行[i]||'').trim()==='';
    if(a!==c) 空对=false;
  }
  判('空行位置两边相同', 空对, '空行对不上');

  // 4. 四竖列宽度
  const 宽 = JSON.parse(await 求值(`(()=>{
    const g=s=>{const e=document.querySelector(s);if(!e)return 0;return Math.round(e.getBoundingClientRect().width);};
    return JSON.stringify({托盘:g('.palette'),画布:g('.stage'),中间:g('.mid'),代码:g('.code'),总:innerWidth});
  })()`));
  判('画布宽度 ≥ 400px（'+宽.画布+'）', 宽.画布>=400, '画布被挤窄了');
  判('代码区宽度 ≥ 300px（'+宽.代码+'）', 宽.代码>=300, '代码区太窄');

  // 6. 大括号结构线：一根线 = 一个没关上的 `{`，位置就是那个 `{` 的缩进列。
  //
  // ⚠️ 判的是「线的列 == 还开着的 { 的列」，不是「线的列 == 缩进/4」。
  // 按缩进画会多出凭空的两根（缩进 16 就画 4 根，可里面只有 2 个大括号）。
  const 线 = JSON.parse(await 求值(`(()=>{
    const 拿=sel=>[...document.querySelectorAll(sel)].map(e=>{
      const p=e.style.backgroundPosition||'';
      // backgroundPosition 形如 "4ch 0px, 12ch 0px" —— 每段开头就是列号
      const 列=p?p.split(',').map(s=>parseInt(s)).filter(n=>!isNaN(n)):[];
      return { 列, 文:e.textContent };
    });
    return JSON.stringify({中:拿('#midOut .tx'), 码:拿('#out .tx')});
  })()`));

  // 自己扫一遍源码，算出每一行「应该有几根线、在哪几列」
  // 期望值：`{` 和 `}` 这两行**不画自己那根线**（跟 VS 一样，线和括号之间空整整一行），
  // 中间的行全画。
  const 应该 = [];
  const 栈 = [];
  线.码.forEach(o => {
    const t = o.文.trim();
    const 缩 = (o.文.match(/^ */) || [''])[0].length;
    if (t === '{') 栈.push(缩);
    // 头/尾那根不画，其余照画
    应该.push(栈.slice(0, t === '{' ? -1 : 栈.length));
    if (t === '}') {
      栈.pop();
      // `}` 这一行：刚弹出的那根不画，剩下的照画
      应该[应该.length - 1] = 栈.slice();
    }
  });
  let 线错 = [];
  线.码.forEach((o, i) => {
    const a = JSON.stringify(o.列.slice().sort((x,y)=>x-y));
    const b = JSON.stringify(应该[i].slice().sort((x,y)=>x-y));
    if (a !== b) 线错.push(`第${i+1}行 画出${a} 该是${b}`);
  });
  判('结构线的根数和位置 = 没关上的大括号', 线.码.length > 0 && !线错.length,
    '对不上：' + 线错.slice(0, 3).join('；'));

  // 每根线必须落在真有一个 `{` 的列上 —— 防止「凭空多画」
  const 所有brace列 = new Set();
  线.码.forEach(o => { if (o.文.trim() === '{') 所有brace列.add((o.文.match(/^ */)||[''])[0].length); });
  const 凭空 = [];
  线.码.forEach((o, i) => o.列.forEach(c => { if (!所有brace列.has(c)) 凭空.push(`第${i+1}行 ${c}ch`); }));
  判('没有一根线画在没大括号的地方', !凭空.length, '凭空画了：' + 凭空.slice(0,5).join(','));

  // 中间层也得有同样的线
  const 中列 = 线.中.map(o => o.列.length);
  const 码列 = 线.码.map(o => o.列.length);
  判('中间层的结构和 C# 一样（每行的线根数相同）',
    JSON.stringify(中列) === JSON.stringify(码列), '根数对不上');

  // 7. 线在像素上必须是连的 —— 列的算法对，也可能渲染成断线（抗锯齿、行高取整）
  //
  // ⚠️ 不能要求「整列一条不断」。if / else if / else 是三个独立的块，
  // 它们之间那一行（`else if`）本来就没有内层线，断了才是对的。
  // 所以判的是：**同一个块的范围内**必须连续 —— 具体做法是按行分组，
  // 每一组「连续相邻、都有这根线」的行，对应屏幕上的一段，那段里不能有断口。
  //
  // ⚠️ 也别按颜色扫全图。托盘背景、文字的锯齿都会落进「线的颜色带」。
  // 从 DOM 拿每根线的 ch 列 → 换算成像素 x → 只扫那几个 x。
  const 几何 = JSON.parse(await 求值(`(()=>{
    const 盒=document.getElementById('out');
    const 底=盒.getBoundingClientRect();
    const tx=[...document.querySelectorAll('#out .tx')];
    if(!tx.length) return JSON.stringify({无:true});
    const s=document.createElement('span');
    s.style.cssText='position:absolute;visibility:hidden;white-space:pre;font:inherit';
    s.textContent='    '; tx[0].appendChild(s);
    const 一ch = s.getBoundingClientRect().width/4; s.remove();
    const 行们 = tx.map(t=>{
      const r=t.getBoundingClientRect();
      const p=t.style.backgroundPosition||'';
      const 列=p?p.split(',').map(x=>parseInt(x)).filter(n=>!isNaN(n)):[];
      return {列, 上:r.top, 下:r.bottom};
    });
    return JSON.stringify({
      左: tx[0].getBoundingClientRect().left,
      一ch, 行们, 区顶: 底.top, 区底: 底.bottom
    });
  })()`));
  let 像素结论='跳过';
  if (!几何.无 && 几何.行们 && 几何.行们.length) {
    // 每根线（列 c）→ 把「连续相邻且都有这根线」的行归成段，
    // 每段对应屏幕上一段 y。那段里必须连续 —— 段与段之间本来就该断
    // （if {} / else if {} / else {} 是三对独立的大括号）。
    const 段表 = {};
    几何.行们.forEach((o, i) => {
      o.列.forEach(c => { (段表[c] = 段表[c] || []).push({ i, 上: o.上, 下: o.下 }); });
    });
    const 检查清单 = [];
    for (const c of Object.keys(段表)) {
      const 行们 = 段表[c];
      let 起 = null;
      const 段们 = [];
      for (const o of 行们) {
        if (起 === null) { 起 = { 末i: o.i, 上: o.上, 下: o.下 }; continue; }
        if (o.i === 起.末i + 1) { 起.末i = o.i; 起.下 = o.下; }
        else { 段们.push({ 上: 起.上, 下: 起.下 }); 起 = { 末i: o.i, 上: o.上, 下: o.下 }; }
      }
      if (起) 段们.push({ 上: 起.上, 下: 起.下 });
      for (const s of 段们) {
        if (s.下 - s.上 < 8) continue;   // 只有一行的不用查
        检查清单.push({
          x: Math.round(几何.左 + parseInt(c) * 几何.一ch),
          上: Math.round(Math.max(s.上, 几何.区顶)),
          下: Math.round(Math.min(s.下, 几何.区底))
        });
      }
    }
    const r线=await 发('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('D:/dswork/zh-csharp-lab/_结构线.png', Buffer.from(r线.result.data,'base64'));
    try {
      像素结论 = require('child_process').execFileSync('python',['-c',`
import json
from PIL import Image
im=Image.open(r'D:/dswork/zh-csharp-lab/_结构线.png').convert('RGB')
清单=json.loads(r'''${JSON.stringify(检查清单)}''')
def 是线(p):
    r,g,b=p
    return r>=28 and g>=34 and b>=42 and abs(r-45)<25 and abs(b-70)<30
W,H=im.size
最坏=0; 最坏段=''
for 项 in 清单:
    x=项['x']; 上=项['上']; 下=项['下']
    段=[];起=None;前=None
    for y in range(上,下):
        命中=any(0<=x+dx<W and 是线(im.getpixel((x+dx,y))) for dx in (-1,0,1))
        if 命中:
            if 起 is None: 起=y
            elif y!=前+1: 段.append((起,前)); 起=y
            前=y
    if 起 is not None: 段.append((起,前))
    段=[s for s in 段 if s[1]-s[0]>=3]
    缝=max([(段[i+1][0]-段[i][1]-1) for i in range(len(段)-1)] or [0])
    if 缝>最坏: 最坏=缝; 最坏段='x=%d y=%d..%d'%(x,上,下)
print('OK segs=%d maxgap=%d %s' % (len(清单), 最坏, 最坏段))
`],{encoding:'utf8'}).trim();
    } catch(e) { 像素结论='ERR '+String(e.message).slice(0,120); }
  }
  判('结构线在像素上是连的（'+像素结论+'）', /maxgap=[0-2]$/.test(像素结论),
     '有断口，见 _结构线.png：'+像素结论);

  // 7. `{` 和 `}` 那两行，自己那根线不画 —— 线跟括号之间空整整一行。
  //    试过「从行中间开始画」，但 `{` 字符本身就占行内 3~15px，
  //    线从 6px 起还是压在 `{` 上，等于没改（§320 的教训）。
  //    最直接的判法：最外层那个 `{`（栈里就它一根），那一行应该一根线都没有。
  const 缝 = JSON.parse(await 求值(`(()=>{
    const 行=[...document.querySelectorAll('#out .tx')];
    const i=行.findIndex(x=>x.textContent.trim()==='{');
    if(i<0) return JSON.stringify({无:true});
    return JSON.stringify({
      第一开位置: 行[i].style.backgroundPosition || '',
      最后一闭位置: (()=>{
        const j=[...行].map(x=>x.textContent.trim()).lastIndexOf('}');
        return j>=0 ? (行[j].style.backgroundPosition||'') : '';
      })()
    });
  })()`));
  判('`{` / `}` 那两行自己不画线（空整整一行，跟 VS 一样）',
     !缝.无 && 缝.第一开位置 === '' && 缝.最后一闭位置 === '',
     '线顶到括号上了：'+JSON.stringify(缝));

  // 7. 线的位置要对准「`{` 那个字符格的正中」，不能贴左边缘。
  //    字符格左边是 N ch，但 `{` 的字形在格子里是居中的 ——
  //    贴左边画，墨迹（988~990）跟线（985）差 3px，看着就是往左偏。
  const 对中 = JSON.parse(await 求值(`(()=>{
    const 行=[...document.querySelectorAll('#out .tx')];
    const t=行.find(x=>(x.style.backgroundPosition||'').trim());
    if(!t) return JSON.stringify({无:true});
    const p=t.style.backgroundPosition.trim();
    const 首 = p.split(',')[0].trim();
    return JSON.stringify({首, 有半ch: /[0-9]\\.5ch/.test(p)});
  })()`));
  判('线对准字符格正中（'+JSON.stringify(对中.首)+'）',
     !对中.无 && 对中.有半ch,
     '线还贴着格子左边，会看着偏左：'+JSON.stringify(对中));

  // 8. 滚动联动
  await 求值(`document.getElementById('midOut').scrollTop=200`);
  await 睡(200);
  const 滚=JSON.parse(await 求值(`JSON.stringify({中:document.getElementById('midOut').scrollTop,码:document.getElementById('out').scrollTop})`));
  判('滚动联动', 滚.中===滚.码 || 滚.中===0, '滚了不同步：'+JSON.stringify(滚));

  console.log(结果.join('\n'));
  console.log('');
  console.log('列宽', JSON.stringify(宽));
  console.log('第 1-6 行对照：');
  for(let i=0;i<6;i++) console.log('  '+(i+1)+' | '+(数.中行[i]||'（空）').padEnd(36)+'| '+(数.码行[i]||'（空）'));
  const 坏=结果.filter(x=>x.startsWith('✗')).length;
  console.log('\\n'+(坏?坏+' 项不过':'全过'));
  process.exit(坏?1:0);
})();
