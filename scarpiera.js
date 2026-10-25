/* Scarpiera modulare per laserBrio: moduli che si aggiungono uno alla volta e si incastrano su ogni lato.
   Ogni modulo è un tubo a pettine (sopra, sotto, 2 fianchi) con schienale a linguette opzionale.
   Le asole per le chiavi stanno sempre nelle stesse posizioni: per questo i formati 1X, 2X e 3X si combinano liberamente
   e un modulo nuovo si aggiunge a quelli già montati. Usa packSheets() e le funzioni di taglio dell'app. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const LS='lb_scarp';
let st={cols:4,rows:3,mods:[],sel:1,tool:'state'};
const DEF={scY:120,scX:110,scD:300,scT:3,scTol:0.1,scFg:20,scKl:30,scXk:4};
let ready=false;

/* ---------- geometria ---------- */
function rect(cx,cy,w,h){return [[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]];}
function rectPts(x,y,w,h){return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];}
function fingerN(D,fg){let n=Math.round(D/fg);if(n%2===0)n++;return Math.max(3,n);}
function depthCenters(p){return [0.25*p.D,0.7*p.D];}
function backCount(len){return Math.max(2,Math.round(len/60));}
// fianco: x = profondità, y = altezza esterna. Pettine: incavi sui denti pari, sopra e sotto.
function sidePts(D,H,t,N){const f=D/N,pts=[];
  for(let i=0;i<N;i++){const y=(i%2===0)?t:0;pts.push([i*f,y],[(i+1)*f,y]);}
  for(let i=N-1;i>=0;i--){const y=(i%2===0)?H-t:H;pts.push([(i+1)*f,y],[i*f,y]);}
  return pts;}
// sopra/sotto: x = larghezza esterna, y = profondità. Incavi sui denti dispari, a destra e a sinistra.
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
function sidePaths(p,n){
  const H=n*p.Ph,Hin=H-2*p.t,N=fingerN(p.D,p.fg);
  const paths=[{pts:sidePts(p.D,H,p.t,N)}];
  depthCenters(p).forEach(cx=>{for(let k=0;k<n;k++)paths.push({hole:true,pts:rect(cx,(k+.5)*p.Ph,p.kl+p.tol,p.t+p.tol)});});
  if(p.back){const nb=backCount(Hin),tl=Math.min(30,Hin/nb*.5);
    for(let i=0;i<nb;i++)paths.push({hole:true,pts:rect(p.D-1.5*p.t,p.t+(i+.5)*Hin/nb,p.t+p.tol,tl+p.tol)});}
  return paths;}
function tbPaths(p){
  const N=fingerN(p.D,p.fg);
  const paths=[{pts:tbPts(p.Pw,p.D,p.t,N)}];
  depthCenters(p).forEach(c=>paths.push({hole:true,pts:rect(p.Pw/2,c,p.t+p.tol,p.kl+p.tol)}));
  if(p.back){const nb=backCount(p.Y),tl=Math.min(30,p.Y/nb*.5);
    for(let i=0;i<nb;i++)paths.push({hole:true,pts:rect(p.t+(i+.5)*p.Y/nb,p.D-1.5*p.t,tl+p.tol,p.t+p.tol)});}
  return paths;}
function backPaths(p,n){
  const Hin=n*p.Ph-2*p.t,nw=backCount(p.Y),nh=backCount(Hin);
  const tlw=Math.min(30,p.Y/nw*.5),tlh=Math.min(30,Hin/nh*.5);
  const cx=[],cy=[];for(let i=0;i<nw;i++)cx.push((i+.5)*p.Y/nw);for(let i=0;i<nh;i++)cy.push((i+.5)*Hin/nh);
  return [{pts:tabbed(p.Y,Hin,p.t,cx,cy,tlw,tlh)}];}
function keyPaths(p){
  const L=2*p.t,c=Math.min(.6,p.t/4),w=p.kl;
  return [{pts:[[c,0],[w-c,0],[w,c],[w,L-c],[w-c,L],[c,L],[0,L-c],[0,c]]}];}

/* ---------- stato e composizione ---------- */
function P(){
  const g=id=>{const v=Number($(id).value);return isFinite(v)?v:0;};
  const p={Y:g('scY'),X:g('scX'),D:g('scD'),t:g('scT'),tol:g('scTol'),fg:g('scFg')||20,kl:g('scKl'),xk:Math.max(0,Math.round(g('scXk'))),back:$('scBack').checked};
  p.Pw=p.Y+2*p.t;p.Ph=p.X+2*p.t;return p;}
