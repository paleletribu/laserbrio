/* laserBrio · controlla il risultato: confronta la foto del lavoro finito con il disegno */
(function(){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function boxBlur(src,w,h,r){
  if(r<1)return src.slice();
  const tmp=new Float32Array(w*h),out=new Float32Array(w*h),n=2*r+1;
  for(let y=0;y<h;y++){
    let s=0;const o=y*w;
    for(let x=-r;x<=r;x++)s+=src[o+clamp(x,0,w-1)];
    for(let x=0;x<w;x++){tmp[o+x]=s/n;s+=src[o+clamp(x+r+1,0,w-1)]-src[o+clamp(x-r,0,w-1)];}
  }
  for(let x=0;x<w;x++){
    let s=0;
    for(let y=-r;y<=r;y++)s+=tmp[clamp(y,0,h-1)*w+x];
    for(let y=0;y<h;y++){out[y*w+x]=s/n;s+=tmp[clamp(y+r+1,0,h-1)*w+x]-tmp[clamp(y-r,0,h-1)*w+x];}
  }
  return out;
}
function samp(a,w,h,i,j){
  const x=i-.5,y=j-.5;
  if(x<0||y<0||x>w-1||y>h-1)return 0;
  const x0=x|0,y0=y|0,x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
  return (a[y0*w+x0]*(1-fx)+a[y0*w+x1]*fx)*(1-fy)+(a[y1*w+x0]*(1-fx)+a[y1*w+x1]*fx)*fy;
}
function pct(arr,p){const s=Array.from(arr).sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*p))];}

/* punti attesi dal disegno */
function densify(pts,step){
  const out=[],n=pts.length;
  for(let i=0;i<n;i++){
    const a=pts[i],b=pts[(i+1)%n],L=Math.hypot(b[0]-a[0],b[1]-a[1]),m=Math.max(1,Math.ceil(L/step));
    for(let k=0;k<m;k++)out.push([a[0]+(b[0]-a[0])*k/m,a[1]+(b[1]-a[1])*k/m]);
  }
  return out;
}

