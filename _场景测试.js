const http=require('http');
const 睡=ms=>new Promise(r=>setTimeout(r,ms));
const 连=()=>new Promise((res,rej)=>{http.get('http://127.0.0.1:9223/json/list',r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{try{const p=JSON.parse(s).find(x=>x.type==='page'&&x.url.includes('zh.editor'));p?res(p.webSocketDebuggerUrl):rej(new Error('无'));}catch(e){rej(e);}});}).on('error',rej);});
(async()=>{
  let ws; for(let i=0;i<20;i++){try{ws=new WebSocket(await 连());break;}catch{await 睡(500);}}
  if(!ws){console.log('连不上');process.exit(1);}
  let id=0; const 等=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&等.has(m.id)){等.get(m.id)(m);等.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  const 发=(m,p={})=>new Promise(r=>{const i=++id;等.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  const 求值=async x=>{const r=await 发('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)return 'ERR '+r.result.exceptionDetails.text;return r.result?.result?.value;};
  const 鼠=(t,x,y,e={})=>发('Input.dispatchMouseEvent',{type:t,x,y,button:'left',buttons:t==='mouseReleased'?0:1,clickCount:1,...e});
  await 发('Emulation.setDeviceMetricsOverride',{width:1500,height:950,deviceScaleFactor:1,mobile:false});
  await 睡(900);

  // 拖一个 chip 到页面坐标 (x,y)
  async function 拖(chip名, 到x, 到y){
    const s = JSON.parse(await 求值(`(()=>{
      document.querySelector('.palette').scrollTop=0;
      const c=[...document.querySelectorAll('.chip')].find(x=>x.textContent.startsWith(${JSON.stringify(chip名)}));
      const r=c.getBoundingClientRect();
      return JSON.stringify({x:Math.round(r.left+18),y:Math.round(r.top+r.height/2)});
    })()`));
    await 鼠('mouseMoved',s.x,s.y,{buttons:0}); await 睡(80);
    await 鼠('mousePressed',s.x,s.y);
    for(let i=1;i<=8;i++){const t=i/8; await 鼠('mouseMoved',Math.round(s.x+(到x-s.x)*t),Math.round(s.y+(到y-s.y)*t)); await 睡(50);}
    await 鼠('mouseReleased',到x,到y);
    await 睡(500);
  }
  const 树=async()=>JSON.parse(await 求值(`(()=>{const 平=(l,父)=>l.map(b=>({类:b.类型,号:b.id,父:父||'顶层',子:(b.子||[]).length,分支:(b.分支||[]).map(s=>({终结:s.终结,子:s.子.map(c=>c.类型)}))}));return JSON.stringify(平(根块们,null));})()`));
  const 底 = async()=>JSON.parse(await 求值(`(()=>{const 平=(l,父)=>[].concat(...l.map(b=>[{类:b.类型,号:b.id,父:父||'顶层'},...平(b.子||[],b.类型),...(b.分支||[]).flatMap(s=>平(s.子||[],b.类型))]));return JSON.stringify(平(根块们,null));})()`));
  const 建=async(js)=>{await 求值('localStorage.clear();"ok"');await 求值(js);await 睡(700);};
  const 盒=(sel)=>求值(`(()=>{const e=${sel}; if(!e)return 'null'; const r=e.getBoundingClientRect(); return JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)});})()`);
  const 结果=[];
  const 判=(名,对,说)=>结果.push((对?'✓ ':'✗ ')+名+(对?'':'  → '+说));

  // ① 拖到容器标题行
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  let b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .head')`));
  await 拖('打印', b.l+60, b.t+15);
  let t=await 底(); let 新=t.find(x=>x.类==='打印');
  判('拖到容器标题行 → 进容器', 新&&新.父==='类', JSON.stringify(新));

  // ② 拖进已有 3 块的容器
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
    [1,2,3].forEach(i=>{const p=建('打印',20,20+i*60);p.字段.值='"'+i+'"';类.子.push(p);});
    根块们=[类];重画();return 'ok';})()`);
  b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('打印', b.l+60, b.t+90);
  t=await 底(); const 类里=t.filter(x=>x.父==='类');
  判('拖进已有 3 块的容器', 类里.length===4, '类里有 '+类里.length+' 个');

  // ③ 从方法里拖到类里
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
    const 法=建('方法',20,20);法.字段.名='m';const 印=建('打印',20,20);印.字段.值='"x"';法.子.push(印);类.子.push(法);
    根块们=[类];重画();return 'ok';})()`);
  const 印id=Number(await 求值(`根块们[0].子[0].子[0].id`));
  b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  // 直接拖那个打印块：先找它屏幕位置
  const 印盒=JSON.parse(await 盒(`document.querySelector('.blk[data-id="${印id}"]')`));
  await 鼠('mouseMoved',印盒.l+40,印盒.t+10,{buttons:0}); await 睡(80);
  await 鼠('mousePressed',印盒.l+40,印盒.t+10);
  for(let i=1;i<=8;i++){await 鼠('mouseMoved',Math.round(印盒.l+40+(b.l+30-印盒.l-40)*i/8),Math.round(印盒.t+10+(b.t+30-印盒.t-10)*i/8)); await 睡(50);}
  await 鼠('mouseReleased',b.l+30,b.t+30); await 睡(600);
  t=await 底(); const 挪=t.find(x=>x.号===印id);
  判('方法里的块拖到类里', 挪&&挪.父==='类', JSON.stringify(挪));

  // ④ 拖到自己子孙里（应该拒绝）
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
    const 法=建('方法',20,20);法.字段.名='m';类.子.push(法);根块们=[类];重画();return 'ok';})()`);
  const 法id=Number(await 求值(`根块们[0].子[0].id`));
  const 法盒=JSON.parse(await 盒(`document.querySelector('.blk[data-id="${法id}"]')`));
  await 鼠('mouseMoved',法盒.l+40,法盒.t+10,{buttons:0}); await 睡(80);
  await 鼠('mousePressed',法盒.l+40,法盒.t+10);
  for(let i=1;i<=8;i++){await 鼠('mouseMoved',法盒.l+40,法盒.t+10+i*12); await 睡(50);}
  await 鼠('mouseReleased',法盒.l+40,法盒.t+10+96); await 睡(600);
  t=await 底(); const 法=t.find(x=>x.号===法id);
  判('把块拖进自己的框里 → 不该变成自己的子', 法&&法.父!=='方法', JSON.stringify(法));

  // ⑤ 拖到画布空白
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  const w=JSON.parse(await 盒(`document.getElementById('world')`));
  await 拖('打印', w.l+900, w.t+500);
  t=await 底(); 新=t.find(x=>x.类==='打印');
  判('拖到画布空白 → 顶层', 新&&新.父==='顶层', JSON.stringify(新));

  // ⑥ 拖进 if 分支段
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
    const 法=建('方法',20,20);法.字段.名='m';
    const 若=建('设若',20,20);若.字段.条件='x>0';树.加分支(若,{条件:'x<0'},false);
    法.子.push(若);类.子.push(法);根块们=[类];重画();return 'ok';})()`);
  const 段盒=JSON.parse(await 盒(`document.querySelectorAll('.branch .body')[0]`));
  if(段盒&&段盒.l){
    await 拖('打印', 段盒.l+50, 段盒.t+25);
    const 分支=JSON.parse(await 求值(`JSON.stringify(根块们[0].子[0].子[0].分支.map(s=>s.子.map(c=>c.类型)))`));
    判('拖进「否则若」那一栏', 分支[0]&&分支[0].length>0, JSON.stringify(分支));
  } else 判('拖进「否则若」那一栏', false, '找不到分支内容区');

  // ⑦ 连续拖 3 次
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('打印', b.l+40, b.t+20);
  b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('打印', b.l+40, b.t+b.h-20);
  b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('打印', b.l+40, b.t+b.h-20);
  t=await 底(); const 连续=t.filter(x=>x.父==='类');
  判('连续拖 3 次都进容器', 连续.length===3, '进了 '+连续.length+' 个');

  console.log(结果.join('\n'));
  await 发('Emulation.clearDeviceMetricsOverride');
  ws.close(); process.exit(0);
})().catch(e=>{console.error('失败：',e.message);process.exit(1);});
