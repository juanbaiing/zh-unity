const http=require('http');
const 睡=ms=>new Promise(r=>setTimeout(r,ms));
const 连=()=>new Promise((res,rej)=>{http.get('http://127.0.0.1:9223/json/list',r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{try{const p=JSON.parse(s).find(x=>x.type==='page'&&x.url.includes('zh.editor'));p?res(p.webSocketDebuggerUrl):rej(new Error('无'));}catch(e){rej(e);}});}).on('error',rej);});
(async()=>{
  let ws;for(let i=0;i<20;i++){try{ws=new WebSocket(await 连());break;}catch{await 睡(500);}}
  let id=0;const 等=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&等.has(m.id)){等.get(m.id)(m);等.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  const 发=(m,p={})=>new Promise(r=>{const i=++id;等.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  const 求值=async x=>{const r=await 发('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)return 'ERR '+r.result.exceptionDetails.text;return r.result?.result?.value;};
  const 鼠=(t,x,y,e={})=>发('Input.dispatchMouseEvent',{type:t,x,y,button:'left',buttons:t==='mouseReleased'?0:1,clickCount:1,...e});
  await 发('Emulation.setDeviceMetricsOverride',{width:1500,height:950,deviceScaleFactor:1,mobile:false});
  await 睡(900);
  const 结果=[];const 判=(名,对,说)=>结果.push((对?'✓ ':'✗ ')+名+(对?'':'  → '+说));
  const 盒=sel=>求值(`(()=>{const e=${sel};if(!e)return '{}';const r=e.getBoundingClientRect();return JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)});})()`);
  async function 拖(chip名,到x,到y){
    const s=JSON.parse(await 求值(`(()=>{document.querySelector('.palette').scrollTop=0;const c=[...document.querySelectorAll('.chip')].find(x=>x.textContent.startsWith(${JSON.stringify(chip名)}));const r=c.getBoundingClientRect();return JSON.stringify({x:Math.round(r.left+18),y:Math.round(r.top+r.height/2)});})()`));
    await 鼠('mouseMoved',s.x,s.y,{buttons:0});await 睡(80);await 鼠('mousePressed',s.x,s.y);
    for(let i=1;i<=8;i++){const t=i/8;await 鼠('mouseMoved',Math.round(s.x+(到x-s.x)*t),Math.round(s.y+(到y-s.y)*t));await 睡(50);}
    await 鼠('mouseReleased',到x,到y);await 睡(450);
  }
  const 建=async js=>{await 求值('localStorage.clear();"ok"');await 求值(js);await 睡(700);};
  const 树=async()=>JSON.parse(await 求值(`(()=>{const 平=(l,父)=>[].concat(...l.map(b=>[{类:b.类型,号:b.id,父:父||'顶层'},...平(b.子||[],b.类型),...(b.分支||[]).flatMap(s=>平(s.子||[],b.类型))]));return JSON.stringify(平(根块们,null));})()`));

  // A. 新加的「否则若」段（空段）能拖进去
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
    const 法=建('方法',20,20);法.字段.名='m';const 若=建('设若',20,20);若.字段.条件='x>0';
    法.子.push(若);类.子.push(法);根块们=[类];重画();return 'ok';})()`);
  // 用界面按钮加一个否则若（模拟点「＋否则若」）
  await 求值(`(()=>{const 主=[...document.querySelectorAll('.blk[data-t="设若"] > .head .ctl')].find(x=>x.textContent==='＋否则若');if(主)主.click();return 'ok';})()`);
  await 睡(700);
  const 段=JSON.parse(await 盒(`[...document.querySelectorAll('.branch .body')].pop()`));
  if(段.l){ await 拖('打印',段.l+40,段.t+20);
    const 分支=JSON.parse(await 求值(`JSON.stringify(根块们[0].子[0].子[0].分支.map(s=>s.子.length))`));
    判('点按钮新加的分支能拖进块', 分支[0]===1, JSON.stringify(分支));
  } else 判('点按钮新加的分支能拖进块',false,'没找到分支');

  // B. 删掉块之后剩下的还能拖
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
    [1,2,3].forEach(i=>{const p=建('打印',20,20+i*60);p.字段.值='"'+i+'"';类.子.push(p);});
    根块们=[类];重画();return 'ok';})()`);
  await 求值(`(()=>{const 删=[...document.querySelectorAll('.blk[data-t="打印"] > .head .ctl.del')][0];if(删)删.click();return 'ok';})()`);
  await 睡(600);
  let n=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.length)`));
  let b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('打印',b.l+40,b.t+b.h-15);
  let n2=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.length)`));
  判('删掉一个之后还能往里拖', n===2&&n2===3, n+' → '+n2);

  // C. 连拖 6 次
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  for(let i=0;i<6;i++){
    b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
    await 拖('打印',b.l+40,b.t+b.h-12);
  }
  n=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.length)`));
  判('连续拖 6 次', n===6, '进了 '+n+' 个');

  // D. 撤销重做连按
  const 前=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.length)`));
  await 求值(`撤销();撤销();'ok'`); await 睡(500);
  const 撤后=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.length)`));
  await 求值(`重做();重做();'ok'`); await 睡(500);
  const 重后=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.length)`));
  判('连撤两次再连重做两次', 撤后===前-2&&重后===前, 前+' → 撤 '+撤后+' → 重 '+重后);

  // E. 拖到自己身上（同一块，原地松开）
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  const 类盒=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"]')`));
  await 鼠('mouseMoved',类盒.l+40,类盒.t+10,{buttons:0});await 睡(80);
  await 鼠('mousePressed',类盒.l+40,类盒.t+10);
  for(let i=1;i<=5;i++){await 鼠('mouseMoved',类盒.l+40+i*3,类盒.t+10+i*2);await 睡(50);}
  await 鼠('mouseReleased',类盒.l+55,类盒.t+20);await 睡(600);
  const t=await 树();
  判('拖自己原地松开 → 还在顶层、没散架', t.length===1&&t[0].类==='类'&&t[0].父==='顶层', JSON.stringify(t));

  console.log(结果.join('\n'));
  await 发('Emulation.clearDeviceMetricsOverride');
  ws.close();process.exit(0);
})().catch(e=>{console.error('失败：',e.message);process.exit(1);});