function analyze(opts){
  const {frame,W,H,b2c,rw,rh,ox,oy,job}=opts;
  const s=Math.min(2,1000/Math.max(rw,rh)),gw=Math.max(8,Math.round(rw*s)),gh=Math.max(8,Math.round(rh*s));
  /* 1. foto raddrizzata (vista dall'alto, 1 mm = s pixel) */
  const L=new Float32Array(gw*gh),col=new Uint8ClampedArray(gw*gh*4);
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){
    const p=b2c((i+.5)/s,rh-(j+.5)/s),u=p[0]-.5,v=p[1]-.5,k=j*gw+i;
    col[k*4+3]=255;
    if(!(u>=0&&v>=0&&u<=W-1&&v<=H-1)){L[k]=-1;col[k*4]=col[k*4+1]=col[k*4+2]=40;continue;}
    const x0=u|0,y0=v|0,x1=Math.min(W-1,x0+1),y1=Math.min(H-1,y0+1),fx=u-x0,fy=v-y0;
    let lum=0;
    for(let c=0;c<3;c++){
      const a=frame[(y0*W+x0)*4+c],b=frame[(y0*W+x1)*4+c],cc=frame[(y1*W+x0)*4+c],d=frame[(y1*W+x1)*4+c];
      const val=(a*(1-fx)+b*fx)*(1-fy)+(cc*(1-fx)+d*fx)*fy;
      col[k*4+c]=val;lum+=val*(c===0?.299:c===1?.587:.114);
    }
    L[k]=lum;
  }
  const valid=[];for(let k=0;k<L.length;k+=7)if(L[k]>=0)valid.push(L[k]);
  if(valid.length<500)return {err:'Il pezzo non si vede nella foto: controlla i 4 angoli della calibrazione.'};
  const bg=pct(valid,.8),dk=pct(valid,.03),range=Math.max(25,bg-dk);
  for(let k=0;k<L.length;k++)if(L[k]<0)L[k]=bg;
  const cut=job.kind==='cut';
  let D;
  if(cut){
    const Lm=boxBlur(L,gw,gh,Math.round(4*s)),sc=Math.max(18,range*.5);
    D=new Float32Array(L.length);for(let k=0;k<L.length;k++)D[k]=clamp((Lm[k]-L[k])/sc,0,1);
  }else{
    D=new Float32Array(L.length);for(let k=0;k<L.length;k++)D[k]=clamp((bg-L[k])/range,0,1);
  }
  const D1=boxBlur(D,gw,gh,Math.max(1,Math.round(.8*s)));
  /* 2. punti attesi */
  const S=[],S0=[],paths=[];
  const cx=ox+job.w/2,cy=oy+job.h/2;
  if(cut){
    job.items.forEach((it,ii)=>it.paths.forEach(p=>{
      const pts=densify(p.pts,1.5).map(q=>[q[0]+ox,q[1]+oy]);
      paths.push({name:it.name||('pezzo '+(ii+1)),hole:!!p.hole,pts});
      for(const q of pts)S.push(q);
    }));
  }else{
    const cv=job.canvas,cx2=cv.getContext('2d'),pc=cv.width,pr=cv.height,id=cx2.getImageData(0,0,pc,pr).data;
    for(let y=oy+1;y<oy+job.h;y+=2)for(let x=ox+1;x<ox+job.w;x+=2){
      const px=clamp(Math.floor((x-ox)/job.w*pc),0,pc-1),py=clamp(Math.floor((job.h-(y-oy))/job.h*pr),0,pr-1),q=(py*pc+px)*4;
      const lum=id[q]*.299+id[q+1]*.587+id[q+2]*.114,e=clamp((205-lum)/165,0,1);
      if(e>.25)S.push([x,y]);else if(e<.05)S0.push([x,y]);
    }
  }
  if(S.length<20)return {err:cut?'Il progetto non ha linee da confrontare.':'L\'immagine ha troppe poche zone incise da confrontare.'};
  const thin=(a,n)=>{if(a.length<=n)return a;const st=a.length/n,o=[];for(let i=0;i<n;i+=1)o.push(a[Math.floor(i*st)]);return o;};
  const Sf=thin(S,6000),S0f=thin(S0,3000);
  function tf(q,P){
    const u=(q[0]-cx)*P.sx,v=(q[1]-cy)*P.sy,c=Math.cos(P.th),sn=Math.sin(P.th);
    return [cx+u*c-v*sn+P.dx,cy+u*sn+v*c+P.dy];
  }
  function score(P){
    let a=0;
    for(const q of Sf){const t=tf(q,P);a+=samp(D1,gw,gh,t[0]*s,(rh-t[1])*s);}
    a/=Sf.length;
    if(S0f.length){let b=0;for(const q of S0f){const t=tf(q,P);b+=1-samp(D1,gw,gh,t[0]*s,(rh-t[1])*s);}a+=b/S0f.length;}
    return a;
  }
  const P0={dx:0,dy:0,sx:1,sy:1,th:0},sc0=score(P0);
  let best={...P0},bs=sc0;
  for(let dx=-15;dx<=15;dx+=1.5)for(let dy=-15;dy<=15;dy+=1.5){const P={dx,dy,sx:1,sy:1,th:0},v=score(P);if(v>bs){bs=v;best=P;}}
  const steps={dx:1,dy:1,sx:.01,sy:.01,th:.01};
  for(let round=0;round<7;round++){
    let imp=true,guard=0;
    while(imp&&guard++<30){
      imp=false;
      for(const k of ['dx','dy','sx','sy','th'])for(const sg of [1,-1]){
        const P={...best};P[k]+=sg*steps[k];const v=score(P);
        if(v>bs+1e-6){bs=v;best=P;imp=true;}
      }
    }
    for(const k in steps)steps[k]/=2;
  }
  /* 3. tratti deboli (solo taglio) */
  let weak=[],vis=0,tot=0;const perItem={};
  if(cut){
    const r=Math.max(1,Math.round(1.2*s));
    for(const p of paths)for(const q of p.pts){
      const t=tf(q,best),i=Math.round(t[0]*s),j=Math.round((rh-t[1])*s);
      let m=0;
      for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){const xx=i+x,yy=j+y;if(xx>=0&&yy>=0&&xx<gw&&yy<gh){const d=D[yy*gw+xx];if(d>m)m=d;}}
      tot++;const ok=m>=.35;if(ok)vis++;else weak.push(t);
      const o=perItem[p.name]||(perItem[p.name]={n:0,ok:0});o.n++;if(ok)o.ok++;
    }
  }
  return {s,gw,gh,col,rw,rh,best,sc0,bs,paths,cut,job,ox,oy,cx,cy,tf,weak,vis,tot,perItem,S};
}

