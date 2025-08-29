// src/canvas.js
export default function createCanvas({ canvasEl, initialPixelsMap, onPlaceRequest }) {
  // returns an API { draw(), place(x,y,color), subscribeToEvents(...) }
  const ctx = canvasEl.getContext('2d', { alpha: false });
  const GRID = 512;
  let pixelMap = new Map(initialPixelsMap || []);
  let scale = 6; // px per logical pixel
  let offset = { x: 50, y: 50 };
  let dpr = window.devicePixelRatio || 1;
  let scheduled = false;
  const subs = [];

  function scheduleDraw(){ if (!scheduled){ scheduled = true; requestAnimationFrame(()=>{ draw(); scheduled=false; }); } }

  function draw(){
    const rect = canvasEl.parentElement.getBoundingClientRect();
    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;
    canvasEl.style.width = rect.width + 'px';
    canvasEl.style.height = rect.height + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = '#0b0f13';
    ctx.fillRect(0,0, rect.width, rect.height);

    const bx = offset.x, by = offset.y;
    const bw = GRID * scale, bh = GRID * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(bx, by, bw, bh);

    const vx0 = Math.max(0, Math.floor((-offset.x)/scale));
    const vy0 = Math.max(0, Math.floor((-offset.y)/scale));
    const vx1 = Math.min(GRID, Math.ceil((rect.width - offset.x)/scale));
    const vy1 = Math.min(GRID, Math.ceil((rect.height - offset.y)/scale));

    for (let y = vy0; y < vy1; y++){
      for (let x = vx0; x < vx1; x++){
        const key = `${x},${y}`;
        const c = pixelMap.get(key);
        if (c){
          ctx.fillStyle = c;
          ctx.fillRect(Math.floor(bx + x * scale), Math.floor(by + y * scale), Math.ceil(scale), Math.ceil(scale));
        }
      }
    }

    if (scale >= 10){
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = vx0; x <= vx1; x++){
        const px = Math.floor(bx + x * scale) + 0.5;
        ctx.moveTo(px, by + vy0 * scale);
        ctx.lineTo(px, by + vy1 * scale);
      }
      for (let y = vy0; y <= vy1; y++){
        const py = Math.floor(by + y * scale) + 0.5;
        ctx.moveTo(bx + vx0 * scale, py);
        ctx.lineTo(bx + vx1 * scale, py);
      }
      ctx.stroke();
    }
  }

  // place locally and notify subscribers
  function place(x,y,color){
    const key = `${x},${y}`;
    pixelMap.set(key, color);
    subs.forEach(s => s({ type:'place', x, y, color, key }));
    scheduleDraw();
  }

  function setPixelMap(mapEntries){
    pixelMap = new Map(mapEntries);
    scheduleDraw();
  }

  function onEvent(cb){
    subs.push(cb);
    return ()=> {
      const i = subs.indexOf(cb);
      if (i>=0) subs.splice(i,1);
    };
  }

  // helpers for pan/zoom interactions not included to keep file focused on drawing,
  // main.js will implement pointer handling and will call place(x,y,color) when needed.

  return { draw: scheduleDraw, place, setPixelMap, onEvent, getState: ()=> ({ scale, offset }) };
}
