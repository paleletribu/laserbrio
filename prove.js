/* laserBrio · Modelli di prova: schede di calibrazione generate dall'app (taglio, incisione, fuoco, incastro, misure) */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const f2=v=>String(Math.round(v*100)/100);

/* ---------- cifre disegnate a tratti (per scrivere i valori sul legno) ---------- */
const SEG={a:[0,0,1,0],b:[1,0,1,1],c:[1,1,1,2],d:[0,2,1,2],e:[0,1,0,2],f:[0,0,0,1],g:[0,1,1,1]};
const DIG={'0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgedc','7':'abc','8':'abcdefg','9':'abcdfg'};
function text(s,x,y,pct){            // altezza 3,6 mm, passo 3 mm; (x,y) = angolo in alto a sinistra
  const w=1.8,h=1.8,o=[];
  [...String(s)].forEach((ch,i)=>{
    if(ch==='-'){o.push({k:'line',pts:[[x+i*3,y+h],[x+i*3+w,y+h]],pct,F:3000});return;}
    if(ch==='+'){o.push({k:'line',pts:[[x+i*3,y+h],[x+i*3+w,y+h]],pct,F:3000});o.push({k:'line',pts:[[x+i*3+w/2,y+h/2],[x+i*3+w/2,y+h*1.5]],pct,F:3000});return;}
    const sg=DIG[ch];if(!sg)return;
    for(const c of sg){const q=SEG[c];o.push({k:'line',pts:[[x+i*3+q[0]*w,y+q[1]*h],[x+i*3+q[2]*w,y+q[3]*h]],pct,F:3000});}
  });
  return o;
}
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const nums=s=>String(s).split(/[,; ]+/).map(Number).filter(v=>isFinite(v)&&v>0);

