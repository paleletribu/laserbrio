/* Bastone con ventagli: fogli, elenco pezzi, materiali e istruzioni. La geometria sta in bastone-geo.js, il 3D in bastone-3d.js, le istruzioni illustrate in bastone-guida.js */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const SZ=400,CELL=2.5,GAP=1,MARG=3;
const G=()=>window.BastoneGeo;

/* ---------- disposizione dei pezzi sui fogli (griglia di occupazione) ---------- */
function rot(pts,a){const c=Math.cos(a),s=Math.sin(a);return pts.map(q=>[q[0]*c-q[1]*s,q[0]*s+q[1]*c]);}
function bbox(pts){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;pts.forEach(q=>{x0=Math.min(x0,q[0]);y0=Math.min(y0,q[1]);x1=Math.max(x1,q[0]);y1=Math.max(y1,q[1]);});return {x0:x0,y0:y0,x1:x1,y1:y1};}
function raster(pts){   /* celle toccate dal poligono, relative all'angolo in alto a sinistra del suo riquadro */
  const b=bbox(pts),nx=Math.ceil((b.x1-b.x0)/CELL)+1,ny=Math.ceil((b.y1-b.y0)/CELL)+1,cells=[],set=new Uint8Array(nx*ny);
  const mark=(x,y)=>{const i=Math.floor((x-b.x0)/CELL),j=Math.floor((y-b.y0)/CELL);if(i>=0&&j>=0&&i<nx&&j<ny&&!set[j*nx+i]){set[j*nx+i]=1;cells.push([i,j]);}};
  for(let j=0;j<ny;j++){const y=b.y0+(j+0.5)*CELL,xs=[];
    for(let k=0;k<pts.length;k++){const p=pts[k],q=pts[(k+1)%pts.length];if((p[1]<=y)!==(q[1]<=y))xs.push(p[0]+(y-p[1])/(q[1]-p[1])*(q[0]-p[0]));}
    xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2)for(let x=xs[k];x<=xs[k+1]+1e-9;x+=CELL/2)mark(x,y);}
  for(let k=0;k<pts.length;k++){const p=pts[k],q=pts[(k+1)%pts.length],n=Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/(CELL/2))+1;for(let t=0;t<=n;t++)mark(p[0]+(q[0]-p[0])*t/n,p[1]+(q[1]-p[1])*t/n);}
  return {cells:cells,nx:nx,ny:ny,b:b};}
function newSheet(){const n=Math.floor((SZ-2*MARG)/CELL);return {n:n,occ:new Uint8Array(n*n),placed:[]};}
function tryPlace(sh,r){
  const n=sh.n;
  for(let j0=0;j0+r.ny<=n;j0++)for(let i0=0;i0+r.nx<=n;i0++){
    let ok=true;for(let k=0;k<r.cells.length;k++){const c=r.cells[k];if(sh.occ[(j0+c[1])*n+i0+c[0]]){ok=false;break;}}
    if(!ok)continue;
    r.cells.forEach(c=>{for(let dj=-GAP;dj<=GAP;dj++)for(let di=-GAP;di<=GAP;di++){const i=i0+c[0]+di,j=j0+c[1]+dj;if(i>=0&&j>=0&&i<n&&j<n)sh.occ[j*n+i]=1;}});
    return {dx:MARG+i0*CELL,dy:MARG+j0*CELL};}
  return null;}
function pack(pieces){
  const sheets=[],list=pieces.slice();
  list.forEach(p=>{const b=bbox(p.pts);p._a=(b.x1-b.x0)*(b.y1-b.y0);p._L=Math.max(b.x1-b.x0,b.y1-b.y0);});
  list.sort((a,b)=>b._L-a._L||b._a-a._a);
  const ang=[0,Math.PI/2,-Math.PI/4,Math.PI/4];
  list.forEach(p=>{
    const rs=ang.map(a=>{const pts=rot(p.pts,a),b=bbox(pts);return {a:a,pts:pts,b:b,r:raster(pts)};}).filter(o=>o.b.x1-o.b.x0<=SZ-2*MARG&&o.b.y1-o.b.y0<=SZ-2*MARG);
    rs.sort((u,v)=>(u.a===0||u.a===Math.PI/2?0:1)-(v.a===0||v.a===Math.PI/2?0:1));
    for(let s=0;s<=sheets.length;s++){
      if(s===sheets.length)sheets.push(newSheet());
      let done=false;
      for(const o of rs){const pos=tryPlace(sheets[s],o.r);if(pos){sheets[s].placed.push({p:p,o:o,x:pos.dx-o.b.x0+(o.r.b.x0-o.b.x0),y:pos.dy-o.b.y0});done=true;break;}}
      if(done)break;
      if(s===sheets.length-1&&sheets[s].placed.length===0)throw new Error('Pezzo troppo grande: '+p.name);}
  });
  return sheets;}
function toSheet(sh,note){
  const items=[],holes=[],outers=[];let mx=0,my=0;
  sh.placed.forEach(pl=>{
    const a=pl.o.a,P=q=>rot([q],a)[0],M=q=>{const r=P(q);return [r[0]+pl.x,SZ-(r[1]+pl.y)];};
    const outer=pl.p.pts.map(M),hs=pl.p.holes.map(h=>h.map(M));
    const b=bbox(outer);
    items.push({name:pl.p.name,tag:pl.p.tag,x:b.x0,y:b.y0,w:b.x1-b.x0,h:b.y1-b.y0,paths:[{pts:outer}].concat(hs.map(h=>({hole:true,pts:h})))});
    hs.forEach(h=>holes.push(h));outers.push(outer);mx=Math.max(mx,b.x1);my=Math.max(my,b.y1);});
  return {items:items,cutPaths:holes.concat(outers),w:mx+10,h:my+10,note:note};}

