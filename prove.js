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
const rrect=(x,y,w,h,r)=>{const p=[],a=(cx,cy,a0)=>{for(let k=0;k<=6;k++){const t=(a0+k*15)*Math.PI/180;p.push([cx+r*Math.cos(t),cy+r*Math.sin(t)]);}};a(x+w-r,y+r,-90);a(x+w-r,y+h-r,0);a(x+r,y+h-r,90);a(x+r,y+r,180);return p;};
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
function textOps(str,x,y,hmm,pct,F,iv,wt){   // scritta in corsivo/grassetto rasterizzata con il canvas del browser
  const px=Math.round(hmm/iv),cv=document.createElement('canvas'),cx=cv.getContext('2d');
  cx.font=(wt||'bold')+' '+px+'px Arial, Helvetica, sans-serif';
  const w=Math.max(1,Math.ceil(cx.measureText(str).width)+2);
  cv.width=w;cv.height=Math.ceil(px*1.25);
  cx.font=(wt||'bold')+' '+px+'px Arial, Helvetica, sans-serif';cx.textBaseline='top';cx.fillStyle='#000';cx.fillText(str,1,0);
  const d=cx.getImageData(0,0,cv.width,cv.height).data;
  return {ops:bitmapRuns(x,y,iv,iv,pct,F,cv.height,(c,r)=>d[(r*cv.width+c)*4+3]>110,cv.width),w:w*iv,h:cv.height*iv};
}
function tmeasure(str,hmm,iv,wt){const px=Math.round(hmm/iv),cx=document.createElement('canvas').getContext('2d');cx.font=(wt||'bold')+' '+px+'px Arial, Helvetica, sans-serif';return (Math.ceil(cx.measureText(String(str)).width)+2)*iv;}

