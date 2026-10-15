/* laserBrio · apri un progetto da file: zip (anche enormi, anche con zip dentro) e SVG → tagli pronti */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const P={stack:[],cur:null,svg:null,sel:null,list:[],photo:null,name:'',err:''};
const CACHE={};

/* ---------- zip (legge solo l'indice e il file scelto: va bene anche per zip da molti GB) ---------- */
const u16=(d,o)=>d.getUint16(o,true),u32=(d,o)=>d.getUint32(o,true),u64=(d,o)=>Number(d.getBigUint64(o,true));
async function blobBytes(b,s,e){return new Uint8Array(await b.slice(s,e).arrayBuffer());}
async function readZip(blob){
  const size=blob.size,tail=await blobBytes(blob,Math.max(0,size-70000),size),td=new DataView(tail.buffer);
  let e=-1;for(let i=tail.length-22;i>=0;i--){if(u32(td,i)===0x06054b50){e=i;break;}}
  if(e<0)throw new Error('Questo file non sembra uno zip.');
  let n=u16(td,e+10),csz=u32(td,e+12),coff=u32(td,e+16);
  if(n===0xFFFF||coff===0xFFFFFFFF||csz===0xFFFFFFFF){
    const lp=e-20;
    if(lp>=0&&u32(td,lp)===0x07064b50){
      const eo=u64(td,lp+8),h=await blobBytes(blob,eo,eo+56),hd=new DataView(h.buffer);
      n=u64(hd,32);csz=u64(hd,40);coff=u64(hd,48);
    }
  }
  const cd=await blobBytes(blob,coff,coff+csz),dv=new DataView(cd.buffer),dec=new TextDecoder('utf-8'),out=[];
  let o=0;
  for(let k=0;k<n&&o+46<=cd.length;k++){
    if(u32(dv,o)!==0x02014b50)break;
    const meth=u16(dv,o+10);let cs=u32(dv,o+20),us=u32(dv,o+24);
    const nl=u16(dv,o+28),xl=u16(dv,o+30),cl=u16(dv,o+32);let lo=u32(dv,o+42);
    const name=dec.decode(cd.subarray(o+46,o+46+nl));
    if(us===0xFFFFFFFF||cs===0xFFFFFFFF||lo===0xFFFFFFFF){
      let x=o+46+nl;const xe=x+xl;
      while(x+4<=xe){
        const id=u16(dv,x),sz=u16(dv,x+2);
        if(id===1){let p=x+4;if(us===0xFFFFFFFF){us=u64(dv,p);p+=8;}if(cs===0xFFFFFFFF){cs=u64(dv,p);p+=8;}if(lo===0xFFFFFFFF){lo=u64(dv,p);}}
        x+=4+sz;
      }
    }
    if(!name.endsWith('/'))out.push({name,meth,cs,us,lo});
    o+=46+nl+xl+cl;
  }
  return out;
}
async function inflateRaw(u8){
  const r=new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
  return new Uint8Array(await r.arrayBuffer());
}
async function unzipEntry(blob,en){
  const h=await blobBytes(blob,en.lo,en.lo+30),hd=new DataView(h.buffer);
  const s=en.lo+30+u16(hd,26)+u16(hd,28),data=await blobBytes(blob,s,s+en.cs);
  if(en.meth===0)return data;
  if(en.meth===8)return inflateRaw(data);
  throw new Error('Compressione dello zip non supportata.');
}