/* ---------- QR code (byte, correzione M, versioni 1-10) ---------- */
const QR=(()=>{
  const ECPB=[0,10,16,26,18,24,16,18,22,22,26],NB=[0,1,1,1,2,2,4,4,4,5,5];
  const mul=(x,y)=>{let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x;}return z&255;};
  const rawMods=v=>{let r=(16*v+128)*v+64;if(v>=2){const n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36;}return r;};
  function rsDiv(n){const r=new Array(n).fill(0);r[n-1]=1;let root=1;for(let i=0;i<n;i++){for(let j=0;j<n;j++){r[j]=mul(r[j],root);if(j+1<n)r[j]^=r[j+1];}root=mul(root,2);}return r;}
  function rsRem(data,div){const r=new Array(div.length).fill(0);for(const b of data){const f=b^r.shift();r.push(0);div.forEach((c,i)=>{r[i]^=mul(c,f);});}return r;}
  function make(bytes){
    let ver=1;
    for(;ver<=10;ver++){const cap=Math.floor(rawMods(ver)/8)-ECPB[ver]*NB[ver];if(4+(ver<10?8:16)+bytes.length*8<=cap*8)break;}
    if(ver>10)throw new Error('Testo troppo lungo per il QR');
    const size=ver*4+17,cap=Math.floor(rawMods(ver)/8)-ECPB[ver]*NB[ver];
    const bits=[];const put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1);};
    put(4,4);put(bytes.length,ver<10?8:16);bytes.forEach(b=>put(b,8));
    put(0,Math.min(4,cap*8-bits.length));while(bits.length%8)bits.push(0);
    const data=[];for(let i=0;i<bits.length;i+=8){let v=0;for(let j=0;j<8;j++)v=v*2+bits[i+j];data.push(v);}
    for(let p=0xEC;data.length<cap;p^=0xEC^0x11)data.push(p);
    const nb=NB[ver],el=ECPB[ver],raw=Math.floor(rawMods(ver)/8),ns=nb-raw%nb,sl=Math.floor(raw/nb),div=rsDiv(el),blocks=[];
    for(let i=0,k=0;i<nb;i++){const d=data.slice(k,k+sl-el+(i<ns?0:1));k+=d.length;const e=rsRem(d,div);if(i<ns)d.push(0);blocks.push(d.concat(e));}
    const all=[];for(let i=0;i<blocks[0].length;i++)blocks.forEach((b,j)=>{if(i!==sl-el||j>=ns)all.push(b[i]);});
    const M=[],F=[];for(let y=0;y<size;y++){M.push(new Array(size).fill(false));F.push(new Array(size).fill(false));}
    const set=(x,y,d)=>{M[y][x]=d;F[y][x]=true;};
    for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
    const finder=(x,y)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),xx=x+dx,yy=y+dy;if(xx>=0&&xx<size&&yy>=0&&yy<size)set(xx,yy,d!==2&&d!==4);}};
    finder(3,3);finder(size-4,3);finder(3,size-4);
    const ap=[];if(ver>1){const n=Math.floor(ver/7)+2,st=ver===32?26:Math.ceil((ver*4+4)/(n*2-2))*2;ap.push(6);for(let p=size-7;ap.length<n;p-=st)ap.splice(1,0,p);}
    ap.forEach((cx,i)=>ap.forEach((cy,j)=>{const n=ap.length;if((i===0&&j===0)||(i===0&&j===n-1)||(i===n-1&&j===0))return;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(cx+dx,cy+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}));
    const fmt=m=>{let rem=m;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);const b=((m<<10)|rem)^0x5412,g=i=>((b>>>i)&1)===1;
      for(let i=0;i<=5;i++)set(8,i,g(i));set(8,7,g(6));set(8,8,g(7));set(7,8,g(8));for(let i=9;i<15;i++)set(14-i,8,g(i));
      for(let i=0;i<8;i++)set(size-1-i,8,g(i));for(let i=8;i<15;i++)set(8,size-15+i,g(i));set(8,size-8,true);};
    fmt(0);
    if(ver>=7){let rem=ver;for(let i=0;i<12;i++)rem=(rem<<1)^((rem>>>11)*0x1F25);const b=(ver<<12)|rem;for(let i=0;i<18;i++){const t=((b>>>i)&1)===1,a=size-11+i%3,c=Math.floor(i/3);set(a,c,t);set(c,a,t);}}
    let i=0;
    for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;if(!F[y][x]&&i<all.length*8){M[y][x]=((all[i>>>3]>>>(7-(i&7)))&1)===1;i++;}}}
    const inv=(m,x,y)=>[(x+y)%2===0,y%2===0,x%3===0,(x+y)%3===0,(Math.floor(x/3)+Math.floor(y/2))%2===0,x*y%2+x*y%3===0,(x*y%2+x*y%3)%2===0,((x+y)%2+x*y%3)%2===0][m];
    const mask=m=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!F[y][x]&&inv(m,x,y))M[y][x]=!M[y][x];};
    const pen=()=>{let p=0;
      for(let a=0;a<size;a++){for(const t of [0,1]){let run=1;for(let b=1;b<size;b++){const c=t?M[b][a]:M[a][b],q=t?M[b-1][a]:M[a][b-1];if(c===q){run++;if(run===5)p+=3;else if(run>5)p++;}else run=1;}}}
      for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++)if(M[y][x]===M[y][x+1]&&M[y][x]===M[y+1][x]&&M[y][x]===M[y+1][x+1])p+=3;
      return p;};
    let best=0,bp=1e9;
    for(let m=0;m<8;m++){mask(m);fmt(m);const p=pen();if(p<bp){bp=p;best=m;}mask(m);}
    mask(best);fmt(best);
    return M;
  }
  return {make};
})();
/* ---------- bitmap → righe di incisione ---------- */
function bitmapRuns(x0,y0,cell,iv,pct,F,rows,get,w){
  const ops=[],n=rows;let dir=true;
  for(let r=0;r<n;r++){
    const runs=[];let s=-1;
    for(let c=0;c<=w;c++){const on=c<w&&get(c,r);if(on&&s<0)s=c;if(!on&&s>=0){runs.push([s,c]);s=-1;}}
    if(!runs.length)continue;
    const sub=Math.max(1,Math.round(cell/iv));
    for(let k=0;k<sub;k++){
      const y=y0+r*cell+(k+0.5)*cell/sub,rr=dir?runs:runs.slice().reverse();
      for(const q of rr)ops.push({k:'run',x0:dir?x0+q[0]*cell:x0+q[1]*cell,x1:dir?x0+q[1]*cell:x0+q[0]*cell,y,pct,F,iv:cell/sub});
      dir=!dir;
    }
  }
  return ops;
}
function qrOps(str,x,y,mod,pct,F){
  const b=[...new TextEncoder().encode(str)],M=QR.make(b);
  return {ops:bitmapRuns(x,y,mod,mod/2,pct,F,M.length,(c,r)=>M[r][c],M.length),size:M.length*mod};
}
function textOps(str,x,y,hmm,pct,F,iv){   // scritta in corsivo/grassetto rasterizzata con il canvas del browser
  const px=Math.round(hmm/iv),cv=document.createElement('canvas'),cx=cv.getContext('2d');
  cx.font='bold '+px+'px Arial, Helvetica, sans-serif';
  const w=Math.max(1,Math.ceil(cx.measureText(str).width)+2);
  cv.width=w;cv.height=Math.ceil(px*1.25);
  cx.font='bold '+px+'px Arial, Helvetica, sans-serif';cx.textBaseline='top';cx.fillStyle='#000';cx.fillText(str,1,0);
  const d=cx.getImageData(0,0,cv.width,cv.height).data;
  return {ops:bitmapRuns(x,y,iv,iv,pct,F,cv.height,(c,r)=>d[(r*cv.width+c)*4+3]>110,cv.width),w:w*iv,h:cv.height*iv};
}

