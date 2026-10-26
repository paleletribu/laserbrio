/* Scarpiera modulare per laserBrio: moduli a cubo (1X, 2X, 3X) che si incastrano con chiavi, da tagliare un modulo alla volta */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const KEY='lb_scarp';
const IDS=['sY','sX','sD','sT','sTol','sFg','sKl'];
const DEF={sY:120,sX:110,sD:300,sT:3,sTol:0.1,sFg:20,sKl:30};
let st={cols:4,rows:3,mods:[],sel:1,tool:'state',vals:Object.assign({},DEF),back:true,mode:'todo',xk:4};
let ready=false;

/* ---------- geometria (coordinate del pezzo: x a destra, y in basso, origine in alto a sinistra) ---------- */
function fingerN(D,fg){let n=Math.round(D/fg);if(n%2===0)n+=1;return Math.max(3,n);}
function rect(cx,cy,w,h){return [[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]];}
function norm(pts,holes){let mx=1e9,my=1e9,Mx=-1e9,My=-1e9;
  pts.forEach(q=>{mx=Math.min(mx,q[0]);my=Math.min(my,q[1]);Mx=Math.max(Mx,q[0]);My=Math.max(My,q[1]);});
  const s=q=>[q[0]-mx,q[1]-my];
  return {pts:pts.map(s),holes:holes.map(h=>h.map(s)),w:Mx-mx,h:My-my};}
function depthCenters(p){return [0.25*p.D,0.7*p.D];}
/* le due chiavi di ogni giunzione sono sfalsate anche in altezza/larghezza: i moduli non possono ruotare tra loro */
function offs(p){return Math.min(0.18*p.X,0.18*p.Y,18);}
function sidePts(D,H,t,N){const f=D/N,pts=[];
  for(let i=0;i<N;i++){const y=(i%2===0)?t:0;pts.push([i*f,y],[(i+1)*f,y]);}
  for(let i=N-1;i>=0;i--){const y=(i%2===0)?H-t:H;pts.push([(i+1)*f,y],[i*f,y]);}
  return pts;}
function tbPts(W,D,t,N){const f=D/N,pts=[];
  for(let i=0;i<N;i++){const x=(i%2===1)?t:0;pts.push([x,i*f],[x,(i+1)*f]);}
  for(let i=N-1;i>=0;i--){const x=(i%2===1)?W-t:W;pts.push([x,(i+1)*f],[x,i*f]);}
  return pts;}
function tabbed(w,h,t,cx,cy,tlw,tlh){
  const pts=[[0,0]];
  cx.forEach(c=>pts.push([c-tlw/2,0],[c-tlw/2,-t],[c+tlw/2,-t],[c+tlw/2,0]));
  pts.push([w,0]);
  cy.forEach(c=>pts.push([w,c-tlh/2],[w+t,c-tlh/2],[w+t,c+tlh/2],[w,c+tlh/2]));
  pts.push([w,h]);
  cx.slice().reverse().forEach(c=>pts.push([c+tlw/2,h],[c+tlw/2,h+t],[c-tlw/2,h+t],[c-tlw/2,h]));
  pts.push([0,h]);
  cy.slice().reverse().forEach(c=>pts.push([0,c+tlh/2],[-t,c+tlh/2],[-t,c-tlh/2],[0,c-tlh/2]));
  return pts;}
function backCount(len){return Math.max(2,Math.round(len/60));}
function mkSide(p,n){
  const H=n*p.Ph,Hin=H-2*p.t,N=fingerN(p.D,p.fg),holes=[],o=offs(p),dc=depthCenters(p);
  for(let k=0;k<n;k++){
    holes.push(rect(dc[0],(k+.5)*p.Ph-o,p.kl+p.tol,p.t+p.tol));
    holes.push(rect(dc[1],(k+.5)*p.Ph+o,p.kl+p.tol,p.t+p.tol));}
  if(p.back){const nb=backCount(Hin),tl=Math.min(30,Hin/nb*.5);
    for(let i=0;i<nb;i++)holes.push(rect(p.D-1.5*p.t,p.t+(i+.5)*Hin/nb,p.t+p.tol,tl+p.tol));}
  const pc=norm(sidePts(p.D,H,p.t,N),holes);pc.name='Fianco '+n+'X';pc.tag='fianco';return pc;}
