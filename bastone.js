/* Bastone con ventagli per laserBrio: 2 fogli da 400 × 400 mm (stecche dei due ventagli, basi e piani delle placche a rombo) */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const SZ=400;                      /* i due fogli sono disegnati per un piano 400 × 400 mm */
const R=7;                         /* mezzo spessore delle stecche (14 mm) */

/* ---------- forme (coordinate come nel disegno: y verso il basso) ---------- */
function arc(cx,cy,r,a0,a1,n){const o=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return o;}
function circle(cx,cy,r){const n=r<2?12:24,o=[];for(let i=0;i<n;i++){const a=2*Math.PI*i/n;o.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return o;}
/* stecca: lunga L, larga 14, estremità tonde; il dentino della guardia sta in alto (tooth=-1) o in basso (tooth=1), a 13 mm dall'estremità destra */
function stecca(L,tooth){
  const h=L/2-R,pts=[];
  pts.push([-h,-R]);
  if(tooth===-1){pts.push([h-13,-R],[h-13,-R-4],[h-1,-R-4],[h-1,-R]);}
  pts.push([h,-R]);
  arc(h,0,R,-Math.PI/2,Math.PI/2,10).forEach(q=>pts.push(q));
  if(tooth===1){pts.push([h-1,R],[h-1,R+4],[h-13,R+4],[h-13,R]);}
  pts.push([-h,R]);
  arc(-h,0,R,Math.PI/2,Math.PI*3/2,10).forEach(q=>pts.push(q));
  return pts;}
function steccaHoles(L,tooth){
  const h=[circle(-L/2+10,0,2.1)];   /* perno M4 vicino all'estremità sinistra */
  if(tooth)h.push(circle(-L/2+35,0,0.6));  /* foro per la gamba della molla */
  return h;}
const place=(pts,cx,cy,rotDeg)=>{const a=(rotDeg||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return pts.map(q=>[cx+q[0]*c-q[1]*s,cy+q[0]*s+q[1]*c]);};
const rectPts=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];

/* ---------- pezzi di ciascun foglio ---------- */
function grandi(){
  const out=[],cs=[[183.03,183.03,-1],[194.34,194.34,0],[205.66,205.66,0],[216.97,216.97,1]];
  cs.forEach(c=>{
    const body=place(stecca(450,c[2]),c[0],c[1],-45);
    const holes=steccaHoles(450,c[2]!==0).map(h=>place(h,c[0],c[1],-45));
    out.push({name:c[2]===0?'Stecca grande':'Guardia grande',tag:'stecca',pts:body,holes:holes});});
  return out;}
function piccole(){
  const out=[],ys=[301,317,333,349,365,381],tooth=[-1,0,0,0,0,1];
  ys.forEach((y,i)=>{const t=tooth[i];
    out.push({name:t?'Guardia piccola':'Stecca piccola',tag:'stecca',pts:place(stecca(220,t),280,y,0),holes:steccaHoles(220,t!==0).map(h=>place(h,280,y,0))});});
  return out;}
function placca(x,y,s,name){
  const c=s/2,o=16;
  return {name:name,tag:'placca',pts:rectPts(x,y,s,s),holes:[circle(x+c,y+c,2.1),circle(x+o,y+o,1.25),circle(x+s-o,y+s-o,1.25)]};}
const SHEETS=[
  {title:'Foglio 1',build:()=>grandi().concat(piccole(),[placca(10,10,100,'Base placca'),placca(120,10,100,'Base placca')])},
  {title:'Foglio 2',build:()=>grandi().concat([placca(10,10,80,'Piano placca'),placca(100,10,80,'Piano placca')])}
];

function toSheet(pieces){
  const items=[],holes=[],outers=[];let mx=0,my=0;
  pieces.forEach(pc=>{
    const T=q=>[q[0],SZ-q[1]];                          /* dal disegno (y in basso) alla macchina (y in alto) */
    const outer=pc.pts.map(T),hs=pc.holes.map(h=>h.map(T));
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    outer.forEach(q=>{x0=Math.min(x0,q[0]);y0=Math.min(y0,q[1]);x1=Math.max(x1,q[0]);y1=Math.max(y1,q[1]);});
    const paths=[{pts:outer}].concat(hs.map(h=>({hole:true,pts:h})));
    items.push({name:pc.name,tag:pc.tag,x:x0,y:y0,w:x1-x0,h:y1-y0,paths:paths});
    hs.forEach(h=>holes.push(h));outers.push(outer);
    mx=Math.max(mx,x1);my=Math.max(my,y1);});
  return {items:items,cutPaths:holes.concat(outers),w:mx+10,h:my+10};}

function plan(AREA){
  if(AREA.w<SZ-0.5||AREA.h<SZ-0.5)
    return {error:'I fogli del bastone sono disegnati per un piano di 400 × 400 mm; l\'area di lavoro impostata è '+Math.round(AREA.w)+' × '+Math.round(AREA.h)+' mm.'};
  const sheets=SHEETS.map(s=>toSheet(s.build()));
  const parts=[{name:'Stecche grandi (con guardie)',tag:'stecca',count:8},{name:'Stecche piccole (con guardie)',tag:'stecca',count:6},{name:'Basi delle placche 100 × 100',tag:'placca',count:2},{name:'Piani delle placche 80 × 80',tag:'placca',count:2}];
  const hardware=[
    'Compensato con strati incrociati: stecche da 2 mm, placche da 3 mm',
    '2 viti M4 con dado autobloccante (lunghezza = spessore asta + 5 mm), 4 viti M2,5 × 10 mm, rondelle in nylon M4',
    '2 molle a torsione (filo 0,8 mm, foro 4 mm, gambe 25 mm, 180°)',
    '1 listello di compensato 3 × 12 × 1000 mm con 2 ganci a L (da tagliare a parte) e cordino con anello',
    'Asta da 165 cm, interno 30 × 16 mm (da tagliare a parte)',
    'Colla vinilica, tela o carta leggera, olio o vernice'
  ];
  const steps=[
    'Taglia prima su cartone e controlla che il piano sia libero su tutti i 400 mm (margine delle stecche grandi: circa 19 mm dal bordo). Foglio 1 e foglio 2 si tagliano uno alla volta, con l\'origine nell\'angolo in basso a sinistra.',
    'Carteggia i bordi (grana 240) e dai olio o vernice: le stecche devono scorrere senza attrito.',
    'Asta: su entrambi i lati stretti apri una feritoia 16 × 40 mm, la prima a 41 cm dalla cima, la seconda a 134 cm. Lascia 3 mm liberi contro la parete posteriore.',
    'Fai passare una vite M4 attraverso l\'asta al centro di ogni feritoia: è il perno del ventaglio.',
    'Ventaglio grande: sul perno alto infila 4 stecche grandi per lato, alternando destra e sinistra, con una rondella in nylon tra una e l\'altra. Le 2 stecche con dentino sono le guardie.',
    'Ventaglio piccolo: stesso procedimento con 3 + 3 stecche piccole sul perno basso (guardie con dentino).',
    'Molla: infila una molla a torsione su ogni perno tra le due guardie. Le gambe vanno nei fori da 1,2 mm vicino al perno. Chiudi i dadi senza stringere a fondo.',
    'Tela: 3 spicchi per lato nel ventaglio grande, 2 per lato nel piccolo. Incolla solo sul terzo esterno di ogni stecca, con piega a fisarmonica.',
    'Chiavistello: a ventaglio chiuso le stecche stanno nell\'asta verso il basso. Il listello scorre dentro l\'asta contro la parete posteriore; i due ganci a L, alle quote dei dentini (circa 84 cm e 154 cm dalla cima), bloccano le guardie. Cordino con anello all\'estremità bassa.',
    'Apertura: tira l\'anello. Il listello scorre di circa 12 mm, libera entrambi i dentini insieme e le molle aprono i ventagli.',
    'Chiusura: richiudi i ventagli a mano (le molle si caricano) e spingi indietro il listello per riagganciare.',
    'Placche: incolla il piano 80 × 80 sulla base 100 × 100, centrando i fori; ruotala a rombo con le viti a sinistra e a destra, copri la testa del perno e fissa con 2 viti M2,5. Il medaglione da 50 mm resta vuoto per ora.',
    'Molle e ganci vanno verificati su un prototipo in cartone: se un ventaglio non si apre del tutto, la molla è debole o la tela è troppo rigida; se si impunta, carteggia il bordo o allarga la feritoia di 1 mm. Le quote dei perni e della molla sono stime.'
  ];
  return {parts:parts,sheets:sheets,hardware:hardware,steps:steps};
}

/* ---------- anteprima 3D (si carica solo quando serve) ---------- */
const HA=1650,SLOT=40;                           /* asta da 165 cm, feritoie 16 × 40 mm */
const YP=[HA-410,HA-1340];                       /* perni a 41 cm e a 134 cm dalla cima */
let V3=null,s3Loading=null,s3={open:1,explode:0};
const CDN3=['https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js','https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
function s3Script(src){return new Promise(function(ok,ko){const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=function(){ko(new Error(src));};document.head.appendChild(e);});}
function s3Ensure(){
  if(window.THREE&&THREE.OrbitControls)return Promise.resolve();
  if(!s3Loading)s3Loading=s3Script(CDN3[0]).then(function(){return s3Script(CDN3[1]);}).catch(function(e){s3Loading=null;throw e;});
  return s3Loading;}
function s3Init(box){
  const r=new THREE.WebGLRenderer({antialias:true});
  r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));r.setClearColor(0xf3ebe0,1);
  r.domElement.style.cssText='width:100%;height:100%;display:block';
  box.innerHTML='';box.appendChild(r.domElement);
  const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(35,1,5,12000);
  sc.add(new THREE.AmbientLight(0xffffff,0.75));
  const d=new THREE.DirectionalLight(0xffffff,0.55);d.position.set(400,900,900);sc.add(d);
  const d2=new THREE.DirectionalLight(0xffffff,0.25);d2.position.set(-500,200,-400);sc.add(d2);
  const ctl=new THREE.OrbitControls(cam,r.domElement);ctl.enableDamping=true;ctl.dampingFactor=0.12;
  V3={box:box,renderer:r,scene:sc,camera:cam,controls:ctl,root:new THREE.Group(),dirty:true,raf:0,fitted:false};
  sc.add(V3.root);
  const size=function(){const w=Math.max(200,box.clientWidth),h=Math.max(260,box.clientHeight||460);r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();V3.dirty=true;};
  if(window.ResizeObserver){V3.ro=new ResizeObserver(size);V3.ro.observe(box);}else window.addEventListener('resize',size);
  size();
  const frame=function(){if(!V3)return;V3.raf=requestAnimationFrame(frame);if(V3.controls.update()||V3.dirty){V3.dirty=false;r.render(sc,cam);}};
  frame();}
