// 边界值分析法：错误最容易躲在边界上，不在中间
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
  await 睡(800);
  const 结果=[];const 判=(名,对,说)=>结果.push((对?'✓ ':'✗ ')+名+(对?'':'  → '+说));
  const 清=async js=>{await 求值('localStorage.clear();"ok"');await 求值(js);await 睡(600);};
  const 盒=sel=>求值(`(()=>{const e=${sel};if(!e)return '{}';const r=e.getBoundingClientRect();return JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)});})()`);

  // ---- 拖动阈值：普通块 4px，输入框 7px ----
  async function 挪几像素(目标,像素,从输入框){
    await 清(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
    const sel = 从输入框 ? `document.querySelector('.blk[data-t="类"] .fld')` : `document.querySelector('.blk[data-t="类"] > .head')`;
    const b=JSON.parse(await 盒(sel));
    const x=从输入框? b.l+20 : b.l+10, y=b.t+8;
    await 鼠('mouseMoved',x,y,{buttons:0}); await 睡(100);
    await 鼠('mousePressed',x,y);
    await 鼠('mouseMoved',x+像素,y,{}); await 睡(150);
    const 拖了=await 求值(`document.querySelectorAll('.blk.dragging').length`);
    await 鼠('mouseReleased',x+像素,y); await 睡(300);
    return 拖了>0;
  }
  // 普通区域：3 不拖、4 拖
  const p3=await 挪几像素(null,3,false), p4=await 挪几像素(null,4,false), p5=await 挪几像素(null,5,false);
  判('普通处 3px 不触发拖动', p3===false, '拖了='+p3);
  判('普通处 4px 触发拖动', p4===true, '拖了='+p4);
  判('普通处 5px 触发拖动', p5===true, '拖了='+p5);
  // 输入框：6 不拖、7 拖
  const f6=await 挪几像素(null,6,true), f7=await 挪几像素(null,7,true), f8=await 挪几像素(null,8,true);
  判('输入框上 6px 不触发', f6===false, '拖了='+f6);
  判('输入框上 7px 触发', f7===true, '拖了='+f7);
  判('输入框上 8px 触发', f8===true, '拖了='+f8);

  // ---- 坐标边界 ----
  await 清(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',0,0);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  let 坐=JSON.parse(await 求值(`JSON.stringify({x:根块们[0].x,y:根块们[0].y})`));
  判('坐标 0,0 能渲染', 坐.x===0&&坐.y===0, JSON.stringify(坐));
  await 求值(`(()=>{根块们[0].x=-50;根块们[0].y=-50;重画();return 'ok';})()`);
  await 睡(400);
  坐=JSON.parse(await 求值(`JSON.stringify({x:根块们[0].x,y:根块们[0].y,有:!!document.querySelector('.blk')})`));
  判('负坐标不崩（虽然看不见）', 坐.有===true, JSON.stringify(坐));

  // ---- 嵌套深度 10 层 / 30 层 ----
  for (const 深 of [10,12]) {
    await 清(`(()=>{document.getElementById('clearBtn').click();let 外=建('类',20,20);外.字段.名='D';
      let 当前=外; for(let i=0;i<${深-1};i++){const c=建('设若',12,12);c.字段.条件='x>'+i;当前.子.push(c);当前=c;}
      根块们=[外];重画();return 'ok';})()`);
    await 睡(500);
    const 好=await 求值(`!!document.querySelector('.blk') && document.querySelectorAll('.blk').length`);
    判(深+' 层嵌套能渲染', 好===深, '渲染出 '+好+' 个块');
  }

  // ---- 字段长度 0 / 1 / 200 ----
  for (const [标,长] of [['空',0],['1 字',1],['200 字',200]]) {
    await 清(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='${'字'.repeat(长)}';根块们=[类];重画();return 'ok';})()`);
    await 睡(400);
    const 有=await 求值(`!!document.querySelector('.blk[data-t="类"]')`);
    判('字段长度 '+标, 有===true, '没了');
  }

  // ---- 画布坐标上限 2400 ----
  await 清(`(()=>{document.getElementById('clearBtn').click();const p=建('打印',2399,1599);p.字段.值='"边"';根块们=[p];重画();return 'ok';})()`);
  await 睡(400);
  const 界=JSON.parse(await 求值(`(()=>{const w=document.getElementById('world').getBoundingClientRect();return JSON.stringify({画布宽:Math.round(w.width),画布高:Math.round(w.height)});})()`));
  判('块摆到画布右下角 2399,1599 → 画布跟着扩', 界.画布宽>=2400, JSON.stringify(界));

  console.log(结果.join('\n'));
  await 发('Emulation.clearDeviceMetricsOverride');
  ws.close();process.exit(0);
})().catch(e=>{console.error('失败：',e.message);process.exit(1);});
