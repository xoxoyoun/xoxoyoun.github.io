// src/main.js
import { initSupabase, getSupabase } from './supabaseClient.js';
import createCanvas from './canvas.js';

/*
  IMPORTANT:
  Replace these constants with your Supabase project values.
  - SUPABASE_URL: https://xyzcompany.supabase.co
  - SUPABASE_ANON_KEY: public anon key
*/
// Get environment variables from the global window object (set by server)
const SUPABASE_URL = window.SUPABASE_URL || 'https://YOUR_SUPABASE_URL.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// initialize supabase client
const supabase = initSupabase({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY });

// DOM
const canvasEl = document.getElementById('canvas');
const paletteCol = document.getElementById('palette-col');
const savedPal = document.getElementById('savedPal');
const colorPicker = document.getElementById('colorPicker');
const saveColorButton = document.getElementById('saveColor');
const tokenWrap = document.getElementById('token-wrap');
const authArea = document.getElementById('auth-area');
const leaderboardEl = document.getElementById('leaderboard');
const messagesEl = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const fitBtn = document.getElementById('fit');

let tokens = 100, lastRefill = Date.now();
const TOKEN_REFILL_INTERVAL = 10000; // 10s
const TOKEN_MAX = 100;

// small saved palette
let saved = ['#DC143C','#FF6347','#FFD700','#ADFF2F','#32CD32','#00CED1','#4169E1','#9370DB','#FF69B4','#F5F5F5','#808080','#2F2F2F'];

// user state
let user = null; // {id, email, user_metadata}
let canvasApi = null;

// init canvas
async function init() {
  // load initial pixels from Supabase
  const { data: seedPixels } = await supabase
    .from('pixels')
    .select('x,y,color,updated_at,owner_id')
    .limit(1000); // initial snapshot (tune as needed)

  const initial = new Map();
  if (seedPixels && seedPixels.length) {
    seedPixels.forEach(p => initial.set(`${p.x},${p.y}`, p.color));
  }

  canvasApi = createCanvas({ canvasEl, initialPixelsMap: initial });
  canvasApi.draw();

  // subscribe to realtime pixel changes
  const pixelSub = supabase
    .from('pixels')
    .on('INSERT', payload => {
      const p = payload.new;
      initial.set(`${p.x},${p.y}`, p.color);
      canvasApi.setPixelMap(initial);
    })
    .on('UPDATE', payload => {
      const p = payload.new;
      initial.set(`${p.x},${p.y}`, p.color);
      canvasApi.setPixelMap(initial);
    })
    .subscribe();

  // subscribe to leaders updates (table)
  const leaderSub = supabase
    .from('leaders')
    .on('*', _ => {
      loadLeaders();
    })
    .subscribe();

  // subscribe to messages (chat)
  const msgSub = supabase
    .from('messages')
    .on('INSERT', payload => {
      appendMessage(payload.new);
    })
    .subscribe();

  // load UI
  renderPalette();
  renderSaved();
  renderTokenUI();
  loadLeaders();
  loadMessages();

  // UI events
  saveColorButton.addEventListener('click', ()=> {
    const v = colorPicker.value;
    if (!saved.includes(v)) { saved.unshift(v); if (saved.length>20) saved.pop(); renderSaved(); renderPalette(); }
  });

  sendChat.addEventListener('click', async ()=> {
    if (!user) return alert('Sign in to chat');
    const text = chatInput.value.trim();
    if (!text) return;
    await supabase.from('messages').insert([{ user_id: user.id, user_name: user.email || user.user_metadata?.full_name || 'Anon', text }]);
    chatInput.value = '';
  });

  // pointer handling for placement (simplified)
  let isPanning = false, last = null;
  const viewport = document.getElementById('viewport');
  viewport.addEventListener('pointerdown', (e)=>{
    viewport.setPointerCapture(e.pointerId);
    last = { x: e.clientX, y: e.clientY, ox: 50, oy: 50 };
    isPanning = e.shiftKey || e.button === 1;
  });
  viewport.addEventListener('pointermove', (e)=>{
    if (!last) return;
    if (isPanning){
      // implement pan if desired (omitted for brevity)
    }
  });
  viewport.addEventListener('pointerup', async (e)=>{
    // place pixel
    if (!user) return alert('Sign in to place pixels');
    if (tokens <= 0) return alert('No tokens available yet. Wait 10s per token.');
    // calculate grid x,y from click pos
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // translate screen -> grid (we use simple mapping here - canvas.js handles more advanced transform in a real build)
    // For demo: map click relative to canvas element size => grid coords
    const cw = canvasEl.clientWidth, ch = canvasEl.clientHeight;
    const gx = Math.floor((mx / cw) * 512);
    const gy = Math.floor((my / ch) * 512);
    const color = colorPicker.value;

    // client side consume token:
    tokens = Math.max(0, tokens - 1);
    renderTokenUI();

    // place to supabase (upsert)
    const { error } = await supabase
      .from('pixels')
      .upsert([{ x: gx, y: gy, color, owner_id: user.id }], { onConflict: ['x','y'] });

    if (error) {
      console.error('place error', error);
      alert('Failed to place pixel: ' + error.message);
      // refund token on error:
      tokens = Math.min(TOKEN_MAX, tokens + 1);
      renderTokenUI();
    } else {
      // success; server-side trigger will update leaders table and real-time subscriptions will update clients
    }
  });

  // zoom controls (very basic)
  zoomIn.addEventListener('click', ()=>{ /* implement zoom changes if using more advanced canvas transform */ alert('Use pinch/wheel to zoom (demo).');});
  zoomOut.addEventListener('click', ()=>{ alert('Use pinch/wheel to zoom (demo).');});
  fitBtn.addEventListener('click', ()=> { /* call fit if implemented in canvasApi */ });

  // token refill loop
  setInterval(()=> {
    const delta = Math.floor((Date.now() - lastRefill) / TOKEN_REFILL_INTERVAL);
    if (delta > 0) {
      tokens = Math.min(TOKEN_MAX, tokens + delta);
      lastRefill += delta * TOKEN_REFILL_INTERVAL;
      renderTokenUI();
    }
  }, 1000);

  // auth UI wiring
  renderAuthUI();
}