/* ---------- matematica ---------- */
const mul=(m,n)=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
const app=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function parseTransform(t){
  let m=[1,0,0,1,0,0];if(!t)return m;
  for(const mt of t.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)){
    const a=mt[2].split(/[\s,]+/).filter(Boolean).map(Number);let n=[1,0,0,1,0,0];
    switch(mt[1]){
      case 'matrix':n=a.slice(0,6);break;
      case 'translate':n=[1,0,0,1,a[0]||0,a[1]||0];break;
      case 'scale':n=[a[0],0,0,a.length>1?a[1]:a[0],0,0];break;
      case 'rotate':{const r=(a[0]||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);n=[c,s,-s,c,0,0];
        if(a.length>2)n=mul(mul([1,0,0,1,a[1],a[2]],n),[1,0,0,1,-a[1],-a[2]]);break;}
      case 'skewX':n=[1,0,Math.tan((a[0]||0)*Math.PI/180),1,0,0];break;
      case 'skewY':n=[1,Math.tan((a[0]||0)*Math.PI/180),0,1,0,0];break;
    }
    if(n.length===6&&n.every(isFinite))m=mul(m,n);
  }
  return m;
}
function arcToBez(x1,y1,rx,ry,phi,fa,fs,x2,y2){
  if(rx===0||ry===0||(x1===x2&&y1===y2))return [['L',x2,y2]];
  rx=Math.abs(rx);ry=Math.abs(ry);
  const p=phi*Math.PI/180,c=Math.cos(p),s=Math.sin(p),dx=(x1-x2)/2,dy=(y1-y2)/2;
  const x1p=c*dx+s*dy,y1p=-s*dx+c*dy;
  const lam=x1p*x1p/(rx*rx)+y1p*y1p/(ry*ry);
  if(lam>1){const q=Math.sqrt(lam);rx*=q;ry*=q;}
  const num=rx*rx*ry*ry-rx*rx*y1p*y1p-ry*ry*x1p*x1p,den=rx*rx*y1p*y1p+ry*ry*x1p*x1p;
  let co=Math.sqrt(Math.max(0,num/den));if(fa===fs)co=-co;
  const cxp=co*rx*y1p/ry,cyp=-co*ry*x1p/rx,cx=c*cxp-s*cyp+(x1+x2)/2,cy=s*cxp+c*cyp+(y1+y2)/2;
  const ang=(ux,uy,vx,vy)=>{const a=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);return a;};
  const t1=ang(1,0,(x1p-cxp)/rx,(y1p-cyp)/ry);let dt=ang((x1p-cxp)/rx,(y1p-cyp)/ry,(-x1p-cxp)/rx,(-y1p-cyp)/ry);
  if(!fs&&dt>0)dt-=2*Math.PI;else if(fs&&dt<0)dt+=2*Math.PI;
  const n=Math.max(1,Math.ceil(Math.abs(dt)/(Math.PI/2))),d=dt/n,k=4/3*Math.tan(d/4),out=[];
  let t=t1;
  for(let i=0;i<n;i++){
    const ct=Math.cos(t),st=Math.sin(t),ce=Math.cos(t+d),se=Math.sin(t+d);
    const e1x=ct-k*st,e1y=st+k*ct,e2x=ce+k*se,e2y=se-k*ce;
    const f=(x,y)=>[c*rx*x-s*ry*y+cx,s*rx*x+c*ry*y+cy];
    const a=f(e1x,e1y),b=f(e2x,e2y),e=f(ce,se);
    out.push(['C',a[0],a[1],b[0],b[1],e[0],e[1]]);t+=d;
  }
  return out;
}
/* d="..." → sottopercorsi di segmenti assoluti in coordinate utente */
function parseD(d){
  const toks=d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)||[];
  const subs=[];let cur=null,i=0,cmd='',x=0,y=0,sx=0,sy=0,lcx=0,lcy=0,lq=null,lc=null;
  const num=()=>Number(toks[i++]);
  const isCmd=t=>/^[a-zA-Z]$/.test(t);
  const start=(px,py)=>{cur={segs:[],closed:false,x0:px,y0:py};subs.push(cur);};
  while(i<toks.length){
    if(isCmd(toks[i]))cmd=toks[i++];else if(!cmd)break;
    const rel=cmd===cmd.toLowerCase(),C=cmd.toUpperCase();
    if(C==='Z'){if(cur){cur.closed=true;x=sx;y=sy;}lq=lc=null;continue;}
    if(C==='M'){
      let nx=num(),ny=num();if(rel){nx+=x;ny+=y;}
      x=sx=nx;y=sy=ny;start(x,y);cmd=rel?'l':'L';lq=lc=null;continue;
    }
    if(!cur)start(x,y);
    if(cur.closed){start(x,y);}
    if(C==='L'){let nx=num(),ny=num();if(rel){nx+=x;ny+=y;}cur.segs.push(['L',nx,ny]);x=nx;y=ny;lq=lc=null;}
    else if(C==='H'){let nx=num();if(rel)nx+=x;cur.segs.push(['L',nx,y]);x=nx;lq=lc=null;}
    else if(C==='V'){let ny=num();if(rel)ny+=y;cur.segs.push(['L',x,ny]);y=ny;lq=lc=null;}
    else if(C==='C'){let a=num(),b=num(),c2=num(),e=num(),nx=num(),ny=num();if(rel){a+=x;b+=y;c2+=x;e+=y;nx+=x;ny+=y;}cur.segs.push(['C',a,b,c2,e,nx,ny]);lc=[c2,e];lq=null;x=nx;y=ny;}
    else if(C==='S'){let c2=num(),e=num(),nx=num(),ny=num();if(rel){c2+=x;e+=y;nx+=x;ny+=y;}const a=lc?2*x-lc[0]:x,b=lc?2*y-lc[1]:y;cur.segs.push(['C',a,b,c2,e,nx,ny]);lc=[c2,e];lq=null;x=nx;y=ny;}
    else if(C==='Q'){let a=num(),b=num(),nx=num(),ny=num();if(rel){a+=x;b+=y;nx+=x;ny+=y;}cur.segs.push(['Q',a,b,nx,ny]);lq=[a,b];lc=null;x=nx;y=ny;}
    else if(C==='T'){let nx=num(),ny=num();if(rel){nx+=x;ny+=y;}const a=lq?2*x-lq[0]:x,b=lq?2*y-lq[1]:y;cur.segs.push(['Q',a,b,nx,ny]);lq=[a,b];lc=null;x=nx;y=ny;}
    else if(C==='A'){const rx=num(),ry=num(),ph=num(),fa=num(),fs=num();let nx=num(),ny=num();if(rel){nx+=x;ny+=y;}
      for(const s of arcToBez(x,y,rx,ry,ph,!!fa,!!fs,nx,ny))cur.segs.push(s);x=nx;y=ny;lq=lc=null;}
    else break;
    if(!isFinite(x)||!isFinite(y))break;
  }
  return subs;
}
/* applica la matrice e trasforma le curve in punti (in mm) */
function flatten(sub,m){
  const pts=[],push=(x,y)=>{const q=app(m,x,y),l=pts[pts.length-1];if(!l||Math.abs(l[0]-q[0])>1e-4||Math.abs(l[1]-q[1])>1e-4)pts.push(q);};
  push(sub.x0,sub.y0);let px=sub.x0,py=sub.y0;
  for(const s of sub.segs){
    if(s[0]==='L'){push(s[1],s[2]);px=s[1];py=s[2];}
    else{
      const P0=app(m,px,py);let c1,c2,e;
      if(s[0]==='C'){c1=app(m,s[1],s[2]);c2=app(m,s[3],s[4]);e=app(m,s[5],s[6]);px=s[5];py=s[6];}
      else{const q=app(m,s[1],s[2]);e=app(m,s[3],s[4]);c1=[P0[0]+2/3*(q[0]-P0[0]),P0[1]+2/3*(q[1]-P0[1])];c2=[e[0]+2/3*(q[0]-e[0]),e[1]+2/3*(q[1]-e[1])];px=s[3];py=s[4];}
      const L=Math.hypot(c1[0]-P0[0],c1[1]-P0[1])+Math.hypot(c2[0]-c1[0],c2[1]-c1[1])+Math.hypot(e[0]-c2[0],e[1]-c2[1]);
      const n=Math.max(3,Math.min(64,Math.ceil(L/0.6)));
      for(let k=1;k<=n;k++){const t=k/n,u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;
        pts.push([a*P0[0]+b*c1[0]+c*c2[0]+d*e[0],a*P0[1]+b*c1[1]+c*c2[1]+d*e[1]]);}
    }
  }
  return pts;
}

