// =============================================================================
// The Works — interactive fractured mirror of Ex Avner's catalogue.
// Three.js scene: irregular mirror shards floating in a painterly dark.
// Center shard = the book; orbiting shards = the Fracture City properties.
// =============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const $ = (sel) => document.querySelector(sel);
const veil    = $('#veil');
const veilbar = $('#veilbar');
const panel   = $('#panel');
const panelClose  = $('#panelClose');
const panelScroll = $('#panelScroll');
const tooltip = $('#tooltip');
const topnav  = $('#topnav');

// -- Fake-loader bar; resolves once the scene is built.
let loaderPct = 0;
function tickLoader(){
  loaderPct = Math.min(100, loaderPct + (Math.random()*10 + 4));
  veilbar.style.width = loaderPct + '%';
  if (loaderPct < 96) setTimeout(tickLoader, 80);
}
tickLoader();

// =============================================================================
// Data
// =============================================================================
const [worksData, bookData] = await Promise.all([
  fetch('data/works.json').then(r => r.json()),
  fetch('data/book.json').then(r => r.json()),
]);

// =============================================================================
// Scene setup
// =============================================================================
const renderer = new THREE.WebGLRenderer({
  canvas: $('#scene'),
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = null;
scene.fog = null;

const camera = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, 0.1, 200);
camera.position.set(0, 0.6, 16.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.45;
controls.minDistance = 7;
controls.maxDistance = 22;
controls.minPolarAngle = Math.PI * 0.25;
controls.maxPolarAngle = Math.PI * 0.75;
controls.target.set(0, 0, 0);

// -- Lighting: warm ember key, cool teal rim, dim moss fill. Strong ambient so
//    the painted shard textures actually read as paint and not as dark metal.
scene.add(new THREE.AmbientLight(0xfff0d0, 0.65));
scene.add(new THREE.HemisphereLight(0xd35a3f, 0x2a4438, 0.25));

const keyLight = new THREE.DirectionalLight(0xffe6b8, 0.6);
keyLight.position.set(-5, 6, 8);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x4a7570, 6, 40, 1.6);
rimLight.position.set(8, -2, 6);
scene.add(rimLight);

const accentLight = new THREE.PointLight(0xd35a3f, 4, 30, 1.8);
accentLight.position.set(-6, -2, 4);
scene.add(accentLight);

// =============================================================================
// Apartment-room backdrop — painterly wood-paneled reading nook with rainy
// cyberpunk neon visible through the right-hand window. The setting that the
// mirror shards float inside, echoing apartment 8-02 from The Visitor.
// =============================================================================
function paintApartmentRoom(canvas){
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Back wall — warm sienna wood-paneling (lifted so the room reads against
  // the dark shards). The lamp glow at center adds the focal warmth.
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#5a3a22');
  wall.addColorStop(0.6, '#8a5028');
  wall.addColorStop(1, '#4a2a18');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);

  // Vertical plank seams across the wall
  ctx.strokeStyle = 'rgba(20,10,5,0.55)'; ctx.lineWidth = 1.5;
  for (let x = 0; x < w; x += w * 0.06){
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h*0.78); ctx.stroke();
  }
  // wood grain noise
  for (let i = 0; i < 600; i++){
    const x = Math.random()*w, y = Math.random()*h*0.78;
    ctx.fillStyle = `rgba(${30 + Math.random()*40 | 0},${15 + Math.random()*20 | 0},${5 + Math.random()*15 | 0},${0.05 + Math.random()*0.08})`;
    ctx.fillRect(x, y, 2 + Math.random()*8, 1);
  }

  // Floor — wood plank perspective, dark warm
  ctx.fillStyle = '#1a0e08';
  ctx.fillRect(0, h*0.78, w, h*0.22);
  // floor plank lines (converging perspective)
  ctx.strokeStyle = 'rgba(60,30,15,0.6)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++){
    const t = i / 14;
    const y = h*0.78 + t * h*0.22;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // Persian rug
  const rugX = w*0.18, rugY = h*0.82, rugW = w*0.55, rugH = h*0.16;
  ctx.fillStyle = '#6a2818';
  ctx.beginPath();
  ctx.moveTo(rugX, rugY);
  ctx.lineTo(rugX + rugW, rugY);
  ctx.lineTo(rugX + rugW + 30, rugY + rugH);
  ctx.lineTo(rugX - 30, rugY + rugH);
  ctx.closePath(); ctx.fill();
  // rug pattern stipple
  for (let i = 0; i < 220; i++){
    const x = rugX + Math.random()*rugW;
    const y = rugY + Math.random()*rugH;
    ctx.fillStyle = ['#8a3a22','#3a1208','#c89a4a','#5a2010'][i%4];
    ctx.fillRect(x, y, 3, 3);
  }

  // Left bookshelf — tall, filled with multicolored spines
  const bsX = 0, bsY = h*0.06, bsW = w*0.27, bsH = h*0.74;
  ctx.fillStyle = '#1a0c06';
  ctx.fillRect(bsX, bsY, bsW, bsH);
  // shelves
  const shelfCount = 7;
  for (let s = 0; s < shelfCount; s++){
    const sy = bsY + (s/shelfCount) * bsH;
    const sh = bsH/shelfCount - 4;
    // shelf board
    ctx.fillStyle = '#3a1f12';
    ctx.fillRect(bsX, sy + sh, bsW, 6);
    // book spines on this shelf
    let bx = bsX + 6;
    while (bx < bsW - 12){
      const bw = 8 + Math.random()*22;
      const bh2 = sh - 6 - Math.random()*10;
      const hue = [
        '#6a3a22','#3a1208','#8a4a2a','#4a2810','#7a3a2a',
        '#5a3010','#3a2010','#8a5a3a','#2a1808','#6a4a2a',
        '#aa6a3a','#3a1810',
      ][Math.floor(Math.random()*12)];
      ctx.fillStyle = hue;
      ctx.fillRect(bx, sy + (sh - bh2 - 6), bw, bh2);
      // gold trim band
      if (Math.random() > 0.7){
        ctx.fillStyle = '#c89a4a';
        ctx.fillRect(bx, sy + (sh - bh2 - 6) + bh2*0.3, bw, 2);
      }
      bx += bw + 1;
    }
  }
  // bookshelf side shadow
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bsW, bsY, 12, bsH + 6);

  // Painting / frame above lamp
  ctx.fillStyle = '#0a0604';
  ctx.fillRect(w*0.05, h*0.02, w*0.1, h*0.08);
  ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3;
  ctx.strokeRect(w*0.05, h*0.02, w*0.1, h*0.08);

  // Standing floor lamp — pole + shade
  const lampX = w*0.32, lampY = h*0.42;
  // pole
  ctx.fillStyle = '#1a0c06';
  ctx.fillRect(lampX - 3, lampY, 6, h*0.36);
  // shade
  ctx.fillStyle = '#f0d8a8';
  ctx.beginPath();
  ctx.moveTo(lampX - 50, lampY + 60);
  ctx.lineTo(lampX + 50, lampY + 60);
  ctx.lineTo(lampX + 40, lampY - 10);
  ctx.lineTo(lampX - 40, lampY - 10);
  ctx.closePath(); ctx.fill();
  // shade highlight
  ctx.fillStyle = 'rgba(255,210,140,0.35)';
  ctx.fillRect(lampX - 36, lampY - 5, 72, 60);
  // warm glow halo
  const halo = ctx.createRadialGradient(lampX, lampY + 25, 10, lampX, lampY + 25, 380);
  halo.addColorStop(0, 'rgba(255,200,130,0.6)');
  halo.addColorStop(0.3, 'rgba(255,170,90,0.32)');
  halo.addColorStop(0.7, 'rgba(180,90,40,0.1)');
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);

  // Posters / key rack on wall
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(w*0.38, h*0.16, w*0.07, h*0.12);  // poster
  ctx.fillStyle = '#c0b890';
  ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('BLADE', w*0.415, h*0.27);
  // small key shelf
  ctx.fillStyle = '#2a1810';
  ctx.fillRect(w*0.38, h*0.32, w*0.07, h*0.04);
  // keys hanging
  ctx.fillStyle = '#c89a4a';
  for (let i = 0; i < 3; i++){
    ctx.fillRect(w*0.385 + i*12, h*0.36, 2, 18);
    ctx.beginPath(); ctx.arc(w*0.385 + i*12 + 1, h*0.40, 4, 0, Math.PI*2); ctx.fill();
  }

  // Door — center, with peephole, knob, number plate
  const doorX = w*0.48, doorY = h*0.13, doorW = w*0.16, doorH = h*0.62;
  ctx.fillStyle = '#3a1f12';
  ctx.fillRect(doorX, doorY, doorW, doorH);
  // door frame
  ctx.strokeStyle = '#1a0c06'; ctx.lineWidth = 6;
  ctx.strokeRect(doorX, doorY, doorW, doorH);
  // panels inset
  ctx.strokeStyle = '#5a3020'; ctx.lineWidth = 2;
  ctx.strokeRect(doorX + 14, doorY + 30, doorW - 28, doorH*0.45 - 30);
  ctx.strokeRect(doorX + 14, doorY + doorH*0.55, doorW - 28, doorH*0.4);
  // number plate
  ctx.fillStyle = '#2a1208';
  ctx.fillRect(doorX + doorW/2 - 30, doorY - 24, 60, 20);
  ctx.fillStyle = '#c89a4a';
  ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
  ctx.fillText('8-02', doorX + doorW/2, doorY - 10);
  // peephole
  ctx.fillStyle = '#1a0c06';
  ctx.beginPath(); ctx.arc(doorX + doorW/2, doorY + 80, 6, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#5a3020'; ctx.lineWidth = 1.5; ctx.stroke();
  // doorknob
  ctx.fillStyle = '#c89a4a';
  ctx.beginPath(); ctx.arc(doorX + doorW - 24, doorY + doorH*0.5, 7, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(doorX + doorW - 30, doorY + doorH*0.5 - 1, 18, 4);

  // Reading chair — red velvet wingback, viewed from side-front
  const chX = w*0.20, chY = h*0.62;
  ctx.fillStyle = '#5a2018';
  // back of chair
  ctx.beginPath();
  ctx.moveTo(chX, chY);
  ctx.quadraticCurveTo(chX + 30, chY - 60, chX + 100, chY - 70);
  ctx.lineTo(chX + 100, chY + 120);
  ctx.lineTo(chX, chY + 120);
  ctx.closePath(); ctx.fill();
  // seat
  ctx.fillStyle = '#3a1208';
  ctx.fillRect(chX, chY + 80, 130, 50);
  // arm
  ctx.fillStyle = '#6a2820';
  ctx.beginPath();
  ctx.moveTo(chX + 100, chY + 30);
  ctx.lineTo(chX + 150, chY + 30);
  ctx.lineTo(chX + 150, chY + 120);
  ctx.lineTo(chX + 100, chY + 120);
  ctx.closePath(); ctx.fill();
  // chair leg shadow
  ctx.fillStyle = '#1a0c06';
  ctx.fillRect(chX + 20, chY + 130, 8, 18);
  ctx.fillRect(chX + 130, chY + 130, 8, 18);

  // Side table with teacup
  const tbX = w*0.34, tbY = h*0.74;
  ctx.fillStyle = '#3a1f12';
  ctx.beginPath(); ctx.ellipse(tbX, tbY, 50, 14, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(tbX - 4, tbY, 8, 40);  // leg
  // teapot
  ctx.fillStyle = '#c89a4a';
  ctx.beginPath(); ctx.ellipse(tbX + 10, tbY - 12, 16, 12, 0, 0, Math.PI*2); ctx.fill();
  // teacup
  ctx.fillStyle = '#e8d8b0';
  ctx.beginPath(); ctx.arc(tbX - 22, tbY - 6, 9, 0, Math.PI*2); ctx.fill();
  // steam wisps
  ctx.strokeStyle = 'rgba(255,220,180,0.4)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++){
    ctx.beginPath();
    ctx.moveTo(tbX + 10 + i*4, tbY - 24);
    ctx.quadraticCurveTo(tbX + 14 + i*4, tbY - 40, tbX + 8 + i*4, tbY - 56);
    ctx.stroke();
  }

  // RIGHT WINDOW — large pane onto rainy cyberpunk city
  const wX = w*0.69, wY = h*0.06, wW = w*0.31, wH = h*0.74;
  // window frame outer
  ctx.fillStyle = '#1a0c06';
  ctx.fillRect(wX - 6, wY - 6, wW + 12, wH + 12);
  // night sky
  const nightSky = ctx.createLinearGradient(0, wY, 0, wY + wH);
  nightSky.addColorStop(0, '#1a1840');
  nightSky.addColorStop(0.5, '#3a1850');
  nightSky.addColorStop(1, '#5a2050');
  ctx.fillStyle = nightSky; ctx.fillRect(wX, wY, wW, wH);

  // distant skyscrapers
  for (let i = 0; i < 14; i++){
    const bx = wX + (i / 14) * wW + Math.random()*6;
    const bw = wW/14 + 6;
    const bh2 = 200 + Math.random()*340;
    ctx.fillStyle = `rgba(${20+Math.random()*15|0},${15+Math.random()*15|0},${30+Math.random()*30|0},1)`;
    ctx.fillRect(bx, wY + wH - bh2, bw, bh2);
    // lit windows
    for (let y = wY + wH - bh2 + 8; y < wY + wH - 12; y += 14){
      for (let x = bx + 3; x < bx + bw - 3; x += 9){
        if (Math.random() > 0.6){
          ctx.fillStyle = ['#ffd47a','#80c8ff','#ff80a0'][Math.floor(Math.random()*3)] + '99';
          ctx.fillRect(x, y, 4, 6);
        }
      }
    }
  }

  // neon signs
  const neonSigns = [
    { x: wX + wW*0.5, y: wY + wH*0.32, text: 'DIOT',   color: '#ff5090' },
    { x: wX + wW*0.78, y: wY + wH*0.48, text: '未来',   color: '#80c8ff' },
    { x: wX + wW*0.72, y: wY + wH*0.62, text: '東京',   color: '#80ffff' },
    { x: wX + wW*0.55, y: wY + wH*0.58, text: 'BAR',    color: '#ffd47a' },
  ];
  for (const s of neonSigns){
    ctx.shadowColor = s.color; ctx.shadowBlur = 24;
    ctx.fillStyle = s.color;
    ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
    ctx.fillText(s.text, s.x, s.y);
  }
  ctx.shadowBlur = 0;

  // rain streaks across the window
  ctx.strokeStyle = 'rgba(200,200,255,0.35)'; ctx.lineWidth = 1;
  for (let i = 0; i < 220; i++){
    const x = wX + Math.random()*wW, y = wY + Math.random()*wH;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16); ctx.stroke();
  }
  // window cross-mullion
  ctx.fillStyle = '#1a0c06';
  ctx.fillRect(wX + wW*0.5 - 4, wY, 8, wH);
  ctx.fillRect(wX, wY + wH*0.5 - 4, wW, 8);

  // Plant on right windowsill
  ctx.fillStyle = '#2a1810';
  ctx.fillRect(wX + wW*0.78, wY + wH - 4, 60, 30);
  ctx.fillStyle = '#1a3a20';
  for (let i = 0; i < 8; i++){
    const lx = wX + wW*0.82 + Math.random()*40;
    const ly = wY + wH - 20 - Math.random()*40;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 4 + Math.random()*6, 12 + Math.random()*8,
                Math.random()*Math.PI, 0, Math.PI*2);
    ctx.fill();
  }

  // Books on the windowsill
  ctx.fillStyle = '#3a1208';
  ctx.fillRect(wX + 30, wY + wH - 10, 80, 18);
  ctx.fillStyle = '#5a3020';
  ctx.fillRect(wX + 30, wY + wH - 14, 80, 6);

  // Final warm wash everywhere except the window (cold light bleeds in)
  const warm = ctx.createRadialGradient(lampX, lampY + 60, 30, lampX, lampY + 60, w*0.7);
  warm.addColorStop(0, 'rgba(255,180,80,0.15)');
  warm.addColorStop(1, 'transparent');
  ctx.fillStyle = warm; ctx.fillRect(0, 0, w, h);

  // Painterly grain over the whole image
  for (let i = 0; i < 3500; i++){
    const x = Math.random()*w, y = Math.random()*h;
    ctx.fillStyle = `rgba(${100 + Math.random()*80 | 0},${60 + Math.random()*40 | 0},${30 + Math.random()*30 | 0},${0.02 + Math.random()*0.04})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

function sizeAndPaintRoom(){
  const c = document.getElementById('roombg');
  const dpr = Math.min(window.devicePixelRatio, 2);
  c.width  = Math.floor(innerWidth  * dpr);
  c.height = Math.floor(innerHeight * dpr);
  c.style.width = innerWidth + 'px';
  c.style.height = innerHeight + 'px';
  paintApartmentRoom(c);
}
sizeAndPaintRoom();

// =============================================================================
// Procedural shard art — each work gets a painterly canvas texture.
// Compositions deliberately echo the three reference images.
// =============================================================================
function makeShardTexture(work){
  // 2:3 portrait — matches the shard's bounding box so the painted composition
  // fills the surface without distortion.
  const w = 1024, h = 1536;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const [p1, p2, p3, p4, p5] = work.palette.concat(work.palette).concat(work.palette);

  // Base painterly sky/wall
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, p1);
  sky.addColorStop(0.55, p3 || p2);
  sky.addColorStop(1, p5 || p3 || p2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Brush-noise layer for painterly grit
  for (let i = 0; i < 1800; i++){
    const x = Math.random() * w, y = Math.random() * h;
    const r = Math.random() * 14 + 2;
    ctx.beginPath();
    ctx.fillStyle = `rgba(${20 + Math.random()*40 | 0},${10 + Math.random()*30 | 0},${5 + Math.random()*20 | 0},${0.04 + Math.random()*0.06})`;
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();
  }

  // Work-specific motif on top
  switch(work.id){
    case 'book':              paintBook(ctx, w, h, work); break;
    case 'fracture-city-show':paintShow(ctx, w, h, work); break;
    case 'fracture-city-game':paintGame(ctx, w, h, work); break;
    case 'the-visitor':       paintVisitor(ctx, w, h, work); break;
    case 'coherence':         paintCoherence(ctx, w, h, work); break;
    case 'corporate-narratives': paintManifesto(ctx, w, h, work); break;
    case 'apparel':           paintApparel(ctx, w, h, work); break;
    default:                  paintGeneric(ctx, w, h, work);
  }

  // Title plate at bottom — sized for the 2:3 canvas
  const plateH = 220;
  const plate = ctx.createLinearGradient(0, h - plateH, 0, h);
  plate.addColorStop(0, 'rgba(0,0,0,0)');
  plate.addColorStop(0.35, 'rgba(7,5,4,0.85)');
  plate.addColorStop(1, 'rgba(7,5,4,0.97)');
  ctx.fillStyle = plate;
  ctx.fillRect(0, h - plateH, w, plateH);

  ctx.fillStyle = '#ead7ad';
  ctx.font = '700 60px "Cinzel","Cormorant Garamond",serif';
  ctx.textAlign = 'center';
  // safe area: keep text well inside the irregular shard outline so no
  // letters get clipped by the shape's cut edges.
  wrapText(ctx, work.title.toUpperCase(), w/2, h - 130, w - 260, 68);

  if (work.subtitle){
    ctx.fillStyle = '#a3906a';
    ctx.font = 'italic 28px "Cormorant Garamond",serif';
    // subtitle gets one line, ellipsed if it overruns the safe width
    let st = work.subtitle;
    while (ctx.measureText(st).width > w - 260 && st.length > 10){
      st = st.slice(0, -1);
    }
    if (st !== work.subtitle) st = st.slice(0, -1) + '…';
    ctx.fillText(st, w/2, h - 50);
  }

  // Crack overlay (every shard carries the wound)
  drawCracks(ctx, w, h, 0.35);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const words = text.split(' '); let line = ''; const lines = [];
  for (const w of words){
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  const startY = y - (lines.length - 1) * lineHeight / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

// --- Book cover composition — Liberty figure with mirror face. Vertical
// symmetry, the figure centered and dominant. Massive spiked iron crown,
// fireworks bursting either side, burning orange sky, decaying skyline,
// stone steps + protest crowd at the base. Closer to the original cover.
function paintBook(ctx, w, h, work){
  const fx = w / 2;                 // vertical axis — everything mirrors here

  // -- Burning orange sky (gradient already laid by base, deepen it)
  const sky = ctx.createLinearGradient(0, 0, 0, h*0.6);
  sky.addColorStop(0, '#9a3a1a');
  sky.addColorStop(0.55, '#d35a3f');
  sky.addColorStop(1, '#c8633a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h*0.62);

  // -- Symmetric firework bursts (mirrored left & right)
  function burst(cx, cy, R, hue){
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, R);
    g.addColorStop(0,   hue + 'ee');
    g.addColorStop(0.35,hue + '55');
    g.addColorStop(1,   'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
    // radial sparks
    ctx.strokeStyle = hue + 'aa'; ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++){
      const a = (k/14)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a)*R*0.15, cy + Math.sin(a)*R*0.15);
      ctx.lineTo(cx + Math.cos(a)*R*0.85, cy + Math.sin(a)*R*0.85);
      ctx.stroke();
    }
  }
  const pairs = [
    { dx: 280, dy: 200, R: 230, hue: '#6b8c5c' },
    { dx: 380, dy: 130, R: 200, hue: '#d35a3f' },
    { dx: 180, dy: 320, R: 170, hue: '#d4a85a' },
  ];
  for (const p of pairs){
    burst(fx - p.dx, p.dy, p.R, p.hue);
    burst(fx + p.dx, p.dy, p.R, p.hue);
  }

  // -- Decaying skyline silhouette, mirrored bilateral spacing
  ctx.fillStyle = 'rgba(28,12,6,0.85)';
  const skyline = [110, 200, 80, 260, 150, 320, 180, 280, 130, 240, 90, 210];
  const cols = 20;
  for (let i = 0; i < cols; i++){
    const t = (i + 0.5) / cols;
    const bx = t * w;
    const bw = w / cols * 0.92;
    // mirror about center: read from |i - cols/2|
    const idx = Math.abs(Math.round(i - (cols-1)/2)) % skyline.length;
    const bh = skyline[idx];
    ctx.fillRect(bx - bw/2, h*0.58 - bh, bw, bh + 200);
  }

  // -- Stone-step plinth at base
  ctx.fillStyle = '#6a3e28';
  ctx.fillRect(0, h*0.78, w, h*0.22);
  // step bands
  ctx.fillStyle = 'rgba(160,90,50,0.5)';
  ctx.fillRect(0, h*0.78, w, 26);
  ctx.strokeStyle = 'rgba(20,10,5,0.7)'; ctx.lineWidth = 2;
  for (let y = h*0.78; y < h; y += 46){
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // ground shadow under figure
  const gshad = ctx.createRadialGradient(fx, h*0.86, 10, fx, h*0.86, 380);
  gshad.addColorStop(0, 'rgba(0,0,0,0.65)');
  gshad.addColorStop(1, 'transparent');
  ctx.fillStyle = gshad; ctx.fillRect(0, h*0.78, w, h*0.22);

  // -- The robed figure (perfectly symmetric, centered, dominant)
  const robeTopY = h*0.36, robeBaseY = h*0.86;
  const shoulderHalf = 360, hipHalf = 380, hemHalf = 420;

  ctx.fillStyle = '#2c4a3e';   // deep oxidized teal
  ctx.beginPath();
  ctx.moveTo(fx - hemHalf, robeBaseY);
  ctx.lineTo(fx - hipHalf, h*0.58);
  ctx.quadraticCurveTo(fx - shoulderHalf, h*0.42, fx - 230, robeTopY + 20);
  ctx.quadraticCurveTo(fx - 150, h*0.30, fx, h*0.29);
  ctx.quadraticCurveTo(fx + 150, h*0.30, fx + 230, robeTopY + 20);
  ctx.quadraticCurveTo(fx + shoulderHalf, h*0.42, fx + hipHalf, h*0.58);
  ctx.lineTo(fx + hemHalf, robeBaseY);
  ctx.closePath(); ctx.fill();

  // robe folds — mirrored
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 10;
  for (let i = 1; i <= 4; i++){
    for (const sgn of [-1, 1]){
      ctx.beginPath();
      ctx.moveTo(fx + sgn*i*70, h*0.42);
      ctx.quadraticCurveTo(fx + sgn*i*85, h*0.70, fx + sgn*i*95, robeBaseY);
      ctx.stroke();
    }
  }
  // robe rim highlight along shoulders
  ctx.strokeStyle = 'rgba(140,180,160,0.4)'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(fx - shoulderHalf, h*0.42);
  ctx.quadraticCurveTo(fx, h*0.27, fx + shoulderHalf, h*0.42);
  ctx.stroke();
  // a single ember catchlight down the center seam
  ctx.strokeStyle = 'rgba(240,150,80,0.25)'; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(fx, h*0.32);
  ctx.lineTo(fx, robeBaseY);
  ctx.stroke();

  // -- Mirror face — oval framed mirror with landscape inside, centered
  const ox = fx, oy = h*0.40, rx = 200, ry = 250;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI*2); ctx.clip();

  // Stormy turbulent sky — sulfur ochre top, blood orange middle, deep wine
  // at the horizon, then iron under the ground. The reflection burns.
  const ms = ctx.createLinearGradient(ox, oy - ry, ox, oy + ry);
  ms.addColorStop(0.00, '#f6b94a');
  ms.addColorStop(0.18, '#e8743a');
  ms.addColorStop(0.42, '#a8341c');
  ms.addColorStop(0.55, '#5a1a14');
  ms.addColorStop(0.62, '#1a0a08');
  ms.addColorStop(1.00, '#08060a');
  ctx.fillStyle = ms; ctx.fillRect(ox - rx, oy - ry, rx*2, ry*2);

  // Smoke clouds rolling across the sky
  for (let i = 0; i < 9; i++){
    const t = i / 8;
    const sx = ox - rx*0.95 + t * rx*1.9;
    const sy = oy - ry*0.7 + Math.sin(t*Math.PI*2)*ry*0.18;
    const sr = 28 + (i%3)*10;
    const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, sr);
    g.addColorStop(0, 'rgba(40,18,14,0.85)');
    g.addColorStop(1, 'rgba(40,18,14,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill();
  }

  // Burning sun / breach in the clouds, off-center for asymmetric drama
  const sunX = ox + rx*0.18, sunY = oy - ry*0.05;
  const sunG = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, rx*0.55);
  sunG.addColorStop(0,    '#fff2c0');
  sunG.addColorStop(0.18, '#ffc070');
  sunG.addColorStop(0.45, 'rgba(232,116,58,0.7)');
  sunG.addColorStop(1,    'transparent');
  ctx.fillStyle = sunG;
  ctx.beginPath(); ctx.arc(sunX, sunY, rx*0.55, 0, Math.PI*2); ctx.fill();

  // Distant burning skyline — toothed silhouette of broken towers
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.moveTo(ox - rx, oy + ry*0.18);
  const teeth = [40, 90, 30, 110, 60, 140, 50, 100, 70, 120, 40, 95, 55];
  const N = teeth.length;
  for (let i = 0; i < N; i++){
    const x = ox - rx + (i / (N-1)) * rx*2;
    const dip = teeth[i];
    ctx.lineTo(x, oy + ry*0.18 - dip);
    ctx.lineTo(x + (rx*2)/(N-1)*0.5, oy + ry*0.18 - dip*0.5);
  }
  ctx.lineTo(ox + rx, oy + ry*0.18);
  ctx.lineTo(ox + rx, oy + ry);
  ctx.lineTo(ox - rx, oy + ry);
  ctx.closePath(); ctx.fill();
  // tower window embers
  for (let i = 0; i < 26; i++){
    const x = ox - rx*0.95 + Math.random()*rx*1.9;
    const y = oy + ry*0.18 - Math.random()*120 - 6;
    ctx.fillStyle = ['#ff9040','#ffd060','#ff6028'][i%3];
    ctx.fillRect(x, y, 2, 3);
  }

  // Long stone road receding to the breach, with a single tiny silhouette
  ctx.fillStyle = '#2a1812';
  ctx.beginPath();
  ctx.moveTo(ox - rx*0.7, oy + ry);
  ctx.lineTo(ox + rx*0.7, oy + ry);
  ctx.lineTo(ox + 14, oy + ry*0.25);
  ctx.lineTo(ox - 14, oy + ry*0.25);
  ctx.closePath(); ctx.fill();
  // road centerline dashes vanishing
  ctx.fillStyle = 'rgba(200,154,74,0.55)';
  for (let i = 0; i < 7; i++){
    const t = i / 7;
    const w = 22 * (1 - t) + 2;
    const yy = oy + ry*0.25 + (ry*0.75) * (t*t);
    ctx.fillRect(ox - w/2, yy, w, 4 * (1 - t) + 1);
  }
  // lone walker
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(ox + 4, oy + ry*0.38, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(ox + 2, oy + ry*0.38 + 4, 4, 10);

  // Lightning fork through the sky — jagged, bright
  ctx.strokeStyle = 'rgba(255,240,200,0.95)';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#fff2c0'; ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(ox - rx*0.45, oy - ry*0.85);
  ctx.lineTo(ox - rx*0.38, oy - ry*0.55);
  ctx.lineTo(ox - rx*0.52, oy - ry*0.40);
  ctx.lineTo(ox - rx*0.34, oy - ry*0.18);
  ctx.lineTo(ox - rx*0.42, oy - ry*0.05);
  ctx.stroke();
  // fork branch
  ctx.beginPath();
  ctx.moveTo(ox - rx*0.38, oy - ry*0.55);
  ctx.lineTo(ox - rx*0.22, oy - ry*0.42);
  ctx.lineTo(ox - rx*0.28, oy - ry*0.30);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Reflection-crack overlay — the mirror itself is fractured, so the scene
  // inside is split by glowing seams. The whole point of the cover.
  const crackLines = [
    [[-0.85, -0.95], [-0.30, -0.20], [ 0.10,  0.30], [ 0.70,  0.95]],
    [[-0.65,  0.95], [-0.25,  0.30], [ 0.15, -0.10], [ 0.60, -0.85]],
    [[-0.95,  0.10], [-0.30,  0.05], [ 0.20, -0.15], [ 0.95, -0.05]],
  ];
  for (const path of crackLines){
    // dark fissure
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    path.forEach(([tx, ty], i) => {
      const px = ox + tx * rx, py = oy + ty * ry;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    // ember catchlight along the crack
    ctx.strokeStyle = 'rgba(255,180,90,0.55)';
    ctx.lineWidth = 0.8;
    ctx.shadowColor = '#ff9040'; ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Per-fragment tint shift — each major shard of the reflection gets a
  // slight overlay so it reads as separate pieces of glass
  const shardTints = [
    { x: -0.5, y: -0.5, r: 0.6, c: 'rgba(80,40,30,0.18)' },
    { x:  0.4, y: -0.6, r: 0.55, c: 'rgba(120,30,20,0.14)' },
    { x: -0.3, y:  0.4, r: 0.7, c: 'rgba(40,20,18,0.22)' },
    { x:  0.5, y:  0.5, r: 0.65, c: 'rgba(20,10,16,0.20)' },
  ];
  for (const t of shardTints){
    const g = ctx.createRadialGradient(ox + t.x*rx, oy + t.y*ry, 4,
                                       ox + t.x*rx, oy + t.y*ry, rx*t.r);
    g.addColorStop(0, t.c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ox + t.x*rx, oy + t.y*ry, rx*t.r, 0, Math.PI*2); ctx.fill();
  }

  // Glass highlight — a soft sheen on the upper-left of the mirror
  const sheen = ctx.createLinearGradient(ox - rx*0.8, oy - ry, ox + rx*0.2, oy);
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(0.6, 'transparent');
  ctx.fillStyle = sheen; ctx.fillRect(ox - rx, oy - ry, rx*2, ry*2);

  ctx.restore();
  // Brass mirror frame
  ctx.strokeStyle = '#c89a4a'; ctx.lineWidth = 22;
  ctx.beginPath(); ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(ox, oy, rx - 12, ry - 12, 0, 0, Math.PI*2); ctx.stroke();
  // frame ornament dots, mirrored
  ctx.fillStyle = '#1a0e08';
  for (let i = 0; i < 8; i++){
    const a = i/8 * Math.PI*2;
    const r = (rx + ry)/2 + 2;
    ctx.beginPath(); ctx.arc(ox + Math.cos(a)*rx*0.95, oy + Math.sin(a)*ry*0.95, 4, 0, Math.PI*2); ctx.fill();
  }

  // -- Massive iron spiked crown radiating from the head, perfectly mirrored
  ctx.fillStyle = '#0e0805';
  const spikes = 11;                              // odd — center spike
  for (let i = 0; i < spikes; i++){
    const a = -Math.PI/2 + (i - (spikes-1)/2) * (Math.PI * 0.092);
    const spikeLen = 220 - Math.abs(i - (spikes-1)/2) * 14;
    const baseHalf = 0.055;
    ctx.beginPath();
    ctx.moveTo(ox + Math.cos(a)*rx,          oy + Math.sin(a)*ry);
    ctx.lineTo(ox + Math.cos(a)*(rx + spikeLen),
               oy + Math.sin(a)*(ry + spikeLen));
    ctx.lineTo(ox + Math.cos(a + baseHalf)*rx,
               oy + Math.sin(a + baseHalf)*ry);
    ctx.closePath(); ctx.fill();
  }
  // spike highlight slivers
  ctx.fillStyle = 'rgba(200,154,74,0.35)';
  for (let i = 0; i < spikes; i++){
    const a = -Math.PI/2 + (i - (spikes-1)/2) * (Math.PI * 0.092);
    const spikeLen = 220 - Math.abs(i - (spikes-1)/2) * 14;
    ctx.beginPath();
    ctx.moveTo(ox + Math.cos(a)*rx, oy + Math.sin(a)*ry);
    ctx.lineTo(ox + Math.cos(a)*(rx + spikeLen),
               oy + Math.sin(a)*(ry + spikeLen));
    ctx.lineTo(ox + Math.cos(a + 0.014)*(rx + spikeLen*0.8),
               oy + Math.sin(a + 0.014)*(ry + spikeLen*0.8));
    ctx.closePath(); ctx.fill();
  }
  // crown headband
  ctx.fillStyle = '#1a0e08';
  ctx.beginPath();
  ctx.ellipse(ox, oy - ry + 22, rx + 14, 36, 0, Math.PI, 0, true);
  ctx.fill();

  // -- Symmetric protest crowd on the steps, mirrored from center
  function silhouette(sx, sy, flagSide){
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI*2); ctx.fill();
    ctx.fillRect(sx - 9, sy + 14, 18, 70);
    // flag pole on outside
    const polX = sx + flagSide * 28;
    ctx.fillRect(polX - 1, sy - 80, 3, 110);
    ctx.fillRect(polX + (flagSide > 0 ? 2 : -36), sy - 80, 34, 24);
  }
  const baseY = h*0.81;
  // start from center outward — guaranteed symmetric
  for (let i = 1; i <= 5; i++){
    const off = 80 + i * 92;
    silhouette(fx - off, baseY + (i%2)*8, -1);
    silhouette(fx + off, baseY + (i%2)*8, +1);
  }
  // center figure (just head + shoulders, no flag)
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath(); ctx.arc(fx, baseY - 6, 18, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(fx - 9, baseY + 8, 18, 70);

  // -- Single broken torch lying across the bottom steps (echoes cover)
  const torchY = h*0.95;
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(fx - 180, torchY, 240, 14);
  ctx.fillStyle = '#c89a4a';
  ctx.fillRect(fx + 50, torchY - 4, 18, 22);
  ctx.fillStyle = '#1a0e08';
  ctx.fillRect(fx - 180, torchY + 5, 30, 6);
}

// --- Show: cracked couch with floating fragments
function paintShow(ctx, w, h, work){
  // sepia wall
  ctx.fillStyle = '#2d1f17'; ctx.fillRect(0, 0, w, h);
  // couch silhouette
  ctx.fillStyle = '#0d0805';
  ctx.beginPath();
  ctx.moveTo(120, h*0.55);
  ctx.lineTo(120, h*0.85);
  ctx.lineTo(w - 120, h*0.85);
  ctx.lineTo(w - 120, h*0.55);
  ctx.quadraticCurveTo(w/2, h*0.48, 120, h*0.55);
  ctx.closePath(); ctx.fill();
  // cushion divisions
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
  for (let i = 1; i < 3; i++){
    const x = 120 + i*(w-240)/3;
    ctx.beginPath(); ctx.moveTo(x, h*0.55); ctx.lineTo(x, h*0.85); ctx.stroke();
  }
  // glowing cracks across the couch (the fractured mirror)
  ctx.strokeStyle = work.palette[2]; // crack green
  ctx.lineWidth = 3;
  ctx.shadowColor = work.palette[2]; ctx.shadowBlur = 22;
  for (let i = 0; i < 14; i++){
    const sx = 180 + Math.random()*(w-360);
    const sy = h*0.55 + Math.random()*(h*0.3);
    ctx.beginPath(); ctx.moveTo(sx, sy);
    let cx = sx, cy = sy;
    for (let k = 0; k < 4; k++){
      cx += (Math.random()-0.5)*120;
      cy += (Math.random()-0.5)*80;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // ghostly silhouettes on couch (just abstract heads)
  ctx.fillStyle = 'rgba(232,216,176,0.18)';
  for (let i = 0; i < 4; i++){
    const cx = 220 + i*(w-440)/3;
    ctx.beginPath(); ctx.ellipse(cx, h*0.6, 50, 60, 0, 0, Math.PI*2); ctx.fill();
  }
}

// --- Game: voxel cyberpunk rain
function paintGame(ctx, w, h, work){
  ctx.fillStyle = '#0a1410'; ctx.fillRect(0, 0, w, h);
  // skyline of voxel towers
  for (let i = 0; i < 22; i++){
    const bx = (i / 22) * w;
    const bw = w/22 + 4;
    const bh = 200 + Math.random()*420;
    ctx.fillStyle = `rgba(${30 + Math.random()*40 | 0},${50 + Math.random()*40 | 0},${50 + Math.random()*30 | 0},1)`;
    ctx.fillRect(bx, h - bh - 100, bw, bh);
    // windows
    ctx.fillStyle = 'rgba(212,168,90,0.7)';
    for (let y = h - bh - 90; y < h - 110; y += 18){
      for (let x = bx + 4; x < bx + bw - 4; x += 12){
        if (Math.random() > 0.55) ctx.fillRect(x, y, 6, 8);
      }
    }
  }
  // wet street reflection
  const refl = ctx.createLinearGradient(0, h*0.78, 0, h);
  refl.addColorStop(0, 'rgba(74,117,112,0.4)');
  refl.addColorStop(1, 'rgba(7,5,8,1)');
  ctx.fillStyle = refl; ctx.fillRect(0, h*0.78, w, h*0.22);
  // rain streaks
  ctx.strokeStyle = 'rgba(192,184,144,0.35)'; ctx.lineWidth = 1;
  for (let i = 0; i < 240; i++){
    const x = Math.random()*w, y = Math.random()*h*0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 18); ctx.stroke();
  }
}

// --- Visitor: a single warm-lit doorway in deep dark
function paintVisitor(ctx, w, h, work){
  ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, w, h);
  // hallway perspective
  ctx.fillStyle = '#1a0e08';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w*0.35, h*0.35); ctx.lineTo(w*0.35, h*0.7); ctx.lineTo(0, h);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, 0); ctx.lineTo(w*0.65, h*0.35); ctx.lineTo(w*0.65, h*0.7); ctx.lineTo(w, h);
  ctx.closePath(); ctx.fill();
  // door
  const dx = w/2, dy = h*0.5;
  const dw = 220, dh = 360;
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(dx - dw/2, dy - dh/2, dw, dh);
  // warm glow leaking around door
  const glow = ctx.createRadialGradient(dx, dy, 50, dx, dy, 320);
  glow.addColorStop(0, 'rgba(212,168,90,0.55)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  // door slit light
  ctx.fillStyle = '#f0d8a8';
  ctx.fillRect(dx - dw/2 - 3, dy - dh/2, 6, dh);
  ctx.fillRect(dx + dw/2 - 3, dy - dh/2, 6, dh);
  ctx.fillRect(dx - dw/2, dy + dh/2 - 3, dw, 6);
  // knob
  ctx.fillStyle = '#d4a85a';
  ctx.beginPath(); ctx.arc(dx + dw/2 - 30, dy, 9, 0, Math.PI*2); ctx.fill();
  // silhouette of figure standing
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.beginPath();
  ctx.ellipse(dx - 250, dy + 60, 50, 80, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(dx - 280, dy + 110, 60, 180);
}

// --- Coherence: triangle of three colored rings
function paintCoherence(ctx, w, h, work){
  ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, w, h);
  // soft cosmic glow
  const sg = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, 600);
  sg.addColorStop(0, 'rgba(160,64,255,0.25)');
  sg.addColorStop(1, 'transparent');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);

  const cx = w/2, cy = h*0.45, R = 200;
  const verts = [
    { x: cx,        y: cy - R,        c: '#ffd47a' },  // V
    { x: cx - R*0.866, y: cy + R*0.5, c: '#80ffff' },  // H
    { x: cx + R*0.866, y: cy + R*0.5, c: '#ff60d0' },  // T
  ];
  // edges
  ctx.strokeStyle = 'rgba(232,216,176,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  ctx.lineTo(verts[1].x, verts[1].y);
  ctx.lineTo(verts[2].x, verts[2].y);
  ctx.closePath(); ctx.stroke();
  // glowing rings at each vertex
  for (const v of verts){
    ctx.shadowColor = v.c; ctx.shadowBlur = 40;
    ctx.strokeStyle = v.c; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(v.x, v.y, 55, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(v.x, v.y, 30, 0, Math.PI*2); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // labels
  ctx.fillStyle = '#e8d8b0'; ctx.font = '600 26px "Cinzel",serif'; ctx.textAlign = 'center';
  ctx.fillText('V · DEPTH',  verts[0].x, verts[0].y - 80);
  ctx.fillText('H · BREATH', verts[1].x - 30, verts[1].y + 100);
  ctx.fillText('T · OBLIGATION', verts[2].x + 30, verts[2].y + 100);
}

// --- Manifesto: cracked mirror with stenciled words
function paintManifesto(ctx, w, h, work){
  // cathedral wall
  ctx.fillStyle = '#0a1410'; ctx.fillRect(0, 0, w, h);
  // arched window distant
  ctx.fillStyle = 'rgba(74,117,112,0.18)';
  ctx.beginPath();
  ctx.moveTo(60, 120); ctx.quadraticCurveTo(140, 30, 220, 120); ctx.lineTo(220, 320); ctx.lineTo(60, 320);
  ctx.closePath(); ctx.fill();
  // mirror slab
  ctx.fillStyle = '#1a2820';
  ctx.fillRect(80, 180, w - 160, h - 360);
  // stenciled text
  ctx.fillStyle = '#c0b890';
  ctx.font = '900 110px "Cinzel","Impact",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('F*CK',           w/2, h*0.42);
  ctx.fillText('CORPORATE',      w/2, h*0.55);
  ctx.fillText('NARRATIVES',     w/2, h*0.68);
  // heavy cracks over the slab
  drawCracks(ctx, w, h, 1.0);
}

function paintGeneric(ctx, w, h, work){
  ctx.fillStyle = work.palette[2] || '#1a1410';
  ctx.fillRect(0, 0, w, h);
}

// --- Apparel shard: a flat-lay of four hanging tees on a warm brown bg
function paintApparel(ctx, w, h, work){
  // warm rust backdrop
  ctx.fillStyle = '#7a4222'; ctx.fillRect(0, 0, w, h);
  // wall plank shading
  for (let i = 0; i < 800; i++){
    ctx.fillStyle = `rgba(40,20,10,${0.04 + Math.random()*0.06})`;
    ctx.fillRect(Math.random()*w, Math.random()*h, 2, 2);
  }
  // 2x2 grid of garments
  const cells = [
    { x: w*0.25, y: h*0.28, tag: "BREAK\nTHE CYCLE",      bg: '#0a0604' },
    { x: w*0.75, y: h*0.28, tag: "I'M TIRED OF\nPERFORMING", bg: '#0a0604' },
    { x: w*0.25, y: h*0.58, tag: "HEAL THROUGH\nTHE CRACKS", bg: '#2a3a28' },
    { x: w*0.75, y: h*0.58, tag: "SOFT LAUNCH OF\nMY BREAKDOWN", bg: '#0a0604' },
  ];
  for (const c of cells){
    paintShirt(ctx, c.x, c.y, w*0.32, h*0.24, c.bg, c.tag);
  }
}

function paintShirt(ctx, cx, cy, sw, sh, bg, tag){
  // tee silhouette
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(cx - sw*0.45, cy - sh*0.30);   // left shoulder outer
  ctx.lineTo(cx - sw*0.18, cy - sh*0.42);   // left neck
  ctx.quadraticCurveTo(cx, cy - sh*0.34, cx + sw*0.18, cy - sh*0.42);
  ctx.lineTo(cx + sw*0.45, cy - sh*0.30);   // right shoulder outer
  ctx.lineTo(cx + sw*0.55, cy - sh*0.05);   // right sleeve cuff
  ctx.lineTo(cx + sw*0.35, cy + sh*0.05);   // right armpit
  ctx.lineTo(cx + sw*0.34, cy + sh*0.50);   // right hem
  ctx.lineTo(cx - sw*0.34, cy + sh*0.50);
  ctx.lineTo(cx - sw*0.35, cy + sh*0.05);
  ctx.lineTo(cx - sw*0.55, cy - sh*0.05);
  ctx.closePath(); ctx.fill();
  // collar shading
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - sw*0.18, cy - sh*0.42);
  ctx.quadraticCurveTo(cx, cy - sh*0.34, cx + sw*0.18, cy - sh*0.42);
  ctx.stroke();
  // print area
  const px = cx - sw*0.22, py = cy - sh*0.18, pw = sw*0.44, ph = sh*0.40;
  // small printed scene placeholder (warm framed panel)
  ctx.fillStyle = '#d4a85a';
  ctx.fillRect(px, py, pw, ph * 0.55);
  // a tiny silhouette of figures inside the print
  ctx.fillStyle = '#3a2010';
  ctx.beginPath(); ctx.arc(px + pw*0.3, py + ph*0.28, ph*0.08, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + pw*0.65, py + ph*0.24, ph*0.10, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(px + pw*0.22, py + ph*0.38, pw*0.18, ph*0.18);
  ctx.fillRect(px + pw*0.55, py + ph*0.35, pw*0.22, ph*0.20);
  // tag text below print
  ctx.fillStyle = '#ead7ad';
  ctx.font = `700 ${Math.round(sh*0.075)}px "Cinzel","Impact",sans-serif`;
  ctx.textAlign = 'center';
  const lines = tag.split('\n');
  lines.forEach((l, i) => {
    ctx.fillText(l, cx, py + ph*0.78 + i * sh*0.085);
  });
}

// --- Crack overlay used across all shards (varying intensity)
function drawCracks(ctx, w, h, intensity){
  ctx.save();
  const cracks = Math.floor(7 * intensity) + 4;
  for (let i = 0; i < cracks; i++){
    const x0 = Math.random() * w;
    const y0 = Math.random() * h;
    const len = 4 + Math.floor(Math.random() * 6);
    ctx.strokeStyle = `rgba(0,0,0,${0.6 * intensity})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    let cx = x0, cy = y0;
    for (let k = 0; k < len; k++){
      cx += (Math.random() - 0.5) * 240;
      cy += (Math.random() - 0.5) * 240;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    // bright highlight on the crack
    ctx.strokeStyle = `rgba(255,232,180,${0.18 * intensity})`;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.restore();
}

// =============================================================================
// Build a shard mesh
// =============================================================================
function makeShardGeometry(width, height, jitter = 0.06){
  // Near-rectangular shard with one diagonal cut at the lower-left so the
  // bottom title plate is always inside the silhouette and no letters get
  // clipped. Jitter only nudges the vertices, never inverts the safe area.
  const w = width / 2, h = height / 2;
  const j = jitter;
  const r = () => (Math.random() - 0.5) * 2 * j;
  const pts = [
    new THREE.Vector2(-w * (1 + r()*0.3),  h * (1 + r()*0.3)),     // top-left
    new THREE.Vector2( w * (1 + r()*0.3),  h * (1 + r()*0.3)),     // top-right
    new THREE.Vector2( w * (1 + r()*0.2), -h * (0.85 + r()*0.2)),  // right-mid
    new THREE.Vector2( w * (0.95 + r()*0.2), -h * (1 + r()*0.1)),  // bottom-right
    new THREE.Vector2(-w * (0.85 + r()*0.2), -h * (1 + r()*0.1)),  // bottom-left
    new THREE.Vector2(-w * (1 + r()*0.2), -h * (0.5 + r()*0.2)),   // left diagonal cut
  ];
  const shape = new THREE.Shape(pts);

  // Compute shape bounds for the UV generator so the painted texture spans
  // the whole shard surface (Three's default uses world coords, which leaves
  // most of the shard sampling a single edge pixel).
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts){
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const rangeX = maxX - minX, rangeY = maxY - minY;
  const normUV = (x, y) => new THREE.Vector2(
    (x - minX) / rangeX,
    (y - minY) / rangeY,
  );
  const uvGenerator = {
    generateTopUV(geometry, vertices, iA, iB, iC){
      return [
        normUV(vertices[iA*3], vertices[iA*3+1]),
        normUV(vertices[iB*3], vertices[iB*3+1]),
        normUV(vertices[iC*3], vertices[iC*3+1]),
      ];
    },
    generateSideWallUV(geometry, vertices, iA, iB, iC, iD){
      return [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(1, 0),
        new THREE.Vector2(1, 1),
        new THREE.Vector2(0, 1),
      ];
    },
  };

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 1,
    UVGenerator: uvGenerator,
  });
  geo.center();
  return geo;
}