/* ---------- elenco pezzi ---------- */
const TAGN={dietro:'Piastre posteriori',fronte:'Piastre anteriori',guida:'Guide laterali del listello',strato:'Strati che reggono le stecche',listello:'Pezzi del listello (con puntale)',puntale:'Strati del puntale',placca:'Placche a rombo',guardia:'Guardie (prima stecca)',stecca:'Stecche',tappo:'Tappi laterali'};
function parts(P){
  const m={};P.forEach(p=>{const k=p.tag+'|'+p.th;(m[k]=m[k]||{name:TAGN[p.tag]+' ('+p.th+' mm)',tag:p.tag,count:0}).count++;});
  return Object.keys(m).map(k=>m[k]);}

let cache=null;
function build(){
  if(cache)return cache;
  const r=G().allPieces(),P=r.pieces;
  const out=[];
  [3,2].forEach(th=>{const grp=P.filter(p=>p.th===th);if(!grp.length)return;
    pack(grp).forEach((s,i,a)=>out.push(toSheet(s,'compensato da '+th+' mm, foglio '+(i+1)+' di '+a.length+' di questo spessore')));});
  cache={sheets:out,parts:parts(P),pieces:P,cam:r.cam};return cache;}

const HARDWARE=[
  'Compensato di pioppo o betulla: circa 5 fogli da 3 mm e 1 foglio da 2 mm, ciascuno di almeno 400 × 400 mm (vedi anche "Pezzi")',
  '4 viti M3 × 20 mm con dado autobloccante e 8 rondelle M3: sono i perni dei ventagli (2 per ventaglio, uno per lato)',
  '14 spinotti da 2 mm lunghi 8–10 mm (filo d\'acciaio, chiodi senza testa o stecchini di bambù): 4 sulle guardie e 10 fra le stecche',
  '1 cordino con anello da fissare al puntale (facoltativo)',
  'Colla vinilica, morsetti o mollette, carta vetrata grana 240, olio o vernice',
  'Tela o carta leggera per i ventagli'
];

function plan(AREA){
  if(!G())return {error:'Sto caricando…'};
  if(AREA.w<SZ-0.5||AREA.h<SZ-0.5)
    return {error:'I fogli del bastone sono disegnati per un piano di 400 × 400 mm; l\'area di lavoro impostata è '+Math.round(AREA.w)+' × '+Math.round(AREA.h)+' mm.'};
  const b=build();
  return {parts:b.parts,sheets:b.sheets,hardware:HARDWARE,steps:window.BastoneGuida?BastoneGuida.testi(b):['Sto caricando le istruzioni…']};}

/* ---------- pagina del progetto ---------- */
function loadJs(src){return new Promise((ok,ko)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=()=>ko(new Error(src));document.head.appendChild(e);});}
function init(){
  const box=$('staffBox');if(!box||box.dataset.ready)return;box.dataset.ready='1';
  box.innerHTML=
    '<p style="margin:0 0 10px"><b>Bastone con ventagli</b> (costume di Aang): un\'asta da 165 cm fatta a strati di compensato, con due ventagli (3 stecche per lato in alto, 2 per lato in basso) che stanno nascosti nell\'asta. Un solo gesto sul puntale in fondo li apre e li blocca insieme; riportando il puntale a filo si chiudono e si bloccano.</p>'+
    '<p class="hint">I pezzi dell\'asta si incastrano a coda di rondine, così puoi comporla della lunghezza che vuoi. Qui sotto trovi i fogli da tagliare, l\'anteprima 3D e le istruzioni con le figure (si stampano da qui). Prima di tagliare tutto, prova su cartone.</p>'+
    '<div class="row" style="margin:10px 0"><button class="btn" id="bsPrint">Stampa le istruzioni</button></div>'+
    '<details id="bs3dBox" open style="margin:10px 0"><summary>Anteprima 3D del bastone</summary>'+
    '<div id="bs3d" style="height:460px;border-radius:12px;overflow:hidden;background:#f3ebe0;border:1px solid #ddd3c3;margin-top:8px"></div>'+
    '<div class="row" style="margin-top:10px"><label class="chk" style="flex:1;min-width:180px">Ventagli: chiusi ↔ aperti <input type="range" id="bs3Open" min="0" max="100" value="100"></label>'+
    '<label class="chk" style="flex:1;min-width:180px">Vista esplosa <input type="range" id="bs3Exp" min="0" max="100" value="0"></label>'+
    '<button class="btn" id="bs3Reset">Rimetti la vista</button></div></details>'+
    '<div id="bsGuida"></div>';
  loadJs('bastone-guida.js').then(()=>{BastoneGuida.monta($('bsGuida'),build());if(window.setProj&&document.body.dataset.proj==='staff')setProj('staff');$('bsPrint').onclick=()=>BastoneGuida.stampa(build());}).catch(()=>{$('bsGuida').textContent='Non riesco a caricare le istruzioni.';});
  const upd=()=>{const d=$('bs3dBox');if(!d.open||window.__bs3)return;window.__bs3=1;loadJs('bastone-3d.js').then(()=>Bastone3D.start($('bs3d'),$('bs3Open'),$('bs3Exp'),$('bs3Reset'),build())).catch(()=>{window.__bs3=0;$('bs3d').textContent='Non riesco a caricare l\'anteprima 3D.';});};
  $('bs3dBox').addEventListener('toggle',upd);upd();
}
window.Bastone={init:init,plan:plan,build:build};
})();