function renderPalette(){
  const container = paletteCol;
  container.innerHTML = '';
  saved.slice(0,12).forEach(c=>{
    const btn = document.createElement('button');
    btn.className = 'color-btn';
    btn.style.background = c;
    btn.title = c;
    btn.addEventListener('click', ()=> colorPicker.value = c);
    container.appendChild(btn);
  });
}

function renderSaved(){
  savedPal.innerHTML = '';
  saved.forEach(c=>{
    const s = document.createElement('button'); s.style.width='36px'; s.style.height='36px'; s.style.borderRadius='8px'; s.style.background = c; s.title=c;
    s.addEventListener('click', ()=> colorPicker.value = c);
    savedPal.appendChild(s);
  });
}

function renderTokenUI(){
  tokenWrap.innerHTML = `<div style="text-align:center">
    <div style="width:72px;height:72px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);border:1px solid rgba(255,255,255,0.04)">
      <strong style="font-size:18px">${tokens}</strong>
    </div>
    <div class="muted" style="margin-top:6px">Next in ${Math.max(0, Math.round((TOKEN_REFILL_INTERVAL - (Date.now() - lastRefill))/1000))}s</div>
  </div>`;
}

// AUTH: show sign-in buttons or user info
function renderAuthUI(){
  authArea.innerHTML = '';
  if (!user){
    const g = document.createElement('button'); g.className='btn'; g.textContent='Sign in with Google';
    const d = document.createElement('button'); d.className='btn'; d.textContent='Sign in with Discord';
    authArea.appendChild(g); authArea.appendChild(d);
    g.addEventListener('click', ()=> signInProvider('google'));
    d.addEventListener('click', ()=> signInProvider('discord'));
  } else {
    const info = document.createElement('div'); info.style.display='flex'; info.style.alignItems='center'; info.style.gap='8px';
    const name = document.createElement('div'); name.innerHTML = `<div style="font-weight:700">${user.email || user.user_metadata?.full_name || 'Me'}</div>`;
    const out = document.createElement('button'); out.className='btn'; out.textContent='Sign out';
    info.appendChild(name); info.appendChild(out); authArea.appendChild(info);
    out.addEventListener('click', async ()=>{
      await supabase.auth.signOut();
      user = null;
      renderAuthUI();
    });
  }
}

async function signInProvider(provider){
  // Supabase will handle redirect to provider
  // Make sure redirect URL on Supabase matches your deployed site (https://USERNAME.github.io)
  const { error } = await supabase.auth.signInWithOAuth({
    provider
  });
  if (error) console.error('sign in error', error);
}

// load leaders from DB
async function loadLeaders(){
  const { data, error } = await supabase.from('leaders').select('user_name,pixels,last_active').order('pixels', { ascending: false }).limit(10);
  if (error) { console.error(error); return; }
  leaderboardEl.innerHTML = '';
  data.forEach((r, i)=> {
    const div = document.createElement('div'); div.className = 'leader-item';
    div.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--accentA),var(--accentB));display:grid;place-items:center">${i+1}</div><div><div style="font-weight:700">${r.user_name}</div><div class="muted">${new Date(r.last_active).toLocaleTimeString()}</div></div></div><div style="font-weight:700">${r.pixels}</div>`;
    leaderboardEl.appendChild(div);
  });
}

// load messages
async function loadMessages(){
  const { data } = await supabase.from('messages').select('id,user_name,text,created_at').order('created_at',{ascending:true}).limit(200);
  messagesEl.innerHTML = '';
  data.forEach(m => appendMessage(m));
}

function appendMessage(m){
  const div = document.createElement('div'); div.className='msg';
  div.innerHTML = `<div style="font-size:12px;color:var(--muted)">${m.user_name} • ${new Date(m.created_at).toLocaleTimeString()}</div><div>${escapeHtml(m.text)}</div>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(s){ return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]); }

// initialize app
init().catch(console.error);
