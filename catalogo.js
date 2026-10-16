/* Catalogo progetti di laserBrio: legge catalogo.json e le foto dalla tua cartella (LaserBrio) sul PC. */
(function(){
const $=id=>document.getElementById(id);
const FE=['Non fattibile','Con limiti','Fattibile'];
const FC=['bad','warn','ok'];
let DB=null,ROOT=null,CUR=null;
const st={q:'',mac:'',fe:'',n:60,view:'prog'};
const dirCache=new Map(),urlCache=new Map();

/* ---- memoria della cartella scelta (IndexedDB) ---- */
function idb(){return new Promise((ok,ko)=>{try{const r=indexedDB.open('laserbrio-cat',1);r.onupgradeneeded=()=>r.result.createObjectStore('h');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);}catch(e){ko(e);}});}
async function saveH(h){try{const d=await idb();d.transaction('h','readwrite').objectStore('h').put(h,'root');}catch(e){}}
async function loadH(){try{const d=await idb();return await new Promise(ok=>{const q=d.transaction('h').objectStore('h').get('root');q.onsuccess=()=>ok(q.result||null);q.onerror=()=>ok(null);});}catch(e){return null;}}

async function dirAt(parts){
  let d=ROOT,k='';
  for(const p of parts){k+='/'+p;if(dirCache.has(k)){d=dirCache.get(k);continue;}d=await d.getDirectoryHandle(p);dirCache.set(k,d);}
  return d;
}
async function fileAt(rel){
  const p=rel.split('/').filter(Boolean),n=p.pop();
  return (await (await dirAt(p)).getFileHandle(n)).getFile();
}
async function photoUrl(rel){
  if(!rel||!ROOT)return '';
  if(urlCache.has(rel))return urlCache.get(rel);
  try{const u=URL.createObjectURL(await fileAt(rel));urlCache.set(rel,u);return u;}catch(e){return '';}
}

/* foto presa dentro lo zip del progetto (quando nella cartella non c'è il jpg) */
const zc=new Map();let zq=Promise.resolve();
function zipPhoto(rel){
  if(zc.has(rel))return zc.get(rel);
  const p=zq.then(async()=>{
    let u='';
    try{
      if(!window.Proj){
        await new Promise((ok,ko)=>{const sc=document.createElement('script');sc.src='progetto.js';sc.onload=ok;sc.onerror=ko;document.head.appendChild(sc);});
        if(!window.__projInit){window.__projInit=true;Proj.init();}
      }
      const f=await fileAt(rel),T=Proj._t,ents=await T.readZip(f);
      const imgs=ents.filter(e=>/\.(jpe?g|png)$/i.test(e.name)&&e.us<40e6);
      const e=imgs.find(x=>/photo/i.test(x.name))||imgs[0];
      if(e){const b=await T.unzipEntry(f,e);u=URL.createObjectURL(new Blob([b],{type:/png$/i.test(e.name)?'image/png':'image/jpeg'}));}
      else u=await vecZip(f,ents);
    }catch(_){}
    return u;
  });
  zq=p.catch(()=>{});zc.set(rel,p);return p;
}

/* anteprima disegnata dal file vettoriale stesso (SVG, DXF, EPS, AI) */
let vq=Promise.resolve();
async function projReady(){
  if(!window.Proj){
    await new Promise((ok,ko)=>{const sc=document.createElement('script');sc.src='progetto.js';sc.onload=ok;sc.onerror=ko;document.head.appendChild(sc);});
  }
  if(!window.__projInit){window.__projInit=true;Proj.init();}
}
const vrank=n=>/\.svg$/i.test(n)?4:/\.eps$/i.test(n)?3:/\.dxf$/i.test(n)?2:/\.ai$/i.test(n)?1:0;
function vdraw(r){
  const W=240,m=12,cv=document.createElement('canvas');cv.width=cv.height=W;
  const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,W);
  const k=Math.min((W-2*m)/Math.max(r.sheetW,1e-6),(W-2*m)/Math.max(r.sheetH,1e-6));
  const ox=(W-r.sheetW*k)/2,oy=(W-r.sheetH*k)/2;
  let tot=0;for(const s of r.subs)tot+=s.pts.length;
  const step=Math.max(1,Math.ceil(tot/40000));
  x.strokeStyle='#2b2b2b';x.lineWidth=1;x.lineJoin='round';x.beginPath();
  for(const s of r.subs){
    const q=s.pts;if(q.length<2)continue;
    x.moveTo(ox+q[0][0]*k,oy+q[0][1]*k);
    for(let i=step;i<q.length;i+=step)x.lineTo(ox+q[i][0]*k,oy+q[i][1]*k);
    if((q.length-1)%step)x.lineTo(ox+q[q.length-1][0]*k,oy+q[q.length-1][1]*k);
    if(s.closed)x.closePath();
  }
  x.stroke();
  return cv.toDataURL('image/png');
}
async function vparse(name,bytes){
  const T=Proj._t;let r;
  if(/\.svg$/i.test(name))r=T.parseSvg(new TextDecoder('utf-8').decode(bytes));
  else if(/\.dxf$/i.test(name))r=T.parseDxf(new TextDecoder('utf-8').decode(bytes));
  else if(/\.eps$/i.test(name))r=T.parseEps(new TextDecoder('latin1').decode(bytes));
  else r=await T.parseAi(bytes);
  return vdraw(r);
}
function vecTask(fn){
  const p=vq.then(async()=>{await new Promise(r=>setTimeout(r,0));try{await projReady();return await fn();}catch(_){return '';}});
  vq=p.catch(()=>{});return p;
}
const vfc=new Map();
function vecFile(h){ /* h = file handle */
  return vecTask(async()=>{const f=await h.getFile();if(f.size>6e6||!vrank(f.name))return '';return vparse(f.name,new Uint8Array(await f.arrayBuffer()));});
}
function vecFolder(rel){
  if(vfc.has(rel))return vfc.get(rel);
  const p=vecTask(async()=>{
    const root=await dirAt(rel.split('/'));let q=[root],seen=0,best=null,bi=0;
    for(let depth=0;depth<4&&q.length&&!best;depth++){
      const nx=[];
      for(const d of q){
        for await(const e of d.values()){
          if(++seen>600)break;
          if(e.kind==='directory'){nx.push(e);continue;}
          const r=vrank(e.name);if(r>bi){const f=await e.getFile();if(f.size<6e6){best=e;bi=r;if(r===4)break;}}
        }
        if(best&&bi>=3)break;
      }
      q=nx;
    }
    if(!best)return '';
    const f=await best.getFile();return vparse(f.name,new Uint8Array(await f.arrayBuffer()));
  });
  vfc.set(rel,p);return p;
}
function vecZip(f,ents){
  const cand=ents.filter(e=>vrank(e.name)&&e.us<6e6);
  if(!cand.length)return '';
  const top=Math.max(...cand.map(e=>vrank(e.name)));
  const L=cand.filter(e=>vrank(e.name)===top);
  const e=L.find(x=>/3\s?mm/i.test(x.name))||L[0];
  return Proj._t.unzipEntry(f,e).then(b=>vparse(e.name,b));
}