function occ(){const g={};st.mods.forEach(m=>{for(let k=0;k<m.n;k++)g[m.c+','+(m.r+k)]=m;});return g;}
function stats(){
  const g=occ(),counts={1:0,2:0,3:0},todoCounts={1:0,2:0,3:0};
  st.mods.forEach(m=>{counts[m.n]++;if(!m.done)todoCounts[m.n]++;});
  let keys=0,todoKeys=0;
  for(const k in g){const [c,r]=k.split(',').map(Number),m=g[k];
    const right=g[(c+1)+','+r];if(right&&right!==m){keys+=2;if(!m.done||!right.done)todoKeys+=2;}
    const up=g[c+','+(r+1)];if(up&&up!==m){keys+=2;if(!m.done||!up.done)todoKeys+=2;}}
  return {counts,todoCounts,keys,todoKeys,g};}
function save(){try{const v={st:st,f:{}};Object.keys(DEF).forEach(k=>v.f[k]=$(k).value);v.back=$('scBack').checked;v.mode=$('scMode').value;localStorage.setItem(LS,JSON.stringify(v));}catch(e){}}
function load(){try{const v=JSON.parse(localStorage.getItem(LS)||'null');if(!v)return;
  if(v.st&&Array.isArray(v.st.mods))st=Object.assign(st,v.st);
  if(v.f)Object.keys(v.f).forEach(k=>{if($(k))$(k).value=v.f[k];});
  if(typeof v.back==='boolean')$('scBack').checked=v.back;
  if(v.mode&&$('scMode'))$('scMode').value=v.mode;}catch(e){}}

function check(p){
  if(!(p.Y>=40&&p.X>=40&&p.D>=100&&p.t>=1.5&&p.t<=8&&p.kl>=12&&p.tol>=0&&p.tol<=1))return 'Controlla le misure: qualcosa è vuoto o fuori misura.';
  if(p.back&&depthCenters(p)[1]+p.kl/2>p.D-2*p.t-2)return 'Profondità troppo piccola: le asole delle chiavi toccano quelle dello schienale. Aumentala o accorcia la chiave.';
  return '';}

/* ---------- piano di taglio per l'app ---------- */
function plan(area){
  if(!ready)return {error:'Sto caricando…'};
  const p=P(),e=check(p);if(e)return {error:e};
  const s=stats(),mode=$('scMode').value;
  let counts,keys;
  if(mode==='todo'){counts=s.todoCounts;keys=s.todoKeys+p.xk;}
  else if(mode==='all'){counts=s.counts;keys=s.keys+p.xk;}
  else{counts={1:0,2:0,3:0};counts[Number(mode)]=1;keys=p.xk;}
  const total=counts[1]+counts[2]+counts[3];
  if(!total&&!(keys>0))return {error:mode==='todo'?'Nessun modulo da costruire: tocca una cella vuota nella composizione qui sopra.':'Aggiungi almeno un modulo.'};
  const parts=[];
  if(total)parts.push({name:'Sopra/Sotto',tag:'tb',count:2*total,paths:tbPaths(p)});
  [1,2,3].forEach(n=>{if(!counts[n])return;
    parts.push({name:'Fianco '+n+'X',tag:'side'+n,count:2*counts[n],paths:sidePaths(p,n)});
    if(p.back)parts.push({name:'Schienale '+n+'X',tag:'back'+n,count:counts[n],paths:backPaths(p,n)});});
  if(keys>0)parts.push({name:'Chiave',tag:'key',count:keys,paths:keyPaths(p)});
  const sh=packSheets(parts,area.w,area.h);
  if(sh.error)return {error:sh.error};
  const hardware=[
    'Legno da '+p.t+' mm (pioppo o compensato): stesso spessore e stesso foglio per tutti i moduli',
    'Colla vinilica per legno: sul pettine e, se vuoi un blocco fisso, sulle chiavi',
    'Nastro adesivo di carta per fermare il legno durante il taglio',
    'Staffa anti-ribaltamento per fissare la scarpiera al muro (se è alta e stretta)'];
  const steps=[
    'Prima di tutto taglia un solo modulo di prova (scegli "Un solo modulo 1X"): serve a regolare il gioco degli incastri. Con le chiavi troppo larghe o troppo strette cambia il "Gioco incastri" e ripeti.',
    'Dopo la prova non cambiare più le misure: i moduli nuovi devono combaciare con quelli già montati.',
    'Taglia i fogli uno alla volta: fissa il legno con nastro adesivo di carta e imposta l\'origine nell\'angolo in basso a sinistra.',
    'Monta il tubo: infila i pettini di sopra e sotto nei due fianchi, incolla. Se c\'è lo schienale, infilalo dal dietro: le linguette entrano nelle asole vicino al fondo.',
    'Per unire due moduli affiancati o sovrapposti infila una chiave in ogni coppia di asole che si trovano una di fronte all\'altra. Una goccia di colla sulle chiavi rende il blocco fisso; senza colla puoi smontare.',
    'Per aggiungere un modulo in futuro: segna come costruiti quelli già fatti, aggiungi il nuovo e taglia solo i suoi pezzi con le chiavi che lo collegano ai vicini.'];
  return {parts:parts,sheets:sh.sheets,hardware:hardware,steps:steps,info:{}};
}

