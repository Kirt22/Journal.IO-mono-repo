import {
  BUFFER_GEOMETRY_UTILS_SOURCE,
  ORBIT_CONTROLS_SOURCE,
  THREE_UMD_SOURCE,
} from './three.vendor';

export type MindMapSceneTheme = {
  bgCenter: string;
  bgEdge: string;
  pinBg: string;
  pinText: string;
  strong: string;
  tipBg: string;
  tipText: string;
};

/**
 * Self-contained HTML for the Mind Map 3D WebView renderer.
 *
 * This is a near-verbatim port of the Claude Design `Mind Map 3D.html` scene
 * (anatomical brain with 4 colored lobes, deep procedural gyri/sulci, cerebellum
 * + brainstem, OrbitControls, and numbered reflection pins). The differences:
 *  - Three.js + OrbitControls + BufferGeometryUtils are inlined from the vendored
 *    r0.147 UMD build (globals) so it runs offline — no CDN import map.
 *  - The 8 reflection regions are supplied by the app via `window.__setMindMap`
 *    (label / subtitle / signal / rank / strongest), keyed to fixed anatomical
 *    coordinates by region id, instead of being hardcoded.
 *  - Pin taps are posted back to React Native; camera reset is `window.__recenter`.
 *  - Scene background and pin/tip colors follow the app theme; the anatomical
 *    lobe colors stay constant because they are semantic.
 */
export function buildMindMapHtml(theme?: MindMapSceneTheme): string {
  return (
    '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">' +
    '<style>' +
    STYLE +
    // Theme overrides baked in at build time so the very first paint (loader +
    // background) already matches the app theme, before any JS runs.
    themeVars(theme) +
    '</style></head><body>' +
    MARKUP +
    '<script>' +
    THREE_UMD_SOURCE +
    '</script>' +
    '<script>' +
    ORBIT_CONTROLS_SOURCE +
    '</script>' +
    '<script>' +
    BUFFER_GEOMETRY_UTILS_SOURCE +
    '</script>' +
    '<script>' +
    SCENE_SCRIPT +
    '</script>' +
    '</body></html>'
  );
}

function themeVars(theme?: MindMapSceneTheme): string {
  if (!theme) {
    return '';
  }
  return (
    ':root{' +
    '--bg-center:' + theme.bgCenter + ';--bg-edge:' + theme.bgEdge + ';' +
    '--pin-bg:' + theme.pinBg + ';--pin-text:' + theme.pinText + ';' +
    '--strong:' + theme.strong + ';' +
    '--tip-bg:' + theme.tipBg + ';--tip-text:' + theme.tipText + ';}'
  );
}