/* ---- aggiungi progetti nuovi: rilegge la cartella e aggiorna catalogo.json ---- */
const VEXT=/\.(svg|dxf|eps|ai|cdr)$/i;
const MACN=[[/scatol|box|casket|cofan|contenit|organizer|salvadan|portatov/i,'Scatole e contenitori'],[/lamp|light|lume|luce|lanterna/i,'Luci'],[/chair|table|bed\b|shelf|shelves|furniture|dresser|sedia|tavol|mobil|mensol|letto|cassett|rocking/i,'Arredo'],[/clock|coaster|kitchen|frame|cornic|vase|vaso|tray|vassoio|orolog|tagliere|cutting/i,'Casa e cucina'],[/game|puzzle|toy|doll|gioc|bambol/i,'Giochi e giocattoli'],[/animal|dog|cat\b|bird|horse|deer|head|cane|gatto|dinosaur|elephant/i,'Animali e sculture'],[/christmas|natale|wedding|easter|pasqua|halloween|topper|matrimon/i,'Feste'],[/garden|giardin|barbecue|feeder|birdhouse/i,'Giardino ed esterno'],[/house|building|facade|church|chiesa|architect|castle|castello/i,'Architettura e modelli'],[/\bcar\b|truck|model|machine|mechan|airplane|ship|tank/i,'Meccanica e modelli'],[/cross|croce|saint|santo|icon|angel|madonna|jesus|gesu/i,'Religione'],[/key ?chain|pendant|charm|ring\b|jewel|portachiavi|medallion|earring/i,'Gioielli e piccoli oggetti'],[/panel|pattern|ornament|decor|mandala|grid|lattice/i,'Pannelli e decori'],[/letter|word|font|alphabet|lettere|monogram|name/i,'Scritte']];
function macroNew(s){for(const [re,m] of MACN)if(re.test(s))return m;return 'Importati';}
function feasNew(s,mac){
  if(/plasma|metal|sandblast|sabbiat/i.test(s))return [0,'pensato per metallo/plasma/sabbiatura'];
  const m=s.match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  if(m){const mm=parseFloat(m[1].replace(',','.'));if(mm>6)return [0,'spessore '+mm+' mm: oltre i limiti dell\'S9'];if(mm>3)return [1,'spessore '+mm+' mm: taglio marginale, più passate'];}
  if(/acrylic|acrilic/i.test(s))return [1,'acrilico: solo opaco/colorato'];
  if(mac==='Arredo'||mac==='Architettura e modelli')return [1,'stima automatica: pezzi spesso grandi, controlla misure e spessore'];
  return [2,'stima automatica: controlla misure e spessore'];
}
function cleanName(n){return n.replace(/\.[a-z0-9]{2,4}$/i,'').replace(/^name_/i,'').replace(/^\d+[_\- ]+/,'').replace(/_/g,' ').replace(/\s+/g,' ').trim()||n;}
async function addNew(){
  const b=sheet();
  line(b,'h3','Aggiungi progetti nuovi').style.margin='0 0 6px';
  const msg=line(b,'p','Controllo la cartella…','hint');
  const x=document.createElement('button');x.className='btn';x.style.marginTop='12px';x.textContent='Chiudi';x.onclick=()=>$('catDet').remove();
  try{
    if(ROOT.requestPermission){const p=await ROOT.requestPermission({mode:'readwrite'});if(p!=='granted')throw new Error('Serve il permesso di scrittura sulla cartella per aggiornare catalogo.json.');}
    const known=new Set(DB.items.map(i=>i[5]));
    const skip=[...DB.raw.map(r=>r[0]),...DB.eng.map(r=>r[1]),...DB.items.filter(i=>!/\.zip$/i.test(i[5])).map(i=>i[5])];
    const under=p=>skip.some(s=>p===s||p.startsWith(s+'/'));
    const newItems=[],newRaw=[];let seen=0,nid=0;
    async function walk(dir,rel,depth){
      if(rel&&under(rel))return;
      const files=[],dirs=[];
      for await(const e of dir.values()){
        if(++seen%300===0){msg.textContent='Controllo la cartella… '+seen+' voci, trovati '+(newItems.length+newRaw.length)+' nuovi';await new Promise(r=>setTimeout(r,0));}
        if(e.kind==='directory')dirs.push(e);else files.push(e.name);
      }
      const p=n=>rel?rel+'/'+n:n;
      for(const f of files)if(/\.zip$/i.test(f)&&!known.has(p(f))){
        const path=p(f),nm=cleanName(f),mac=macroNew(path),fe=feasNew(path,mac);
        newItems.push([(f.match(/^\d+/)||['n'+(++nid)])[0],nm,f.replace(/\.zip$/i,''),mac,rel?rel.split('/').pop():'Importati',path,'',['zip'],fe[0],fe[1]]);
      }
      const vec=files.filter(f=>VEXT.test(f));
      if(rel&&vec.length){
        const ex={};files.forEach(f=>{const m=f.match(/\.([a-z0-9]{2,4})$/i);if(m)ex[m[1].toLowerCase()]=(ex[m[1].toLowerCase()]||0)+1;});
        const nm=cleanName(rel.split('/').pop()),mac=macroNew(rel),fe=feasNew(rel,mac);
        if(vec.length>=10){newRaw.push([rel,nm,mac,files.length,ex,fe[0],fe[1]]);}
        else{
          const im=files.filter(f=>/\.(jpe?g|png)$/i.test(f)),ph=im.find(f=>/photo/i.test(f))||im[0]||'';
          newItems.push([(rel.split('/').pop().match(/^\d+/)||['n'+(++nid)])[0],nm,rel.split('/').pop(),mac,rel.split('/').slice(-2,-1)[0]||'Importati',rel,ph?p(ph):'',Object.keys(ex),fe[0],fe[1]]);
        }
        return;
      }
      if(depth<6)for(const d of dirs)await walk(d,p(d.name),depth+1);
    }
    await walk(ROOT,'',0);
    if(!newItems.length&&!newRaw.length){msg.textContent='Nessun progetto nuovo: tutto quello che c\'è nella cartella è già nel catalogo ('+seen+' voci controllate).';}
    else{
      DB.items.push(...newItems);DB.raw.push(...newRaw);
      const old=await (await ROOT.getFileHandle('catalogo.json')).getFile();
      const bk=await ROOT.getFileHandle('catalogo-prima.json',{create:true});let w=await bk.createWritable();await w.write(await old.text());await w.close();
      const fh=await ROOT.getFileHandle('catalogo.json');w=await fh.createWritable();await w.write(JSON.stringify(DB));await w.close();
      msg.textContent='Aggiunti '+newItems.length+' progetti e '+newRaw.length+' raccolte. I nomi restano come sono nei file (non vengono tradotti), e la fattibilità sull\'S9 è una stima automatica dallo spessore nel nome. Ho tenuto una copia del catalogo precedente (catalogo-prima.json).';
      render();
    }
  }catch(e){msg.textContent='Non riesco ad aggiornare: '+(e.message||e);msg.style.color='var(--bad)';}
  b.appendChild(x);
}