/* ---------- SVG ---------- */
function parseDecl(t){const o={};for(const p of (t||'').split(';')){const i=p.indexOf(':');if(i>0)o[p.slice(0,i).trim()]=p.slice(i+1).trim();}return o;}
function unitMm(v){
  if(!v)return null;const m=String(v).trim().match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)\s*(mm|cm|in|pt|pc|px|)?$/i);
  if(!m)return null;const n=Number(m[1]);
  switch((m[2]||'px').toLowerCase()){case 'mm':return n;case 'cm':return n*10;case 'in':return n*25.4;case 'pt':return n*25.4/72;case 'pc':return n*25.4/6;default:return n*25.4/96;}
}
function parseSvg(text){
  const doc=new DOMParser().parseFromString(text,'image/svg+xml');
  const svg=doc.documentElement;
  if(!svg||svg.nodeName.toLowerCase()!=='svg'||doc.querySelector('parsererror'))throw new Error('Il file SVG non si legge.');
  const css={};
  for(const st of doc.querySelectorAll('style')){
    for(const m of st.textContent.matchAll(/([^{}]+)\{([^}]*)\}/g)){
      const dec=parseDecl(m[2]);
      for(const sel of m[1].split(',')){const s=sel.trim();if(/^\.[\w-]+$/.test(s))css[s.slice(1)]=Object.assign(css[s.slice(1)]||{},dec);}
    }
  }
  const vbA=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
  const wmm=unitMm(svg.getAttribute('width')),hmm=unitMm(svg.getAttribute('height'));
  let vb=vbA.length===4&&vbA.every(isFinite)?vbA:null,sx,sy;
  if(vb){sx=wmm?wmm/vb[2]:25.4/96;sy=hmm?hmm/vb[3]:sx;}
  else{vb=[0,0,(wmm||210)*96/25.4,(hmm||297)*96/25.4];sx=sy=25.4/96;}
  const base=[sx,0,0,sy,-vb[0]*sx,-vb[1]*sy];
  const subs=[];
  const SKIP=new Set(['defs','clippath','mask','symbol','metadata','title','desc','style','script','pattern','marker','image','text','foreignobject']);
  function styleOf(el,par){
    const s=Object.assign({},par);
    const set=o=>{for(const k of ['stroke','fill','display','visibility','stroke-width']){if(o[k]!==undefined)s[k]=o[k];}};
    const at={};for(const k of ['stroke','fill','display','visibility','stroke-width']){const v=el.getAttribute(k);if(v!==null)at[k]=v;}
    set(at);
    for(const c of (el.getAttribute('class')||'').split(/\s+/))if(css[c])set(css[c]);
    set(parseDecl(el.getAttribute('style')));
    return s;
  }
  function shapeD(el){
    const g=n=>Number(el.getAttribute(n))||0,t=el.nodeName.toLowerCase();
    if(t==='path')return el.getAttribute('d')||'';
    if(t==='line')return 'M'+g('x1')+' '+g('y1')+'L'+g('x2')+' '+g('y2');
    if(t==='polyline'||t==='polygon'){const a=(el.getAttribute('points')||'').trim().split(/[\s,]+/).map(Number);if(a.length<4)return '';let d='M'+a[0]+' '+a[1];for(let i=2;i+1<a.length;i+=2)d+='L'+a[i]+' '+a[i+1];return d+(t==='polygon'?'Z':'');}
    if(t==='rect'){const x=g('x'),y=g('y'),w=g('width'),h=g('height');let rx=g('rx'),ry=g('ry');if(!rx&&ry)rx=ry;if(!ry&&rx)ry=rx;rx=Math.min(rx,w/2);ry=Math.min(ry,h/2);
      if(!(w>0&&h>0))return '';
      if(!rx)return 'M'+x+' '+y+'h'+w+'v'+h+'h'+(-w)+'Z';
      return 'M'+(x+rx)+' '+y+'h'+(w-2*rx)+'a'+rx+' '+ry+' 0 0 1 '+rx+' '+ry+'v'+(h-2*ry)+'a'+rx+' '+ry+' 0 0 1 '+(-rx)+' '+ry+'h'+(-(w-2*rx))+'a'+rx+' '+ry+' 0 0 1 '+(-rx)+' '+(-ry)+'v'+(-(h-2*ry))+'a'+rx+' '+ry+' 0 0 1 '+rx+' '+(-ry)+'Z';}
    if(t==='circle'||t==='ellipse'){const cx=g('cx'),cy=g('cy'),rx=t==='circle'?g('r'):g('rx'),ry=t==='circle'?g('r'):g('ry');if(!(rx>0&&ry>0))return '';
      return 'M'+(cx+rx)+' '+cy+'A'+rx+' '+ry+' 0 1 1 '+(cx-rx)+' '+cy+'A'+rx+' '+ry+' 0 1 1 '+(cx+rx)+' '+cy+'Z';}
    return '';
  }
  function walk(el,m,par){
    for(const ch of el.children){
      const t=ch.nodeName.toLowerCase();if(SKIP.has(t))continue;
      const st=styleOf(ch,par);if(st.display==='none'||st.visibility==='hidden')continue;
      const mm=mul(m,parseTransform(ch.getAttribute('transform')));
      if(t==='g'||t==='a'||t==='svg'){walk(ch,mm,st);continue;}
      const d=shapeD(ch);if(!d)continue;
      const stroke=st.stroke&&st.stroke!=='none'?st.stroke.toLowerCase():null,fill=st.fill===undefined?'#000':st.fill;
      const key=stroke?stroke:(fill&&fill!=='none'?'riempimento '+fill.toLowerCase():null);
      if(!key)continue;
      for(const sub of parseD(d)){
        if(!sub.segs.length)continue;
        const pts=flatten(sub,mm);if(pts.length<2)continue;
        let closed=sub.closed;
        if(!closed&&pts.length>2&&Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<0.02){closed=true;}
        if(closed&&pts.length>2&&Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<0.02)pts.pop();
        if(closed&&pts.length<3)continue;
        subs.push({pts,closed,key});
      }
    }
  }
  walk(svg,base,{stroke:undefined,fill:'#000'});
  const sheetW=vb[2]*sx,sheetH=vb[3]*sy;
  const layers={};
  for(const s of subs){
    let l=layers[s.key];if(!l)l=layers[s.key]={key:s.key,n:0,len:0};
    l.n++;for(let i=1;i<s.pts.length;i++)l.len+=Math.hypot(s.pts[i][0]-s.pts[i-1][0],s.pts[i][1]-s.pts[i-1][1]);
  }
  return {subs,layers,sheetW,sheetH};
}