function s3Fit(){
  const asp=V3.camera.aspect||1,ext={w:950,h:HA,d:60};
  V3.controls.target.set(0,ext.h/2,0);
  const span=Math.max(ext.h*1.08,ext.w/asp*1.1);
  const dist=span/(2*Math.tan(17.5*Math.PI/180));
  const v=new THREE.Vector3(0.28,0.12,1).normalize().multiplyScalar(dist);
  V3.camera.position.set(v.x,ext.h/2+v.y,v.z);V3.camera.far=dist*8;V3.camera.updateProjectionMatrix();
  V3.controls.update();V3.dirty=true;}
const deg=a=>a*Math.PI/180;
function s3Apply(){
  if(!V3)return;const e=s3.explode,f=s3.open;
  V3.root.children.forEach(function(m){
    const u=m.userData,b=u.base,n=u.dir;
    m.position.set(b[0]+n[0]*e,b[1]+n[1]*e,b[2]+n[2]*e);
    if(u.fan){const th=-90+f*(u.thOpen+90);m.rotation.z=deg(u.wing===0?th:180-th);}});
  V3.dirty=true;}
function s3Build(){
  while(V3.root.children.length)V3.root.remove(V3.root.children[0]);
  const wood=function(c,op){return new THREE.MeshLambertMaterial({color:c,side:THREE.DoubleSide,transparent:op<1,opacity:op});};
  const metal=wood(0x8f959b,1),line=function(c){return new THREE.LineBasicMaterial({color:c||0x4a2f17});};
  const reg=function(geo,mat,base,dir,edge,extra){
    const m=new THREE.Mesh(geo,mat);m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo,35),line(edge)));
    m.userData=Object.assign({base:base,dir:dir},extra||{});V3.root.add(m);return m;};
  const box=function(sz,c,col,dir,op,rz){const m=reg(new THREE.BoxGeometry(sz[0],sz[1],sz[2]),wood(col,op===undefined?1:op),c,dir);if(rz)m.rotation.z=rz;return m;};
  const cyl=function(r,len,c,col,dir){const g=new THREE.CylinderGeometry(r,r,len,16);g.rotateX(Math.PI/2);return reg(g,metal,c,dir,0x333333);};
  /* asta: pareti da 3 mm, interno 30 × 16; sui lati stretti le feritoie dei due ventagli */
  box([36,HA,3],[0,HA/2,-9.5],0xcfa468,[0,0,-90],1);
  box([36,HA,3],[0,HA/2,9.5],0xdcb67a,[0,0,90],0.28);
  const cuts=[0].concat(YP.slice().reverse().reduce(function(a,y){return a.concat([y-SLOT/2,y+SLOT/2]);},[]),[HA]);
  [-1,1].forEach(function(sx){
    for(let i=0;i<cuts.length;i+=2){const y0=cuts[i],y1=cuts[i+1];if(y1-y0<1)continue;
      box([3,y1-y0,16],[sx*16.5,(y0+y1)/2,0],0xcfa468,[sx*120,0,0],1);}});
  /* ventagli: stecche da 2 mm che ruotano sul perno; chiuse puntano verso il basso, dentro l'asta */
  const geoCache={};
  const steccaGeo=function(L,tooth){
    const key=L+'|'+tooth;if(geoCache[key])return geoCache[key];
    const sh0=L/2-10,pts=stecca(L,tooth).map(function(q){return new THREE.Vector2(q[0]+sh0,-q[1]);});
    const shp=new THREE.Shape(pts);
    steccaHoles(L,tooth!==0).forEach(function(h){shp.holes.push(new THREE.Path(h.map(function(q){return new THREE.Vector2(q[0]+sh0,-q[1]);})));});
    const g=new THREE.ExtrudeGeometry(shp,{depth:2,bevelEnabled:false,curveSegments:1,steps:1});g.translate(0,0,-1);
    return (geoCache[key]=g);};
  [{y:YP[0],L:450,n:4},{y:YP[1],L:220,n:3}].forEach(function(F){
    const tot=2*F.n;
    for(let j=0;j<tot;j++){
      const wing=j%2,k=(j-wing)/2,tooth=j===0?-1:(j===tot-1?1:0),z=(j-(tot-1)/2)*2;
      const col=tooth?0xb98648:(wing?0xe8cc9c:0xe0c08f);
      const m=reg(steccaGeo(F.L,tooth),wood(col,1),[0,F.y,z],[0,0,z*14],0x4a2f17,{fan:true,wing:wing,thOpen:-80+k*(100/(F.n-1))});
      m.rotation.z=deg(-90);}
    cyl(2,26,[0,F.y,0],0,[0,0,60]);
    cyl(4.5,3,[0,F.y,-11],0,[0,0,-30]);});
  /* placche a rombo: base 100 × 100 e piano 80 × 80 sul davanti, sopra il perno */
  YP.forEach(function(y){
    box([100,100,3],[0,y,12.5],0xd8b684,[0,0,130],1,Math.PI/4);
    box([80,80,3],[0,y,15.5],0xe3c392,[0,0,200],1,Math.PI/4);});
  /* listello del chiavistello (dietro, a destra) con i due ganci a L */
  const ys=HA-640-500;
  box([12,1000,3],[9,ys,-6.5],0x9a7448,[0,0,-130],1);
  [HA-840,HA-1540].forEach(function(y){box([6,8,6],[10,y,-3.5],0x6b4a24,[0,0,-130],1);});
  s3Apply();}
