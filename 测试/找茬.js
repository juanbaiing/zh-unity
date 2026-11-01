// 专门找茬：边界值、怪输入、极端情况
const http=require('http');
const 睡=ms=>new Promise(r=>setTimeout(r,ms));
const 连=()=>new Promise((res,rej)=>{http.get('http://127.0.0.1:9223/json/list',r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{try{const p=JSON.parse(s).find(x=>x.type==='page'&&x.url.includes('zh.editor'));p?res(p.webSocketDebuggerUrl):rej(new Error('无'));}catch(e){rej(e);}});}).on('error',rej);});
(async()=>{
  let ws;for(let i=0;i<20;i++){try{ws=new WebSocket(await 连());break;}catch{await 睡(500);}}
  let id=0;const 等=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&等.has(m.id)){等.get(m.id)(m);等.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  const 发=(m,p={})=>new Promise(r=>{const i=++id;等.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  const 求值=async x=>{const r=await 发('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)return 'ERR:'+(r.result.exceptionDetails.exception?.description||'').split('\n')[0];return r.result?.result?.value;};
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
  const 盒=sel=>求值(`(()=>{const e=${sel};if(!e)return '{}';const r=e.getBoundingClientRect();return JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)});})()`);
  const 清=async js=>{await 求值('localStorage.clear();"ok"');await 求值(js||`(()=>{document.getElementById('clearBtn').click();根块们=[];重画();return 'ok';})()`);await 睡(600);};

  // ① 字段里塞怪字符
  await 清(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='敌人';根块们=[类];重画();return 'ok';})()`);
  const 怪=await 求值(`(()=>{
    const 危=['"',"'",'\\','{','}','<script>','</div>','%s','$\{x\}','\n','       '];
    const 出=[];
    for(const v of 危){
      根块们[0].字段.名=v;
      try{ 重画(); 出.push(JSON.stringify(v)+':ok'); }catch(e){ 出.push(JSON.stringify(v)+':崩 '+e.message); }
    }
    根块们[0].字段.名='敌人'; 重画();
    return 出.join(' | ');
  })()`);
  判('字段塞怪字符不崩', !String(怪).includes('崩'), String(怪).slice(0,120));

  // ② 名字超长
  await 清(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A'.repeat(300);根块们=[类];重画();return 'ok';})()`);
  await 睡(400);
  const 超长=await 求值(`(()=>{const e=document.querySelector('.blk[data-t="类"]');const r=e.getBoundingClientRect();return JSON.stringify({宽:Math.round(r.width),画布有:!!e});})()`);
  const 超长o=JSON.parse(超长);
  判('名字 300 字不撑爆布局', 超长o.宽<3000 && 超长o.画布有, JSON.stringify(超长o));

  // ③ 循环引用：把块塞进自己
  await 清(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';根块们=[类];重画();return 'ok';})()`);
  const 自引=await 求值(`(()=>{try{
    根块们[0].子.push(根块们[0]);
    重画();
    const 出='没崩，子数='+根块们[0].子.length;
    根块们[0].子=[]; 重画();
    return 出;
  }catch(e){ return '崩了：'+e.message; }})()`);
  结果.push('· 块自己塞进自己（非法数据）：'+String(自引).slice(0,40)+'  ← 直接改数据才造得出来，不算失败');

  // ④ 空工程 / 全空数据
  await 求值('localStorage.clear();"ok"');
  const 空读=await 求值(`(()=>{try{ 工程表={}; 当前工程=''; 根块们=[]; 重画(); const 读=读盘(); return '不崩，读盘='+读; }catch(e){ return '崩了：'+e.message; }})()`);
  判('空工程读盘', !String(空读).startsWith('崩'), String(空读).slice(0,80));

  // ⑤ 存档坏了
  const 坏档=await 求值(`(()=>{try{
    localStorage.setItem('zh-editor-工程表','{这不是json');
    const r=读盘();
    localStorage.removeItem('zh-editor-工程表');
    return '不崩，读盘='+r;
  }catch(e){ return '崩了：'+e.message; }})()`);
  判('存档是坏 JSON', !String(坏档).startsWith('崩'), String(坏档).slice(0,80));

  // ⑥ 重复点新建工程 20 次
  const 多工=await 求值(`(()=>{try{
    localStorage.clear(); 工程表={}; 当前工程='';
    for(let i=0;i<20;i++) 新工程();
    const n=Object.keys(工程表).length;
    const 名们=Object.keys(工程表);
    return '工程数='+n+' 有重名='+(new Set(名们).size!==n);
  }catch(e){ return '崩了：'+e.message; }})()`);
  判('连点 20 次新建工程', String(多工).includes('工程数=20')&&String(多工).includes('没有重名'.slice(0,0)+'false'), String(多工));

  // ⑦ 空画布生成
  await 清(`(()=>{document.getElementById('clearBtn').click();根块们=[];重画();return 'ok';})()`);
  const 空生成=await 求值(`当前代码`);
  const 空检查=await 求值(`document.getElementById('errCount').textContent`);
  判('空画布 → 不生成 class、编译检查不炸', !String(空生成).includes('public class') && String(空检查).length>0, '代码长度='+String(空生成).length+' 状态='+空检查);

  // ⑧ 只有孤岛块（没类）
  await 清(`(()=>{document.getElementById('clearBtn').click();const p=建('打印',40,40);p.字段.值='"飘"';根块们=[p];重画();return 'ok';})()`);
  const 孤=await 求值(`(()=>{return JSON.stringify({代码:document.getElementById('out').textContent.slice(0,40),孤岛:document.getElementById('孤岛提示').textContent});})()`);
  判('只有孤岛块 → 有提示、生成不炸', String(孤).includes('孤岛')||String(孤).includes('没进类'), String(孤).slice(0,100));

  // ⑨ 一秒钟连点清空 10 次
  const 连清=await 求值(`(()=>{try{for(let i=0;i<10;i++) document.getElementById('clearBtn').click(); return '不崩';}catch(e){return '崩了：'+e.message;}})()`);
  判('连点 10 次清空', String(连清)==='不崩', String(连清));

  // ⑩ 拖到两个块的缝隙里
  await 清(`(()=>{document.getElementById('clearBtn').click();const 类=建('类',40,40);类.字段.名='A';
     const a=建('打印',20,20);a.字段.值='"1"';const b=建('打印',20,20);b.字段.值='"2"';类.子.push(a,b);根块们=[类];重画();return 'ok';})()`);
  const 缝=await 求值(`(()=>{const 块们=[...document.querySelectorAll('.blk[data-t="打印"]')];const r1=块们[0].getBoundingClientRect();const r2=块们[1].getBoundingClientRect();return JSON.stringify({缝:Math.round(r2.top-r1.bottom),缝y:Math.round((r1.bottom+r2.top)/2),x:Math.round(r1.left+30)});})()`);
  判('两块的缝隙够不够拖进去', JSON.parse(缝).缝>=5, 缝);

  console.log(结果.join('\n'));
  await 发('Emulation.clearDeviceMetricsOverride');
  ws.close();process.exit(0);
})().catch(e=>{console.error('失败：',e.message);process.exit(1);});