/* ---------- dai tratti al piano di taglio ---------- */
function bboxOf(pts){let a=1e18,b=1e18,c=-1e18,d=-1e18;for(const p of pts){if(p[0]<a)a=p[0];if(p[0]>c)c=p[0];if(p[1]<b)b=p[1];if(p[1]>d)d=p[1];}return {minx:a,miny:b,maxx:c,maxy:d};}
function area2(pts){let s=0;for(let i=0,n=pts.length;i<n;i++){const a=pts[i],b=pts[(i+1)%n];s+=a[0]*b[1]-b[0]*a[1];}return s/2;}
function inside(pt,poly){
  let c=false;const x=pt[0],y=pt[1];
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;
  }
  return c;
}
function build(area){
  if(!P.svg)return {error:P.err||'Scegli uno zip o un file SVG con il pulsante qui sopra.'};
  const sc=(Number($('impScale').value)||100)/100,strip=$('impOut').checked;
  const keys=P.sel,list=[];
  for(const s of P.svg.subs){
    if(!keys.has(s.key))continue;
    if(strip){const b=bboxOf(s.pts);if(b.maxx<0||b.maxy<0||b.minx>P.svg.sheetW||b.miny>P.svg.sheetH)continue;}
    list.push(s);
  }
  if(!list.length)return {error:'Nessun tratto selezionato: accendi almeno un colore nell\'elenco qui sopra.'};
  let all=[];for(const s of list)for(const p of s.pts)all.push(p);
  const bb=bboxOf(all),w=(bb.maxx-bb.minx)*sc,h=(bb.maxy-bb.miny)*sc,m=3;
  if(!(w>0&&h>0))return {error:'Il disegno non ha dimensioni.'};
  if(w+2*m>area.w||h+2*m>area.h)return {error:'Il progetto misura '+Math.round(w)+' × '+Math.round(h)+' mm e non sta nell\'area di lavoro ('+Math.round(area.w)+' × '+Math.round(area.h)+' mm). Riduci la scala, oppure spegni i colori che sono cornici o fogli.'};
  const paths=list.map(s=>{
    const pts=s.pts.map(q=>[(q[0]-bb.minx)*sc+m,(bb.maxy-q[1])*sc+m]);   // SVG ha la Y verso il basso: la giro
    return {pts,closed:s.closed};
  });
  // fori = tratti chiusi dentro un altro tratto chiuso (profondità dispari)
  const closed=paths.filter(p=>p.closed);
  if(closed.length<=2500){
    for(const p of closed){p.a=Math.abs(area2(p.pts));p.b=bboxOf(p.pts);}
    for(const p of closed){
      let depth=0;const t=p.pts[0];
      for(const q of closed){
        if(q===p||q.a<=p.a)continue;
        if(t[0]<q.b.minx||t[0]>q.b.maxx||t[1]<q.b.miny||t[1]>q.b.maxy)continue;
        if(inside(t,q.pts))depth++;
      }
      p.hole=depth%2===1;
    }
  }
  const holes=[],outers=[],item={name:P.name||'progetto',tag:'file',x:m,y:m,w:w,h:h,paths:[]};
  for(const p of paths){
    const pts=p.pts;if(!p.closed)pts.open=true;
    item.paths.push({hole:!!p.hole,open:!p.closed,pts:pts});
    (p.hole||!p.closed?holes:outers).push(pts);
  }
  item.paths.sort((a,b)=>(a.open?2:a.hole?1:0)-(b.open?2:b.hole?1:0));
  const sheet={items:[item],cutPaths:holes.concat(outers),w:w+2*m,h:h+2*m};
  return {sheets:[sheet],hardware:[],steps:[],imported:{n:paths.length,holes:holes.length,w:w,h:h}};
}