const STYLE = [
  ':root{',
  '--bg-center:#FFF4EA;--bg-edge:#E7D4C1;',
  '--pin-bg:rgba(38,34,32,.82);--pin-text:#FDF8F3;--strong:#D6503B;',
  '--tip-bg:#2D2A26;--tip-text:#FDF8F3;}',
  '*{box-sizing:border-box}',
  'html,body{margin:0;height:100%;width:100%;overflow:hidden;',
  'background:radial-gradient(120% 92% at 50% 32%,var(--bg-center) 0%,var(--bg-edge) 100%);',
  'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;',
  '-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}',
  '#brainCanvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}',
  '.brshadow{position:absolute;left:50%;bottom:14%;transform:translateX(-50%);width:56%;height:34px;',
  'border-radius:50%;background:radial-gradient(closest-side,rgba(123,70,57,.28),rgba(123,70,57,0));z-index:1;pointer-events:none}',
  '.tip{position:absolute;top:16px;left:50%;transform:translateX(-50%);background:var(--tip-bg);color:var(--tip-text);',
  'font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:10px;box-shadow:0 8px 20px rgba(60,30,20,.35);',
  'max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0;transition:opacity .18s;pointer-events:none;z-index:6}',
  '.tip.show{opacity:1}',
  '.pins{position:absolute;inset:0;pointer-events:none;z-index:4}',
  '.pin{position:absolute;left:0;top:0;width:22px;height:22px;border-radius:999px;transform:translate(-50%,-50%);',
  'display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--pin-text);',
  'background:var(--pin-bg);box-shadow:0 2px 7px rgba(40,20,10,.4),0 0 0 1.5px rgba(255,255,255,.55);',
  'pointer-events:auto;cursor:pointer;transition:opacity .15s;will-change:left,top,opacity}',
  '.pin.strong{background:var(--strong);box-shadow:0 2px 10px rgba(210,60,40,.5),0 0 0 2px rgba(255,255,255,.8)}',
  '.pin.strong::after{content:"";position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;',
  'border-radius:999px;border:2px solid var(--strong);animation:pinpulse 2s ease-out infinite;pointer-events:none}',
  '.pin.sel{transform:translate(-50%,-50%) scale(1.16);box-shadow:0 3px 12px rgba(40,20,10,.5),0 0 0 2.5px #fff;z-index:2}',
  '.pin.active{transform:translate(-50%,-50%) scale(1.16);box-shadow:0 3px 12px rgba(40,20,10,.5),0 0 0 2.5px #fff;z-index:2}',
  '@keyframes pinpulse{0%{transform:scale(.75);opacity:.65}100%{transform:scale(1.9);opacity:0}}',
  // Loading overlay — a calm pulsing orb that paints before the heavy brain build
  // blocks the thread, then fades out once the first frame renders.
  '.loader{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;',
  'gap:15px;z-index:8;opacity:1;transition:opacity .55s ease;pointer-events:none}',
  '.loader.hide{opacity:0}',
  '.loader .orb{width:44px;height:44px;border-radius:999px;position:relative;',
  'background:radial-gradient(circle at 50% 42%, var(--strong), rgba(0,0,0,0) 72%);',
  'animation:orbpulse 1.5s ease-in-out infinite}',
  '.loader .orb::after{content:"";position:absolute;inset:-9px;border-radius:999px;border:2px solid var(--strong);',
  'opacity:.35;animation:orbring 1.7s ease-out infinite}',
  '.loader .ll{font-size:11.5px;font-weight:700;letter-spacing:.02em;color:var(--legend-text)}',
  '@keyframes orbpulse{0%,100%{transform:scale(.84);opacity:.72}50%{transform:scale(1.06);opacity:1}}',
  '@keyframes orbring{0%{transform:scale(.7);opacity:.5}100%{transform:scale(1.55);opacity:0}}',
].join('');

const MARKUP = [
  '<div class="brshadow"></div>',
  '<canvas id="brainCanvas"></canvas>',
  '<div class="pins" id="pins"></div>',
  '<div class="tip" id="tip"></div>',
  '<div class="loader" id="loader"><div class="orb"></div><div class="ll">Shaping your Mind Map…</div></div>',
].join('');