/* ---------- modelli ---------- */
const GL={nome:'',sp:'3'},UPDS=[];
const LAB=12;   // potenza delle scritte (incisione leggera)
const parseG=str=>String(str||'').split('_').map(g=>nums(g.replace(/,/g,' ')));
const T=[
 {id:'scheda',name:'Scheda di prova (un foglio solo)',
  desc:'Un unico foglio da fare su ogni nuovo legno e da conservare. Sopra c\'è scritto il nome del materiale e lo spessore; poi i quadratini di taglio e di incisione (potenza × velocità), la scala di grigi, le linee per il fuoco, le fessure per gli incastri e un QR. Alla fine il foglio viene tagliato lungo il contorno. Per scegliere i valori giusti, fotografa il foglio col QR (o inquadralo con la camera) e tocca i quadratini migliori: laserBrio si ricorda potenza e velocità.',
  par:[['cs','Taglio: velocità (mm/min)','150,250,400'],['cp','Taglio: potenze (%)','70,85,100'],['es','Incisione: velocità (mm/min)','1500,2500,3500'],['ep','Incisione: potenze (%)','15,30,45'],
       ['rmin','Scala di grigi: da (%)','5'],['rmax','Scala di grigi: a (%)','50'],['rs','Scala di grigi: velocità','2000'],['fp','Fuoco: potenza (%)','30'],['fs','Fuoco: velocità','1500'],['step','Incastro: passo delle fessure (mm)','0.1'],
       ['qp','Potenza di scritte e QR (%)','30'],['cont','Taglia il contorno (si/no)','si']],
  gen(p,E){
    const cs=nums(p.cs).slice(0,5),cp=nums(p.cp).slice(0,5),es=nums(p.es).slice(0,5),ep=nums(p.ep).slice(0,5);
    if(!cs.length||!cp.length||!es.length||!ep.length)return [];
    const nome=(GL.nome||'Materiale').trim(),sp=(GL.sp||'').trim(),t=+sp||3,qp=Math.min(100,+p.qp||30),F=2000,c=8,g=5,ops=[],cuts=[];
    const t1=textOps(nome.toUpperCase(),4,3,5,qp,F,0.15);ops.push(...t1.ops);
    if(sp)ops.push(...textOps(sp+' mm',4,10.5,3.5,qp,F,0.15).ops);
    const oy=26,hy=oy-6;
    const grid=(ox,S,P,eng)=>{
      S.forEach((v,i)=>ops.push(...text(v,ox+i*(c+g)+(c-String(v).length*3)/2+0.6,hy,LAB)));
      P.forEach((v,j)=>ops.push(...text(v,ox-3-String(v).length*3,oy+j*(c+g)+(c-3.6)/2,LAB)));
      P.forEach((pc,j)=>S.forEach((v,i)=>{
        const x=ox+i*(c+g),y=oy+j*(c+g);
        if(eng)ops.push({k:'fill',x,y,w:c,h:c,pct:Math.min(100,pc),F:v,iv:0.1});
        else cuts.push({k:'cut',pts:rect(x,y,c,c),closed:true,pct:Math.min(100,pc),F:v,passes:1});
      }));
    };
    const ox1=16,ox2=ox1+cs.length*(c+g)+16;
    grid(ox1,cs,cp,false);grid(ox2,es,ep,true);
    const gb=oy+Math.max(cp.length,ep.length)*(c+g);
    const xq=ox2+es.length*(c+g)+6;
    const url='https://paleletribu.github.io/laserbrio/?m='+encodeURIComponent(nome)+(sp?'&s='+encodeURIComponent(sp):'')+'&g='+[cs,cp,es,ep].map(a=>a.join(',')).join('_');
    const q=qrOps(url,xq,4,0.8,qp,F);ops.push(...q.ops);
    // fuoco: 6 linee sotto il QR
    const yf=4+q.size+6,fp=Math.min(100,+p.fp||30),fs=+p.fs||1500;
    for(let i=0;i<6;i++){ops.push({k:'line',pts:[[xq+6,yf+i*4],[xq+q.size,yf+i*4]],pct:fp,F:fs});ops.push(...text(i+1,xq,yf+i*4-1.8,LAB));}
    // riga 2: scala di grigi e fessure
    const y2=gb+4,a0=Math.max(1,+p.rmin||5),a1=Math.min(100,+p.rmax||50);
    for(let i=0;i<6;i++){
      const pc=Math.round(a0+(a1-a0)*i/5),x=4+i*11;
      ops.push({k:'fill',x,y:y2,w:8,h:14,pct:pc,F:+p.rs||2000,iv:0.1});
      ops.push(...text(pc,x+(8-String(pc).length*3)/2+0.6,y2+16,LAB));
    }
    const co=E.cut(),sx=4+6*11+10,st=Math.max(0.02,+p.step||0.1);
    for(let i=0;i<7;i++){
      const w=t+(i-3)*st,x=sx+i*9+(9-w)/2,lab=String(Math.round(w*10));
      ops.push(...text(lab,sx+i*9+(9-lab.length*3)/2+0.6,y2+16,LAB));
      cuts.push({k:'cut',pts:rect(x,y2,w,12),closed:true,pct:co.pct,F:co.F,passes:co.passes});
    }
    const W=Math.max(xq+q.size+4,sx+63+4,t1.w+8),H=Math.max(y2+24,yf+24+2);
    const all=ops.concat(cuts);
    if(!/^n/i.test(String(p.cont).trim()))all.push({k:'cut',pts:rect(0,0,W,H),closed:true,pct:co.pct,F:co.F,passes:co.passes});
    return all;}}
];