function report(R){
  const out=[];
  if(R.bs<(R.cut?.12:.3))out.push({t:'warn',m:'Non riesco a riconoscere bene il disegno nella foto (poco contrasto, ombre o riflessi). Fai la foto con luce uniforme e il pezzo ben visibile, e controlla i 4 angoli.'});
  const b=R.best,dx=b.dx,dy=b.dy,deg=b.th*180/Math.PI;
  const f=n=>Math.abs(n).toFixed(1).replace('.',',');
  const parts=[];
  if(Math.abs(dx)>=.8)parts.push(f(dx)+' mm '+(dx>0?'a destra':'a sinistra'));
  if(Math.abs(dy)>=.8)parts.push(f(dy)+' mm '+(dy>0?'verso il fondo della macchina':'verso di te'));
  if(parts.length){
    out.push({t:'bad',m:'Il lavoro è venuto spostato di '+parts.join(' e ')+' rispetto a dove lo volevi.'});
    out.push({t:'fix',m:'Per correggere: la prossima volta porta l\'origine (passo 4) '+[Math.abs(dx)>=.8?f(dx)+' mm '+(dx>0?'a sinistra':'a destra'):'',Math.abs(dy)>=.8?f(dy)+' mm '+(dy>0?'verso di te':'verso il fondo'):''].filter(Boolean).join(' e ')+' rispetto a dove l\'avevi messa.'});
  }else out.push({t:'ok',m:'Posizione giusta: il lavoro è dove doveva stare (differenza sotto 0,8 mm).'});
  const ex=(b.sx-1)*100,ey=(b.sy-1)*100;
  if(Math.abs(ex)>=.5||Math.abs(ey)>=.5){
    const w=R.job.w*b.sx,h=R.job.h*b.sy;
    out.push({t:'bad',m:'Le misure non tornano: larghezza '+(ex>=0?'+':'−')+Math.abs(ex).toFixed(1).replace('.',',')+'% (circa '+w.toFixed(1).replace('.',',')+' mm invece di '+R.job.w.toFixed(1).replace('.',',')+'), altezza '+(ey>=0?'+':'−')+Math.abs(ey).toFixed(1).replace('.',',')+'% (circa '+h.toFixed(1).replace('.',',')+' mm invece di '+R.job.h.toFixed(1).replace('.',',')+').'});
    out.push({t:'fix',m:'Prima controlla che la calibrazione usi le misure vere del riferimento. Se sono giuste e l\'errore si ripete, nel laser vanno tarati i passi per mm: $100 per l\'asse X (nuovo = attuale ÷ '+b.sx.toFixed(3).replace('.',',')+') e $101 per l\'asse Y (nuovo = attuale ÷ '+b.sy.toFixed(3).replace('.',',')+'). I valori attuali si leggono con il comando $$.'});
  }else out.push({t:'ok',m:'Misure giuste (differenza sotto 0,5%).'});
  if(Math.abs(deg)>=.4)out.push({t:'bad',m:'Il lavoro è ruotato di '+Math.abs(deg).toFixed(1).replace('.',',')+'° in senso '+(deg>0?'antiorario':'orario')+'. Controlla che il pezzo sia appoggiato dritto e che la camera guardi dall\'alto; se succede sempre, le guide della macchina non sono a squadra.'});
  if(R.cut&&R.tot){
    const pc=Math.round(R.vis/R.tot*100);
    if(pc>=95)out.push({t:'ok',m:'Il taglio si vede su quasi tutto il contorno ('+pc+'%).'});
    else{
      out.push({t:'bad',m:'Il taglio si vede solo sul '+pc+'% del contorno. I punti rossi sulla foto sono dove il laser non ha tagliato bene.'});
      const worst=Object.entries(R.perItem).map(([n,o])=>[n,o.ok/o.n]).filter(x=>x[1]<.9).sort((a,b)=>a[1]-b[1]).slice(0,4);
      if(worst.length)out.push({t:'info',m:'Pezzi con più punti deboli: '+worst.map(w=>w[0]+' ('+Math.round(w[1]*100)+'%)').join(', ')+'.'});
      out.push({t:'fix',m:'Per correggere: aggiungi una passata o abbassa un po\' la velocità di taglio, controlla la messa a fuoco e pulisci la lente. Se i punti deboli sono tutti dallo stesso lato, il legno potrebbe non essere piano.'});
    }
  }
  out.push({t:'info',m:'Questi numeri valgono se la calibrazione era precisa e né la camera né il pezzo si sono mossi. Sotto circa 1 mm di errore non sono affidabili.'});
  return out;
}

function draw(R,cv){
  const sc=1,w=R.gw,h=R.gh;cv.width=w;cv.height=h;
  const c=cv.getContext('2d');c.putImageData(new ImageData(R.col,w,h),0,0);
  const X=x=>x*R.s,Y=y=>(R.rh-y)*R.s;
  c.lineWidth=1.2;
  if(R.cut){
    c.strokeStyle='#00e5ff';
    for(const p of R.paths){c.beginPath();p.pts.forEach((q,i)=>i?c.lineTo(X(q[0]),Y(q[1])):c.moveTo(X(q[0]),Y(q[1])));c.closePath();c.stroke();}
  }else{
    c.strokeStyle='#00e5ff';c.strokeRect(X(R.ox),Y(R.oy+R.job.h),R.job.w*R.s,R.job.h*R.s);
  }
  c.fillStyle='#ff1744';
  for(const t of R.weak){c.beginPath();c.arc(X(t[0]),Y(t[1]),Math.max(2,R.s*1.2),0,7);c.fill();}
}

window.Check={analyze,report,draw};
})();