/* ---- avvio ---- */
function css(){
  if($('catCss'))return;
  const s=document.createElement('style');s.id='catCss';
  s.textContent=`#catOv{position:fixed;inset:0;z-index:50;background:var(--bg);overflow:auto;-webkit-overflow-scrolling:touch}
#catOv .in{max-width:980px;margin:0 auto;padding:12px 14px 60px}
#catOv .top{position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2;border-bottom:1px solid var(--line)}
.cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:12px}
.cc{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column}
.cc .th{aspect-ratio:1;background:var(--soft) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--mute);font-size:34px}
.cc .tx{padding:8px 9px;font-size:14px;line-height:1.25;flex:1}
.cc .tx b{display:block;margin-bottom:3px;word-break:break-word}
.cc .tx small{color:var(--mute);display:block}
.chip{display:inline-block;padding:6px 12px;border-radius:99px;border:1px solid var(--line);background:#fff;margin:3px 4px 3px 0;cursor:pointer;font-size:14px}
.chip.on{background:var(--accent);color:#fff;border-color:var(--accent)}
#catM,#catF,#catV{white-space:nowrap;overflow-x:auto;padding-bottom:2px}
#catDet{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
#catDet .box{background:#fff;border-radius:16px 16px 0 0;max-width:640px;width:100%;max-height:92vh;overflow:auto;padding:16px}
#catDet img{max-width:100%;max-height:50vh;border-radius:10px;display:block;margin:0 auto 10px}`;
  document.head.appendChild(s);
}
function shell(){
  if($('catOv'))return;
  css();
  const o=document.createElement('div');o.id='catOv';
  o.innerHTML=`<div class="in"><div class="top">
<div class="row sp"><b style="font-size:19px">Catalogo progetti</b><button class="btn" id="catX">Chiudi</button></div>
<div id="catConn" class="hint"></div>
<div class="row" style="margin-top:6px"><input type="text" id="catQ" placeholder="Cerca (es. lampada, scatola, cane…)" style="flex:1;min-width:180px"></div>
<div id="catV" style="margin-top:6px"></div><div id="catM" style="margin-top:4px"></div><div id="catF"></div></div>
<p class="hint" id="catInfo"></p><div class="cgrid" id="catG"></div><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="catMore" hidden>Mostra altri</button></div></div>`;
  document.body.appendChild(o);
  $('catX').onclick=()=>{o.hidden=true;document.body.style.overflow='';};
  let t;$('catQ').oninput=e=>{clearTimeout(t);t=setTimeout(()=>{st.q=e.target.value.trim().toLowerCase();st.n=60;draw();},180);};
  $('catMore').onclick=()=>{st.n+=60;draw(true);};
}
async function open(){
  shell();$('catOv').hidden=false;document.body.style.overflow='hidden';
  if(!DB){
    if(!ROOT){const h=await loadH();if(h){CUR=h;}}
    conn();
    if(CUR&&!ROOT){
      try{if((await CUR.queryPermission({mode:'read'}))==='granted'){ROOT=CUR;await loadDB();}}catch(e){}
    }
  }
  render();
}
function conn(){
  const c=$('catConn');
  if(ROOT){c.textContent='Cartella collegata: '+ROOT.name;return;}
  c.innerHTML='';
  const b=document.createElement('button');b.className='btn primary';b.textContent=CUR?'Riattiva la cartella '+CUR.name:'Collega la cartella LaserBrio';
  b.onclick=async()=>{
    try{
      if(CUR){if((await CUR.requestPermission({mode:'read'}))==='granted')ROOT=CUR;}
      if(!ROOT){ROOT=await showDirectoryPicker({id:'laserbrio',mode:'read'});CUR=ROOT;await saveH(ROOT);}
      await loadDB();conn();render();
    }catch(e){c.textContent='Non sono riuscito ad aprire la cartella: '+(e.message||e);}
  };
  c.appendChild(b);
  const p=document.createElement('p');p.className='hint';
  p.textContent=('showDirectoryPicker' in window)?'Scegli la cartella LaserBrio (quella con i progetti scaricati, sul PC). Serve Chrome o Edge.':'Questo browser non può leggere una cartella: apri laserBrio da Chrome o Edge sul PC.';
  c.appendChild(p);
}
async function loadDB(){
  try{DB=JSON.parse(await (await fileAt('catalogo.json')).text());}
  catch(e){$('catConn').textContent='Non trovo catalogo.json nella cartella scelta (deve essere dentro LaserBrio).';ROOT=null;DB=null;}
}