function mkTB(p){
  const W=p.Pw,N=fingerN(p.D,p.fg),holes=[],o=offs(p),dc=depthCenters(p);
  holes.push(rect(W/2-o,dc[0],p.t+p.tol,p.kl+p.tol));
  holes.push(rect(W/2+o,dc[1],p.t+p.tol,p.kl+p.tol));
  if(p.back){const nb=backCount(p.Y),tl=Math.min(30,p.Y/nb*.5);
    for(let i=0;i<nb;i++)holes.push(rect(p.t+(i+.5)*p.Y/nb,p.D-1.5*p.t,tl+p.tol,p.t+p.tol));}
  const pc=norm(tbPts(W,p.D,p.t,N),holes);pc.name='Sopra/Sotto';pc.tag='tb';return pc;}
function mkBack(p,n){
  const Hin=n*p.Ph-2*p.t,nw=backCount(p.Y),nh=backCount(Hin);
  const tlw=Math.min(30,p.Y/nw*.5),tlh=Math.min(30,Hin/nh*.5);
  const cx=[],cy=[];for(let i=0;i<nw;i++)cx.push((i+.5)*p.Y/nw);for(let i=0;i<nh;i++)cy.push((i+.5)*Hin/nh);
  const pc=norm(tabbed(p.Y,Hin,p.t,cx,cy,tlw,tlh),[]);pc.name='Schienale '+n+'X';pc.tag='schienale';return pc;}
function mkKey(p){const L=2*p.t,c=Math.min(.6,p.t/4),w=p.kl;
  const pc=norm([[c,0],[w-c,0],[w,c],[w,L-c],[w-c,L],[c,L],[0,L-c],[0,c]],[]);pc.name='Chiave';pc.tag='chiave';return pc;}

function params(){
  const v=st.vals,p={Y:+v.sY,X:+v.sX,D:+v.sD,t:+v.sT,tol:+v.sTol,fg:+v.sFg,kl:+v.sKl,back:!!st.back};
  p.Pw=p.Y+2*p.t;p.Ph=p.X+2*p.t;return p;}
function valid(p){return p.t>=1&&p.Y>=p.kl+4*p.t&&p.X>=p.t*3+10&&p.D>=100&&p.fg>=8&&p.kl>=12&&p.tol>=0;}

/* ---------- composizione ---------- */
function occ(){const g={};st.mods.forEach(m=>{for(let k=0;k<m.n;k++)g[m.c+','+(m.r+k)]=m;});return g;}
function stats(){
  const g=occ(),counts={1:0,2:0,3:0},todo={1:0,2:0,3:0};
  st.mods.forEach(m=>{counts[m.n]++;if(!m.done)todo[m.n]++;});
  let keys=0,todoKeys=0;
  for(const k in g){const a=k.split(',').map(Number),c=a[0],r=a[1],m=g[k];
    const right=g[(c+1)+','+r];if(right&&right!==m){keys+=2;if(!m.done||!right.done)todoKeys+=2;}
    const up=g[c+','+(r+1)];if(up&&up!==m){keys+=2;if(!m.done||!up.done)todoKeys+=2;}}
  return {counts:counts,todo:todo,keys:keys,todoKeys:todoKeys,g:g};}