/* ---------- modelli ---------- */
const GL={nome:'',sp:'3'},UPDS=[];
const LAB=12;   // potenza delle scritte (incisione leggera)
const parseG=str=>String(str||'').split('_').map(g=>nums(g.replace(/,/g,' ')));
function gbox(all){const bb={};all.forEach(o=>{const b=bb[o.g]||(bb[o.g]={x0:1e9,y0:1e9,x1:-1e9,y1:-1e9}),fn=(x,y)=>{if(x<b.x0)b.x0=x;if(x>b.x1)b.x1=x;if(y<b.y0)b.y0=y;if(y>b.y1)b.y1=y;};if(o.k==='run'){fn(o.x0,o.y);fn(o.x1,o.y);}else if(o.k==='fill'){fn(o.x,o.y);fn(o.x+o.w,o.y+o.h);}else o.pts.forEach(q=>fn(q[0],q[1]));});return bb;}
const T=[
 {id:'scheda',name:'Scheda di prova (un foglio solo)',
  desc:'Un foglio solo da incidere su ogni nuovo legno e da conservare: nome, spessore e data, quadratini di taglio e di incisione, fuoco, tacche sul lato per provare gli incastri, piegature e un QR. Dopo l\'incisione fotografa il foglio col QR: laserBrio ti guida a scegliere i valori giusti e li ricorda.',
  par:[['cs','Taglio: velocità (mm/min)','150,250,400'],['cp','Taglio: potenze (%)','70,85,100'],['es','Incisione: velocità (mm/min)','1500,2500,3500'],['ep','Incisione: potenze (%)','15,30,45'],
       ['fp','Fuoco: potenza (%)','30'],['fs','Fuoco: velocità','1500'],['step','Incastro: passo delle fessure (mm)','0.1'],
       ['qp','Potenza di scritte e QR (%)','30'],['hg','Piegatura: distanza tra le righe (mm)','2,2.75,3.5'],['cont','Taglia il contorno (si/no)','si']],
  gen(p,E,xf){
    const cs=nums(p.cs).slice(0,5),cp=nums(p.cp).slice(0,5),es=nums(p.es).slice(0,5),ep=nums(p.ep).slice(0,5);
    if(!cs.length||!cp.length||!es.length||!ep.length)return [];
    const nome=(GL.nome||'Materiale').trim(),sp=(GL.sp||'').trim(),t=+sp||3,qp=Math.min(100,+p.qp||30),F=2000,c=8,g=5,ops=[],cuts=[];
    let cg='head';const tagA=a=>{const pp=a.push.bind(a);a.push=(...xs)=>{xs.forEach(x=>{if(!x.g)x.g=cg;});return pp(...xs);};return a;};tagA(ops);tagA(cuts);
    const t1=textOps(nome,4,2.5,6,qp,F,0.15,'600');ops.push(...t1.ops);
    const tsp=sp?textOps(sp+' mm',4,11.8,2.8,Math.min(qp,LAB+10),F,0.15,'600'):null;if(tsp)ops.push(...tsp.ops);
    const dd=new Date(),ds=String(dd.getDate()).padStart(2,'0')+'/'+String(dd.getMonth()+1).padStart(2,'0')+'/'+String(dd.getFullYear()).slice(2);
    ops.push(...textOps(ds,4+(tsp?tsp.w+5:0),11.8,2.8,Math.min(qp,LAB+8),F,0.15,'600').ops);
    const tit=(s,x,y,h)=>ops.push(...textOps(s,Math.max(4,x),y,h||2.4,Math.min(qp,LAB+10),F,0.15,'600').ops);
    const nl=(v,x,y,al)=>{const hh=2.4,w=tmeasure(v,hh,0.15,'500');ops.push(...textOps(String(v),al==='c'?x-w/2:al==='r'?x-w:x,y,hh,Math.min(qp,LAB+6),F,0.15,'500').ops);};
    const oy=26,hy=oy-6;
    const grid=(ox,S,P,eng)=>{
      S.forEach((v,i)=>nl(v,ox+i*(c+g)+c/2,hy,'c'));
      P.forEach((v,j)=>nl(v,ox-2.5,oy+j*(c+g)+(c-2.4)/2,'r'));
      P.forEach((pc,j)=>S.forEach((v,i)=>{
        const x=ox+i*(c+g),y=oy+j*(c+g);
        if(eng)ops.push({k:'fill',x,y,w:c,h:c,pct:Math.min(100,pc),F:v,iv:0.1});
        else cuts.push({k:'cut',pts:rrect(x,y,c,c,1.2),closed:true,pct:Math.min(100,pc),F:v,passes:1});
      }));
    };
    const ox1=16,ox2=ox1+cs.length*(c+g)+16;
    cg='taglio';grid(ox1,cs,cp,false);tit('Taglio',ox1-9,16);
    cg='incis';grid(ox2,es,ep,true);tit('Incisione',ox2-9,16);
    cg='qr';
    const gb=oy+Math.max(cp.length,ep.length)*(c+g);
    const xq=ox2+es.length*(c+g)+6;
    const hgs=nums(p.hg).filter(v=>v>=0.5&&v<=8).slice(0,3);
    const hp=hgs.map(v=>['R',v]).concat(hgs.map(v=>['L',v]));
    const od=g=>{const t=xf&&xf[g];return t?[t.dx||0,t.dy||0]:[0,0]},dq=od('qr'),di=od('incis'),dt2=od('taglio'),rl=v=>Math.round(v*10)/10,ofs=[di[0]-dq[0],di[1]-dq[1],dt2[0]-dq[0],dt2[1]-dq[1]].map(rl);
    const url='https://paleletribu.github.io/laserbrio/?m='+encodeURIComponent(nome)+(sp?'&s='+encodeURIComponent(sp):'')+'&g='+[cs,cp,es,ep].map(a=>a.join(',')).join('_')+'&p='+(+p.step||0.1)+(hp.length?'&h='+hp.map(a=>a[0]+a[1]).join(','):'')+(ofs.some(v=>v)?'&o='+ofs.join(','):'');
    if(window.Prove)window.Prove._url=url;
    const q=qrOps(url,xq,4,0.8,qp,F);ops.push(...q.ops);
    // fuoco: 6 linee sotto il QR
    const yf=4+q.size+6,fp=Math.min(100,+p.fp||30),fs=+p.fs||1500;
    for(let i=0;i<6;i++){ops.push({k:'line',pts:[[xq+6,yf+i*5],[xq+q.size,yf+i*5]],pct:fp,F:fs});nl(i+1,xq,yf+i*5-1.2,'l');}
    // riga 2: fessure e pannellini da incastrare (la linguetta è larga quanto lo spessore scritto)
    const y2=Math.max(gb+5,yf+6*5+1);
    const co=E.cut(),sx=4;tit('Fuoco',xq,yf-4.5);const st=Math.max(0.02,+p.step||0.1);
    const px0=sx;
    // forme piccole (a sinistra) e scritte (a destra), in una fascia sotto la parte alta
    cg='forme';
    const xr=xq+q.size+8,yB=4,SZ=[1,2,3,4,5,6,8,10],yS=yB+13,SD=SZ.slice().reverse();
    const lay=a=>{let x=xr;return a.map(v=>{const o=x;x+=v+4;return [o,o+v,v];});};
    const rA=lay(SZ),rD=lay(SD),xs=xr+SZ.reduce((u,v)=>u+v+4,0);
    // il passo tra le file è il minimo che evita le sovrapposizioni (la fila centrale è in ordine inverso, così le forme si incastrano)
    const need=(p1,p2)=>{let m=0;p1.forEach(u=>p2.forEach(w=>{if(u[0]<w[1]+1.5&&w[0]<u[1]+1.5)m=Math.max(m,(u[2]+w[2])/2+3);}));return m;};
    const PR=Math.max(need(rA,rD),need(rD,rA),9);
    tit('Forme piccole (mm) · esagoni in ordine inverso',xr,yB);
    rA.forEach(([x0,x1,v])=>nl(v,(x0+x1)/2,yB+6.5,'c'));
    const cy=k=>yS+5+k*PR,circ=(cx,cyy,r,n,a0)=>{const o=[];for(let k=0;k<n;k++){const a=a0+k*2*Math.PI/n;o.push([cx+r*Math.cos(a),cyy+r*Math.sin(a)]);}return o;};
    rA.forEach(([x0,x1,v])=>{cuts.push({k:'cut',pts:circ((x0+x1)/2,cy(0),v/2,24,0),closed:true,pct:co.pct,F:co.F,passes:co.passes});cuts.push({k:'cut',pts:rect(x0,cy(2)-v/2,v,v),closed:true,pct:co.pct,F:co.F,passes:co.passes});});
    rD.forEach(([x0,x1,v])=>cuts.push({k:'cut',pts:circ((x0+x1)/2,cy(1),v/2,6,0),closed:true,pct:co.pct,F:co.F,passes:co.passes}));
    cg='scritte';
    const xt=xs+10,yT=yB+7;tit('Scritte (altezza in mm)',xt,yB);let yt=yT;
    [1.5,2,2.5,3,3.5,4].forEach(hh=>{ops.push(...textOps('Prova '+hh,xt,yt,hh,qp,F,0.15,'600').ops);yt+=hh+2.6;});
    const yE=Math.max(yt,cy(2)+5);
    // piegature: 6 linguette attaccate al foglio (tagliate su 3 lati), con le righe che arrivano quasi ai bordi
    const NAME={R:'Righe',L:'Lenti'},th=44,pcol=46,pw=42,yH=Math.max(y2,yE)+8;
    hp.forEach(([ty,pt],i)=>{
      cg='h'+i;
      const x0=4+i*pcol,y0=yH+11,by=y0+8,bh=th-8-10;
      tit(NAME[ty]+' · '+pt+' mm',x0,y0-4.6,2.1);
      // righe dritte (come i modelli di cerniera classici): tratti da bordo a bordo, sfalsati di mezzo passo; lenti: stesso schema con tagli a lente
      const n=Math.floor(bh/pt)+1,yc=by+(bh-(n-1)*pt)/2,iw=pw,X=x0,lens=ty==='L',gp=lens?2.5:2.4,nn=3,Ls=(iw-(nn-1)*gp)/nn,P=Ls+gp,hw=Math.min(0.3*pt,1);
      // lo schema è simmetrico rispetto al centro della linguetta; le file dispari sono sfalsate di mezzo passo e i pezzi sul bordo sono tagliati dal bordo
      for(let r=0;r<n;r++){
        const y=yc+r*pt;
        const segs=[];
        if(lens){const Pl=pw/2,Ll=Pl-gp;if(r%2)segs.push([Pl-Ll/2,Pl+Ll/2],[0,Ll/2-gp/2],[pw-(Ll/2-gp/2),pw]);else segs.push([Pl/2-Ll/2,Pl/2+Ll/2],[1.5*Pl-Ll/2,1.5*Pl+Ll/2]);}
        else for(let a=(r%2?-P/2:0);a<iw-0.01;a+=P){const s0=Math.max(a,0),s1=Math.min(a+Ls,iw);if(s1-s0>=1.5)segs.push([s0,s1]);}
        segs.forEach(([s0,s1])=>{
          let pts,closed=false;
          if(lens){closed=true;const m=Math.max(6,2*Math.round((s1-s0)/1.4)),up=[],dn=[];for(let k=0;k<=m;k++){const x=s0+(s1-s0)*k/m,hh=hw*Math.sin(Math.PI*k/m);up.push([X+x,y-hh]);dn.push([X+x,y+hh]);}pts=up.concat(dn.slice(1,-1).reverse());}
          else pts=[[X+s0,y],[X+s1,y]];
          cuts.push({k:'cut',pts,closed,pct:co.pct,F:co.F,passes:co.passes});
        });
      }
      cuts.push({k:'cut',pts:[[x0,y0],[x0,y0+th],[x0+pw,y0+th],[x0+pw,y0]],closed:false,pct:co.pct,F:co.F,passes:co.passes});
    });
    const MG=19;
    // tutto il disegno si sposta a destra di MG mm; a sinistra restano le tacche aperte sul bordo (si liberano con il taglio del contorno)
    const mv=o=>{if(o.pts)o.pts=o.pts.map(p=>[p[0]+MG,p[1]]);if(o.x0!==undefined){o.x0+=MG;o.x1+=MG;}if(o.x!==undefined&&o.pts===undefined)o.x+=MG;};
    ops.forEach(mv);cuts.forEach(mv);
    cg='tacche';
    const nt=[-3,-2,-1,0,1,2,3];
    tit('Tacche (mm)',3,5);
    nt.forEach((d,i)=>{
      const w=t+d*st,y=13+i*12.5;
      cuts.push({k:'cut',pts:[[0,y],[10,y],[10,y+w],[0,y+w]],closed:false,pct:co.pct,F:co.F,passes:co.passes});
      nl(String(Math.round(w*100)/100),12,y+w/2-1.2,'l');
    });
    return ops.concat(cuts);},
  fin(all,xf,p,E){   // applica gli spostamenti/ingrandimenti dei pezzi, poi disegna il contorno attorno a tutto
    const co=E.cut(),ext=(o,fn)=>{if(o.k==='run'){fn(o.x0,o.y);fn(o.x1,o.y);}else if(o.k==='fill'){fn(o.x,o.y);fn(o.x+o.w,o.y+o.h);}else o.pts.forEach(q=>fn(q[0],q[1]));};
    const bb=gbox(all);
    const TT={},eff={};
    for(const g in (xf||{})){
      const t=xf[g],b=bb[g];if(!t||!b||g==='tacche')continue;
      const fx=g==='taglio'||g==='incis'||g==='qr',sc=fx?1:(t.s||1),r=(fx?0:(t.r||0))*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
      const f=(x,y)=>{const u=(x-cx)*sc,v=(y-cy)*sc;return [cx+cs*u-sn*v,cy+sn*u+cs*v];};
      let mnx=1e9,mny=1e9;all.forEach(o=>{if(o.g===g)ext(o,(x,y)=>{const q=f(x,y);if(q[0]<mnx)mnx=q[0];if(q[1]<mny)mny=q[1];});});
      TT[g]={f,sc,rot:Math.abs(r)>1e-6,dx:Math.max(t.dx||0,19-mnx),dy:Math.max(t.dy||0,2-mny)};eff[g]=[TT[g].dx,TT[g].dy];
    }
    const out=all.map(o=>{
      const T_=TT[o.g];if(!T_)return o;
      const c=Object.assign({},o),m=(x,y)=>{const q=T_.f(x,y);return [q[0]+T_.dx,q[1]+T_.dy];};
      if(o.k==='run'){const p0=m(o.x0,o.y),p1=m(o.x1,o.y);if(T_.rot){c.k='line';c.pts=[p0,p1];delete c.x0;delete c.x1;delete c.y;}else{c.x0=p0[0];c.x1=p1[0];c.y=p0[1];}c.iv=(o.iv||0)*T_.sc;}
      else if(o.k==='fill'){const p0=m(o.x,o.y);c.x=p0[0];c.y=p0[1];c.w=o.w*T_.sc;c.h=o.h*T_.sc;}
      else c.pts=o.pts.map(q=>m(q[0],q[1]));
      return c;
    });
    let mx=0,my=0;out.forEach(o=>ext(o,(x,y)=>{if(x>mx)mx=x;if(y>my)my=y;}));
    const W=mx+4,H=Math.max(my+4,105);
    if(!/^n/i.test(String(p.cont).trim()))out.push({k:'cut',g:'contorno',pts:rrect(0,0,W,H,4),closed:true,pct:co.pct,F:co.F,passes:co.passes});
    out.eff=eff;return out;}}
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
function flipY(ops,H){   // il disegno ha la Y verso il basso, il laser verso il fondo: senza questo scritte e QR verrebbero specchiati
  return ops.map(o=>{
    if(o.k==='run')return Object.assign({},o,{y:H-o.y});
    if(o.k==='fill')return Object.assign({},o,{y:H-o.y-o.h});
    return Object.assign({},o,{pts:o.pts.map(q=>[q[0],H-q[1]])});
  });
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
.pvc canvas{width:100%;max-width:560px;background:#fff;border:1px solid var(--line);border-radius:8px;display:block;margin:8px 0}
.pvp{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin:8px 0}
.pvp label{font-size:13px;color:var(--mute)}`;
  document.head.appendChild(s);
}
function draw(cv,ops,bd){
  const W=900,k=(W-30)/Math.max(bd.w,bd.h,1);
  cv.width=W;cv.height=Math.max(120,Math.round(bd.h*k+30));
  const x=cv.getContext('2d');x.fillStyle='#f4ece1';x.fillRect(0,0,cv.width,cv.height);
  x.fillStyle='#e2b98a';x.beginPath();x.roundRect?x.roundRect(15-4,15-4,bd.w*k+8,bd.h*k+8,14):x.rect(11,11,bd.w*k+8,bd.h*k+8);x.fill();
  cv._k=k;
  const X=v=>15+v*k,Y=v=>15+v*k;
  for(const o of ops){
    if(o.k==='run'){x.fillStyle='rgba(120,60,20,.9)';x.fillRect(X(Math.min(o.x0,o.x1)),Y(o.y)-0.5,Math.abs(o.x1-o.x0)*k,Math.max(1,o.iv*k));continue;}
    if(o.k==='fill'){x.fillStyle='rgba(150,80,30,'+(0.2+0.7*Math.min(1,o.pct/60))+')';x.fillRect(X(o.x),Y(o.y),o.w*k,o.h*k);continue;}
    x.strokeStyle=o.k==='cut'?'#b3261e':(o.pct<=LAB+1?'#8a7a68':'#7a4a22');x.lineWidth=o.k==='cut'?1.6:1;
    x.beginPath();o.pts.forEach((q,i)=>i?x.lineTo(X(q[0]),Y(q[1])):x.moveTo(X(q[0]),Y(q[1])));
    if(o.closed)x.closePath();x.stroke();
  }
}
const bd0=ops=>bounds(ops).h;
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
  const FIX=new Set(['taglio','incis','qr']);
  let cur=null,raw=null,xf=(()=>{try{return JSON.parse(localStorage.getItem('lb_layout')||'{}')||{};}catch(e){return {};}})(),sel=null,edit=false,bbs={},kt=0;
  const ed=document.createElement('button');ed.className='btn';ed.textContent='Sposta e ridimensiona i pezzi';ed.style.marginTop='6px';
  const rs=document.createElement('button');rs.className='btn';rs.textContent='Rimetti come prima';rs.style.marginTop='6px';rs.hidden=true;
  const rot=document.createElement('button');rot.className='btn';rot.textContent='Ruota di 90°';rot.style.marginTop='6px';rot.hidden=true;
  const hint=document.createElement('div');hint.className='hint';hint.hidden=true;hint.textContent='Trascina un pezzo per spostarlo. Con il pezzo scelto, trascina il pallino in basso a destra per ingrandirlo o rimpicciolirlo, quello in alto per ruotarlo liberamente (oppure usa Ruota di 90°). Il foglio si adatta da solo. I quadrati di Taglio, quelli di Incisione e il QR si spostano ma non si ruotano né si ingrandiscono (la lettura della foto si ricorda dove li hai messi). Puoi usare anche le frecce della tastiera: 1 mm alla volta, con Maiusc 5 mm, con Ctrl 0,2 mm; R ruota di 90°.';
  c.insertBefore(ed,cv);c.insertBefore(rot,cv);c.insertBefore(rs,cv);c.insertBefore(hint,cv);
  rot.onclick=()=>{if(!sel||FIX.has(sel))return;const t=xf[sel]||(xf[sel]={dx:0,dy:0,s:1,r:0});t.r=(Math.round(((t.r||0)+90)/90)*90)%360;rs.hidden=false;view(true);};
  const onKey=e=>{
    if(!edit||!sel||sel==='tacche'||$('pvOv').hidden||/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||''))return;
    const st=e.shiftKey?5:(e.ctrlKey||e.metaKey?0.2:1),A={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]}[e.key];
    if(e.key==='r'||e.key==='R'){if(!FIX.has(sel)){e.preventDefault();rot.onclick();}return;}
    if(!A)return;e.preventDefault();
    const t=xf[sel]||(xf[sel]={dx:0,dy:0,s:1,r:0});t.dx+=A[0];t.dy+=A[1];rs.hidden=false;view(false);clearTimeout(kt);kt=setTimeout(upd,350);
  };
  document.addEventListener('keydown',onKey);
  ed.onclick=()=>{edit=!edit;sel=null;rot.hidden=!edit;ed.textContent=edit?'Fatto: smetti di spostare':'Sposta e ridimensiona i pezzi';hint.hidden=!edit;cv.style.touchAction=edit?'none':'';cv.style.cursor=edit?'move':'';view(false);};
  rs.onclick=()=>{xf={};sel=null;rs.hidden=true;view(true);};
  const NAMEG={base:'Intestazione, Taglio, Incisione e QR',forme:'Forme piccole',scritte:'Scritte'};
  function overlay(ops,bd){
    const x=cv.getContext('2d'),k=cv._k;if(!edit)return;
    bbs=gbox(ops.filter(o=>o.g!=='contorno'));
    x.save();x.lineWidth=2;
    for(const g in bbs){if(g==='tacche'||g==='contorno')continue;const b=bbs[g],on=g===sel;
      x.strokeStyle=on?'#1f6feb':'rgba(31,111,235,.45)';x.setLineDash(on?[]:[6,4]);
      x.strokeRect(15+b.x0*k-3,15+b.y0*k-3,(b.x1-b.x0)*k+6,(b.y1-b.y0)*k+6);
      if(on&&!FIX.has(g)){x.fillStyle='#1f6feb';x.beginPath();x.arc(15+b.x1*k+3,15+b.y1*k+3,8,0,7);x.fill();x.beginPath();x.moveTo(15+(b.x0+b.x1)/2*k,15+b.y0*k-3);x.lineTo(15+(b.x0+b.x1)/2*k,15+b.y0*k-20);x.stroke();x.beginPath();x.arc(15+(b.x0+b.x1)/2*k,15+b.y0*k-22,8,0,7);x.fill();}
    }
    x.restore();
  }
  function view(full){
    try{localStorage.setItem('lb_layout',JSON.stringify(xf));}catch(e){}rs.hidden=!Object.keys(xf).length;
    try{
      if(!raw)throw new Error('Controlla i valori scritti.');
      const ops=tp.fin?tp.fin(raw,xf,val,E):raw,bd=bounds(ops);if(ops.eff)for(const g in ops.eff)if(xf[g]){xf[g].dx=ops.eff[g][0];xf[g].dy=ops.eff[g][1];}
      Prove._last={ops,bd};
      draw(cv,ops,bd);overlay(ops,bd);
      if(!full)return;
      const r=build(flipY(ops,bd0(ops)),E.smax()),A=E.area();
      const fits=bd.w<=A.w&&bd.h<=A.h;
      info.style.color=fits?'':'var(--bad)';
      info.textContent='Misura circa '+Math.round(bd.w)+' × '+Math.round(bd.h)+' mm · tempo circa '+fmtTime(r.timeSec)+(fits?' · parte dall\'origine che hai impostato (angolo in basso a sinistra del legno).':' · NON entra nell\'area di lavoro ('+A.w+' × '+A.h+' mm).');
      cur=fits?r:null;
    }catch(e){info.style.color='var(--bad)';info.textContent=e.message;cur=null;}
    go.disabled=dl.disabled=!cur;
  }
  function upd(){
    try{raw=tp.gen(val,E,xf);if(!raw.length){raw=null;}}catch(e){raw=null;}
    view(true);
  }
  // trascinamento dei pezzi
  let drag=null,tmr=0;
  const pt=e=>{const r=cv.getBoundingClientRect(),k=cv._k||1;return [((e.clientX-r.left)*cv.width/r.width-15)/k,((e.clientY-r.top)*cv.height/r.height-15)/k];};
  cv.addEventListener('pointerdown',e=>{
    if(!edit)return;const [mx,my]=pt(e),k=cv._k||1;let hit=null,mode='move';
    if(sel&&!FIX.has(sel)&&bbs[sel]){const b=bbs[sel];if(Math.hypot((mx-b.x1)*k-3,(my-b.y1)*k-3)<14){hit=sel;mode='scale';}}
    if(!hit&&sel&&!FIX.has(sel)&&bbs[sel]){const b=bbs[sel];if(Math.hypot((mx-(b.x0+b.x1)/2)*k,(my-b.y0)*k+22)<14){hit=sel;mode='rot';}}
    if(!hit){let ba=1e12;for(const g in bbs){if(g==='tacche')continue;const b=bbs[g];if(mx>=b.x0-1&&mx<=b.x1+1&&my>=b.y0-1&&my<=b.y1+1){const a=(b.x1-b.x0)*(b.y1-b.y0);if(a<ba){ba=a;hit=g;}}}}
    sel=hit;
    if(!hit){view(false);return;}
    const t=xf[hit]||(xf[hit]={dx:0,dy:0,s:1,r:0}),b=bbs[hit],br=gbox(raw)[hit],cr=[(br.x0+br.x1)/2,(br.y0+br.y1)/2],C0=[cr[0]+t.dx,cr[1]+t.dy];
    drag={g:hit,mode,mx,my,dx:t.dx,dy:t.dy,s:t.s,r:t.r||0,cr,C0,a0:Math.atan2(my-C0[1],mx-C0[0]),off:[b.x0-C0[0],b.y0-C0[1]],w:Math.max(b.x1-b.x0,1),h:Math.max(b.y1-b.y0,1),b0:{x:b.x0,y:b.y0}};
    cv.setPointerCapture(e.pointerId);e.preventDefault();view(false);
  });
  cv.addEventListener('pointermove',e=>{
    if(!drag)return;const [mx,my]=pt(e),t=xf[drag.g];
    if(drag.mode==='move'){t.dx=drag.dx+(mx-drag.mx);t.dy=drag.dy+(my-drag.my);}
    else if(drag.mode==='rot'){let r=drag.r+(Math.atan2(my-drag.C0[1],mx-drag.C0[0])-drag.a0)*180/Math.PI;r=Math.round(r/5)*5;if(Math.abs(r/90-Math.round(r/90))<0.06)r=Math.round(r/90)*90;t.r=((r%360)+360)%360;}
    else{const k0=Math.max((drag.mx-drag.b0.x)/drag.w,(drag.my-drag.b0.y)/drag.h,0.05),k1=Math.max((mx-drag.b0.x)/drag.w,(my-drag.b0.y)/drag.h,0.05);const ns=Math.max(0.4,Math.min(4,drag.s*k1/k0)),ra=ns/drag.s;t.s=ns;t.dx=drag.b0.x-drag.off[0]*ra-drag.cr[0];t.dy=drag.b0.y-drag.off[1]*ra-drag.cr[1];}
    rs.hidden=false;view(false);
  });
  const endDrag=()=>{if(!drag)return;drag=null;upd();};
  cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
  go.onclick=()=>{if(!cur)return;$('pvOv').hidden=true;document.body.style.overflow='';E.startJob(cur,tp.name);};
  dl.onclick=()=>{if(!cur)return;const b=new Blob([cur.lines.join('\n')+'\n'],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='laserbrio-prova-'+tp.id+'.gcode';a.click();};
  UPDS.push(upd);upd();
}

/* ---------- scegli i quadratini migliori: laserBrio si ricorda i valori ---------- */
function pkCss(){
  if($('pkCss'))return;
  const s=document.createElement('style');s.id='pkCss';
  s.textContent=`.pk{margin-top:14px;display:grid;gap:14px}
.pk .st{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fffdfa}
.pk .sh{display:flex;gap:10px;align-items:center}
.pk .sh .n{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;flex:none}
.pk .sh b{font-size:17px}
.pk .rule{margin:10px 0 4px;padding:10px 12px;border-radius:10px;background:var(--soft);font-size:15px;line-height:1.4}
.pk .rule strong{color:var(--accent-d)}
.pk details{margin:6px 0 2px;font-size:14px;color:var(--mute)}
.pk summary{cursor:pointer;color:var(--accent-d);font-weight:600}
.pk .tb{display:grid;gap:5px;margin-top:10px;max-width:460px}
.pk .th{font-size:12px;color:var(--mute);text-align:center;align-self:end;padding-bottom:2px}
.pk .tl{font-size:13px;color:var(--ink);font-weight:600;align-self:center;text-align:right;padding-right:4px}
.pk .cell{position:relative;border:2px solid transparent;border-radius:10px;min-height:54px;font:600 14px system-ui,sans-serif;cursor:pointer;background:#efe6d9;color:var(--ink);padding:4px}
.pk .cell small{display:block;font-weight:500;font-size:11px;opacity:.85}
.pk .cell.on{border-color:var(--accent);box-shadow:0 0 0 3px rgba(196,86,26,.28)}
.pk .cell .star{position:absolute;top:-8px;right:-6px;background:var(--accent);color:#fff;border-radius:10px;font-size:11px;padding:1px 6px}
.pk .ax{font-size:12px;color:var(--mute);margin-top:6px}
.pk img{width:100%;max-width:460px;border-radius:10px;border:1px solid var(--line);display:block;margin:10px 0 4px}
.pk .lg{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--mute)}
.pk .lg i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:4px}
.pk .sum{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid var(--accent);border-radius:14px;padding:12px 14px;background:#fff5ec}
.pk .sum span{flex:1;min-width:180px;font-size:14px}`;
  document.head.appendChild(s);
}
function picker(box,d,full){
  const G=parseG(d.g);if(G.length<4||G.some(a=>!a.length))return;
  pkCss();
  const [cs,cp,es,ep]=G;let selC=null,selE=null,selS=null,selH=null;
  const A=Array.isArray(d.a)&&d.a.length===ep.length&&d.a.every(r=>Array.isArray(r)&&r.length===es.length)?d.a:null;
  const root=document.createElement('div');root.className='pk';box.appendChild(root);
  const el=(tag,cls,html,par)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;(par||root).appendChild(e);return e;};
  const sv=document.createElement('button'),sum=document.createElement('span');
  const NMn=x=>({R:'righe',O:'onde',L:'lenti',Z:'zigzag'})[x.t];
  const upd=()=>{sum.innerHTML='<b>Hai scelto</b> — taglio: '+(selC?selC[0]+'% a '+selC[1]+' mm/min':'<i>niente</i>')+' · incisione: '+(selE?selE[0]+'% a '+selE[1]+' mm/min':'<i>niente</i>')+' · incastro: '+(selS?selS+' mm':'<i>niente</i>')+' · piegatura: '+(selH?NMn(selH)+' '+selH.v+' mm':'<i>niente</i>');sv.disabled=!(selC||selE||selS||selH);};
  const table=(par,S,P,pick,info)=>{
    const t=el('div','tb',null,par);t.style.gridTemplateColumns='46px repeat('+S.length+',1fr)';
    el('div','th','',t);S.forEach(v=>el('div','th',v+'<br>mm/min',t));
    const cells=[];
    P.forEach((pc,j)=>{
      el('div','tl',pc+'%',t);
      S.forEach((v,i)=>{
        const inf=info?info(j,i):{};
        const b=el('button','cell',(inf.txt||'')+(inf.sub?'<small>'+inf.sub+'</small>':''),t);
        if(inf.bg){b.style.background=inf.bg;b.style.color=inf.fg;}
        if(inf.star)el('span','star','★ consigliato',b);
        b.onclick=()=>{pick(pc,v);cells.forEach(x=>x.classList.remove('on'));b.classList.add('on');upd();};
        b._j=j;b._i=i;cells.push(b);
      });
    });
    el('div','ax','Sopra: velocità · a sinistra: potenza',par);
    return cells;
  };
  // ---- 1 TAGLIO ----
  const s1=el('div','st');
  const h1=el('div','sh','<span class="n">1</span><b>Taglio</b>',s1);
  el('div','rule','Tocca il quadratino <strong>più veloce</strong> che si è <strong>staccato del tutto</strong>.',s1);
  el('details',null,'<summary>Come lo controllo?</summary>Spingi con un dito ogni quadratino: deve cadere da solo, senza forzare. Tra quelli che cadono scegli la velocità più alta; a parità di velocità, la potenza più bassa. Se nessuno cade, il taglio è troppo debole: rifai la scheda con velocità più bassa. Dalla foto non si può capire se il taglio è passato, quindi qui scegli tu.',s1);
  table(s1,cs,cp,(pc,v)=>{selC=[pc,v];},()=>({txt:'✂'}));
  // ---- 2 INCISIONE ----
  const s2=el('div','st');
  el('div','sh','<span class="n">2</span><b>Incisione</b>',s2);
  el('div','rule','Tocca il quadrato <strong>più scuro</strong> che è <strong>ancora pulito</strong>: tono uniforme, senza bordi neri bruciati né fumo.',s2);
  el('details',null,'<summary>Perché non sempre il più scuro?</summary>Oltre un certo punto più potenza non scurisce, brucia soltanto: bordi carbonizzati, fumo, legno rovinato. Se due quadrati sembrano uguali, prendi quello con meno potenza (o più veloce).',s2);
  let sug=null;
  if(A){
    const cl=[];ep.forEach((pc,j)=>es.forEach((v,i)=>cl.push({j,i,e:pc/v,d:A[j][i]})));
    const dm=Math.max(...cl.map(c=>c.d));
    if(dm>=0.08){cl.sort((a,b)=>a.e-b.e);sug=cl.find(c=>c.d>=0.85*dm)||cl[cl.length-1];
      el('p','hint','Dalla foto ho misurato quanto è scuro ogni quadrato (la percentuale). Il ★ è il primo, dal più leggero, che arriva quasi al massimo (massimo misurato: '+Math.round(dm*100)+'%). <b>Guardalo dal vivo</b>: se ha bordi bruciati o fumo, prendine uno più leggero.',s2);
    }else el('p','hint','Dalla foto i quadrati sembrano tutti molto chiari: foto sfocata o lontana, oppure prova troppo debole. Scegli a occhio.',s2);
    if(d.ov){const im=el('img',null,null,s2);im.src=d.ov;el('div','lg','<span><i style="background:#19a974"></i>incisione</span><span><i style="background:#1f6feb"></i>taglio</span><span>I riquadri devono coprire i quadrati veri: se sono spostati, rifai la foto più dritta e vicina.</span>',s2);}
  }
  const mix=x=>{const a=[222,176,128],b=[40,22,12],c=a.map((v,k)=>Math.round(v+(b[k]-v)*x));return 'rgb('+c+')';};
  const eb=table(s2,es,ep,(pc,v)=>{selE=[pc,v];},A?(j,i)=>({bg:mix(A[j][i]),fg:A[j][i]>0.45?'#fff':'#2b2118',txt:Math.round(A[j][i]*100)+'%',sub:'scuro',star:!!(sug&&sug.j===j&&sug.i===i)}):()=>({}));
  if(sug){const b=eb.find(x=>x._j===sug.j&&x._i===sug.i);if(b){selE=[ep[sug.j],es[sug.i]];b.classList.add('on');}}
  // ---- 3 INCASTRI ----
  const tk=+String(d.s||'').replace(',','.')||3,stp=+d.p||0.1;
  const row=(par,items,pick)=>{const t=el('div','tb',null,par);t.style.gridTemplateColumns='repeat('+items.length+',1fr)';const cs2=[];items.forEach(it=>{const b=el('button','cell','<b>'+it[0]+'</b><small>'+it[1]+'</small>',t);b.onclick=()=>{pick(it[2]);cs2.forEach(x=>x.classList.remove('on'));b.classList.add('on');upd();};cs2.push(b);});return cs2;};
  const s3=el('div','st');
  el('div','sh','<span class="n">3</span><b>Incastri</b>',s3);
  el('div','rule','Tocca la tacca in cui il legno <strong>entra a pressione con le dita</strong>, senza gioco e senza forzare.',s3);
  el('details',null,'<summary>Come lo provo?</summary>Togli i pezzetti caduti dalle 7 tacche sul lato sinistro. Prendi un ritaglio dello stesso legno e infilalo <b>di costa</b> in ogni tacca, dalla più stretta alla più larga. Quella giusta lo tiene fermo ma lo lascia entrare con una piccola spinta: se entra da solo è troppo larga, se devi martellare è troppo stretta. Il numero è la larghezza della tacca in mm: è lo spessore vero del tuo legno, che spesso non è quello scritto sulla confezione.',s3);
  row(s3,[0,1,2,3,4,5,6].map(i=>{const w=Math.round((tk+(i-3)*stp)*100)/100;return [w.toFixed(2),i===3?'nominale':(i<3?'stretta':'larga'),w];}),w=>{selS=w;});
  // ---- 4 PIEGATURA ----
  const NM={R:'Righe',O:'Onde',L:'Lenti',Z:'Zigzag'},hl=String(d.h||'').split(',').map(t=>{const m=String(t).match(/^([ROLZ])?([\d.]+)$/);return m?{t:m[1]||'R',v:+m[2]}:null;}).filter(x=>x&&x.v>0);
  if(hl.length){
    const s4=el('div','st');
    el('div','sh','<span class="n">4</span><b>Piegatura</b>',s4);
    el('div','rule','Tocca il rettangolo che <strong>si piega di più</strong> senza spaccarsi né incrinarsi. Ci sono righe dritte e lenti, ognuna con 3 distanze: provale tutte.',s4);
    el('details',null,'<summary>Come lo provo?</summary>Ogni linguetta resta attaccata al foglio: piegala piano con le mani e guarda come regge. Più le righe sono vicine più il legno si piega, ma si indebolisce. Righe = tratti dritti sfalsati (il classico), Lenti = tagli a forma di lente (più morbido e più elegante). Scegli il più morbido che regge senza rompersi. Il numero è la distanza tra le righe in mm.',s4);
    row(s4,hl.map(x=>[NM[x.t],x.v+' mm',x]),x=>{selH=x;});
  }
  // ---- riepilogo + salva ----
  const fin=el('div','sum');fin.appendChild(sum);
  sv.className='btn primary';sv.textContent='Salva questo materiale';fin.appendChild(sv);
  const st=el('p','hint','');
  upd();
  sv.onclick=()=>{
    const m={id:'c_'+Date.now(),name:full,minP:8,maxP:65,speed:2500};
    if(selE){m.maxP=selE[0];m.minP=Math.max(1,Math.round(selE[0]*0.15));m.speed=selE[1];}
    if(selC)m.cut={speed:selC[1],passes:1,power:selC[0]};
    if(selS)m.slot=selS;if(selH){m.hinge=selH.v;m.hingeType=NMn(selH);}
    window.Lb.saveMat(m);sv.disabled=true;
    st.textContent='Salvato: '+full+(selC?' · taglio '+selC[0]+'% a '+selC[1]:'')+(selE?' · incisione fino al '+selE[0]+'% a '+selE[1]:'')+(selS?' · incastro '+selS+' mm':'')+(selH?' · piegatura '+NMn(selH)+' '+selH.v+' mm':'')+'. Ora lo trovi nell\'elenco dei materiali.';
  };
}
let jsq=null;
function loadJsQR(){
  if(window.jsQR)return Promise.resolve();
  return jsq||(jsq=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';s.onload=res;s.onerror=()=>{jsq=null;rej(new Error('rete'));};document.head.appendChild(s);}));
}
async function scan(src){   // legge il QR e dove sono i suoi tre angoli nella foto
  let text=null,cor=null,fin=null;
  if(window.BarcodeDetector){try{const r=await new BarcodeDetector({formats:['qr_code']}).detect(src);if(r[0]&&r[0].rawValue){text=r[0].rawValue;cor=r[0].cornerPoints||null;}}catch(e){}}
  try{await loadJsQR();}catch(e){if(!text)throw e;}
  if(window.jsQR){
    for(const k of [1,0.6,0.35]){
      const w=Math.round(src.width*k),h=Math.round(src.height*k),cv=document.createElement('canvas');cv.width=w;cv.height=h;
      const cx=cv.getContext('2d');cx.drawImage(src,0,0,w,h);
      const r=window.jsQR(cx.getImageData(0,0,w,h).data,w,h);
      if(r&&r.data){
        if(!text)text=r.data;
        const L=r.location;fin=[L.topLeftFinderPattern,L.topRightFinderPattern,L.bottomLeftFinderPattern].map(p=>[p.x/k,p.y/k]);
        break;
      }
    }
  }
  return text?{text,cor,fin}:null;
}
/* guarda la foto: quanto è scuro ogni quadrato di incisione rispetto al legno che ha intorno */
function analyse(src,sc,G,O){
  O=(O&&O.length>=4&&O.every(isFinite))?O:[0,0,0,0];
  try{
    const [cs,cp,es,ep]=G,c=8,g=5,oy=26,ox2=16+cs.length*(c+g)+16,xq=ox2+es.length*(c+g)+6;
    const mod=0.8,Mn=QR.make([...new TextEncoder().encode(sc.text)]).length,s=Mn*mod,fo=3.5*mod;
    let P,Q;
    if(sc.fin){P=[[xq+fo,4+fo],[xq+s-fo,4+fo],[xq+fo,4+s-fo]];Q=sc.fin;}
    else if(sc.cor&&sc.cor.length>=4){P=[[xq,4],[xq+s,4],[xq,4+s]];Q=[sc.cor[0],sc.cor[1],sc.cor[3]].map(p=>[p.x,p.y]);}
    else return null;
    const ux=P[1][0]-P[0][0],uy=P[1][1]-P[0][1],vx=P[2][0]-P[0][0],vy=P[2][1]-P[0][1],det=ux*vy-uy*vx;
    if(Math.abs(det)<1e-6)return null;
    const Ux=Q[1][0]-Q[0][0],Uy=Q[1][1]-Q[0][1],Vx=Q[2][0]-Q[0][0],Vy=Q[2][1]-Q[0][1];
    const a=(Ux*vy-Vx*uy)/det,b=(Vx*ux-Ux*vx)/det,cc=(Uy*vy-Vy*uy)/det,d=(Vy*ux-Uy*vx)/det;
    const f=(x,y)=>[Q[0][0]+a*(x-P[0][0])+b*(y-P[0][1]),Q[0][1]+cc*(x-P[0][0])+d*(y-P[0][1])];
    const W=src.width,H=src.height,id=src.getContext('2d').getImageData(0,0,W,H).data;
    let bad=0;
    const lum=(x,y)=>{const [px,py]=f(x,y),ix=Math.round(px),iy=Math.round(py);if(ix<1||iy<1||ix>=W-1||iy>=H-1){bad++;return null;}let t=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const k=((iy+dy)*W+ix+dx)*4;t+=0.299*id[k]+0.587*id[k+1]+0.114*id[k+2];}return t/9;};
    const avg=a=>{const v=a.filter(x=>x!=null);return v.length?v.reduce((p,q)=>p+q,0)/v.length:null;};
    const dark=[];
    ep.forEach((pc,j)=>{dark.push([]);es.forEach((v,i)=>{
      const x=ox2+i*(c+g)+O[0],y=oy+j*(c+g)+O[1],inn=[],out=[];
      for(let p=0;p<5;p++)for(let q=0;q<5;q++)inn.push(lum(x+1.5+p*1.25,y+1.5+q*1.25));
      for(let p=0;p<5;p++){const t=1.5+p*1.25;out.push(lum(x+t,y-1.3),lum(x+t,y+c+1.3),lum(x-1.3,y+t),lum(x+c+1.3,y+t));}
      const li=avg(inn),lo=avg(out);
      dark[j].push(li==null||lo==null||lo<20?null:Math.max(0,Math.min(1,1-li/lo)));
    });});
    if(bad>200||dark.flat().some(x=>x==null))return null;
    // foto di controllo con i quadrati riconosciuti
    const k=Math.min(1,720/W),cv=document.createElement('canvas');cv.width=Math.round(W*k);cv.height=Math.round(H*k);
    const x=cv.getContext('2d');x.drawImage(src,0,0,cv.width,cv.height);x.lineWidth=2;x.font='bold 13px sans-serif';
    const box=(x0,y0,w,h,col)=>{x.strokeStyle=col;x.beginPath();[[x0,y0],[x0+w,y0],[x0+w,y0+h],[x0,y0+h]].forEach((p,i)=>{const q=f(p[0],p[1]);i?x.lineTo(q[0]*k,q[1]*k):x.moveTo(q[0]*k,q[1]*k);});x.closePath();x.stroke();};
    cp.forEach((pc,j)=>cs.forEach((v,i)=>box(16+i*(c+g)+O[2],oy+j*(c+g)+O[3],c,c,'#1f6feb')));
    ep.forEach((pc,j)=>es.forEach((v,i)=>{box(ox2+i*(c+g)+O[0],oy+j*(c+g)+O[1],c,c,'#19a974');const q=f(ox2+i*(c+g)+O[0]+1,oy+j*(c+g)+O[1]+c/2);x.fillStyle='#19a974';x.fillText(Math.round(dark[j][i]*100)+'%',q[0]*k,q[1]*k);}));
    return {dark,ov:cv.toDataURL('image/jpeg',0.6)};
  }catch(e){return null;}
}
async function readScheda(src,msgEl){
  msgEl.style.color='';msgEl.textContent='Leggo il QR…';
  let sc=null,txt=null;
  try{sc=await scan(src);txt=sc&&sc.text;}catch(e){msgEl.style.color='var(--bad)';msgEl.textContent='Non riesco a caricare il lettore: serve internet.';return;}
  if(!txt){msgEl.style.color='var(--bad)';msgEl.textContent='Non trovo il QR. Riprova con più luce, tutto il QR dentro la foto e senza riflessi.';return;}
  let q=null;try{q=new URL(txt).searchParams;}catch(e){}
  if(!q||!q.get('m')){msgEl.style.color='var(--bad)';msgEl.textContent='Questo QR non è di una scheda laserBrio.';return;}
  $('pvOv').hidden=true;document.body.style.overflow='';
  const G=q.get('g')?parseG(q.get('g')):[],an=(G.length>=4&&G.every(a=>a.length))?analyse(src,sc,G,String(q.get('o')||'').split(',').map(Number)):null;
  window.Lb.material({m:q.get('m'),s:q.get('s'),g:q.get('g'),c:q.get('c'),i:q.get('i'),a:an&&an.dark,ov:an&&an.ov,p:q.get('p'),h:q.get('h')});
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
window.Prove={open,picker,scan,analyse};
})();