/* ---- disegno ---- */
function views(){
  const v=$('catV');v.innerHTML='';
  [['prog','Progetti con foto'],['raw','Raccolte vettoriali'],['eng','Immagini da incidere']].forEach(([k,t])=>{
    const b=document.createElement('span');b.className='chip'+(st.view===k?' on':'');b.textContent=t;
    b.onclick=()=>{st.view=k;st.mac='';st.n=60;render();};v.appendChild(b);});
  const ad=document.createElement('span');ad.className='chip';ad.style.borderStyle='dashed';ad.textContent='➕ Aggiungi progetti nuovi';ad.onclick=()=>{if(DB&&ROOT)addNew();};v.appendChild(ad);
}
function render(){
  views();
  const M=$('catM'),F=$('catF');M.innerHTML='';F.innerHTML='';
  if(!DB){$('catG').innerHTML='';$('catInfo').textContent='';$('catMore').hidden=true;return;}
  if(st.view==='prog'){
    const cnt={};DB.items.forEach(i=>cnt[i[3]]=(cnt[i[3]]||0)+1);
    chip(M,'Tutte',''.length?'':'',!st.mac,()=>{st.mac='';st.n=60;render();});
    Object.keys(cnt).sort().forEach(m=>chip(M,m+' ('+cnt[m]+')','',st.mac===m,()=>{st.mac=m;st.n=60;render();}));
    chip(F,'Qualsiasi fattibilità','',st.fe==='',()=>{st.fe='';st.n=60;render();});
    [2,1,0].forEach(k=>chip(F,FE[k],'',st.fe===String(k),()=>{st.fe=String(k);st.n=60;render();}));
  }
  draw();
}
function chip(box,t,_,on,fn){const s=document.createElement('span');s.className='chip'+(on?' on':'');s.textContent=t;s.onclick=fn;box.appendChild(s);}
const io=new IntersectionObserver(es=>es.forEach(async e=>{
  if(!e.isIntersecting)return;io.unobserve(e.target);
  const t=e.target;let u=t.dataset.p?await photoUrl(t.dataset.p):'';
  if(!u&&t.dataset.z)u=await zipPhoto(t.dataset.z);
  if(!u&&t.dataset.v)u=await vecFolder(t.dataset.v);
  if(t.__h&&!u)u=await vecFile(t.__h);
  if(u){t.textContent='';t.style.background='url("'+u+'") center/cover no-repeat';}
}),{rootMargin:'200px'});
const EM={'Arredo':'🪑','Luci':'💡','Scatole e contenitori':'📦','Casa e cucina':'🏠','Giochi e giocattoli':'🧩','Animali e sculture':'🦌','Decorazioni':'✨','Feste':'🎄','Giardino ed esterno':'🌿','Architettura e modelli':'🏛️','Meccanica e modelli':'⚙️','Religione':'✝️','Varie':'🔧'};
function ph(t,mac,title){
  let h=0;for(const c of (mac||'')+title)h=(h*31+c.charCodeAt(0))%360;
  t.style.background='linear-gradient(135deg,hsl('+h+',55%,82%),hsl('+((h+40)%360)+',55%,70%))';
  t.style.flexDirection='column';t.style.gap='4px';t.style.color='#fff';
  t.textContent='';
  const e=document.createElement('div');e.textContent=EM[mac]||'📁';e.style.fontSize='40px';
  const l=document.createElement('div');l.textContent='anteprima non disponibile';l.style.cssText='font-size:10px;color:#5a4a3a;opacity:.8';
  t.appendChild(e);t.appendChild(l);
}
function card(g,th,title,sub,fe,click,mac,z,v){
  const c=document.createElement('div');c.className='cc';
  const t=document.createElement('div');t.className='th';if(th){t.textContent='📁';t.dataset.p=th;}else ph(t,mac,title);
  if(z&&/\.zip$/i.test(z))t.dataset.z=z;
  if(v)t.dataset.v=v;
  if(th||t.dataset.z||v)io.observe(t);
  const x=document.createElement('div');x.className='tx';
  const b=document.createElement('b');b.textContent=title;x.appendChild(b);
  const s=document.createElement('small');s.textContent=sub;x.appendChild(s);
  if(fe!==undefined&&fe!==null){const p=document.createElement('span');p.className='pill '+FC[fe];p.style.marginTop='4px';p.textContent=FE[fe];x.appendChild(p);}
  c.appendChild(t);c.appendChild(x);c.onclick=click;g.appendChild(c);
}
function draw(append){
  const g=$('catG');if(!append)g.innerHTML='';
  let list=[];
  if(st.view==='prog'){
    list=DB.items.filter(i=>(!st.mac||i[3]===st.mac)&&(st.fe===''||String(i[8])===st.fe)&&(!st.q||(i[1]+' '+i[2]+' '+i[4]).toLowerCase().includes(st.q)));
    const from=append?g.children.length:0;
    list.slice(from,st.n).forEach(i=>card(g,i[6],i[1],i[4],i[8],()=>detail(i),i[3],i[5],(!i[6]&&!/\.zip$/i.test(i[5]))?i[5]:''));
  }else if(st.view==='raw'){
    list=DB.raw.filter(r=>!st.q||(r[1]+' '+r[2]).toLowerCase().includes(st.q));
    const from=append?g.children.length:0;
    list.slice(from,st.n).forEach(r=>card(g,'',r[1],r[4].categorie?r[3]+' categorie':r[3]+' file ('+Object.keys(r[4]).join(', ')+')',r[5],()=>detailRaw(r),undefined,undefined,r[0]));
  }else{
    list=DB.eng.filter(r=>!st.q||r[0].toLowerCase().includes(st.q));
    const from=append?g.children.length:0;
    list.slice(from,st.n).forEach(r=>card(g,r[3]?r[1]+'/'+r[3]:'',r[0],r[2]+' immagini',null,()=>engFolder(r)));
  }
  $('catInfo').textContent=list.length+' risultati'+(st.view==='prog'?' · la fattibilità sull\'S9 è una stima (potenza 5,5 W, area circa 410×400 mm, compensato fino a 3 mm; 4-6 mm al limite).':'');
  $('catMore').hidden=g.children.length>=list.length;
}