/* ---------- G-code ---------- */
function build(ops,smax){
  const out=['G54','G21','G90','M4 S0'];let len=0,sec=0;
  for(const o of ops){
    const S=Math.round(o.pct/100*smax),F=Math.round(o.F);
    if(o.k==='run'){
      out.push('G0 X'+f2(o.x0)+' Y'+f2(o.y));out.push('G1 X'+f2(o.x1)+' S'+S+' F'+F);
      len+=Math.abs(o.x1-o.x0);sec+=Math.abs(o.x1-o.x0)/(F/60)+0.02;
    }else if(o.k==='fill'){
      const n=Math.max(1,Math.round(o.h/o.iv));
      for(let r=0;r<n;r++){
        const y=o.y+(r+0.5)*o.h/n,fw=r%2===0,xa=fw?o.x:o.x+o.w,xb=fw?o.x+o.w:o.x;
        out.push('G0 X'+f2(xa)+' Y'+f2(y));out.push('G1 X'+f2(xb)+' S'+S+' F'+F);
        len+=o.w;sec+=o.w/(F/60);
      }
    }else{
      for(let ps=0;ps<(o.passes||1);ps++){
        const pts=o.closed?o.pts.concat([o.pts[0]]):o.pts;
        out.push('G0 X'+f2(pts[0][0])+' Y'+f2(pts[0][1]));
        out.push('G1 X'+f2(pts[1][0])+' Y'+f2(pts[1][1])+' S'+S+' F'+F);
        for(let i=2;i<pts.length;i++)out.push('X'+f2(pts[i][0])+' Y'+f2(pts[i][1]));
        for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);len+=d;sec+=d/(F/60);}
      }
    }
  }
  out.push('M5','G0 X0 Y0');
  return {lines:out,timeSec:sec*1.1+10,len};
}
function bounds(ops){
  let a=1e9,b=1e9,c=-1e9,d=-1e9;
  const add=(x,y)=>{if(x<a)a=x;if(x>c)c=x;if(y<b)b=y;if(y>d)d=y;};
  for(const o of ops){if(o.k==='run'){add(o.x0,o.y);add(o.x1,o.y);}else if(o.k==='fill'){add(o.x,o.y);add(o.x+o.w,o.y+o.h);}else for(const q of o.pts)add(q[0],q[1]);}
  return {w:c-Math.min(a,0),h:d-Math.min(b,0)};
}