function makeShardMesh(work, size){
  const geo = makeShardGeometry(size, size * 1.5);
  const tex = makeShardTexture(work);
  // Low metalness so the painted texture reads as actual paint, with a
  // clearcoat sheen for the wet-mirror look. Emissive map (re-using the same
  // texture) gives subtle self-illumination, raised on hover.
  // Low metalness + matte-ish roughness so the painted texture reads as paint;
  // emissive map echoes the texture at low intensity so the dark passages
  // (steps, figure) remain readable without blowing out highlights.
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex,
    metalness: 0.0,
    roughness: 0.7,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    reflectivity: 0.25,
    side: THREE.DoubleSide,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.55,
    toneMapped: true,
  });
  // Back of shard — same texture, dimmer.
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { work, baseRot: new THREE.Euler(), targetEmissive: 0.55 };
  return mesh;
}

// =============================================================================
// Place shards: book at center, others orbiting
// =============================================================================
const shards = [];
const group = new THREE.Group();
scene.add(group);

const headline = worksData.headline;
const bookWork = headline.find(w => w.primary);
const others   = headline.filter(w => !w.primary);

// Central book shard — largest.
const bookShard = makeShardMesh(bookWork, 4.4);
bookShard.position.set(0, 0.2, 0);
bookShard.userData.orbit = { radius: 0, angle: 0, speed: 0 };
group.add(bookShard); shards.push(bookShard);