/* ---------- impaginazione sui fogli (con rotazione), y verso l'alto ---------- */
function pack(pieces,W,H,gap){
  const SW=W+gap,SH=H+gap,sheets=[];
  const order=pieces.slice().sort((a,b)=>b.w*b.h-a.w*a.h);
  const newSheet=()=>{const s={free:[{x:0,y:0,w:SW,h:SH}],items:[]};sheets.push(s);return s;};
  function findIn(s,pc){let best=null;
    for(const f of s.free){
      for(const rot of [false,true]){
        const w=(rot?pc.h:pc.w)+gap,h=(rot?pc.w:pc.h)+gap;
        if(w<=f.w+1e-9&&h<=f.h+1e-9){
          const a=Math.min(f.w-w,f.h-h),b=Math.max(f.w-w,f.h-h);
          if(!best||a<best.a||(a===best.a&&b<best.b))best={x:f.x,y:f.y,w:w,h:h,rot:rot,a:a,b:b};}}}
    return best;}
  function place(s,b){const nf=[];
    for(const f of s.free){
      if(b.x>=f.x+f.w||b.x+b.w<=f.x||b.y>=f.y+f.h||b.y+b.h<=f.y){nf.push(f);continue;}
      if(b.x>f.x)nf.push({x:f.x,y:f.y,w:b.x-f.x,h:f.h});
      if(b.x+b.w<f.x+f.w)nf.push({x:b.x+b.w,y:f.y,w:f.x+f.w-(b.x+b.w),h:f.h});
      if(b.y>f.y)nf.push({x:f.x,y:f.y,w:f.w,h:b.y-f.y});
      if(b.y+b.h<f.y+f.h)nf.push({x:f.x,y:b.y+b.h,w:f.w,h:f.y+f.h-(b.y+b.h)});}
    const inside=(a,c)=>a.x>=c.x&&a.y>=c.y&&a.x+a.w<=c.x+c.w&&a.y+a.h<=c.y+c.h;
    s.free=nf.filter((a,i)=>!nf.some((c,j)=>j!==i&&inside(a,c)&&(!(a.x===c.x&&a.y===c.y&&a.w===c.w&&a.h===c.h)||j<i)));}
  for(const pc of order){
    let done=false;
    for(const s of sheets){const b=findIn(s,pc);if(b){s.items.push({pc:pc,x:b.x,y:b.y,rot:b.rot});place(s,b);done=true;break;}}
    if(!done){const s=newSheet(),b=findIn(s,pc);if(!b)return null;s.items.push({pc:pc,x:b.x,y:b.y,rot:b.rot});place(s,b);}
  }
  return sheets;}

function buildList(p,counts,keys){
  const L=[];let mods=0;
  [1,2,3].forEach(n=>{const c=counts[n]||0;if(!c)return;mods+=c;
    L.push({make:()=>mkSide(p,n),qty:2*c});
    if(p.back)L.push({make:()=>mkBack(p,n),qty:c});});
  if(mods)L.unshift({make:()=>mkTB(p),qty:2*mods});
  if(keys>0)L.push({make:()=>mkKey(p),qty:keys});
  return L;}

