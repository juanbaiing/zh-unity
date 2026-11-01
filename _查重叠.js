const http=require("http");
const 睡=ms=>new Promise(r=>setTimeout(r,ms));
const 连=()=>new Promise((res,rej)=>{http.get("http://127.0.0.1:9223/json/list",r=>{let s="";r.on("data",c=>s+=c);r.on("end",()=>{try{const p=JSON.parse(s).find(x=>x.type==="page"&&x.url.includes("zh.editor"));p?res(p.webSocketDebuggerUrl):rej(new Error("无"));}catch(e){rej(e);}});}).on("error",rej);});
(async()=>{
  let ws; for(let i=0;i<20;i++){try{ws=new WebSocket(await 连());break;}catch{await 睡(500);}}
  let id=0; const 等=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&等.has(m.id)){等.get(m.id)(m);等.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  const 求值=async x=>{const r=await new Promise(rr=>{const i=++id;等.set(i,rr);ws.send(JSON.stringify({id:i,method:"Runtime.evaluate",params:{expression:x,awaitPromise:true,returnByValue:true}}));});return r.result?.result?.value;};
  await 睡(1500);

  console.log("视口 CSS 尺寸 =", await 求值("innerWidth + ' x ' + innerHeight"));
  console.log("托盘里设若 chip 的 rect =", await 求值("(()=>{const c=[...document.querySelectorAll('.chip')].find(x=>x.textContent.startsWith('设若')); const r=c.getBoundingClientRect(); return JSON.stringify({top:Math.round(r.top),left:Math.round(r.left),底部:Math.round(r.bottom)});})()"));
  console.log("");
  console.log("=== 单独跑一次 清全部重叠，看已有块动不动 ===");
  console.log("之前：", await 求值("根块们.map(b=>b.类型+'@y'+Math.round(b.y)).join(', ')"));
  console.log("调用结果：", await 求值("JSON.stringify(清全部重叠())"));
  console.log("之后：", await 求值("根块们.map(b=>b.类型+'@y'+Math.round(b.y)).join(', ')"));
  console.log("");
  console.log("=== 连续重画 3 次，看坐标会不会漂 ===");
  for (let i=1;i<=3;i++){
    await 求值("重画(); 'ok'");
    await 睡(300);
    console.log("  第"+i+"次后：", await 求值("根块们.map(b=>b.类型+'@y'+Math.round(b.y)).join(', ')"));
  }
  ws.close(); process.exit(0);
})();