// Orbiting shards arranged in a tight ring around the book — sized so all
// five sit inside the initial frame from the default camera angle. Each shard
// drifts in front of and behind the book over time.
const ringRadius = 4.6;
others.forEach((work, i) => {
  const m = makeShardMesh(work, 2.4 + (i%2)*0.25);
  const angle = (i / others.length) * Math.PI * 2 + Math.PI * 0.15;
  m.userData.orbit = {
    radius: ringRadius,
    angle,
    speed: 0.05 + Math.random() * 0.02,
    yPhase: i * 1.1,
    ySwing: 0.35 + Math.random() * 0.35,
    xStretch: 1.25,
    zSwing: 2.0,
  };
  const x = Math.cos(angle) * ringRadius * 1.25;
  const y = Math.sin(angle) * ringRadius * 0.55;
  const z = Math.sin(angle * 0.5) * 2.0 + 2.4;
  m.position.set(x, y, z);
  m.lookAt(camera.position);
  group.add(m); shards.push(m);
});

// =============================================================================
// Embers/dust particle field
// =============================================================================
const emberCount = 380;
const emberGeo = new THREE.BufferGeometry();
const emberPos = new Float32Array(emberCount * 3);
const emberVel = new Float32Array(emberCount * 3);
for (let i = 0; i < emberCount; i++){
  emberPos[i*3]   = (Math.random() - 0.5) * 40;
  emberPos[i*3+1] = (Math.random() - 0.5) * 24;
  emberPos[i*3+2] = (Math.random() - 0.5) * 30 - 4;
  emberVel[i*3]   = (Math.random() - 0.5) * 0.01;
  emberVel[i*3+1] = 0.005 + Math.random() * 0.012;
  emberVel[i*3+2] = (Math.random() - 0.5) * 0.008;
}
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
const emberMat = new THREE.PointsMaterial({
  color: 0xd35a3f,
  size: 0.05,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const embers = new THREE.Points(emberGeo, emberMat);
scene.add(embers);

// =============================================================================
// Postprocessing — bloom for the ember/teal accents
// =============================================================================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Bloom only on the brightest highlights (embers, gold rims) — high threshold
// so the painted shard textures stay readable.
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.35, 0.4, 0.92,
);
composer.addPass(bloom);

// =============================================================================
// Interaction — raycast for hover/click
// =============================================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-2, -2);
let hovered = null;

renderer.domElement.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  if (tooltip.classList.contains('show')){
    tooltip.style.left = e.clientX + 'px';
    tooltip.style.top  = e.clientY + 'px';
  }
});
renderer.domElement.addEventListener('pointerleave', () => { mouse.set(-2, -2); });

