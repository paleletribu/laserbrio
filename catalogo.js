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
    }catch(_){}
    return u;
  });
  zq=p.catch(()=>{});zc.set(rel,p);return p;
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
function card(g,th,title,sub,fe,click,mac,z){
  const c=document.createElement('div');c.className='cc';
  const t=document.createElement('div');t.className='th';if(th){t.textContent='📁';t.dataset.p=th;}else ph(t,mac,title);
  if(z&&/\.zip$/i.test(z))t.dataset.z=z;
  if(th||t.dataset.z)io.observe(t);
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
    list.slice(from,st.n).forEach(i=>card(g,i[6],i[1],i[4],i[8],()=>detail(i),i[3],i[5]));
  }else if(st.view==='raw'){
    list=DB.raw.filter(r=>!st.q||(r[1]+' '+r[2]).toLowerCase().includes(st.q));
    const from=append?g.children.length:0;
    list.slice(from,st.n).forEach(r=>card(g,'',r[1],r[4].categorie?r[3]+' categorie':r[3]+' file ('+Object.keys(r[4]).join(', ')+')',r[5],()=>detailRaw(r)));
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
    const row=(txt,ok,fn)=>{const d=document.createElement('div');d.textContent=txt;d.style.cssText='padding:10px 8px;border-bottom:1px solid var(--line);'+(ok?'cursor:pointer;font-weight:600':'color:var(--mute)');if(ok)d.onclick=fn;list.appendChild(d);};
    for(const d of dirs){if(t&&!d.name.toLowerCase().includes(t))continue;if(n++>=300)break;row('📁 '+d.name,true,()=>browse(rel+'/'+d.name,d.name));}
    for(const f of files){
      if(t&&!f.name.toLowerCase().includes(t))continue;if(n++>=300)break;
      const ok=/\.(svg|dxf|eps|ai)$/i.test(f.name);
      row((ok?'📐 ':'')+f.name,ok,async()=>{try{openFileHandle(await f.getFile());}catch(e){alert('Non riesco ad aprirlo: '+(e.message||e));}});
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