function plan(AREA){
  const p=params();
  if(!valid(p))return {error:'Controlla le misure della scarpiera: qualcosa è vuoto o troppo piccolo.'};
  const s=stats(),mode=st.mode,xk=Math.max(0,Math.round(+st.xk||0));
  let counts,keys;
  if(mode==='todo'){counts=s.todo;keys=s.todoKeys+xk;}
  else if(mode==='all'){counts=s.counts;keys=s.keys+xk;}
  else{counts={1:0,2:0,3:0};counts[+mode]=1;keys=xk;}
  const list=buildList(p,counts,keys);
  if(!list.length)return {error:mode==='todo'?'Nessun modulo da costruire: aggiungi un modulo nella composizione qui sopra.':'Aggiungi almeno un modulo nella composizione.'};
  const m=5,gap=4,W=AREA.w-2*m,H=AREA.h-2*m,pieces=[],parts=[];
  for(const it of list){const pc=it.make();parts.push({name:pc.name,tag:pc.tag,count:it.qty});
    if(Math.min(pc.w,pc.h)>Math.min(W,H)||Math.max(pc.w,pc.h)>Math.max(W,H))
      return {error:'Il pezzo "'+pc.name+'" ('+Math.round(pc.w)+' × '+Math.round(pc.h)+' mm) è più grande dell\'area di lavoro ('+Math.round(W)+' × '+Math.round(H)+' mm utili). Riduci la profondità o l\'altezza.'};
    for(let i=0;i<it.qty;i++)pieces.push(pc);}
  const pk=pack(pieces,W,H,gap);
  if(!pk)return {error:'I pezzi non entrano nell\'area di lavoro.'};
  const sheets=pk.map(sh=>{
    const items=[],holes=[],outers=[];let mx=0,my=0;
    sh.items.forEach(it=>{
      const pc=it.rot?{pts:it.pc.pts.map(q=>[q[1],it.pc.w-q[0]]),holes:it.pc.holes.map(h=>h.map(q=>[q[1],it.pc.w-q[0]])),w:it.pc.h,h:it.pc.w}:it.pc;
      /* da coordinate col y in basso a coordinate della macchina col y in alto */
      const T=q=>[m+it.x+q[0],m+it.y+(pc.h-q[1])];
      const paths=[{pts:pc.pts.map(T)}].concat(pc.holes.map(h=>({hole:true,pts:h.map(T)})));
      items.push({name:it.pc.name,tag:it.pc.tag,x:m+it.x,y:m+it.y,w:pc.w,h:pc.h,paths:paths});
      mx=Math.max(mx,it.x+pc.w);my=Math.max(my,it.y+pc.h);
      paths.forEach(pa=>(pa.hole?holes:outers).push(pa.pts));});
    return {items:items,cutPaths:holes.concat(outers),w:mx+2*m,h:my+2*m};});
  const e=p.Ph;
  const steps=[
    'Prima di tutto taglia un solo modulo di prova (scegli "Un solo modulo 1X"): serve a regolare il gioco degli incastri sul tuo legno. Dopo, non cambiare più le misure, altrimenti i moduli nuovi non combaceranno con quelli già montati.',
    'Taglia i fogli uno alla volta: fissa il legno con nastro adesivo di carta e imposta l\'origine nell\'angolo in basso a sinistra.',
    'Modulo: incastra sopra e sotto con i due fianchi (denti alterni), così forma un tubo.',
    'Schienale (se c\'è): entra da dietro, con le linguette nelle asole vicino al fondo del tubo.',
    'Per unire due moduli (affiancati o uno sopra l\'altro): infila le chiavi nelle asole che si trovano una di fronte all\'altra. Le asole sono nelle stesse posizioni su tutti i moduli, per questo 1X, 2X e 3X si combinano liberamente.',
    'Con una goccia di colla sulle chiavi il blocco diventa fisso; senza colla puoi riaprire e riorganizzare. Le asole libere sui lati esterni restano vuote.',
    'Altezza interna dei moduli: 1X = '+Math.round(p.X)+' mm, 2X = '+Math.round(2*e-2*p.t)+' mm, 3X = '+Math.round(3*e-2*p.t)+' mm (un 2X combacia con due 1X impilati).'
  ];
  const hardware=[
    'Compensato o pioppo da '+p.t+' mm',
    'Chiavi: '+keys+' (le chiavi si tagliano dagli stessi fogli, insieme ai moduli)',
    'Colla vinilica per legno (facoltativa) e nastro adesivo di carta'
  ];
  return {parts:parts,sheets:sheets,hardware:hardware,steps:steps};
}

/* ---------- interfaccia ---------- */
function save(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&s.mods){st=Object.assign(st,s);st.vals=Object.assign({},DEF,s.vals||{});}}catch(e){}}
function changed(){
  if(ready){
    IDS.forEach(i=>{const v=parseFloat($(i).value);if(isFinite(v))st.vals[i]=v;});
    st.back=$('sBack').checked;st.mode=$('scMode').value;st.xk=parseInt($('sXk').value)||0;
  }
  save();draw();if(window.__projChanged)window.__projChanged();
}
function cellClick(c,r){
  const g=occ(),m=g[c+','+r];$('scWarn').textContent='';
  if(m){if(st.tool==='del')st.mods=st.mods.filter(x=>x!==m);else m.done=!m.done;}
  else{const n=st.sel;
    if(r+n>st.rows){$('scWarn').textContent='Non entra: aggiungi una riga o scegli un modulo più basso.';return;}
    for(let k=0;k<n;k++)if(g[c+','+(r+k)]){$('scWarn').textContent='Lo spazio sopra è già occupato.';return;}
    st.mods.push({c:c,r:r,n:n,done:false});}
  changed();}