/* ---------- interfaccia ---------- */
function changed(){save();draw();if(window.__projChanged)window.__projChanged();}
function draw(){
  const p=P(),g=occ(),box=$('scLay');
  const cw=Math.min(78,Math.max(40,Math.floor(560/st.cols))),ch=Math.max(24,cw*p.Ph/Math.max(1,p.Pw));
  const W=st.cols*cw,H=st.rows*ch;
  let s='<svg width="'+(W+2)+'" height="'+(H+2)+'" viewBox="-1 -1 '+(W+2)+' '+(H+2)+'" style="display:block;margin:auto">';
  for(let c=0;c<st.cols;c++)for(let r=0;r<st.rows;r++)
    s+='<rect data-c="'+c+'" data-r="'+r+'" x="'+c*cw+'" y="'+(st.rows-1-r)*ch+'" width="'+cw+'" height="'+ch+'" fill="#fff" stroke="#e1d6c6" stroke-dasharray="3 3" style="cursor:pointer"/>';
  const col={1:'#e8c79a',2:'#d9b27a',3:'#c79a5e'};
  st.mods.forEach(m=>{
    const ok=m.r===0||g[m.c+','+(m.r-1)];
    s+='<rect data-c="'+m.c+'" data-r="'+m.r+'" x="'+(m.c*cw+2)+'" y="'+((st.rows-m.r-m.n)*ch+2)+'" width="'+(cw-4)+'" height="'+(m.n*ch-4)+'" rx="3" fill="'+(m.done?'#b9cfb5':col[m.n])+'" stroke="'+(ok?(m.done?'#3f6b44':'#3c2314'):'#b3261e')+'" stroke-width="'+(ok?1.5:3)+'" style="cursor:pointer"/>';
    s+='<text x="'+(m.c*cw+cw/2)+'" y="'+((st.rows-m.r-m.n/2)*ch+4)+'" text-anchor="middle" font-size="13" fill="#3c2314" pointer-events="none">'+m.n+'X'+(m.done?' ✓':'')+'</text>';});
  s+='</svg>';box.innerHTML=s;
  box.querySelectorAll('rect').forEach(e=>e.addEventListener('click',()=>cell(+e.dataset.c,+e.dataset.r)));
  const sx=stats(),tot=st.mods.length,nd=st.mods.filter(m=>m.done).length;
  let maxc=-1,maxh=0;st.mods.forEach(m=>{maxc=Math.max(maxc,m.c);maxh=Math.max(maxh,m.r+m.n);});
  $('scSum').innerHTML=tot?('<b>'+tot+'</b> moduli: <b>'+nd+'</b> costruiti, <b>'+(tot-nd)+'</b> da costruire · ingombro <b>'+Math.round((maxc+1)*p.Pw)+' × '+Math.round(maxh*p.Ph)+' mm</b> (largh. × alt.) · chiavi per i nuovi: <b>'+sx.todoKeys+'</b>'):'Nessun modulo: tocca una cella per iniziare.';
  const dim=n=>Math.round(n*p.Ph-2*p.t);
  $('scDer').textContent='Esterno modulo 1X: '+Math.round(p.Pw)+' × '+Math.round(p.Ph)+' mm. Altezza interna: 1X '+Math.round(p.X)+' mm, 2X '+dim(2)+' mm, 3X '+dim(3)+' mm.';
  if(st.mods.some(m=>m.r>0&&!g[m.c+','+(m.r-1)]))$('scWarn').textContent='Attenzione: ci sono moduli sospesi (bordo rosso) senza un modulo sotto.';
}
function cell(c,r){
  const g=occ(),m=g[c+','+r];$('scWarn').textContent='';
  if(m){if(st.tool==='del')st.mods=st.mods.filter(x=>x!==m);else m.done=!m.done;}
  else{const n=st.sel;
    if(r+n>st.rows){$('scWarn').textContent='Non entra: aggiungi una riga o scegli un modulo più basso.';return;}
    for(let k=0;k<n;k++)if(g[c+','+(r+k)]){$('scWarn').textContent='Lo spazio sopra è già occupato.';return;}
    st.mods.push({c:c,r:r,n:n,done:false});}
  changed();}