/* ---------- interfaccia ---------- */
function css(){
  if($('pvCss'))return;
  const s=document.createElement('style');s.id='pvCss';
  s.textContent=`#pvOv{position:fixed;inset:0;z-index:50;background:var(--bg);overflow:auto;-webkit-overflow-scrolling:touch}
#pvOv .in{max-width:900px;margin:0 auto;padding:12px 14px 60px}
#pvOv .top{display:flex;justify-content:space-between;align-items:center;gap:10px;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2;border-bottom:1px solid var(--line)}
.pvc{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:12px}
.pvc h3{margin:0 0 4px}
.pvc canvas{width:100%;max-width:420px;background:#fff;border:1px solid var(--line);border-radius:8px;display:block;margin:8px 0}
.pvp{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin:8px 0}
.pvp label{font-size:13px;color:var(--mute)}`;
  document.head.appendChild(s);
}
function draw(cv,ops,bd){
  const W=420,k=(W-20)/Math.max(bd.w,bd.h,1);
  cv.width=W;cv.height=Math.max(80,Math.round(bd.h*k+20));
  const x=cv.getContext('2d');x.fillStyle='#fbf7f0';x.fillRect(0,0,cv.width,cv.height);
  const X=v=>10+v*k,Y=v=>10+v*k;
  for(const o of ops){
    if(o.k==='run'){x.fillStyle='rgba(120,60,20,.9)';x.fillRect(X(Math.min(o.x0,o.x1)),Y(o.y)-0.5,Math.abs(o.x1-o.x0)*k,Math.max(1,o.iv*k));continue;}
    if(o.k==='fill'){x.fillStyle='rgba(150,80,30,'+(0.2+0.7*Math.min(1,o.pct/60))+')';x.fillRect(X(o.x),Y(o.y),o.w*k,o.h*k);continue;}
    x.strokeStyle=o.k==='cut'?'#b3261e':(o.pct<=LAB+1?'#8a7a68':'#7a4a22');x.lineWidth=o.k==='cut'?1.6:1;
    x.beginPath();o.pts.forEach((q,i)=>i?x.lineTo(X(q[0]),Y(q[1])):x.moveTo(X(q[0]),Y(q[1])));
    if(o.closed)x.closePath();x.stroke();
  }
}
function fmtTime(s){const m=Math.round(s/60);return m<1?'meno di 1 min':(m<60?m+' min':Math.floor(m/60)+' h '+(m%60)+' min');}
function card(parent,tp,E){
  const c=document.createElement('div');c.className='pvc';parent.appendChild(c);
  const h=document.createElement('h3');h.textContent=tp.name;c.appendChild(h);
  const d=document.createElement('div');d.className='hint';d.textContent=tp.desc;c.appendChild(d);
  const det=document.createElement('details');det.innerHTML='<summary>Valori della prova (si possono lasciare così)</summary>';c.appendChild(det);
  const g=document.createElement('div');g.className='pvp';det.appendChild(g);
  const val={};
  tp.par.forEach(([id,lab,d0])=>{
    const def=typeof d0==='function'?d0(E):d0;
    const l=document.createElement('label');l.textContent=lab;const i=document.createElement('input');i.type='text';i.value=def;val[id]=def;
    i.oninput=()=>{val[id]=i.value;upd();};l.appendChild(i);g.appendChild(l);
  });
  const cv=document.createElement('canvas');c.appendChild(cv);
  const info=document.createElement('div');info.className='hint';c.appendChild(info);
  const row=document.createElement('div');row.className='row';row.style.marginTop='8px';c.appendChild(row);
  const go=document.createElement('button');go.className='btn primary';go.textContent='Invia al laser';row.appendChild(go);
  const dl=document.createElement('button');dl.className='btn';dl.textContent='Scarica il G-code';row.appendChild(dl);
  let cur=null;
  function upd(){
    try{
      const ops=tp.gen(val,E);
      if(!ops.length)throw new Error('Controlla i valori scritti.');
      const bd=bounds(ops),r=build(ops,E.smax()),A=E.area();
      draw(cv,ops,bd);
      const fits=bd.w<=A.w&&bd.h<=A.h;
      info.style.color=fits?'':'var(--bad)';
      info.textContent='Misura circa '+Math.round(bd.w)+' × '+Math.round(bd.h)+' mm · tempo circa '+fmtTime(r.timeSec)+(fits?' · parte dall\'origine che hai impostato (angolo in basso a sinistra del legno).':' · NON entra nell\'area di lavoro ('+A.w+' × '+A.h+' mm).');
      cur=fits?r:null;
    }catch(e){info.style.color='var(--bad)';info.textContent=e.message;cur=null;}
    go.disabled=dl.disabled=!cur;
  }
  go.onclick=()=>{if(!cur)return;$('pvOv').hidden=true;document.body.style.overflow='';E.startJob(cur,tp.name);};
  dl.onclick=()=>{if(!cur)return;const b=new Blob([cur.lines.join('\n')+'\n'],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='laserbrio-prova-'+tp.id+'.gcode';a.click();};
  UPDS.push(upd);upd();
}

/* ---------- scegli i quadratini migliori: laserBrio si ricorda i valori ---------- */
function picker(box,d,full){
  const G=parseG(d.g);if(G.length<4||G.some(a=>!a.length))return;
  const [cs,cp,es,ep]=G;let selC=null,selE=null;
  const wrap=document.createElement('div');wrap.style.marginTop='8px';box.appendChild(wrap);
  const mk=(title,S,P,pick)=>{
    const h=document.createElement('p');h.className='hint';h.textContent=title;wrap.appendChild(h);
    const t=document.createElement('div');t.style.cssText='display:grid;grid-template-columns:repeat('+S.length+',1fr);gap:6px;max-width:420px';
    P.forEach(pc=>S.forEach(v=>{
      const b=document.createElement('button');b.className='btn';b.style.cssText='padding:8px 2px;font-size:13px';b.textContent=pc+'% · '+v;
      b.onclick=()=>{pick(pc,v);t.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');sv.disabled=false;};
      t.appendChild(b);
    }));
    wrap.appendChild(t);
  };
  mk('Taglio: tocca il quadratino che si è staccato bene con la velocità più alta (potenza % · velocità mm/min).',cs,cp,(pc,v)=>{selC=[pc,v];});
  mk('Incisione: tocca il quadrato con il tono che ti piace, senza bruciare (potenza % · velocità mm/min).',es,ep,(pc,v)=>{selE=[pc,v];});
  const sv=document.createElement('button');sv.className='btn primary';sv.textContent='Salva questo materiale';sv.disabled=true;sv.style.marginTop='10px';wrap.appendChild(sv);
  const st=document.createElement('p');st.className='hint';wrap.appendChild(st);
  sv.onclick=()=>{
    const m={id:'c_'+Date.now(),name:full,minP:8,maxP:65,speed:2500};
    if(selE){m.maxP=selE[0];m.minP=Math.max(1,Math.round(selE[0]*0.15));m.speed=selE[1];}
    if(selC)m.cut={speed:selC[1],passes:1,power:selC[0]};
    window.Lb.saveMat(m);sv.disabled=true;
    st.textContent='Salvato: '+full+(selC?' · taglio '+selC[0]+'% a '+selC[1]:'')+(selE?' · incisione fino al '+selE[0]+'% a '+selE[1]:'')+'. Ora lo trovi nell\'elenco dei materiali.';
  };
}
let jsq=null;
function loadJsQR(){
  if(window.jsQR)return Promise.resolve();
  return jsq||(jsq=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';s.onload=res;s.onerror=()=>{jsq=null;rej(new Error('rete'));};document.head.appendChild(s);}));
}
async function decodeQR(src){
  if(window.BarcodeDetector){try{const r=await new BarcodeDetector({formats:['qr_code']}).detect(src);if(r[0]&&r[0].rawValue)return r[0].rawValue;}catch(e){}}
  await loadJsQR();
  for(const k of [1,0.6,0.35]){
    const w=Math.round(src.width*k),h=Math.round(src.height*k),cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const cx=cv.getContext('2d');cx.drawImage(src,0,0,w,h);
    const r=window.jsQR(cx.getImageData(0,0,w,h).data,w,h);if(r&&r.data)return r.data;
  }
  return null;
}
async function readScheda(src,msgEl){
  msgEl.style.color='';msgEl.textContent='Leggo il QR…';
  let txt=null;
  try{txt=await decodeQR(src);}catch(e){msgEl.style.color='var(--bad)';msgEl.textContent='Non riesco a caricare il lettore: serve internet.';return;}
  if(!txt){msgEl.style.color='var(--bad)';msgEl.textContent='Non trovo il QR. Riprova con più luce, tutto il QR dentro la foto e senza riflessi.';return;}
  let q=null;try{q=new URL(txt).searchParams;}catch(e){}
  if(!q||!q.get('m')){msgEl.style.color='var(--bad)';msgEl.textContent='Questo QR non è di una scheda laserBrio.';return;}
  $('pvOv').hidden=true;document.body.style.overflow='';
  window.Lb.material({m:q.get('m'),s:q.get('s'),g:q.get('g'),c:q.get('c'),i:q.get('i')});
}
function fromFile(f,msgEl){
  const img=new Image(),u=URL.createObjectURL(f);
  img.onload=()=>{const k=Math.min(1,2000/Math.max(img.width,img.height)),cv=document.createElement('canvas');cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);URL.revokeObjectURL(u);readScheda(cv,msgEl);};
  img.onerror=()=>{msgEl.style.color='var(--bad)';msgEl.textContent='Non riesco ad aprire la foto.';};
  img.src=u;
}
function open(){
  const E=window.Lb;if(!E){alert('Riprova tra un attimo.');return;}
  css();
  let o=$('pvOv');
  if(!o){
    o=document.createElement('div');o.id='pvOv';
    o.innerHTML='<div class="in"><div class="top"><h2 style="margin:0">Modelli di prova</h2><button class="btn" id="pvX">Chiudi</button></div><div class="pvc" style="margin-top:10px"><div class="pvp"><label>Nome del materiale<input type="text" id="pvNome" placeholder="es. Compensato pioppo"></label><label>Spessore (mm)<input type="text" id="pvSp" value="3"></label></div></div><div class="pvc" style="margin-top:10px"><b>Hai già inciso la scheda?</b><p class="hint" style="margin:4px 0 8px">Fotografala con il QR, oppure inquadrala con la camera: poi tocca i quadratini migliori e laserBrio si ricorda i valori.</p><div class="row"><button class="btn primary" id="pvFoto">Fotografa o scegli una foto</button><button class="btn" id="pvVideo">Leggi dal video della camera</button><input type="file" id="pvFile" accept="image/*" capture="environment" hidden></div><p class="hint" id="pvRd"></p></div><p class="hint">Schede di calibrazione generate da laserBrio. Fanne una su ogni nuovo materiale: sul legno restano scritti i valori usati, così scegli quello giusto e lo ricopi nelle impostazioni. Usa un ritaglio dello stesso legno del lavoro vero e imposta l\'origine come al passo 4.</p><div id="pvL"></div></div>';
    document.body.appendChild(o);
    $('pvX').onclick=()=>{o.hidden=true;document.body.style.overflow='';};
    T.forEach(tp=>card($('pvL'),tp,E));
    $('pvFoto').onclick=()=>$('pvFile').click();
    $('pvFile').onchange=ev=>{const f=ev.target.files[0];ev.target.value='';if(f)fromFile(f,$('pvRd'));};
    $('pvVideo').onclick=()=>{const v=$('camVid');if(!v||!v.videoWidth){$('pvRd').style.color='var(--bad)';$('pvRd').textContent='La camera non è accesa: aprila prima (passo 4, "Usa la camera").';return;}const cv=document.createElement('canvas');cv.width=v.videoWidth;cv.height=v.videoHeight;cv.getContext('2d').drawImage(v,0,0);readScheda(cv,$('pvRd'));};
    $('pvNome').oninput=()=>{GL.nome=$('pvNome').value;UPDS.forEach(f=>f());};
    $('pvSp').oninput=()=>{GL.sp=$('pvSp').value;UPDS.forEach(f=>f());};
  }
  o.hidden=false;document.body.style.overflow='hidden';o.scrollTop=0;
}
window.Prove={open,picker};
})();