function draw(){
  const p=params(),g=occ(),box=$('scLay');
  const cw=Math.min(78,Math.max(36,Math.floor(560/st.cols))),ch=Math.max(24,cw*p.Ph/p.Pw);
  const W=st.cols*cw,H=st.rows*ch;
  let s='<svg width="'+(W+2)+'" height="'+(H+2)+'" viewBox="-1 -1 '+(W+2)+' '+(H+2)+'" style="max-width:100%;height:auto">';
  for(let c=0;c<st.cols;c++)for(let r=0;r<st.rows;r++)
    s+='<rect data-c="'+c+'" data-r="'+r+'" x="'+c*cw+'" y="'+(st.rows-1-r)*ch+'" width="'+cw+'" height="'+ch+'" fill="#fff" stroke="#e6dccb" stroke-dasharray="3 3" style="cursor:pointer"/>';
  const cols={1:'#d9b98a',2:'#c79a5e',3:'#b07a3a'};
  st.mods.forEach(m=>{
    const ok=(m.r===0)||g[m.c+','+(m.r-1)];
    s+='<rect data-c="'+m.c+'" data-r="'+m.r+'" x="'+(m.c*cw+2)+'" y="'+((st.rows-m.r-m.n)*ch+2)+'" width="'+(cw-4)+'" height="'+(m.n*ch-4)+'" rx="3" fill="'+(m.done?'#b9cfb5':cols[m.n])+'" stroke="'+(ok?(m.done?'#3f6b44':'#6b4a24'):'#b3322a')+'" stroke-width="'+(ok?1.5:3)+'" style="cursor:pointer"/>';
    s+='<text x="'+(m.c*cw+cw/2)+'" y="'+((st.rows-m.r-m.n/2)*ch+4)+'" text-anchor="middle" font-size="13" fill="#3b2a14" pointer-events="none">'+m.n+'X'+(m.done?' ✓':'')+'</text>';});
  s+='</svg>';box.innerHTML=s;
  box.querySelectorAll('rect').forEach(e=>e.addEventListener('click',()=>cellClick(+e.dataset.c,+e.dataset.r)));
  const sx=stats(),tot=st.mods.length,nd=st.mods.filter(m=>m.done).length;
  let maxc=-1,maxh=0;st.mods.forEach(m=>{maxc=Math.max(maxc,m.c);maxh=Math.max(maxh,m.r+m.n);});
  $('scSum').innerHTML=tot?('<b>'+tot+'</b> moduli: <b>'+nd+'</b> costruiti, <b>'+(tot-nd)+'</b> da costruire · ingombro <b>'+((maxc+1)*p.Pw)+' × '+(maxh*p.Ph)+' mm</b> (largh. × alt.) · chiavi per i nuovi: <b>'+sx.todoKeys+'</b>'):'Nessun modulo: tocca una cella per iniziare.';
  if(st.mods.some(m=>m.r>0&&!sx.g[m.c+','+(m.r-1)]))$('scWarn').textContent='Attenzione: ci sono moduli sospesi (bordo rosso) senza un modulo sotto.';
}
function init(){
  const box=$('shoeBox');if(!box||box.dataset.ready)return;box.dataset.ready='1';
  load();
  const L=(id,lab,step,min)=>'<div><label for="'+id+'">'+lab+'</label><input type="number" id="'+id+'" value="'+st.vals[id]+'" step="'+step+'" min="'+min+'"></div>';
  box.innerHTML=
    '<p style="margin:0 0 10px"><b>Scarpiera modulare</b>: moduli a cubo da tagliare un po\' alla volta e aggiungere a quelli già montati. Ogni modulo si incastra su tutti i lati con le chiavi, anche con moduli di altezza diversa (1X, 2X, 3X).</p>'+
    '<div class="grid2">'+L('sY','Larghezza interna Y (mm)',1,40)+L('sX','Altezza interna X (mm)',1,40)+L('sD','Profondità (mm)',5,100)+L('sT','Spessore del legno (mm)',0.1,1)+L('sTol','Gioco degli incastri (mm)',0.05,0)+L('sFg','Dente a pettine (mm)',1,8)+L('sKl','Lunghezza chiave (mm)',1,12)+
    '<div><label class="chk"><input type="checkbox" id="sBack"'+(st.back?' checked':'')+'> Schienale</label></div></div>'+
    '<p class="hint">Valori già pronti per pioppo da 3 mm e area 400 × 400. Taglia prima <b>un solo modulo di prova</b> per regolare il gioco; poi non cambiare più le misure.</p>'+
    '<div class="row" style="margin:8px 0">Modulo da aggiungere: <button class="btn scSel" data-n="1">1X</button><button class="btn scSel" data-n="2">2X</button><button class="btn scSel" data-n="3">3X</button></div>'+
    '<div class="row" style="margin:8px 0"><button class="btn" id="scAddC">+ colonna</button><button class="btn" id="scDelC">− colonna</button><button class="btn" id="scAddR">+ riga</button><button class="btn" id="scDelR">− riga</button><button class="btn" id="scClr">Svuota</button></div>'+
    '<div class="row" style="margin:8px 0"><button class="btn scTool" data-t="state">Tocco = fatto / da fare</button><button class="btn scTool" data-t="del">Tocco = rimuovi</button><button class="btn" id="scAllDone">Segna tutto come costruito</button></div>'+
    '<div id="scLay" style="overflow:auto;background:#faf7f1;border:1px dashed #ddd3c3;border-radius:8px;padding:4px"></div>'+
    '<p class="hint" id="scSum"></p><p class="hint" id="scWarn" style="color:var(--bad)"></p>'+
    '<p class="hint">Tocca una cella vuota per aggiungere un modulo (cresce verso l\'alto). Un modulo nuovo è <b>da costruire</b> (legno); toccandolo diventa <b>costruito</b> (verde). Il taglio propone solo i moduli da costruire, con le chiavi per collegarli a quelli già montati.</p>'+
    '<div class="grid2"><div><label for="scMode">Cosa tagliare</label><select id="scMode"><option value="todo">Solo i moduli da costruire (nuovi)</option><option value="all">Tutta la composizione</option><option value="1">Un solo modulo 1X (prova)</option><option value="2">Un solo modulo 2X</option><option value="3">Un solo modulo 3X</option></select></div>'+
    '<div><label for="sXk">Chiavi di scorta</label><input type="number" id="sXk" value="'+st.xk+'" min="0" step="1"></div></div>';
  $('scMode').value=st.mode;
  ready=true;
  box.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',changed));
  box.querySelectorAll('.scSel').forEach(b=>{b.classList.toggle('on',Number(b.dataset.n)===st.sel);b.onclick=()=>{st.sel=Number(b.dataset.n);box.querySelectorAll('.scSel').forEach(x=>x.classList.toggle('on',x===b));save();};});
  box.querySelectorAll('.scTool').forEach(b=>{b.classList.toggle('on',b.dataset.t===st.tool);b.onclick=()=>{st.tool=b.dataset.t;box.querySelectorAll('.scTool').forEach(x=>x.classList.toggle('on',x===b));save();};});
  $('scAddC').onclick=()=>{st.cols=Math.min(12,st.cols+1);changed();};
  $('scDelC').onclick=()=>{if(st.cols>1){st.cols--;st.mods=st.mods.filter(m=>m.c<st.cols);changed();}};
  $('scAddR').onclick=()=>{st.rows=Math.min(8,st.rows+1);changed();};
  $('scDelR').onclick=()=>{if(st.rows>1){st.rows--;st.mods=st.mods.filter(m=>m.r+m.n<=st.rows);changed();}};
  $('scAllDone').onclick=()=>{st.mods.forEach(m=>m.done=true);changed();};
  $('scClr').onclick=()=>{st.mods=[];changed();};
  draw();
}
window.Scarp={init:init,plan:plan};
})();