function init(){
  if(ready)return;
  const box=$('shoeBox');if(!box)return;
  const num=(id,lab,step,min)=>'<div><label for="'+id+'">'+lab+'</label><input type="number" id="'+id+'" value="'+DEF[id]+'" step="'+step+'" min="'+min+'"></div>';
  box.innerHTML=
    '<p style="margin:0 0 10px"><b>Scarpiera modulare</b>: moduli a cubo che si aggiungono uno alla volta e si incastrano su ogni lato, con altezza 1X, 2X o 3X. Si taglia un modulo quando serve e lo si aggiunge a quelli già montati.</p>'+
    '<div class="grid2">'+
      num('scY','Larghezza interna Y (mm)',1,40)+num('scX','Altezza interna X (mm)',1,40)+
      num('scD','Profondità (mm)',5,100)+num('scT','Spessore del legno (mm)',0.1,1.5)+
      num('scTol','Gioco incastri (mm)',0.05,0)+num('scFg','Dente del pettine (mm)',1,8)+
      num('scKl','Lunghezza chiave (mm)',1,12)+num('scXk','Chiavi di scorta',1,0)+
    '</div>'+
    '<label class="chk" style="margin-top:10px"><input type="checkbox" id="scBack" checked> Schienale</label>'+
    '<p class="hint" id="scDer"></p>'+
    '<p style="margin:12px 0 6px"><b>Componi la scarpiera</b></p>'+
    '<div class="row" style="margin-bottom:8px">'+
      '<button class="btn on scSel" data-n="1">1X</button><button class="btn scSel" data-n="2">2X</button><button class="btn scSel" data-n="3">3X</button>'+
      '<button class="btn" id="scAddC">+ colonna</button><button class="btn" id="scDelC">− colonna</button>'+
      '<button class="btn" id="scAddR">+ riga</button><button class="btn" id="scDelR">− riga</button>'+
    '</div>'+
    '<div class="row" style="margin-bottom:8px">'+
      '<button class="btn on scTool" data-t="state">Tocco = fatto / da fare</button><button class="btn scTool" data-t="del">Tocco = rimuovi</button>'+
      '<button class="btn" id="scAllDone">Segna tutto come costruito</button><button class="btn" id="scClr">Svuota</button>'+
    '</div>'+
    '<div id="scLay" style="overflow:auto;padding:4px;background:#faf6f0;border:1px dashed #d7c9b5;border-radius:10px"></div>'+
    '<p class="hint" id="scSum"></p><p class="hint" id="scWarn" style="color:var(--bad)"></p>'+
    '<p class="hint">Tocca una cella vuota per aggiungere un modulo (cresce verso l\'alto). Un modulo nuovo è <b>da costruire</b>; toccandolo diventa <b>costruito</b> (verde). <b>Dopo aver tagliato il primo modulo non cambiare più le misure</b>, altrimenti i nuovi non combaceranno.</p>'+
    '<label for="scMode">Cosa tagliare</label>'+
    '<select id="scMode"><option value="todo">Solo i moduli da costruire (nuovi)</option><option value="all">Tutta la composizione</option><option value="1">Un solo modulo 1X (prova)</option><option value="2">Un solo modulo 2X</option><option value="3">Un solo modulo 3X</option></select>';
  load();
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