// NOTE: keep this script free of template literals and `${` so it can live inside
// a TS template/concatenation safely. It uses only `+` string concatenation.
const SCENE_SCRIPT = [
  "(function(){",
  "var canvas = document.getElementById('brainCanvas');",
  "var tip = document.getElementById('tip');",
  "var pinsEl = document.getElementById('pins');",
  "var loaderEl = document.getElementById('loader');",
  "var loaderHidden = false;",
  "function hideLoader(){ if(loaderHidden) return; loaderHidden = true; if(loaderEl){ loaderEl.classList.add('hide'); setTimeout(function(){ if(loaderEl && loaderEl.parentNode){ loaderEl.parentNode.removeChild(loaderEl); } }, 650); } }",

  // 4 anatomical lobes (constant, semantic colors)
  "var LOBES = {",
  "  frontal:   { name:'Frontal lobe',   c:'#D65642' },",
  "  parietal:  { name:'Parietal lobe',  c:'#E39A34' },",
  "  temporal:  { name:'Temporal lobe',  c:'#4E86A6' },",
  "  occipital: { name:'Occipital lobe', c:'#6BA36A' }",
  "};",
  "function lobeAt(x,y,z){",
  "  var L=Math.hypot(x,y,z)||1, dz=z/L, dy=y/L;",
  "  var sylC = -0.02 - 0.22*dz;",
  "  if(dy < sylC && dz > -0.42) return 'temporal';",
  "  if(dz > 0.20 - 0.16*dy) return 'frontal';",
  "  if(dz > -0.55) return 'parietal';",
  "  return 'occipital';",
  "}",

  // Fixed anatomical projection per region id (from the design's REGIONS.a)
  "var COORDS = {",
  "  self_reflection_identity:  [0.20, 0.62,-0.30],",
  "  relationships_perspective: [0.86, 0.16,-0.42],",
  "  planning_self_control:     [0.40, 0.40, 0.86],",
  "  memory_meaning:            [0.80,-0.40,-0.02],",
  "  emotional_intensity:       [0.72,-0.34, 0.52],",
  "  motivation_reward:         [0.42,-0.10, 0.70],",
  "  body_inner_signals:        [0.92, 0.00, 0.18],",
  "  conflict_attention:        [0.24, 0.66, 0.42]",
  "};",

  // ---- compact seeded 3D Perlin noise ----
  "var perm = new Uint8Array(512);",
  "(function(){",
  "  var p=new Uint8Array(256); for(var i=0;i<256;i++) p[i]=i;",
  "  var s=1337; function rnd(){ s=(s*16807)%2147483647; return s/2147483647; }",
  "  for(var i2=255;i2>0;i2--){ var j=Math.floor(rnd()*(i2+1)); var t=p[i2]; p[i2]=p[j]; p[j]=t; }",
  "  for(var i3=0;i3<512;i3++) perm[i3]=p[i3&255];",
  "})();",
  "function fade(t){ return t*t*t*(t*(t*6-15)+10); }",
  "function lerp(a,b,t){ return a+t*(b-a); }",
  "function grad(h,x,y,z){ h&=15; var u=h<8?x:y, v=h<4?y:(h===12||h===14?x:z); return ((h&1)?-u:u)+((h&2)?-v:v); }",
  "function noise3(x,y,z){",
  "  var X=Math.floor(x)&255, Y=Math.floor(y)&255, Z=Math.floor(z)&255;",
  "  x-=Math.floor(x); y-=Math.floor(y); z-=Math.floor(z);",
  "  var u=fade(x), v=fade(y), w=fade(z);",
  "  var A=perm[X]+Y, AA=perm[A]+Z, AB=perm[A+1]+Z;",
  "  var B=perm[X+1]+Y, BA=perm[B]+Z, BB=perm[B+1]+Z;",
  "  return lerp(",
  "    lerp(lerp(grad(perm[AA],x,y,z),   grad(perm[BA],x-1,y,z),   u),",
  "         lerp(grad(perm[AB],x,y-1,z), grad(perm[BB],x-1,y-1,z), u), v),",
  "    lerp(lerp(grad(perm[AA+1],x,y,z-1),   grad(perm[BA+1],x-1,y,z-1),   u),",
  "         lerp(grad(perm[AB+1],x,y-1,z-1), grad(perm[BB+1],x-1,y-1,z-1), u), v),",
  "    w);",
  "}",
  "function fbm(x,y,z,oct){ var v=0,a=0.5,f=1; for(var i=0;i<oct;i++){ v+=a*noise3(x*f,y*f,z*f); f*=2; a*=0.5; } return v; }",
  "function cortField(x,y,z,freq,wamp){",
  "  var wx=fbm(x*0.5+11.2,y*0.5+3.7,z*0.5+9.1,2);",
  "  var wy=fbm(x*0.5+5.1, y*0.5+8.3,z*0.5+1.9,2);",
  "  var wz=fbm(x*0.5+2.4, y*0.5+6.6,z*0.5+4.2,2);",
  "  return Math.abs(fbm((x+wx*wamp)*freq,(y+wy*wamp)*freq,(z+wz*wamp)*freq,2));",
  "}",
  "function clamp(x,a,b){ return Math.min(b,Math.max(a,x)); }",
  "function sstep(a,b,x){ var t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }",
  "function gauss(v,c,s){ var t=(v-c)/s; return Math.exp(-t*t); }",

  // The heavy brain build is deferred (see boot() trigger below) so the loader
  // overlay paints before this blocks the main thread.
  "function boot(){",
  // ================= CEREBRUM =================
  "var geo = new THREE.IcosahedronGeometry(1, 64);",
  "var pos = geo.attributes.position;",
  "var colAttr = new THREE.BufferAttribute(new Float32Array(pos.count*3), 3);",
  "var tmp = new THREE.Vector3();",
  "var cReg = new THREE.Color();",
  "for(var i=0;i<pos.count;i++){",
  "  tmp.fromBufferAttribute(pos,i);",
  "  var d = tmp.clone().normalize();",
  "  var ax = Math.abs(d.x), lat = ax;",
  "  var f1 = cortField(d.x, d.y, d.z, 5.0, 0.42);",
  "  var s1 = sstep(0.03, 0.92, f1);",
  "  var gyri = (s1-0.5)*0.135;",
  "  var f2 = cortField(d.x+3.1, d.y-1.7, d.z+2.2, 10.5, 0.20);",
  "  gyri += (f2-0.42)*0.015;",
  "  var sulcusLine = sstep(0.15, 0.0, f1);",
  "  var sylC = -0.02 - 0.22*d.z;",
  "  var sylvian = gauss(d.y - sylC, 0, 0.085) * sstep(0.30,0.68,lat) * gauss(d.z, 0.10, 0.85);",
  "  var central = gauss(d.z - (0.20 - 0.16*d.y), 0, 0.045) * sstep(-0.05,0.55,d.y);",
  "  var paroc = gauss(d.z + 0.55, 0, 0.05) * sstep(0.05,0.6,d.y);",
  "  var midline = gauss(d.x, 0, 0.055) * sstep(-0.05,0.5,d.y);",
  "  var majorCarve = sylvian*0.12 + central*0.042 + paroc*0.032 + midline*0.11;",
  "  var r = 1 + gyri - majorCarve;",
  "  var tempMask = sstep(0.0,0.30, sylC - d.y) * sstep(0.30,0.72,lat) * gauss(d.z, 0.14, 0.66);",
  "  r += tempMask*0.17;",
  "  r += sstep(0.45,1.0, d.z)*0.03;",
  "  var p = d.clone().multiplyScalar(r);",
  "  p.x *= 0.82; p.y *= 0.80; p.z *= 1.20;",
  "  if(p.y < 0){ var m=sstep(0.55,0.0,lat); p.y *= (1.0 - 0.30*m); }",
  "  p.z += sstep(0.1,1.0,d.z)*0.05;",
  "  if(d.z < -0.55){ var tt=sstep(-0.55,-1.0,d.z); p.x*=1-0.18*tt; p.y*=1-0.10*tt; p.z-=0.05*tt; }",
  "  pos.setXYZ(i, p.x, p.y, p.z);",
  "  cReg.set(LOBES[lobeAt(d.x, d.y, d.z)].c);",
  "  var totalDisp = gyri - majorCarve;",
  "  var ao = sstep(-0.11, 0.09, totalDisp);",
  "  var c = cReg.clone().multiplyScalar(0.60 + 0.40*ao);",
  "  c.multiplyScalar(1 - 0.32*sulcusLine);",
  "  c.multiplyScalar(1 - 0.20*sstep(0.40,1.0, sylvian));",
  "  colAttr.setXYZ(i, c.r, c.g, c.b);",
  "}",
  "geo.setAttribute('color', colAttr);",
  "var brainGeo = THREE.BufferGeometryUtils.mergeVertices(geo);",
  "brainGeo.computeVertexNormals();",
  "var brain = new THREE.Mesh(brainGeo, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.66, metalness:0.0 }));",
  "brain.name = 'brain';",

  // ================= CEREBELLUM + STEM =================
  "function makeCerebellum(){",
  "  var g = new THREE.IcosahedronGeometry(1, 40);",
  "  var pa = g.attributes.position; var v = new THREE.Vector3();",
  "  for(var i=0;i<pa.count;i++){",
  "    v.fromBufferAttribute(pa,i); var d=v.clone().normalize();",
  "    var folia = Math.abs(Math.sin(d.y*30 + Math.cos(d.z*6)*0.6));",
  "    var vermis = 1 - 0.10*gauss(d.x,0,0.10);",
  "    var rr = (1 + (folia-0.5)*0.05) * vermis;",
  "    var p = d.clone().multiplyScalar(rr);",
  "    p.x*=1.06; p.y*=0.62; p.z*=0.86;",
  "    pa.setXYZ(i,p.x,p.y,p.z);",
  "  }",
  "  var cg = THREE.BufferGeometryUtils.mergeVertices(g);",
  "  cg.computeVertexNormals();",
  "  var mm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color:'#8F8177', roughness:0.85 }));",
  "  mm.name='cerebellum'; mm.scale.setScalar(0.58); mm.position.set(0,-0.58,-0.90);",
  "  return mm;",
  "}",
  "var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.15, 0.62, 24), new THREE.MeshStandardMaterial({ color:'#C29A6E', roughness:0.88 }));",
  "stem.name='stem'; stem.position.set(0,-0.74,-0.60); stem.rotation.x=0.5;",

  "var group = new THREE.Group();",
  "group.add(brain, makeCerebellum(), stem);",
  "group.rotation.y = 0.5;",

  // ---- scene / renderer ----
  "var scene = new THREE.Scene();",
  "var renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:true });",
  "renderer.setClearColor(0x000000, 0);",
  "if(THREE.SRGBColorSpace){ renderer.outputColorSpace = THREE.SRGBColorSpace; } else { renderer.outputEncoding = THREE.sRGBEncoding; }",
  "scene.add(group);",
  "var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);",
  "var START = new THREE.Vector3(3.2, 0.6, 1.9);",
  "camera.position.copy(START);",
  "scene.add(new THREE.HemisphereLight(0xFFF6EC, 0xB98A63, 0.72));",
  "var key = new THREE.DirectionalLight(0xffffff, 1.05); key.position.set(1.6, 2.4, 2.0); scene.add(key);",
  "var fill = new THREE.DirectionalLight(0xFFE7C8, 0.4); fill.position.set(-2.4, 0.2, 1.0); scene.add(fill);",
  "var rim = new THREE.DirectionalLight(0xFFD9B0, 0.55); rim.position.set(-0.6, 1.0, -2.6); scene.add(rim);",
  "scene.add(new THREE.AmbientLight(0xffffff, 0.20));",

  "var controls = new THREE.OrbitControls(camera, canvas);",
  "controls.enablePan = false;",
  "controls.enableDamping = true;",
  "controls.dampingFactor = 0.09;",
  "controls.rotateSpeed = 0.9;",
  "controls.minDistance = 2.8;",
  "controls.maxDistance = 5.6;",
  "controls.autoRotate = true;",
  "controls.autoRotateSpeed = 0.7;",
  "controls.target.set(0, -0.05, 0);",

  "var reduceMotion = false;",
  "var idleTimer;",
  "function pauseSpin(){ controls.autoRotate = false; clearTimeout(idleTimer); idleTimer = setTimeout(function(){ controls.autoRotate = !reduceMotion; }, 3500); }",
  "controls.addEventListener('start', pauseSpin);",

  // ---- resize ----
  "function resize(){",
  "  var w = canvas.clientWidth||1, h = canvas.clientHeight||1;",
  "  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));",
  "  renderer.setSize(w, h, false);",
  "  camera.aspect = w/h; camera.updateProjectionMatrix();",
  "}",
  "if(window.ResizeObserver){ new ResizeObserver(resize).observe(canvas); }",
  "window.addEventListener('resize', resize);",
  "resize();",

  // ---- dynamic reflection-point pins ----
  "var REGIONS = [];",
  "var pinEls = [];",
  "var selectedId = null;",
  "function post(msg){ try{ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } }catch(e){} }",
  "function rebuildPins(){",
  "  pinsEl.innerHTML='';",
  "  pinEls = REGIONS.map(function(r){",
  "    var el = document.createElement('div');",
  "    el.className = 'pin' + (r.isStrongest ? ' strong' : '') + (r.id===selectedId ? ' sel' : '');",
  "    el.textContent = r.rank;",
  "    el.addEventListener('click', function(ev){ ev.stopPropagation(); selectPin(r); });",
  "    pinsEl.appendChild(el);",
  "    var a = COORDS[r.id] || [0,0,1];",
  "    var base = new THREE.Vector3(a[0],a[1],a[2]).normalize().multiplyScalar(1.03);",
  "    base.x*=0.82; base.y*=0.80; base.z*=1.20; base.multiplyScalar(1.05);",
  "    return { el:el, base:base, region:r };",
  "  });",
  "}",
  "function applySelected(){",
  "  pinEls.forEach(function(p){ p.el.classList.toggle('sel', p.region.id===selectedId); });",
  "}",
  "function selectPin(r){",
  "  selectedId = r.id;",
  "  pinEls.forEach(function(p){ p.el.classList.toggle('active', p.region.id===r.id); });",
  "  applySelected();",
  "  tip.textContent = r.subtitle + '  \\u00b7  ' + Math.round(r.signalScore*100) + '%';",
  "  tip.classList.add('show');",
  "  pauseSpin();",
  "  clearTimeout(tip._t); tip._t = setTimeout(function(){ tip.classList.remove('show'); pinEls.forEach(function(p){ p.el.classList.remove('active'); }); }, 3400);",
  "  post({ type:'pinTap', regionId:r.id });",
  "}",

  // ---- project pins each frame; ride the near hemisphere; hide when back-facing ----
  "var _w=new THREE.Vector3(), _bc=new THREE.Vector3(), _camL=new THREE.Vector3();",
  "function updatePins(){",
  "  if(!pinEls.length) return;",
  "  brain.updateWorldMatrix(true,false);",
  "  _bc.setFromMatrixPosition(brain.matrixWorld);",
  "  _camL.copy(camera.position); brain.worldToLocal(_camL);",
  "  var sx = _camL.x>=0?1:-1;",
  "  var W=canvas.clientWidth, H=canvas.clientHeight;",
  "  for(var i=0;i<pinEls.length;i++){",
  "    var p=pinEls[i];",
  "    _w.copy(p.base); _w.x=Math.abs(_w.x)*sx; _w.applyMatrix4(brain.matrixWorld);",
  "    var nx=_w.x-_bc.x, ny=_w.y-_bc.y, nz=_w.z-_bc.z, nl=Math.hypot(nx,ny,nz)||1;",
  "    var cx=camera.position.x-_w.x, cy=camera.position.y-_w.y, cz=camera.position.z-_w.z, cl=Math.hypot(cx,cy,cz)||1;",
  "    var facing=(nx*cx+ny*cy+nz*cz)/(nl*cl);",
  "    var proj=_w.clone().project(camera);",
  "    if(facing>0.14 && proj.z<1){",
  "      p.el.style.display='flex';",
  "      p.el.style.left=((proj.x*0.5+0.5)*W)+'px';",
  "      p.el.style.top=((-proj.y*0.5+0.5)*H)+'px';",
  "      p.el.style.opacity=String(clamp((facing-0.14)/0.22,0.2,1));",
  "    } else { p.el.style.display='none'; }",
  "  }",
  "}",

  "function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); updatePins(); }",
  "animate();",

  // ---- bridge from React Native ----
  "function setVar(name,val){ if(val){ document.documentElement.style.setProperty(name, val); } }",
  "window.__setMindMap = function(payload){",
  "  try {",
  "    if(payload && payload.theme){",
  "      var th=payload.theme;",
  "      setVar('--bg-center', th.bgCenter); setVar('--bg-edge', th.bgEdge);",
  "      setVar('--pin-bg', th.pinBg); setVar('--pin-text', th.pinText); setVar('--strong', th.strong);",
  "      setVar('--tip-bg', th.tipBg); setVar('--tip-text', th.tipText); setVar('--legend-text', th.legendText);",
  "    }",
  "    reduceMotion = !!(payload && payload.reduceMotion);",
  "    controls.autoRotate = !reduceMotion;",
  "    if(payload && typeof payload.selectedId !== 'undefined'){ selectedId = payload.selectedId; }",
  "    if(payload && payload.regions){",
  "      REGIONS = payload.regions.map(function(r,idx){",
  "        return { id:r.id, label:r.label, subtitle:r.subtitle, signalScore:(typeof r.signalScore==='number'?r.signalScore:0), rank:(r.rank||idx+1), isStrongest:!!r.isStrongest };",
  "      });",
  "      rebuildPins();",
  "    } else { applySelected(); }",
  "    hideLoader();",
  "  } catch(e){ post({ type:'error', message:String(e) }); }",
  "};",
  "window.__recenter = function(){",
  "  camera.position.copy(START); controls.target.set(0,-0.05,0); controls.autoRotate = !reduceMotion; controls.update();",
  "};",
  // First frame has rendered the brain: signal RN (which then injects data) and
  // fade the loader; the timeout is a fallback in case no data ever arrives.
  "requestAnimationFrame(function(){ requestAnimationFrame(function(){ hideLoader(); post({ type:'ready' }); }); });",
  "setTimeout(hideLoader, 4000);",
  "}",
  // Defer boot past two frames so the loader overlay is painted first.
  "requestAnimationFrame(function(){ requestAnimationFrame(function(){ try { boot(); } catch(e){ hideLoader(); } }); });",
  "})();",
].join('\n');