/* ---- dettaglio ---- */
function sheet(){
  let d=$('catDet');if(d)d.remove();
  d=document.createElement('div');d.id='catDet';
  const b=document.createElement('div');b.className='box';d.appendChild(b);
  d.onclick=e=>{if(e.target===d)d.remove();};
  document.body.appendChild(d);return b;
}
function line(b,tag,txt,cls){const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=txt;b.appendChild(e);return e;}
async function detail(i){
  const b=sheet(),[id,it,orig,mac,sub,path,ph,fm,fe,why]=i;
  if(ph){const im=document.createElement('img');im.alt=it;b.appendChild(im);photoUrl(ph).then(u=>{if(u)im.src=u;else im.remove();});}
  else{const t=document.createElement('div');t.className='th';t.style.cssText='height:160px;border-radius:10px;margin-bottom:10px;display:flex;align-items:center;justify-content:center';window.__ph(t,mac,it);b.appendChild(t);
    if(/\.zip$/i.test(path))zipPhoto(path).then(u=>{if(u){t.textContent='';t.style.height='';t.style.background='url("'+u+'") center/contain no-repeat #f3ebe0';t.style.height='260px';}});}
  line(b,'h3',it).style.margin='0 0 4px';
  if(orig&&orig!==it)line(b,'div','Nome originale: '+orig,'hint');
  line(b,'div',mac+' › '+sub,'hint');
  const p=line(b,'span',FE[fe]+' sull\'S9 (stima)','pill '+FC[fe]);p.style.margin='8px 0';
  if(why)line(b,'div',why,'hint');
  line(b,'div','Codice '+id+' · formati: '+fm.join(', '),'hint');
  const r=document.createElement('div');r.className='row';r.style.marginTop='12px';b.appendChild(r);
  const zip=/\.zip$/i.test(path),can=zip||fm.includes('svg')||fm.includes('dxf')||fm.includes('eps')||fm.includes('ai');
  const go=document.createElement('button');go.className='btn primary big';go.textContent=zip?'Apri e taglia':'Apri nel taglio';go.disabled=!can;
  go.onclick=async()=>{
    try{
      let f;
      if(zip)f=await fileAt(path);
      else{
        const d=await dirAt(path.split('/')),it2=[];for await(const e of d.values())if(/\.(svg|dxf|eps|ai)$/i.test(e.name))it2.push(e);
        const rk=n=>/\.svg$/i.test(n)?3:/\.dxf$/i.test(n)?2:/\.eps$/i.test(n)?1:0;
        it2.sort((a,b)=>rk(b.name)-rk(a.name));
        f=await it2[0].getFile();
      }
      $('catDet').remove();$('catOv').hidden=true;document.body.style.overflow='';
      if(window.setMode)setMode('taglia');
      if(window.setProj)setProj('file');
      const w=()=>window.Proj&&Proj.openFile?Proj.openFile(f):setTimeout(w,200);w();
      setTimeout(()=>{const e=$('s2t');if(e)e.scrollIntoView({behavior:'smooth'});},300);
    }catch(e){alert('Non riesco ad aprirlo: '+(e.message||e));}
  };
  r.appendChild(go);
  const x=document.createElement('button');x.className='btn';x.textContent='Chiudi';x.onclick=()=>$('catDet').remove();r.appendChild(x);
  if(!can)line(b,'p','Questo progetto è in formato '+fm.filter(f=>f!=='jpg'&&f!=='png').join('/').toUpperCase()+': laserBrio non lo sa aprire (legge SVG, DXF, EPS e AI).','hint');
  else if(zip)line(b,'p','Se lo zip contiene più spessori (3, 4, 6 mm) apro il 3 mm: gli altri sono nell\'elenco.','hint');
}
async function openFileHandle(f){
  $('catDet')&&$('catDet').remove();$('catOv').hidden=true;document.body.style.overflow='';
  if(window.setMode)setMode('taglia');
  if(window.setProj)setProj('file');
  const w=()=>window.Proj&&Proj.openFile?Proj.openFile(f):setTimeout(w,200);w();
  setTimeout(()=>{const e=$('s2t');if(e)e.scrollIntoView({behavior:'smooth'});},300);
}
async function browse(rel,title){
  const b=sheet();
  line(b,'h3',title).style.margin='0 0 2px';
  line(b,'div','Cartella: '+rel+' · si aprono SVG, DXF, EPS e AI (il CDR no).','hint');
  const q=document.createElement('input');q.type='text';q.placeholder='Cerca nel nome';q.style.margin='8px 0';b.appendChild(q);
  const list=document.createElement('div');b.appendChild(list);
  let dirs=[],files=[];
  try{const d=await dirAt(rel.split('/'));for await(const e of d.values()){if(e.kind==='directory')dirs.push(e);else files.push(e);}}
  catch(e){line(b,'p','Cartella non trovata.','hint');}
  dirs.sort((a,b)=>a.name.localeCompare(b.name));files.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  const show=()=>{
    const t=q.value.trim().toLowerCase();list.innerHTML='';let n=0;
    const row=(txt,ok,fn,h)=>{const d=document.createElement('div');d.style.cssText='padding:8px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;'+(ok?'cursor:pointer;font-weight:600':'color:var(--mute)');
      const th=document.createElement('div');th.style.cssText='flex:0 0 56px;height:56px;border-radius:8px;background:var(--soft) center/contain no-repeat;display:flex;align-items:center;justify-content:center;font-size:22px';
      if(h){th.__h=h;th.textContent='📐';io.observe(th);}else th.textContent=txt.startsWith('📁')?'📁':'·';
      const s=document.createElement('span');s.textContent=txt.replace(/^📁 |^📐 /,'');s.style.cssText='word-break:break-word';
      d.appendChild(th);d.appendChild(s);if(ok)d.onclick=fn;list.appendChild(d);};
    for(const d of dirs){if(t&&!d.name.toLowerCase().includes(t))continue;if(n++>=300)break;row('📁 '+d.name,true,()=>browse(rel+'/'+d.name,d.name));}
    for(const f of files){
      if(t&&!f.name.toLowerCase().includes(t))continue;if(n++>=300)break;
      const ok=/\.(svg|dxf|eps|ai)$/i.test(f.name);
      row((ok?'📐 ':'')+f.name,ok,async()=>{try{openFileHandle(await f.getFile());}catch(e){alert('Non riesco ad aprirlo: '+(e.message||e));}},ok?f:null);
    }
    if(n>=300)line(list,'div','Elenco troncato a 300: scrivi nel filtro per restringere.','hint');
    if(!n)line(list,'div','Niente qui.','hint');
  };
  q.oninput=show;show();
  const x=document.createElement('button');x.className='btn';x.style.marginTop='12px';x.textContent='Chiudi';x.onclick=()=>$('catDet').remove();b.appendChild(x);
}
function detailRaw(r){
  const b=sheet();
  line(b,'h3',r[1]).style.margin='0 0 4px';
  line(b,'div',r[2]+' · cartella "'+r[0]+'"','hint');
  const p=line(b,'span',FE[r[5]]+' sull\'S9 (stima)','pill '+FC[r[5]]);p.style.margin='8px 0';
  line(b,'div',r[6],'hint');
  if(r[4].categorie)line(b,'div',r[3]+' categorie: apri la cartella e scegli (formati EPS, AI, DXF).','hint');else line(b,'div',r[3]+' file, formati: '+Object.entries(r[4]).map(([k,v])=>k.toUpperCase()+' '+v).join(', ')+' (senza foto di anteprima)','hint');
  const go=document.createElement('button');go.className='btn primary big';go.style.marginTop='12px';go.style.marginRight='8px';go.textContent='Sfoglia la cartella';go.onclick=()=>browse(r[0],r[1]);b.appendChild(go);
  const x=document.createElement('button');x.className='btn';x.style.marginTop='12px';x.textContent='Chiudi';x.onclick=()=>$('catDet').remove();b.appendChild(x);
}
async function engFolder(r){
  const b=sheet();
  line(b,'h3',r[0]).style.margin='0 0 4px';
  line(b,'div','Tocca un\'immagine per incidere.','hint');
  const g=document.createElement('div');g.className='cgrid';g.style.gridTemplateColumns='repeat(auto-fill,minmax(96px,1fr))';b.appendChild(g);
  const x=document.createElement('button');x.className='btn';x.style.marginTop='12px';x.textContent='Chiudi';x.onclick=()=>$('catDet').remove();
  let names=[];try{const d=await dirAt(r[1].split('/'));for await(const e of d.values())if(/\.(jpg|png)$/i.test(e.name))names.push(e.name);}catch(e){line(b,'p','Cartella non trovata.','hint');}
  names.sort();let n=0;
  const more=document.createElement('button');more.className='btn';more.textContent='Mostra altre';more.style.marginTop='10px';
  const add=()=>{names.slice(n,n+60).forEach(nm=>{
    const c=document.createElement('div');c.className='cc';const t=document.createElement('div');t.className='th';t.dataset.p=r[1]+'/'+nm;io.observe(t);
    c.appendChild(t);c.onclick=async()=>{
      const f=await fileAt(r[1]+'/'+nm);$('catDet').remove();$('catOv').hidden=true;document.body.style.overflow='';
      if(window.setMode)setMode('incidi');
      if(window.loadFile)loadFile(f);
      window.scrollTo({top:0,behavior:'smooth'});
    };g.appendChild(c);});n+=60;more.hidden=n>=names.length;};
  more.onclick=add;b.appendChild(more);b.appendChild(x);add();
}
window.__ph=ph;window.Cat={open};
})();