renderer.domElement.addEventListener('click', (e) => {
  if (panel.classList.contains('open')) return;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(shards, false);
  if (hits.length){
    openWork(hits[0].object.userData.work);
  }
});

panelClose.addEventListener('click', closePanel);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

// =============================================================================
// Top nav — chips for each work
// =============================================================================
headline.forEach(w => {
  const b = document.createElement('button');
  b.textContent = w.title;
  b.addEventListener('click', () => openWork(w));
  topnav.appendChild(b);
});

// =============================================================================
// Panel rendering
// =============================================================================
function openWork(work){
  panelScroll.scrollTop = 0;
  panelScroll.innerHTML = renderWork(work);
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  // Wire chapter clicks
  panelScroll.querySelectorAll('[data-chapter]').forEach(el => {
    el.addEventListener('click', () => openChapter(parseInt(el.dataset.chapter, 10)));
  });
  panelScroll.querySelectorAll('[data-app]').forEach(el => {
    el.addEventListener('click', () => {
      const slug = el.dataset.app;
      if (window.fracture?.openApp){ window.fracture.openApp(slug); }
      else alert('In the Fracture City shell, this opens: ' + slug);
    });
  });
  // Camera focus on shard
  const target = shards.find(s => s.userData.work.id === work.id);
  if (target){ focusOn(target); }
}
function closePanel(){
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  focusTarget = null;
  controls.target.set(0, 0, 0);
  // glide camera back to its rest position
  cameraResting = true;
}
let cameraResting = false;
const cameraRestPos = new THREE.Vector3(0, 0.6, 16.5);