/* ---------- interfaccia ---------- */
const redraw=()=>{if(window.__projChanged)window.__projChanged();};
function msg(t,bad){const m=$('impMsg');m.textContent=t||'';m.style.color=bad?'var(--bad)':'var(--mute)';}
function fillLayers(){
  const box=$('impLayers');box.innerHTML='';
  const L=Object.values(P.svg.layers).sort((a,b)=>b.len-a.len);
  P.sel=new Set(L.map(l=>l.key));
  for(const l of L){
    const lab=document.createElement('label');lab.className='chk';lab.style.marginRight='14px';
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;
    cb.onchange=()=>{if(cb.checked)P.sel.add(l.key);else P.sel.delete(l.key);redraw();};
    lab.appendChild(cb);
    const sw=document.createElement('span');sw.style.cssText='display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid #888;background:'+(/^#|^rgb/.test(l.key)?l.key:'#ddd');
    lab.appendChild(sw);
    lab.appendChild(document.createTextNode(' '+l.key.replace('riempimento ','solo riempimento ')+' · '+l.n+' tratti'));
    box.appendChild(lab);
  }
}
async function useSvgText(text,name){
  P.svg=null;
  try{
    P.svg=parseSvg(text);P.name=name.replace(/\.svg$/i,'').replace(/^.*[\\/]/,'');
    if(!P.svg.subs.length)throw new Error('In questo SVG non ci sono linee da tagliare.');
    P.err='';fillLayers();
    const b=P.svg;msg('Caricato: '+P.name+'. Foglio del file '+Math.round(b.sheetW)+' × '+Math.round(b.sheetH)+' mm, '+b.subs.length+' tratti.');
  }catch(e){P.svg=null;P.err=e.message;msg(e.message,true);}
  redraw();
}
function showList(){
  const q=($('impFilter').value||'').toLowerCase(),sel=$('impList');sel.innerHTML='';
  const cur=P.cur;if(!cur){return;}
  let shown=0,total=0;
  if(P.stack.length>1){const o=document.createElement('option');o.value='..';o.textContent='⬆ Torna indietro';sel.appendChild(o);}
  for(let i=0;i<cur.entries.length;i++){
    const e=cur.entries[i],n=e.name.toLowerCase();
    if(!(n.endsWith('.svg')||n.endsWith('.zip')))continue;
    total++;
    if(q&&!n.includes(q))continue;
    if(shown>=300)continue;shown++;
    const o=document.createElement('option');o.value=String(i);o.textContent=(n.endsWith('.zip')?'📦 ':'')+e.name+(e.us>1048576?' ('+(e.us/1048576).toFixed(0)+' MB)':'');sel.appendChild(o);
  }
  $('impCount').textContent=total?(shown+' di '+total+(shown<total?' (scrivi nel filtro per restringere)':'')):'Nessun file SVG o zip qui dentro.';
  // preferisci subito la prima foto
}
async function loadPhoto(){
  const img=$('impPhoto');img.hidden=true;
  if(P.photo){URL.revokeObjectURL(P.photo);P.photo=null;}
  const cur=P.cur;if(!cur)return;
  const e=cur.entries.find(x=>/\.(jpe?g|png)$/i.test(x.name)&&x.us<6e6);
  if(!e)return;
  try{const b=await unzipEntry(cur.blob,e);P.photo=URL.createObjectURL(new Blob([b],{type:/png$/i.test(e.name)?'image/png':'image/jpeg'}));img.src=P.photo;img.hidden=false;}catch(_){}
}
async function openZip(blob,label,push){
  msg('Leggo lo zip…');
  try{
    const entries=await readZip(blob);
    const f={blob,entries,label};
    if(push)P.stack.push(f);else P.stack=[f];
    P.cur=f;$('impFilter').value='';showList();loadPhoto();
    const svgs=entries.filter(e=>/\.svg$/i.test(e.name));
    msg(entries.length+' file nello zip, '+svgs.length+' SVG.'+(svgs.length===1?'':' Scegli quello che vuoi dall\'elenco.'));
    if(svgs.length===1){await pick(entries.indexOf(svgs[0]));}
    else if(!svgs.length&&!entries.some(e=>/\.zip$/i.test(e.name)))msg('Questo zip non contiene SVG (solo '+[...new Set(entries.map(e=>e.name.split('.').pop().toLowerCase()))].slice(0,6).join(', ')+'). Per ora laserBrio legge gli SVG.',true);
  }catch(e){msg(e.message||'Non riesco a leggere lo zip.',true);}
}
async function pick(i){
  const cur=P.cur,e=cur.entries[i];if(!e)return;
  try{
    const b=await unzipEntry(cur.blob,e);
    if(/\.zip$/i.test(e.name)){await openZip(new Blob([b]),e.name,true);return;}
    await useSvgText(new TextDecoder('utf-8').decode(b),e.name);
  }catch(err){msg(err.message||'Non riesco ad aprire il file.',true);}
}
function init(){
  $('impFile').onchange=async ev=>{
    const f=ev.target.files[0];if(!f)return;
    if(/\.zip$/i.test(f.name)||f.type==='application/zip')await openZip(f,f.name,false);
    else{P.stack=[];P.cur=null;$('impList').innerHTML='';$('impCount').textContent='';$('impPhoto').hidden=true;await useSvgText(await f.text(),f.name);}
    ev.target.value='';
  };
  $('impList').onchange=async()=>{
    const v=$('impList').value;
    if(v==='..'){P.stack.pop();P.cur=P.stack[P.stack.length-1];showList();loadPhoto();return;}
    if(v!=='')await pick(Number(v));
  };
  $('impFilter').oninput=showList;
  $('impScale').oninput=redraw;$('impOut').onchange=redraw;
  $('impDrop').onclick=()=>$('impFile').click();
}
window.Proj={plan:build,init,_t:{parseSvg,readZip,unzipEntry,parseD,flatten}};
})();
