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

/* ---------- EPS e AI (PDF): solo i tratti ---------- */
function finishSubs(subs){
  if(!subs.length)throw new Error('In questo file non ci sono linee da tagliare.');
  let a=1e18,b=1e18,c=-1e18,d=-1e18;
  for(const s of subs)for(const p of s.pts){if(p[0]<a)a=p[0];if(p[0]>c)c=p[0];if(p[1]<b)b=p[1];if(p[1]>d)d=p[1];}
  for(const s of subs)s.pts=s.pts.map(p=>[p[0]-a,d-p[1]]);
  const layers={};
  for(const s of subs){let l=layers[s.key];if(!l)l=layers[s.key]={key:s.key,n:0,len:0};l.n++;for(let i=1;i<s.pts.length;i++)l.len+=Math.hypot(s.pts[i][0]-s.pts[i-1][0],s.pts[i][1]-s.pts[i-1][1]);}
  return {subs,layers,sheetW:c-a,sheetH:d-b};
}
function pathOps(tokens,subs,key,useCm){
  const K=25.4/72,NUM=/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
  let st=[],cur=null,cx=0,cy=0,sx=0,sy=0,clip=false;
  let m=[1,0,0,1,0,0];const mst=[];
  const T=(x,y)=>[(m[0]*x+m[2]*y+m[4])*K,(m[1]*x+m[3]*y+m[5])*K];
  const bez=(x1,y1,x2,y2,x3,y3)=>{
    const n=10,x0=cx,y0=cy;
    for(let i=1;i<=n;i++){const t=i/n,u=1-t;
      cur.push(T(u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3));}
    cx=x3;cy=y3;
  };
  const pending=[];
  const paint=()=>{ // fine tracciato
    if(cur)pending.push({pts:cur,closed:false});cur=null;
    if(!clip)for(const p of pending)subs.push({pts:p.pts,closed:p.closed,key});
    pending.length=0;clip=false;
  };
  const closeCur=()=>{
    if(cur&&cur.length>1){
      let pts=cur,closed=true;
      if(pts.length>2&&Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<0.02)pts=pts.slice(0,-1);
      if(pts.length>=3)pending.push({pts,closed:true});
    }
    cur=null;cx=sx;cy=sy;
  };
  const open=()=>{if(cur&&cur.length>1){pending.push({pts:cur,closed:false});}cur=null;};
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];
    if(NUM.test(t)){st.push(parseFloat(t));continue;}
    const n=st.length;
    switch(t){
      case 'm':case 'moveto':case 'M':
        if(n>=2){open();cx=sx=st[n-2];cy=sy=st[n-1];cur=[T(cx,cy)];}break;
      case 'l':case 'lineto':case 'L':
        if(n>=2&&cur){cx=st[n-2];cy=st[n-1];cur.push(T(cx,cy));}break;
      case 'c':case 'curveto':case 'C':
        if(n>=6&&cur)bez(st[n-6],st[n-5],st[n-4],st[n-3],st[n-2],st[n-1]);break;
      case 'v':if(n>=4&&cur)bez(cx,cy,st[n-4],st[n-3],st[n-2],st[n-1]);break;
      case 'y':if(n>=4&&cur)bez(st[n-4],st[n-3],st[n-2],st[n-1],st[n-2],st[n-1]);break;
      case 'h':case 'closepath':case '@c':case 'cp':case 'Z':closeCur();break;
      case 're':if(n>=4){open();const x=st[n-4],y=st[n-3],w=st[n-2],h=st[n-1];cur=[T(x,y),T(x+w,y),T(x+w,y+h),T(x,y+h)];pending.push({pts:cur,closed:true});cur=null;}break;
      case 'n':case 'N':cur=null;pending.length=0;clip=false;break;
      case 'W':case 'W*':case 'clip':case 'eoclip':clip=true;break;
      case 'S':case 's':case 'f':case 'F':case 'f*':case 'B':case 'B*':case 'b':case 'b*':case 'stroke':case 'fill':case 'eofill':case '@F':
        if(t==='s'||t==='b'||t==='b*')closeCur();
        paint();break;
      case 'q':if(useCm)mst.push(m.slice());break;
      case 'Q':if(useCm&&mst.length)m=mst.pop();break;
      case 'cm':if(useCm&&n>=6){const a=st.slice(n-6);m=[m[0]*a[0]+m[2]*a[1],m[1]*a[0]+m[3]*a[1],m[0]*a[2]+m[2]*a[3],m[1]*a[2]+m[3]*a[3],m[0]*a[4]+m[2]*a[5]+m[4],m[1]*a[4]+m[3]*a[5]+m[5]];}break;
    }
    st=[];
  }
  open();paint();
}
function parseEps(text){
  const a=text.indexOf('%!PS');
  let s=a>0?text.slice(a):text;
  const e=s.indexOf('%%Trailer');if(e>0)s=s.slice(0,e);
  let k=s.indexOf('%%EndSetup');if(k<0)k=s.indexOf('%%EndProlog');if(k<0)k=0;
  s=s.slice(k).replace(/%[^\n\r]*/g,' ');
  const subs=[];
  pathOps(s.split(/\s+/).filter(Boolean),subs,'tratti',false);
  return finishSubs(subs);
}
async function inflate(u8){
  for(const fmt of ['deflate','deflate-raw']){
    try{
      const ds=new DecompressionStream(fmt),w=ds.writable.getWriter();
      w.write(fmt==='deflate-raw'?u8.subarray(2):u8).catch(()=>{});w.close().catch(()=>{});
      return new Uint8Array(await new Response(ds.readable).arrayBuffer());
    }catch(_){}
  }
  return null;
}
function ahex(u8){
  const o=[];let h=-1;
  for(const c of u8){
    if(c===62)break;
    let v=c>=48&&c<=57?c-48:c>=65&&c<=70?c-55:c>=97&&c<=102?c-87:-1;
    if(v<0)continue;
    if(h<0)h=v;else{o.push(h*16+v);h=-1;}
  }
  if(h>=0)o.push(h*16);
  return new Uint8Array(o);
}
function a85(u8){
  const o=[];let g=[];
  for(let i=0;i<u8.length;i++){
    const c=u8[i];
    if(c===126)break;
    if(c<=32)continue;
    if(c===122&&!g.length){o.push(0,0,0,0);continue;}
    if(c<33||c>117)continue;
    g.push(c-33);
    if(g.length===5){let v=0;for(const x of g)v=v*85+x;o.push((v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255);g=[];}
  }
  if(g.length>1){const n=g.length;while(g.length<5)g.push(84);let v=0;for(const x of g)v=v*85+x;const b=[(v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255];for(let i=0;i<n-1;i++)o.push(b[i]);}
  return new Uint8Array(o);
}
async function parseAi(u8){
  let head='';for(let i=0;i<Math.min(8,u8.length);i++)head+=String.fromCharCode(u8[i]);
  if(!head.startsWith('%PDF'))return parseEps(new TextDecoder('latin1').decode(u8));
  const s=new TextDecoder('latin1').decode(u8);
  let subs=[],psSubs=null;let i=0;
  while((i=s.indexOf('stream',i))>=0){
    if(s.slice(i-3,i).trim().endsWith('end')){i+=6;continue;}
    let st=i+6;if(s[st]==='\r')st++;if(s[st]==='\n')st++;
    const en=s.indexOf('endstream',st);if(en<0)break;
    const dict=s.slice(Math.max(0,i-500),i),d=dict.slice(dict.lastIndexOf('obj')>=0?dict.lastIndexOf('obj'):0);
    i=en+9;
    if(/\/Subtype\s*\/Image|\/Type\s*\/XRef|\/ObjStm|\/Metadata/.test(d))continue;
    let bytes=u8.subarray(st,en);
    const fm=d.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/);
    const fl=fm?(fm[1].match(/\/\w+/g)||[]).map(x=>x.slice(1)):[];
    let bad=false;
    for(const f of fl){
      if(f==='FlateDecode'||f==='Fl'){bytes=await inflate(bytes);}
      else if(f==='ASCII85Decode'||f==='A85'){bytes=a85(bytes);}
      else if(f==='ASCIIHexDecode'||f==='AHx'){bytes=ahex(bytes);}
      else{bad=true;break;}
      if(!bytes){bad=true;break;}
    }
    if(bad)continue;
    if(bytes.length>60e6)continue;
    const txt=new TextDecoder('latin1').decode(bytes);
    if(txt.startsWith('%!PS')){
      const k=txt.indexOf('%%EndSetup');
      psSubs=psSubs||[];
      pathOps(txt.slice(k>0?k:0).replace(/%[^\n\r]*/g,' ').split(/\s+/).filter(Boolean),psSubs,'tratti',false);
      continue;
    }
    if(!/[\d.]\s+[ml]\s/.test(txt.slice(0,4000)))continue;
    pathOps(txt.replace(/%[^\n\r]*/g,' ').split(/\s+/).filter(Boolean),subs,'tratti',true);
  }
  return finishSubs(psSubs&&psSubs.length>=subs.length?psSubs:subs);
}

function parseDxf(text){
  const L=text.split(/\r?\n/);
  const pr=[];
  for(let i=0;i+1<L.length;i+=2)pr.push([parseInt(L[i],10),L[i+1].trim()]);
  let unit=1,i0=0,i1=pr.length;
  for(let i=0;i<pr.length-1;i++){
    if(pr[i][0]===9&&pr[i][1]==='$INSUNITS'){const v=Number(pr[i+1][1]);unit={1:25.4,2:304.8,4:1,5:10,6:1000,8:0.0254e-3*1000/25.4,9:0.0254,10:914.4}[v]||1;}
    if(pr[i][0]===2&&pr[i][1]==='ENTITIES'&&pr[i-1]&&pr[i-1][1]==='SECTION'){i0=i+1;}
  }
  const ents=[];let cur=null;
  for(let i=i0;i<i1;i++){
    const [c,v]=pr[i];
    if(c===0){
      if(v==='ENDSEC'&&cur){ents.push(cur);cur=null;break;}
      if(cur)ents.push(cur);
      cur={t:v,g:[]};
    }else if(cur)cur.g.push([c,v]);
  }
  if(cur)ents.push(cur);
  const subs=[];
  const num=v=>Number(v);
  const lay=e=>{const l=e.g.find(x=>x[0]===8);return l?l[1]:'0';};
  const add=(pts,closed,key)=>{
    if(pts.length<2)return;
    if(!closed&&pts.length>2&&Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<0.02)closed=true;
    if(closed&&pts.length>2&&Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<0.02)pts.pop();
    if(closed&&pts.length<3)return;
    subs.push({pts:pts.map(p=>[p[0]*unit,p[1]*unit]),closed,key});
  };
  const arcPts=(cx,cy,r,a0,a1)=>{
    while(a1<=a0)a1+=360;
    const n=Math.max(6,Math.ceil((a1-a0)/6)),out=[];
    for(let k=0;k<=n;k++){const a=(a0+(a1-a0)*k/n)*Math.PI/180;out.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
    return out;
  };
  const bulgeSeg=(p,q,b)=>{
    const out=[],d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(!b||d<1e-9)return out;
    const th=4*Math.atan(b),r=d/2/Math.sin(th/2),mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2;
    const h=r*Math.cos(th/2),nx=-(q[1]-p[1])/d,ny=(q[0]-p[0])/d,cx=mx+nx*h,cy=my+ny*h;
    const a0=Math.atan2(p[1]-cy,p[0]-cx),n=Math.max(2,Math.ceil(Math.abs(th)/0.1));
    for(let k=1;k<n;k++){const a=a0+th*k/n;out.push([cx+Math.abs(r)*Math.cos(a)*Math.sign(r),cy+Math.abs(r)*Math.sin(a)*Math.sign(r)]);}
    return out;
  };
  function nurbs(deg,knots,cp,w){
    const n=cp.length,pts=[];
    const t0=knots[deg],t1=knots[n];
    const spans=Math.max(1,n-deg),steps=Math.min(400,spans*8);
    const basis=(t)=>{
      let k=deg;while(k<n-1&&t>=knots[k+1])k++;
      const N=new Array(deg+1).fill(0);N[0]=1;const left=[],right=[];
      for(let j=1;j<=deg;j++){left[j]=t-knots[k+1-j];right[j]=knots[k+j]-t;let sv=0;for(let r=0;r<j;r++){const den=right[r+1]+left[j-r],tmp=den?N[r]/den:0;N[r]=sv+right[r+1]*tmp;sv=left[j-r]*tmp;}N[j]=sv;}
      return [k,N];
    };
    for(let s=0;s<=steps;s++){
      let t=t0+(t1-t0)*s/steps;if(s===steps)t=t1-1e-9*(t1-t0);
      const [k,N]=basis(t);let x=0,y=0,ww=0;
      for(let j=0;j<=deg;j++){const idx=k-deg+j;if(idx<0||idx>=n)continue;const b=N[j]*(w?w[idx]:1);x+=b*cp[idx][0];y+=b*cp[idx][1];ww+=b;}
      if(ww)pts.push([x/ww,y/ww]);
    }
    return pts;
  }
  for(let ei=0;ei<ents.length;ei++){
    const e=ents[ei],g=e.g,key=lay(e);
    if(e.t==='LINE'){
      const f=c=>{const x=g.find(a=>a[0]===c);return x?num(x[1]):0;};
      add([[f(10),f(20)],[f(11),f(21)]],false,key);
    }else if(e.t==='CIRCLE'){
      const f=c=>{const x=g.find(a=>a[0]===c);return x?num(x[1]):0;};
      const p=arcPts(f(10),f(20),f(40),0,360);p.pop();add(p,true,key);
    }else if(e.t==='ARC'){
      const f=c=>{const x=g.find(a=>a[0]===c);return x?num(x[1]):0;};
      add(arcPts(f(10),f(20),f(40),f(50),f(51)),false,key);
    }else if(e.t==='LWPOLYLINE'){
      const vs=[];let closed=false;
      for(const [c,v] of g){
        if(c===70)closed=(parseInt(v,10)&1)===1;
        else if(c===10)vs.push({x:num(v),y:0,b:0});
        else if(c===20&&vs.length)vs[vs.length-1].y=num(v);
        else if(c===42&&vs.length)vs[vs.length-1].b=num(v);
      }
      const pts=[];
      for(let k=0;k<vs.length;k++){
        pts.push([vs[k].x,vs[k].y]);
        if(vs[k].b){const q=vs[(k+1)%vs.length];if(k+1<vs.length||closed)pts.push(...bulgeSeg([vs[k].x,vs[k].y],[q.x,q.y],vs[k].b));}
      }
      add(pts,closed,key);
    }else if(e.t==='POLYLINE'){
      const closed=g.some(a=>a[0]===70&&(parseInt(a[1],10)&1)===1);
      const pts=[];let j=ei+1;
      for(;j<ents.length&&ents[j].t!=='SEQEND';j++){
        if(ents[j].t==='VERTEX'){const x=ents[j].g.find(a=>a[0]===10),y=ents[j].g.find(a=>a[0]===20);if(x&&y)pts.push([num(x[1]),num(y[1])]);}
      }
      ei=j;add(pts,closed,key);
    }else if(e.t==='SPLINE'){
      let flags=0,deg=3;const knots=[],cp=[],w=[],fit=[];
      for(const [c,v] of g){
        if(c===70)flags=parseInt(v,10);else if(c===71)deg=parseInt(v,10);
        else if(c===40)knots.push(num(v));
        else if(c===41)w.push(num(v));
        else if(c===10)cp.push([num(v),0]);
        else if(c===20&&cp.length)cp[cp.length-1][1]=num(v);
        else if(c===11)fit.push([num(v),0]);
        else if(c===21&&fit.length)fit[fit.length-1][1]=num(v);
      }
      let pts;
      if(cp.length>deg&&knots.length>=cp.length+deg+1)pts=nurbs(deg,knots,cp,w.length===cp.length?w:null);
      else pts=fit.length?fit:cp;
      add(pts,(flags&1)===1,key);
    }
  }
  // unisce i tratti aperti che si toccano per formare contorni chiusi
  (function(){
    const T=0.05,K=p=>Math.round(p[0]/T)+','+Math.round(p[1]/T);
    const open=subs.filter(s=>!s.closed),keep=subs.filter(s=>s.closed);
    if(open.length<2)return;
    const map=new Map(),used=new Set();
    const put=(p,i)=>{const k=K(p);let a=map.get(k);if(!a)map.set(k,a=[]);a.push(i);};
    const near=(p)=>{const r=[],x=Math.round(p[0]/T),y=Math.round(p[1]/T);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const a=map.get((x+dx)+','+(y+dy));if(a)r.push(...a);}return r;};
    open.forEach((s,i)=>{put(s.pts[0],i);put(s.pts[s.pts.length-1],i);});
    const out=[];
    for(let i=0;i<open.length;i++){
      if(used.has(i))continue;used.add(i);
      let pts=open[i].pts.slice(),key=open[i].key,guard=0;
      for(let dir=0;dir<2;dir++){
        let go=true;
        while(go&&guard++<100000){
          go=false;const end=pts[pts.length-1];
          for(const j of near(end)){
            if(used.has(j))continue;
            const q=open[j].pts;
            if(Math.hypot(q[0][0]-end[0],q[0][1]-end[1])<T*1.5){used.add(j);pts=pts.concat(q.slice(1));go=true;break;}
            if(Math.hypot(q[q.length-1][0]-end[0],q[q.length-1][1]-end[1])<T*1.5){used.add(j);pts=pts.concat(q.slice(0,-1).reverse());go=true;break;}
          }
        }
        pts.reverse();
      }
      out.push({pts,key});
    }
    subs.length=0;subs.push(...keep);
    for(const o of out){
      let p=o.pts,closed=false;
      if(p.length>2&&Math.hypot(p[0][0]-p[p.length-1][0],p[0][1]-p[p.length-1][1])<T*1.5){closed=true;p=p.slice(0,-1);}
      if(closed&&p.length<3)continue;
      subs.push({pts:p,closed,key:o.key});
    }
  })();
  if(!subs.length)throw new Error('In questo DXF non ci sono linee da tagliare.');
  let a=1e18,b=1e18,c=-1e18,d=-1e18;
  for(const s of subs)for(const p of s.pts){if(p[0]<a)a=p[0];if(p[0]>c)c=p[0];if(p[1]<b)b=p[1];if(p[1]>d)d=p[1];}
  for(const s of subs)s.pts=s.pts.map(p=>[p[0]-a,d-p[1]]);
  const layers={};
  for(const s of subs){let l=layers[s.key];if(!l)l=layers[s.key]={key:s.key,n:0,len:0};l.n++;for(let i=1;i<s.pts.length;i++)l.len+=Math.hypot(s.pts[i][0]-s.pts[i-1][0],s.pts[i][1]-s.pts[i-1][1]);}
  return {subs,layers,sheetW:c-a,sheetH:d-b};
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
/* ---------- ruota, specchia, ritaglia ---------- */
function clipPoly(pts,x0,y0,x1,y1){      // Sutherland-Hodgman contro il rettangolo
  let o=pts;
  const edges=[[p=>p[0]>=x0,(a,b)=>{const t=(x0-a[0])/(b[0]-a[0]);return [x0,a[1]+t*(b[1]-a[1])];}],
    [p=>p[0]<=x1,(a,b)=>{const t=(x1-a[0])/(b[0]-a[0]);return [x1,a[1]+t*(b[1]-a[1])];}],
    [p=>p[1]>=y0,(a,b)=>{const t=(y0-a[1])/(b[1]-a[1]);return [a[0]+t*(b[0]-a[0]),y0];}],
    [p=>p[1]<=y1,(a,b)=>{const t=(y1-a[1])/(b[1]-a[1]);return [a[0]+t*(b[0]-a[0]),y1];}]];
  for(const [inn,cut] of edges){
    const inp=o;o=[];if(!inp.length)break;
    for(let i=0;i<inp.length;i++){
      const a=inp[i],b=inp[(i+1)%inp.length],ia=inn(a),ib=inn(b);
      if(ia){o.push(a);if(!ib)o.push(cut(a,b));}else if(ib){o.push(cut(a,b));}
    }
  }
  return o;
}
function clipLine(pts,x0,y0,x1,y1){      // tratto aperto: restano i pezzi dentro il rettangolo
  const out=[];let cur=null;
  for(let i=1;i<pts.length;i++){
    let a=pts[i-1],b=pts[i],t0=0,t1=1;const dx=b[0]-a[0],dy=b[1]-a[1];
    let ok=true;
    for(const [p,q] of [[-dx,a[0]-x0],[dx,x1-a[0]],[-dy,a[1]-y0],[dy,y1-a[1]]]){
      if(p===0){if(q<0){ok=false;break;}}
      else{const r=q/p;if(p<0){if(r>t1){ok=false;break;}if(r>t0)t0=r;}else{if(r<t0){ok=false;break;}if(r<t1)t1=r;}}
    }
    if(!ok){cur=null;continue;}
    const A=[a[0]+t0*dx,a[1]+t0*dy],B=[a[0]+t1*dx,a[1]+t1*dy];
    if(cur&&t0===0)cur.push(B);else{cur=[A,B];out.push(cur);}
    if(t1<1)cur=null;
  }
  return out;
}
const val=(id,d)=>{const e=$(id);if(!e)return d;const v=Number(e.value);return isFinite(v)?v:d;};
function transformSubs(list){
  const rot=((P.rot||0)%360+360)%360,flip=!!P.flip;
  if(!rot&&!flip)return list;
  let all=[];for(const s of list)for(const p of s.pts)all.push(p);
  const b=bboxOf(all),cx=(b.minx+b.maxx)/2,cy=(b.miny+b.maxy)/2,r=rot*Math.PI/180,c=Math.cos(r),sn=Math.sin(r);
  return list.map(s=>({key:s.key,closed:s.closed,pts:s.pts.map(q=>{
    let x=q[0]-cx,y=q[1]-cy;if(flip)x=-x;
    return [cx+x*c-y*sn,cy+x*sn+y*c];})}));
}
function build(area){
  if(!P.svg)return {error:P.err||'Scegli uno zip o un file SVG con il pulsante qui sopra.'};
  const sc=(Number($('impScale').value)||100)/100,strip=$('impOut').checked;
  const keys=P.sel;let list=[];
  for(const s of P.svg.subs){
    if(!keys.has(s.key))continue;
    if(strip){const b=bboxOf(s.pts);if(b.maxx<0||b.maxy<0||b.minx>P.svg.sheetW||b.miny>P.svg.sheetH)continue;}
    list.push(s);
  }
  if(!list.length)return {error:'Nessun tratto selezionato: accendi almeno un colore nell\'elenco qui sopra.'};
  list=transformSubs(list);
  let all=[];for(const s of list)for(const p of s.pts)all.push(p);
  const bb=bboxOf(all),m=3,gap=4;
  P.baseW=bb.maxx-bb.minx;P.baseH=bb.maxy-bb.miny;
  if(!((bb.maxx-bb.minx)>0&&(bb.maxy-bb.miny)>0))return {error:'Il disegno non ha dimensioni.'};
  // tutti i tratti, con Y girata (nel file la Y va verso il basso) e scala applicata
  let paths=list.map(s=>({pts:s.pts.map(q=>[(q[0]-bb.minx)*sc,(bb.maxy-q[1])*sc]),closed:s.closed}));
  P.preW=P.baseW*sc;P.preH=P.baseH*sc;
  let cropped=false;
  if($('impCrop')&&$('impCrop').checked){
    const x0=val('impCx',0),y0=val('impCy',0),x1=x0+val('impCw',P.preW),y1=y0+val('impCh',P.preH);
    if(!(x1>x0&&y1>y0))return {error:'Il ritaglio non ha dimensioni: controlla larghezza e altezza.'};
    const np=[];
    for(const p of paths){
      if(p.closed){const q=clipPoly(p.pts,x0,y0,x1,y1);if(q.length>=3)np.push({pts:q,closed:true});}
      else for(const q of clipLine(p.pts,x0,y0,x1,y1))if(q.length>=2)np.push({pts:q,closed:false});
    }
    if(!np.length)return {error:'Dentro il ritaglio non c\'è nessun tratto. Sposta o allarga il rettangolo.'};
    let a2=[];for(const p of np)for(const q of p.pts)a2.push(q);
    const cb=bboxOf(a2);
    for(const p of np)p.pts=p.pts.map(q=>[q[0]-cb.minx,q[1]-cb.miny]);
    paths=np;cropped=true;bb.minx=0;bb.maxx=(cb.maxx-cb.minx)/sc;bb.miny=0;bb.maxy=(cb.maxy-cb.miny)/sc;
  }
  for(const p of paths){p.b=bboxOf(p.pts);p.a=p.closed?Math.abs(area2(p.pts)):0;}
  const closed=paths.filter(p=>p.closed).sort((x,y)=>y.a-x.a);
  // fori = tratti chiusi dentro un altro tratto chiuso (profondità dispari); owner = il contorno più piccolo che lo contiene
  if(closed.length<=6000){
    for(let i=0;i<closed.length;i++){
      const p=closed[i],t=p.pts[0];let depth=0,owner=null;
      for(let j=i-1;j>=0;j--){
        const q=closed[j];
        if(q.a<=p.a)continue;
        if(t[0]<q.b.minx||t[0]>q.b.maxx||t[1]<q.b.miny||t[1]>q.b.maxy)continue;
        if(inside(t,q.pts)){depth++;if(!owner)owner=q;}
      }
      p.hole=depth%2===1;p.owner=owner;
    }
  }
  const pieces=[];
  for(const p of closed)if(!p.hole){p.kids=[];pieces.push(p);}
  for(const p of closed)if(p.hole){let o=p.owner;while(o&&o.hole)o=o.owner;if(o&&o.kids)o.kids.push(p);else{p.kids=[];p.hole=false;pieces.push(p);}}
  for(const p of paths)if(!p.closed){
    const t=p.pts[0];let best=null;
    for(const q of pieces){if(t[0]>=q.b.minx&&t[0]<=q.b.maxx&&t[1]>=q.b.miny&&t[1]<=q.b.maxy&&(!best||q.a<best.a))best=q;}
    if(best)best.kids.push(p);else{p.kids=[];pieces.push(p);}
  }
  for(const q of pieces){
    let b=q.b;for(const k of q.kids)b={minx:Math.min(b.minx,k.b.minx),miny:Math.min(b.miny,k.b.miny),maxx:Math.max(b.maxx,k.b.maxx),maxy:Math.max(b.maxy,k.b.maxy)};
    q.box=b;q.pw=b.maxx-b.minx;q.ph=b.maxy-b.miny;
  }
  const W=area.w-2*m,H=area.h-2*m;
  const wholeW=(bb.maxx-bb.minx)*sc,wholeH=(bb.maxy-bb.miny)*sc;
  const sheets=[];
  const mk=(its)=>{
    const holes=[],outers=[];
    for(const it of its)for(const p of it.paths){(p.hole||p.open?holes:outers).push(p.pts);}
    let mw=0,mh=0;for(const it of its){mw=Math.max(mw,it.x+it.w);mh=Math.max(mh,it.y+it.h);}
    return {items:its,cutPaths:holes.concat(outers),w:mw+m,h:mh+m};
  };
  const place=(q,ox,oy,name)=>{
    const dx=ox-q.box.minx,dy=oy-q.box.miny;
    const mv=p=>({hole:!!p.hole&&p.closed,open:!p.closed,pts:p.pts.map(c=>{const r=[c[0]+dx,c[1]+dy];if(!p.closed)r.open=true;return r;})});
    const ps=[mv(q)].concat(q.kids.map(mv));
    ps.forEach(p=>{if(p.open)p.pts.open=true;});
    ps.sort((a,b)=>(a.open?2:a.hole?1:0)-(b.open?2:b.hole?1:0));
    return {name,tag:'file',x:ox,y:oy,w:q.pw,h:q.ph,paths:ps};
  };
  const copies=Math.max(1,Math.min(50,Math.round(val('impCopies',1))));
  if(copies===1&&wholeW<=W&&wholeH<=H){
    // tutto sta in un foglio: lo lascio com'è nel file
    const its=pieces.map((q,i)=>place(q,q.box.minx+m,q.box.miny+m,(P.name||'progetto')+(pieces.length>1?' · pezzo '+(i+1):'')));
    sheets.push(mk(its));
  }else{
    // non sta: divido in pezzi e li dispongo su più fogli (file di legno) grandi come l'area di lavoro
    const big=pieces.find(q=>q.pw>W||q.ph>H);
    if(big)return {error:'Un pezzo del progetto misura '+Math.round(big.pw)+' × '+Math.round(big.ph)+' mm e non sta nell\'area di lavoro ('+Math.round(area.w)+' × '+Math.round(area.h)+' mm). Riduci la scala, oppure spegni i colori che sono cornici o fogli.'};
    const ord0=pieces.slice().sort((x,y)=>y.ph-x.ph||y.pw-x.pw),ord=[];
    for(const q of ord0)for(let k=0;k<copies;k++)ord.push(q);
    let its=[],x=0,y=0,rowH=0,n=0;
    for(const q of ord){
      if(x>0&&x+q.pw>W){x=0;y+=rowH+gap;rowH=0;}
      if(y+q.ph>H){sheets.push(mk(its));its=[];x=0;y=0;rowH=0;}
      its.push(place(q,x+m,y+m,(P.name||'progetto')+' · pezzo '+(++n)));
      x+=q.pw+gap;rowH=Math.max(rowH,q.ph);
    }
    if(its.length)sheets.push(mk(its));
  }
  const nh=paths.filter(p=>p.hole).length;
  setTimeout(syncDims,0);
  return {sheets,hardware:[],steps:[],imported:{n:paths.length,holes:nh,w:wholeW,h:wholeH,pieces:pieces.length*copies}};
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
async function useSvgText(text,name,bytes){
  P.svg=null;
  try{
    if(/\.(ai|eps)$/i.test(name)){
      const u=bytes||new TextEncoder().encode(text);
      P.svg=/^%PDF/.test(String.fromCharCode(...u.subarray(0,4)))?await parseAi(u):parseEps(new TextDecoder('latin1').decode(u));
    }else P.svg=/\.dxf$/i.test(name)?parseDxf(text):parseSvg(text);
    P.name=name.replace(/\.(svg|dxf|ai|eps)$/i,'').replace(/^.*[\\/]/,'');
    if(!P.svg.subs.length)throw new Error('In questo file non ci sono linee da tagliare.');
    P.err='';resetEdit();fillLayers();
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
    if(!(/\.(svg|dxf|eps|ai|zip)$/.test(n)))continue;
    total++;
    if(q&&!n.includes(q))continue;
    if(shown>=300)continue;shown++;
    const o=document.createElement('option');o.value=String(i);o.textContent=(n.endsWith('.zip')?'📦 ':'')+e.name+(e.us>1048576?' ('+(e.us/1048576).toFixed(0)+' MB)':'');sel.appendChild(o);
  }
  $('impCount').textContent=total?(shown+' di '+total+(shown<total?' (scrivi nel filtro per restringere)':'')):'Nessun file SVG, DXF, EPS, AI o zip qui dentro.';
  // preferisci subito la prima foto
}
async function loadPhoto(){
  const img=$('impPhoto');img.hidden=true;
  if(P.photo){URL.revokeObjectURL(P.photo);P.photo=null;}
  const cur=P.cur;if(!cur)return;
  const imgs=cur.entries.filter(x=>/\.(jpe?g|png)$/i.test(x.name)&&x.us<40e6);
  const e=imgs.find(x=>/photo/i.test(x.name))||imgs[0];
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
    const dxfs=entries.filter(e=>/\.dxf$/i.test(e.name));
    const epss=entries.filter(e=>/\.eps$/i.test(e.name));
    const ais=entries.filter(e=>/\.ai$/i.test(e.name));
    const cand=svgs.length?svgs:dxfs.length?dxfs:epss.length?epss:ais;
    const kind=svgs.length?'SVG':dxfs.length?'DXF':epss.length?'EPS':'AI';
    if(cand.length){
      const pref=cand.find(e=>/3\s?mm/i.test(e.name))||cand[0];
      msg(entries.length+' file nello zip, '+cand.length+' '+kind+'.'+(cand.length===1?'':' Ho aperto '+pref.name.split('/').pop()+': se serve un altro spessore sceglilo dall\'elenco.'));
      await pick(entries.indexOf(pref));return;
    }
    if(!entries.some(e=>/\.zip$/i.test(e.name)))msg('Questo zip non contiene SVG (solo '+[...new Set(entries.map(e=>e.name.split('.').pop().toLowerCase()))].slice(0,6).join(', ')+'). laserBrio legge SVG, DXF, EPS e AI (il CDR no).',true);
  }catch(e){msg(e.message||'Non riesco a leggere lo zip.',true);}
}
async function pick(i){
  const cur=P.cur,e=cur.entries[i];if(!e)return;
  try{
    const b=await unzipEntry(cur.blob,e);
    if(/\.zip$/i.test(e.name)){await openZip(new Blob([b]),e.name,true);return;}
    await useSvgText(/\.(ai|eps)$/i.test(e.name)?'':new TextDecoder('utf-8').decode(b),e.name,b);
  }catch(err){msg(err.message||'Non riesco ad aprire il file.',true);}
}
/* ---------- duplica, ruota, ridimensiona, ritaglia: comandi ---------- */
function syncDims(){
  const w=$('impW'),h=$('impH');if(!w||!h||!P.baseW)return;
  const sc=(Number($('impScale').value)||100)/100;
  if(document.activeElement!==w)w.value=Math.round(P.baseW*sc*10)/10;
  if(document.activeElement!==h)h.value=Math.round(P.baseH*sc*10)/10;
}
function resetEdit(){
  P.rot=0;P.flip=false;
  for(const [id,v] of [['impCopies','1'],['impRot','0'],['impScale','100']]){const e=$(id);if(e)e.value=v;}
  const c=$('impCrop');if(c){c.checked=false;$('impCropBox').hidden=true;}
}
function buildEditUi(){
  if($('impEdit'))return;
  const anchor=$('impScale').closest('.grid2');if(!anchor)return;
  const d=document.createElement('div');d.id='impEdit';d.style.marginTop='10px';
  d.innerHTML='<p style="margin:12px 0 4px"><b>Modifica il progetto</b></p>'
   +'<div class="grid2"><div><label for="impW">Larghezza (mm)</label><input type="number" id="impW" min="1" step="0.1"></div>'
   +'<div><label for="impH">Altezza (mm)</label><input type="number" id="impH" min="1" step="0.1"></div></div>'
   +'<p class="hint" style="margin-top:4px">Cambia una misura e l\'altra si adatta (le proporzioni restano uguali).</p>'
   +'<div class="row" style="margin-top:8px"><button class="btn" id="impRL">↺ 90°</button><button class="btn" id="impRR">↻ 90°</button><button class="btn" id="impFl">⇋ Specchia</button>'
   +'<label style="margin:0 0 0 6px">Angolo</label><input type="number" id="impRot" value="0" step="1" style="width:80px"> °</div>'
   +'<div class="grid2" style="margin-top:10px"><div><label for="impCopies">Quante copie</label><input type="number" id="impCopies" value="1" min="1" max="50" step="1"></div>'
   +'<div style="display:flex;align-items:flex-end"><label class="chk"><input type="checkbox" id="impCrop"> Ritaglia una parte</label></div></div>'
   +'<div id="impCropBox" hidden><p class="hint" style="margin-top:6px">Tieni solo il rettangolo qui sotto (misure in mm, dall\'angolo in basso a sinistra del disegno). I tratti che escono vengono tagliati sul bordo del rettangolo.</p>'
   +'<div class="grid2"><div><label for="impCx">Da sinistra</label><input type="number" id="impCx" value="0" step="0.5"></div><div><label for="impCy">Dal basso</label><input type="number" id="impCy" value="0" step="0.5"></div>'
   +'<div><label for="impCw">Larghezza</label><input type="number" id="impCw" value="0" step="0.5"></div><div><label for="impCh">Altezza</label><input type="number" id="impCh" value="0" step="0.5"></div></div></div>';
  anchor.parentNode.insertBefore(d,anchor.nextSibling);
  const setScale=v=>{$('impScale').value=Math.max(5,Math.min(2000,Math.round(v*100)/100));redraw();};
  $('impW').oninput=()=>{const w=Number($('impW').value);if(w>0&&P.baseW){setScale(w/P.baseW*100);const h=$('impH');h.value=Math.round(P.baseH*w/P.baseW*10)/10;}};
  $('impH').oninput=()=>{const h=Number($('impH').value);if(h>0&&P.baseH){setScale(h/P.baseH*100);const w=$('impW');w.value=Math.round(P.baseW*h/P.baseH*10)/10;}};
  const rot=a=>{P.rot=(((P.rot||0)+a)%360+360)%360;$('impRot').value=P.rot;redraw();};
  $('impRL').onclick=()=>rot(-90);$('impRR').onclick=()=>rot(90);
  $('impFl').onclick=()=>{P.flip=!P.flip;redraw();};
  $('impRot').oninput=()=>{P.rot=Number($('impRot').value)||0;redraw();};
  $('impCopies').oninput=redraw;
  $('impCrop').onchange=()=>{
    $('impCropBox').hidden=!$('impCrop').checked;
    if($('impCrop').checked){$('impCx').value=0;$('impCy').value=0;$('impCw').value=Math.round((P.preW||P.baseW||0)*10)/10;$('impCh').value=Math.round((P.preH||P.baseH||0)*10)/10;}
    redraw();
  };
  for(const id of ['impCx','impCy','impCw','impCh'])$(id).oninput=redraw;
}
function init(){
  buildEditUi();
  const openAny=async f=>{
    if(/\.zip$/i.test(f.name)||f.type==='application/zip')await openZip(f,f.name,false);
    else{P.stack=[];P.cur=null;$('impList').innerHTML='';$('impCount').textContent='';$('impPhoto').hidden=true;if(/\.(ai|eps)$/i.test(f.name))await useSvgText('',f.name,new Uint8Array(await f.arrayBuffer()));else await useSvgText(await f.text(),f.name);}
  };
  Proj.openFile=openAny;
  $('impFile').onchange=async ev=>{
    const f=ev.target.files[0];if(!f)return;
    await openAny(f);
    ev.target.value='';
  };
  $('impList').onchange=async()=>{
    const v=$('impList').value;
    if(v==='..'){P.stack.pop();P.cur=P.stack[P.stack.length-1];showList();loadPhoto();return;}
    if(v!=='')await pick(Number(v));
  };
  $('impFilter').oninput=showList;
  $('impScale').oninput=()=>{redraw();};$('impOut').onchange=redraw;
  $('impDrop').onclick=()=>$('impFile').click();
}
const gz={
  box(items){let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const it of items||[]){a=Math.min(a,it.x);b=Math.min(b,it.y);c=Math.max(c,it.x+it.w);d=Math.max(d,it.y+it.h);}return (items&&items.length)?{x0:a,y0:b,x1:c,y1:d}:null;},
  rot:()=>P.rot||0,
  scale:()=>Number($('impScale').value)||100,
  setRot(d){d=((d%360)+360)%360;P.rot=d;const e=$('impRot');if(e)e.value=Math.round(d*10)/10;(window.__projRefresh||redraw)();},
  setScale(p){p=Math.max(5,Math.min(2000,p));$('impScale').value=Math.round(p*100)/100;(window.__projRefresh||redraw)();}
};
window.Proj={plan:build,init,gz,_t:{parseSvg,parseDxf,parseEps,parseAi,readZip,unzipEntry,parseD,flatten}};
})();
