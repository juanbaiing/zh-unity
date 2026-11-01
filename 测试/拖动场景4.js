const http=require('http');
const 睡=ms=>new Promise(r=>setTimeout(r,ms));
const 连=()=>new Promise((res,rej)=>{http.get('http://127.0.0.1:9223/json/list',r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{try{const p=JSON.parse(s).find(x=>x.type==='page'&&x.url.includes('zh.editor'));p?res(p.webSocketDebuggerUrl):rej(new Error('无'));}catch(e){rej(e);}});}).on('error',rej);});
(async()=>{
  let ws;for(let i=0;i<20;i++){try{ws=new WebSocket(await 连());break;}catch{await 睡(500);}}
  let id=0;const 等=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&等.has(m.id)){等.get(m.id)(m);等.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  const 发=(m,p={})=>new Promise(r=>{const i=++id;等.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  const 求值=async x=>{const r=await 发('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)return 'ERR';return r.result?.result?.value;};
  const 鼠=(t,x,y,e={})=>发('Input.dispatchMouseEvent',{type:t,x,y,button:'left',buttons:t==='mouseReleased'?0:1,clickCount:1,...e});
  // 58MB 自包含 exe 启动慢，页面没就绪时 Runtime.evaluate 会一直等 —— 先确认它活了
  for (let i = 0; i < 60; i++) {
    const 就绪 = await 求值("document.readyState + '|' + (typeof 根块们)");
    if (String(就绪).startsWith('complete|object')) break;
    await 睡(500);
  }
  await 发('Emulation.setDeviceMetricsOverride',{width:1500,height:950,deviceScaleFactor:1,mobile:false});
  await 睡(900);
  const 结果=[];const 判=(名,对,说)=>结果.push((对?'✓ ':'✗ ')+名+(对?'':'  → '+说));
  const 盒=sel=>求值(`(()=>{const e=${sel};if(!e)return '{}';const r=e.getBoundingClientRect();return JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)});})()`);
  async function 拖(chip名,到x,到y,中断){
    const s=JSON.parse(await 求值(`(()=>{document.querySelector('.palette').scrollTop=0;const c=[...document.querySelectorAll('.chip')].find(x=>x.textContent.startsWith(${JSON.stringify(chip名)}));const r=c.getBoundingClientRect();return JSON.stringify({x:Math.round(r.left+18),y:Math.round(r.top+r.height/2)});})()`));
    await 鼠('mouseMoved',s.x,s.y,{buttons:0});await 睡(80);await 鼠('mousePressed',s.x,s.y);
    for(let i=1;i<=8;i++){const t=i/8;await 鼠('mouseMoved',Math.round(s.x+(到x-s.x)*t),Math.round(s.y+(到y-s.y)*t));await 睡(50);}
    if(中断){ await 中断(); return; }
    await 鼠('mouseReleased',到x,到y);await 睡(450);
  }
  const 建=async js=>{await 求值('localStorage.clear();"ok"');await 求值(js);await 睡(700);};

  // A. 拖到块的输入框上（应该还是进那个容器，不该被输入框吞掉）
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  const 输入=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .fld')`));
  await 拖('打印',输入.l+20,输入.t+8);
  const 进没=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.map(x=>x.类型))`));
  判('拖到容器的输入框上 → 照样进容器', 进没.includes('打印'), JSON.stringify(进没));

  // B. 拖一个空容器进来，再往这个新容器里拖
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  let b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('设若',b.l+40,b.t+25);
  const 新盒=JSON.parse(await 盒(`document.querySelector('.blk[data-t="设若"] .body')`));
  if(新盒.l){
    await 拖('打印',新盒.l+30,新盒.t+20);
    const r=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.find(x=>x.类型==='设若').子.length)`));
    判('往刚拖进来的空容器里再拖', r===1, '里面有 '+r+' 个');
  } else 判('往刚拖进来的空容器里再拖',false,'没找到新容器');

  // C. 拖到一半按 Esc（不该崩、不该留半截）
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('打印',b.l+40,b.t+25,async()=>{
    await 发('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await 睡(200);
    await 鼠('mouseReleased',b.l+40,b.t+25);
    await 睡(600);
  });
  const 崩=await 求值(`typeof 重画 === 'function' && document.querySelectorAll('.blk.dragging').length`);
  判('拖动中按 Esc 不崩、不留半截块', 崩===0, '残留 '+崩);

  // D. 拖到托盘上（应该删掉）
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('打印',b.l+40,b.t+25);
  let 前=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.length)`));
  const 托=JSON.parse(await 盒(`document.querySelector('.palette')`));
  const 印盒=JSON.parse(await 盒(`document.querySelector('.blk[data-t="打印"]')`));
  await 鼠('mouseMoved',印盒.l+40,印盒.t+10,{buttons:0});await 睡(80);
  await 鼠('mousePressed',印盒.l+40,印盒.t+10);
  for(let i=1;i<=8;i++){await 鼠('mouseMoved',Math.round(印盒.l+40+(托.l+60-印盒.l-40)*i/8),Math.round(印盒.t+10+(托.t+200-印盒.t-10)*i/8));await 睡(50);}
  await 鼠('mouseReleased',托.l+60,托.t+200);await 睡(600);
  let 后=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.length)`));
  判('拖到边栏上 → 删掉', 前===1&&后===0, 前+' → '+后);

  console.log(结果.join('\n'));
  await 发('Emulation.clearDeviceMetricsOverride');
  ws.close();process.exit(0);
})().catch(e=>{console.error('失败：',e.message);process.exit(1);});