function s3Update(){
  const bx=document.getElementById('bs3dBox'),box=document.getElementById('bs3d');
  if(!bx||!bx.open||!box)return;
  s3Ensure().then(function(){
    if(!V3||V3.box!==box){if(V3){cancelAnimationFrame(V3.raf);try{V3.renderer.dispose();}catch(e){}}s3Init(box);}
    s3Build();
    if(!V3.fitted){s3Fit();V3.fitted=true;}
  }).catch(function(){box.innerHTML='<p class="hint" style="padding:14px">Non riesco a caricare la vista 3D: serve internet la prima volta.</p>';V3=null;});}

function init(){
  const box=$('staffBox');if(!box||box.dataset.ready)return;box.dataset.ready='1';
  box.innerHTML=
    '<p style="margin:0 0 10px"><b>Bastone con ventagli</b> (costume di Aang): un\'asta con due ventagli pieghevoli, uno grande e uno piccolo, che stanno interamente dentro l\'asta quando è chiusa e si aprono con un solo gesto.</p>'+
    '<p class="hint">Servono <b>2 fogli</b> da 400 × 400 mm: stecche dei due ventagli, basi e piani delle due placche a rombo. L\'asta, le feritoie e il listello del chiavistello si tagliano a parte. I medaglioni sulle placche restano vuoti per ora. Prova prima su cartone.</p>'+
    '<details id="bs3dBox" open style="margin:10px 0"><summary>Anteprima 3D del bastone</summary>'+
    '<div id="bs3d" style="height:460px;border-radius:12px;overflow:hidden;background:#f3ebe0;border:1px solid #ddd3c3;margin-top:8px"></div>'+
    '<div class="row" style="margin-top:10px"><label class="chk" style="flex:1;min-width:180px">Ventagli: chiusi ↔ aperti <input type="range" id="bs3Open" min="0" max="100" value="100"></label>'+
    '<label class="chk" style="flex:1;min-width:180px">Vista esplosa <input type="range" id="bs3Exp" min="0" max="100" value="0"></label>'+
    '<button class="btn" id="bs3Reset">Rimetti la vista</button></div>'+
    '<p class="hint">Trascina per ruotare, rotellina o due dita per ingrandire. L\'asta è un po\' trasparente davanti, così a ventagli chiusi vedi le stecche dentro. Con "Vista esplosa" si staccano le pareti, i perni, le placche e il listello. Misure e posizioni sono quelle del progetto, non un disegno di dettaglio.</p></details>';
  $('bs3Open').oninput=function(){s3.open=Number($('bs3Open').value)/100;s3Apply();};
  $('bs3Exp').oninput=function(){s3.explode=Number($('bs3Exp').value)/100;s3Apply();};
  $('bs3Reset').onclick=function(){if(V3)s3Fit();};
  $('bs3dBox').addEventListener('toggle',s3Update);
  s3Update();
}
window.Bastone={init:init,plan:plan};
})();
