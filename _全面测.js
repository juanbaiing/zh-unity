// 全面测试：拖动 / 宽度 / 边界 / 缩放 / 内层块
// 每个用例都先复位，避免上一次的残留污染下一次。
const http = require('http');
const 端口 = process.env.ZH_PORT || 9222;

function 要(路径) {
  return new Promise((好, 坏) => {
    http.get(`http://127.0.0.1:${端口}${路径}`, r => {
      let b = ''; r.on('data', c => (b += c)); r.on('end', () => 好(b));
    }).on('error', 坏);
  });
}

(async () => {
  const 列 = JSON.parse(await 要('/json/list'));
  const 页 = 列.find(t => t.type === 'page');
  const ws = new WebSocket(页.webSocketDebuggerUrl);
  const 等 = new Map(); let 号 = 0;
  const 调用 = (m, p = {}) => new Promise((好, 坏) => {
    const id = ++号; 等.set(id, { 好, 坏 });
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && 等.has(m.id)) {
      const { 好, 坏 } = 等.get(m.id); 等.delete(m.id);
      m.error ? 坏(new Error(JSON.stringify(m.error))) : 好(m.result);
    }
  };
  await new Promise(好 => (ws.onopen = 好));

  // 注入工具箱
  // ⚠️ 每个用例之间必须恢复块树和坐标 —— 拖动会改坐标、会存盘，
  //    不复位的话下一个用例量到的是上一个用例的残局，读数全是假的。
  await 调用('Runtime.evaluate', {
    expression: `window.__原样 = null;
    window.__T = {
      备份: function(){ window.__原样 = JSON.parse(JSON.stringify(工程表[当前工程].块们)); },
      复位: function(z){
        if (window.__原样) {
          工程表[当前工程].块们 = JSON.parse(JSON.stringify(window.__原样));
          根块们 = 工程表[当前工程].块们;
        }
        重画();
        if (z != null) 视.z = z;
        视.x = 60; 视.y = 60; 应用视();
      },
      找块: function(列, id){ for (const b of (列||[])) { if (b.id===id) return b; const r=this.找块(b.子,id); if(r)return r; for(const f of (b.分支||[])){const q=this.找块(f.子,id); if(q)return q;} } return null; },
      拖: function(块, dx, dy){
        const r = 块.getBoundingClientRect();
        const 发 = (t,x,y,目) => 目.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,button:0,pointerId:1}));
        发('pointerdown', r.left+8, r.top+8, 块);
        发('pointermove', r.left+8+dx*0.3, r.top+8+dy*0.3, document);
        发('pointermove', r.left+8+dx, r.top+8+dy, document);
        发('pointerup', r.left+8+dx, r.top+8+dy, document);
      }
    };`,
    returnByValue: true,
  });

  const 跑 = async (名, 式) => {
    const r = await 调用('Runtime.evaluate', { expression: 式, returnByValue: true });
    const v = r.result.value;
    console.log('\n【' + 名 + '】');
    console.log(typeof v === 'object' ? JSON.stringify(v) : v);
    return v;
  };

  // ── 0. 先备份原地
  await 跑('0 备份原样', `(__T.备份(), '备份好，共 ' + window.__原样.length + ' 个顶层块')`);

  // ── 1. 顶层大块：位置准不准、宽度变不变、world 扩不扩
  await 跑('1 顶层块 z=1 拖 120,80', `(function(){
    __T.复位(1);
    const 块 = 世界.querySelector('.blk'); const id = +块.dataset.id;
    const b = __T.找块(根块们, id);
    const 前 = {x:+b.x.toFixed(1), y:+b.y.toFixed(1), 宽:块.offsetWidth, world宽:世界.offsetWidth};
    __T.拖(块, 120, 80);
    const 后块 = 世界.querySelector('.blk[data-id="'+id+'"]'); const b2 = __T.找块(根块们, id);
    return {前, 后:{x:+b2.x.toFixed(1), y:+b2.y.toFixed(1), 宽:后块?后块.offsetWidth:'没了', world宽:世界.offsetWidth},
            应移:{x:120, y:80}, 实移:{x:+(b2.x-前.x).toFixed(1), y:+(b2.y-前.y).toFixed(1)}, 宽度稳定: 后块 && 后块.offsetWidth===前.宽};
  })()`);

  // ── 2. 拖到画布右边界外，world 该自动长大
  await 跑('2 拖到画布边界外 world 该长大', `(function(){
    __T.复位(1);
    const 块 = 世界.querySelector('.blk');
    const 前 = 世界.offsetWidth;
    __T.拖(块, 500, 0);
    const 后 = 世界.offsetWidth;
    return {前world宽:前, 后world宽:后, 有扩: 后 >= 前};
  })()`);

  // ── 3. 内层小块：用屏幕坐标测，容器内外两套坐标系不能混着减
  await 跑('3 容器内小块 z=1 拖 100,60', `(function(){
    __T.复位(1);
    const 块 = 世界.querySelector('.blk .blk');
    if (!块) return '没有内层块';
    const id = +块.dataset.id;
    const r前 = 块.getBoundingClientRect();
    __T.拖(块, 100, 60);
    const 后块 = 世界.querySelector('.blk[data-id="'+id+'"]');
    if (!后块) return '拖完找不到';
    const r后 = 后块.getBoundingClientRect();
    return {
      屏前: {左:Math.round(r前.left), 上:Math.round(r前.top)},
      屏后: {左:Math.round(r后.left), 上:Math.round(r后.top)},
      屏移: {x:Math.round(r后.left-r前.left), y:Math.round(r后.top-r前.top)},
      期望屏移: {x:100, y:60},
      在画布里: 后块.closest('#world') ? '在' : '飞出去了',
      数据坐标: (function(){ const b=__T.找块(根块们,id); return {x:+b.x.toFixed(1), y:+b.y.toFixed(1)}; })()
    };
  })()`);

  // ── 4. z=0.5 时拖，位置换算对不对
  await 跑('4 z=0.5 拖 100,50', `(function(){
    __T.复位(0.5);
    const 块 = 世界.querySelector('.blk'); const id = +块.dataset.id;
    const b = __T.找块(根块们, id);
    const 前 = {x:+b.x.toFixed(1), y:+b.y.toFixed(1)};
    __T.拖(块, 100, 50);
    const b2 = __T.找块(根块们, id);
    return {应移:{x:200,y:100}, 实移:{x:+(b2.x-前.x).toFixed(1), y:+(b2.y-前.y).toFixed(1)}};
  })()`);

  // ── 5. 缩放之后右边能不能看到（靠平移）
  await 跑('5 放大后靠平移看右边', `(function(){
    __T.复位(1);
    const 块 = 世界.querySelector('.blk');
    __T.拖(块, 400, 0);
    const 右块 = 世界.querySelector('.blk');
    const 画布右 = parseFloat(右块.style.left) + 右块.offsetWidth;
    视.z = 2; 应用视();
    const 屏右前 = 画布右 * 2 + 视.x;
    视.x -= 屏右前 - 300; 应用视();
    const 屏右后 = 画布右 * 2 + 视.x;
    return {画布右, 放大2倍后屏右前:Math.round(屏右前), 平移后:Math.round(屏右后), 视口宽:window.innerWidth, 能看到: 屏右后 < window.innerWidth};
  })()`);

  // ── 6. 撤销 / 重做还是不是好的
  await 跑('6 撤销后块数不变', `(function(){
    __T.复位(1);
    const 前 = 世界.querySelectorAll('.blk').length;
    撤销();
    const 后 = 世界.querySelectorAll('.blk').length;
    重做();
    const 再 = 世界.querySelectorAll('.blk').length;
    return {前, 撤销后:后, 重做后:再};
  })()`);

  // ⚠️ 收尾必须把块树恢复成原样。
  //    上一版没做，第 3 个用例把容器里的块拖出来就留在外面了 ——
  //    结果用户的工程里 height 字段跑到类外面，生成出一句 `public float height`，
  //    直接 CS9348。测试脚本不许改坏被测数据。
  await 跑('收尾：恢复原样', `(function(){
    __T.复位(1);
    if (window.__原样) {
      工程表[当前工程].块们 = JSON.parse(JSON.stringify(window.__原样));
      根块们 = 工程表[当前工程].块们;
      重画();
      存盘();
    }
    return '块树已还原，顶层 ' + 根块们.length + ' 个，共 ' + 世界.querySelectorAll('.blk').length + ' 个块';
  })()`);

  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
