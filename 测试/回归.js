const http=require('http');const fs=require('fs');
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
  const 睡1=ms=>new Promise(r=>setTimeout(r,ms));
  await 发('Emulation.setDeviceMetricsOverride',{width:1500,height:950,deviceScaleFactor:1,mobile:false});
  await 睡1(900);
  const 结果=[];const 判=(名,对,说)=>结果.push((对?'✓ ':'✗ ')+名+(对?'':'  → '+说));
  const 盒=sel=>求值(`(()=>{const e=${sel};if(!e)return '{}';const r=e.getBoundingClientRect();return JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)});})()`);
  async function 拖(chip名,到x,到y){
    const s=JSON.parse(await 求值(`(()=>{document.querySelector('.palette').scrollTop=0;const c=[...document.querySelectorAll('.chip')].find(x=>x.textContent.startsWith(${JSON.stringify(chip名)}));const r=c.getBoundingClientRect();return JSON.stringify({x:Math.round(r.left+18),y:Math.round(r.top+r.height/2)});})()`));
    await 鼠('mouseMoved',s.x,s.y,{buttons:0});await 睡1(80);await 鼠('mousePressed',s.x,s.y);
    for(let i=1;i<=8;i++){const t=i/8;await 鼠('mouseMoved',Math.round(s.x+(到x-s.x)*t),Math.round(s.y+(到y-s.y)*t));await 睡1(50);}
    await 鼠('mouseReleased',到x,到y);await 睡1(450);
  }
  const 建=async js=>{await 求值('localStorage.clear();"ok"');await 求值(js);await 睡1(700);};

  // A. 拖容器块进容器（不是叶子）
  await 建(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  let b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('设若',b.l+40,b.t+25);
  let 类里=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.map(x=>x.类型))`));
  判('拖容器块（设若）进类', 类里.includes('设若'), JSON.stringify(类里));

  // B. 再加一个块到那个设若里
  const 若盒=JSON.parse(await 盒(`document.querySelector('.blk[data-t="设若"] .body')`));
  if(若盒.l){ await 拖('打印',若盒.l+30,若盒.t+20);
    const 若子=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.find(x=>x.类型==='设若').子.map(y=>y.类型))`));
    判('再拖一个进设若', 若子.includes('打印'), JSON.stringify(若子));
  } else 判('再拖一个进设若',false,'没找到设若');

  // C. 拖宽边栏之后再拖
  await 求值(`(()=>{document.querySelector('.palette').style.width='300px';return 'ok';})()`);
  await 睡1(300);
  b=JSON.parse(await 盒(`document.querySelector('.blk[data-t="类"] .body')`));
  await 拖('打印',b.l+200,b.t+60);
  const 宽后=JSON.parse(await 求值(`JSON.stringify(根块们[0].子.length)`));
  判('边栏拖宽后照样能拖', 宽后>=2, '类里有 '+宽后+' 个');
  await 求值(`(()=>{document.querySelector('.palette').style.width='170px';return 'ok';})()`);

  // D. 生成 + 编译检查
  await 睡1(3000);
  const 代码=await 求值(`document.getElementById('out').textContent`);
  const 状态=await 求值(`document.getElementById('errCount').textContent`);
  判('生成正常', 代码&&代码.includes('public class'), (代码||'').slice(0,20));
  判('编译检查有结果', 状态&&状态.length>0, 状态);

  // E. 多工程标签（先清干净，前面的场景会留下工程）
  await 求值(`localStorage.clear(); 工程表={}; 当前工程=''; 新工程(); 新工程(); 'ok'`);
  await 睡1(400);
  const 标签数=await 求值(`document.querySelectorAll('.tab:not(.新)').length`);
  判('新建工程', 标签数===2, '标签数 '+标签数);

  // F. 存盘/读盘
  await 求值(`存盘(); 'ok'`);
  const 存档=await 求值(`(localStorage.getItem('zh-editor-工程表')||'').length>10`);
  判('存档有内容', 存档===true, String(存档));

  // G. 空画布时不该出块
  await 求值(`localStorage.clear(); (()=>{document.getElementById('clearBtn').click();重画();return 'ok';})()`);
  await 睡1(600);
  const 空=await 求值(`document.querySelectorAll('#world > .blk').length`);
  判('清空后画布是空的', 空===0, '还有 '+空+' 个');

  console.log(结果.join('\n'));
  await 发('Emulation.clearDeviceMetricsOverride');
  ws.close();process.exit(0);
})().catch(e=>{console.error('失败：',e.message);process.exit(1);});