function renderWork(work){
  if (work.kind === 'apparel'){
    return `
      <div class="detail-kind">${escape(work.kind)} · ${work.collections.reduce((n,c)=>n+c.designs.length,0)} designs</div>
      <h1 class="detail-title">${escape(work.title)}</h1>
      <div class="detail-sub">${escape(work.subtitle)}</div>
      <p class="detail-blurb">${escape(work.blurb)}</p>
      ${work.collections.map((col, ci) => `
        <div class="apparel-collection">
          <div class="detail-section-h">${escape(col.name)} · ${escape(col.garment)}</div>
          <div class="apparel-collection-sub">${escape(col.blurb)}</div>
          <div class="apparel-grid">
            ${col.designs.map((d, di) => `
              <div class="apparel-card" data-collection="${ci}" data-design="${di}">
                <canvas></canvas>
                <div class="apparel-tag">${escape(d.tag)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    `;
  }
  if (work.kind === 'book'){
    return `
      <div class="detail-kind">Volume · 32 chapters</div>
      <h1 class="detail-title">${escape(work.title)}</h1>
      <div class="detail-sub">${escape(work.subtitle)} — ${escape(work.author)}</div>
      <div class="cover"><canvas id="bookcover"></canvas></div>
      <p class="detail-blurb">${escape(work.blurb)}</p>
      <div class="detail-section-h">Read by chapter</div>
      <ol class="chapter-list">
        ${bookData.chapters.map(c => `
          <li data-chapter="${c.index}">
            <span></span>
            <span>
              <span class="ch-title">${escape(c.title)}</span>
              ${c.subtitle ? `<span class="ch-sub">${escape(c.subtitle)}</span>` : ''}
            </span>
          </li>
        `).join('')}
      </ol>
    `;
  }
  const linksHtml = (work.links || []).map(l =>
    l.appSlug
      ? `<button data-app="${l.appSlug}">${escape(l.label)}</button>`
      : `<a href="${l.href}">${escape(l.label)}</a>`
  ).join('');
  const bodyHtml = (work.body || []).map(p => `<p>${escape(p)}</p>`).join('');
  return `
    <div class="detail-kind">${escape(work.kind || 'work')}</div>
    <h1 class="detail-title">${escape(work.title)}</h1>
    ${work.subtitle ? `<div class="detail-sub">${escape(work.subtitle)}</div>` : ''}
    <p class="detail-blurb">${escape(work.blurb)}</p>
    ${bodyHtml}
    ${linksHtml ? `<div class="detail-section-h">Threads</div><div class="links">${linksHtml}</div>` : ''}
  `;
}

function openChapter(index){
  const c = bookData.chapters[index - 1];
  if (!c) return;
  panelScroll.scrollTop = 0;
  panelScroll.innerHTML = `
    <div class="chapter-view">
      <button class="back" id="chBack">‹ BACK TO CONTENTS</button>
      <div class="detail-kind">Chapter ${String(index).padStart(2,'0')} of ${bookData.chapters.length}</div>
      <h2>${escape(c.title)}</h2>
      ${c.subtitle ? `<div class="ch-subtitle">${escape(c.subtitle)}</div>` : ''}
      ${c.paragraphs.map((p, i) =>
        p === '◆' || p.length < 4
          ? `<div class="glyph">◆</div>`
          : `<p>${escape(p)}</p>`
      ).join('')}
      <div class="glyph">◆&nbsp;◆&nbsp;◆</div>
      <button class="back" id="chBack2">‹ BACK TO CONTENTS</button>
    </div>
  `;
  panelScroll.querySelector('#chBack').addEventListener('click', () => openWork(bookWork));
  panelScroll.querySelector('#chBack2').addEventListener('click', () => openWork(bookWork));
}

function escape(s){ return String(s ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

// Paint apparel thumbnails when the panel mounts them
function paintApparelThumbs(){
  const apparelWork = headline.find(w => w.kind === 'apparel');
  if (!apparelWork) return;
  document.querySelectorAll('.apparel-card').forEach(card => {
    if (card.dataset.painted) return;
    const c = card.querySelector('canvas');
    const ci = +card.dataset.collection, di = +card.dataset.design;
    const design = apparelWork.collections[ci].designs[di];
    const garment = apparelWork.collections[ci].garment;
    const bg = (garment.includes('hood') || garment.includes('crewneck')) ? '#8a4a26'
             : (garment.includes('earth')) ? ['#e8dac0','#5a6a3a','#c8643a','#1a2810'][di % 4]
             : '#0a0604';
    c.width = 400; c.height = 400;
    paintShirt(c.getContext('2d'), 200, 200, 360, 320, bg, design.tag);
    card.dataset.painted = '1';
  });
}

// Render the cover canvas inline when the book panel mounts
const _observer = new MutationObserver(() => {
  paintApparelThumbs();
  const c = document.getElementById('bookcover');
  if (c && !c.dataset.painted){
    c.dataset.painted = '1';
    c.width = 800; c.height = 1200;
    paintBook(c.getContext('2d'), c.width, c.height, bookWork);
    drawCracks(c.getContext('2d'), c.width, c.height, 0.5);
    // overlay title
    const ctx = c.getContext('2d');
    const plate = ctx.createLinearGradient(0, c.height - 220, 0, c.height);
    plate.addColorStop(0, 'rgba(0,0,0,0)'); plate.addColorStop(1, 'rgba(7,5,4,0.98)');
    ctx.fillStyle = plate; ctx.fillRect(0, c.height - 220, c.width, 220);
    ctx.fillStyle = '#ead7ad'; ctx.textAlign = 'center';
    ctx.font = '700 56px "Cinzel",serif';
    ctx.fillText('THE COLLAPSE', c.width/2, c.height - 130);
    ctx.fillText('OF MEANING',  c.width/2, c.height - 70);
    ctx.font = 'italic 22px "Cormorant Garamond",serif';
    ctx.fillStyle = '#a3906a';
    ctx.fillText(bookWork.subtitle, c.width/2, c.height - 30);
  }
});
_observer.observe(panelScroll, { childList: true, subtree: true });

// =============================================================================
// Hover tooltip
// =============================================================================
function updateHover(){
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(shards, false);
  const hit = hits[0]?.object;
  if (hit !== hovered){
    if (hovered){ hovered.userData.targetEmissive = 0.55; }
    if (hit)   { hit.userData.targetEmissive    = 1.1;  }
    hovered = hit;
    if (hit){
      tooltip.innerHTML = `${escape(hit.userData.work.title)}<span class="tt-sub">${escape(hit.userData.work.subtitle || '')}</span>`;
      tooltip.classList.add('show');
      document.body.style.cursor = 'pointer';
    } else {
      tooltip.classList.remove('show');
      document.body.style.cursor = 'default';
    }
  }
}

// =============================================================================
// Camera focus on a shard
// =============================================================================
let focusTarget = null, focusTime = 0;
function focusOn(mesh){
  focusTarget = mesh;
  focusTime = performance.now();
}

// =============================================================================
// Animation loop
// =============================================================================
const clock = new THREE.Clock();
function animate(){
  const t = clock.getElapsedTime();
  const dt = clock.getDelta();

  // Orbit the smaller shards
  shards.forEach((m, i) => {
    if (i === 0){
      // book — slow breathing rotation
      m.rotation.y = Math.sin(t * 0.18) * 0.18;
      m.rotation.x = Math.sin(t * 0.12) * 0.05;
      m.position.y = 0.2 + Math.sin(t * 0.4) * 0.08;
    } else {
      const o = m.userData.orbit;
      o.angle += o.speed * dt;
      const x = Math.cos(o.angle) * o.radius * (o.xStretch ?? 1);
      const y = Math.sin(o.angle) * o.radius * 0.55
                + Math.sin(t * 0.6 + o.yPhase) * o.ySwing * 0.4;
      const z = Math.sin(o.angle * 0.5) * (o.zSwing ?? 2) + 2.4
                + Math.sin(t * 0.4 + o.yPhase) * 0.4;
      m.position.set(x, y, z);
      const lookTarget = camera.position.clone()
        .add(new THREE.Vector3(Math.sin(t*0.3 + i)*0.4, Math.cos(t*0.4 + i)*0.3, 0));
      m.lookAt(lookTarget);
      m.rotation.z += Math.sin(t * 0.4 + i) * 0.003;
    }
    // ease emissive toward target (hover glow)
    const cur = m.material.emissiveIntensity;
    m.material.emissiveIntensity = cur + (m.userData.targetEmissive - cur) * 0.08;
  });

  // Embers
  const pos = embers.geometry.attributes.position.array;
  for (let i = 0; i < emberCount; i++){
    pos[i*3]   += emberVel[i*3]   + Math.sin(t * 0.5 + i) * 0.0008;
    pos[i*3+1] += emberVel[i*3+1];
    pos[i*3+2] += emberVel[i*3+2];
    if (pos[i*3+1] > 12){
      pos[i*3]   = (Math.random() - 0.5) * 40;
      pos[i*3+1] = -12;
      pos[i*3+2] = (Math.random() - 0.5) * 30 - 4;
    }
  }
  embers.geometry.attributes.position.needsUpdate = true;

  updateHover();

  // Camera focus easing — softer pull so the cluster stays in frame.
  if (focusTarget){
    const desired = focusTarget.position.clone().multiplyScalar(0.3);
    desired.z += focusTarget === bookShard ? 13 : 9;
    desired.y += 0.4;
    camera.position.lerp(desired, 0.035);
    controls.target.lerp(focusTarget.position, 0.05);
  } else if (cameraResting){
    camera.position.lerp(cameraRestPos, 0.05);
    if (camera.position.distanceTo(cameraRestPos) < 0.05) cameraResting = false;
  }

  controls.update();
  composer.render();
  requestAnimationFrame(animate);
}

// Resize
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  sizeAndPaintRoom();
});

// Expose for debugging
window.__works = { scene, camera, shards, controls, renderer, composer };

// Kick it off
animate();

// Drop the veil
setTimeout(() => {
  loaderPct = 100;
  veilbar.style.width = '100%';
  setTimeout(() => veil.classList.add('gone'), 380);
}, 600);
