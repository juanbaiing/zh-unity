const http=require('http');
const fs=require('fs');
const 睡=ms=>new Promise(r=>setTimeout(r,ms));
const 连=()=>new Promise((res,rej)=>{http.get('http://127.0.0.1:9223/json/list',r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{try{const p=JSON.parse(s).find(x=>x.type==='page'&&x.url.includes('zh.editor'));p?res(p.webSocketDebuggerUrl):rej(new Error('无'));}catch(e){rej(e);}});}).on('error',rej);});
(async()=>{
  let ws; for(let i=0;i<20;i++){try{ws=new WebSocket(await 连());break;}catch{await 睡(500);}}
  let id=0; const 等=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&等.has(m.id)){等.get(m.id)(m);等.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  const 发=(m,p={})=>new Promise(r=>{const i=++id;等.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  const 求值=async x=>{const r=await 发('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)return 'ERR';return r.result?.result?.value;};
  const 鼠=(t,x,y,e={})=>发('Input.dispatchMouseEvent',{type:t,x,y,button:'left',buttons:t==='mouseReleased'?0:1,clickCount:1,...e});
  await 发('Emulation.setDeviceMetricsOverride',{width:1500,height:950,deviceScaleFactor:1,mobile:false});
  await 睡(900);
  async function 拖(chip名,到x,到y){
    const s=JSON.parse(await 求值(`(()=>{document.querySelector('.palette').scrollTop=0;const c=[...document.querySelectorAll('.chip')].find(x=>x.textContent.startsWith(${JSON.stringify(chip名)}));const r=c.getBoundingClientRect();return JSON.stringify({x:Math.round(r.left+18),y:Math.round(r.top+r.height/2)});})()`));
    await 鼠('mouseMoved',s.x,s.y,{buttons:0});await 睡(80);await 鼠('mousePressed',s.x,s.y);
    for(let i=1;i<=8;i++){const t=i/8;await 鼠('mouseMoved',Math.round(s.x+(到x-s.x)*t),Math.round(s.y+(到y-s.y)*t));await 睡(50);}
    await 鼠('mouseReleased',到x,到y);await 睡(500);
  }
  async function 拖块(id,到x,到y){
    const b=JSON.parse(await 求值(`(()=>{const e=document.querySelector('.blk[data-id="${id}"]');if(!e)return 'null';const r=e.getBoundingClientRect();return JSON.stringify({l:Math.round(r.left),t:Math.round(r.top)});})()`));
    if(!b||!b.l)return;
    await 鼠('mouseMoved',b.l+40,b.t+10,{buttons:0});await 睡(80);await 鼠('mousePressed',b.l+40,b.t+10);
    for(let i=1;i<=8;i++){await 鼠('mouseMoved',Math.round(b.l+40+(到x-b.l-40)*i/8),Math.round(b.t+10+(到y-b.t-10)*i/8));await 睡(50);}
    await 鼠('mouseReleased',到x,到y);await 睡(500);
  }
  const 树=async()=>JSON.parse(await 求值(`(()=>{const 平=(l,父)=>[].concat(...l.map(b=>[{类:b.类型,号:b.id,父:父||'顶层'},...平(b.子||[],b.类型),...(b.分支||[]).flatMap(s=>平(s.子||[],b.类型))]));return JSON.stringify(平(根块们,null));})()`));
  const 建=async js=>{await 求值('localStorage.clear();"ok"');await 求值(js);await 睡(700);};
  const 盒=sel=>求值(`(()=>{const e=${sel};if(!e)return '{}';const r=e.getBoundingClientRect();return JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)});})()`);
  const 结果=[];const 判=(名,对,说)=>结果.push((对?'✓ ':'✗ ')+名+(对?'':'  → '+说));

  // ⑧ 从「否则若」段拖出来
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
    const 法=建('方法',20,20);法.字段.名='m';const 若=建('设若',20,20);若.字段.条件='x>0';
    树.加分支(若,{条件:'x<0'},false);const 印=建('打印',20,20);印.字段.值='"分支里"';若.分支[0].子.push(印);
    法.子.push(若);类.子.push(法);根块们=[类];重画();return 'ok';})()`);
  const 印id=Number(await 求值(`根块们[0].子[0].子[0].分支[0].子[0].id`));
  const w=JSON.parse(await 盒(`document.getElementById('world')`));
  await 拖块(印id, w.l+950, w.t+700);
  let t=await 树();let 挪=t.find(x=>x.号===印id);
  判('把块从「否则若」段拖到画布', 挪&&挪.父==='顶层', JSON.stringify(挪));

  // ⑨ 拖到「否则」段
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
    const 法=建('方法',20,20);法.字段.名='m';const 若=建('设若',20,20);若.字段.条件='x>0';
    树.加分支(若,{},true);法.子.push(若);类.子.push(法);根块们=[类];重画();return 'ok';})()`);
  const 段们=await 求值(`document.querySelectorAll('.branch .body').length`);
  const 末段=JSON.parse(await 盒(`[...document.querySelectorAll('.branch .body')].pop()`));
  if(末段.l){ await 拖('打印',末段.l+50,末段.t+25);
    const 分支=JSON.parse(await 求值(`JSON.stringify(根块们[0].子[0].子[0].分支.map(s=>s.子.length))`));
    判('拖进「否则」那一栏', 分支[0]>0, JSON.stringify(分支));
  } else 判('拖进「否则」那一栏',false,'找不到段');

  // ⑩ 拖到四层嵌套最内层
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
    const 法=建('方法',20,20);法.字段.名='m';const 若=建('设若',20,20);若.字段.条件='x>0';
    法.子.push(若);类.子.push(法);根块们=[类];重画();return 'ok';})()`);
  const 最内=JSON.parse(await 盒(`[...document.querySelectorAll('.body')].sort((a,b)=>{const d=e=>{let n=0,p=e;while(p&&p!==document.body){p=p.parentElement;n++;}return n;};return d(b)-d(a);})[0]`));
  await 拖('打印',最内.l+40,最内.t+25);
  t=await 树();const 深=new Function('return 1');
  const 层级=JSON.parse(await 求值(`(()=>{const 找=(l,d)=>{for(const b of l){if(b.类型==='打印')return d;const r=找(b.子||[],d+1);if(r>=0)return r;}return -1;};return JSON.stringify(找(根块们,0));})()`));
  判('拖进四层嵌套最里层', 层级===3, '在第 '+层级+' 层');

  // ⑪ 拖到画布左边外（负坐标）
  await 建(`(()=>{document.getElementById('clearBtn').click();根块们=[];重画();return 'ok';})()`);
  await 拖('打印', 200, 400);
  const 坐标=JSON.parse(await 求值(`JSON.stringify(根块们.map(b=>({x:Math.round(b.x),y:Math.round(b.y)})))`));
  判('拖到画布靠左', 坐标[0]&&坐标[0].x>=0, JSON.stringify(坐标));

  // ⑫ 拖完撤销
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  const 前n=(await 树()).length;
  const b2=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('打印',b2.l+40,b2.t+20);
  const 中n=(await 树()).length;
  求值("撤销()");
  await 睡(500);
  const 后n=(await 树()).length;
  判('拖完撤销能回去', 中n===前n+1&&后n===前n, 前n+'→'+中n+'→'+后n);

  console.log(结果.join('\n'));
  await 发('Emulation.clearDeviceMetricsOverride');
  ws.close();process.exit(0);
})().catch(e=>{console.error('失败：',e.message);process.exit(1);});
