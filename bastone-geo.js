/* Bastone con ventagli - geometria dei pezzi (asta a strati con code di rondine, stecche, tappi, listello a camma, placche) */
(function(){
'use strict';
/* ---- misure (mm) ---- */
const HA=1650,PUN=14,HB=HA-PUN;          /* asta 165 cm: corpo + puntale */
const HW=20;                               /* mezza larghezza (asta 40 mm) */
const PIV=12;                              /* perno dei ventagli: distanza dall'asse */
const FANS=[{key:'alto',Yp:410,L:450,n:3,sig:80/3},{key:'basso',Yp:1340,L:220,n:2,sig:40}];
const BETA=80,RC=7.5,A0=41,DW=6,PW=1.15;   /* apertura, raggio perno-camma, angolo di partenza, tratto di blocco, mezza asola */
const LAT0=-5,LAT1=8,BOSS=8.6,LOBE=9.5;    /* stecca: da -5 a +8 mm dal perno; testa tonda; lobo della guardia */
const R1=12,R2=20;                         /* raggi delle asole ad arco fra le stecche */
const rad=d=>d*Math.PI/180;

/* ---- utilità ---- */
function arc(cx,cy,r,a0,a1,n){const o=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return o;}
function circ(cx,cy,r){const n=r<2?10:20,o=[];for(let i=0;i<n;i++){const a=2*Math.PI*i/n;o.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return o;}
function slotPoly(path,hw){
  const n=path.length,L=[],Rr=[];let nx0=0,ny0=0,nxE=0,nyE=0;
  for(let i=0;i<n;i++){
    const a=path[Math.max(0,i-1)],b=path[Math.min(n-1,i+1)];let tx=b[0]-a[0],ty=b[1]-a[1];const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;
    const nx=-ty,ny=tx;if(i===0){nx0=nx;ny0=ny;}if(i===n-1){nxE=nx;nyE=ny;}
    L.push([path[i][0]+hw*nx,path[i][1]+hw*ny]);Rr.push([path[i][0]-hw*nx,path[i][1]-hw*ny]);}
  const pe=path[n-1],p0=path[0],aE=Math.atan2(nyE,nxE),a0=Math.atan2(ny0,nx0);
  return L.concat(arc(pe[0],pe[1],hw,aE,aE-Math.PI,8).slice(1,-1),Rr.reverse(),arc(p0[0],p0[1],hw,a0+Math.PI,a0,8).slice(1,-1));}
const polar=(r,psi)=>[-r*Math.sin(rad(psi)),r*Math.cos(rad(psi))];   /* (lat verso il centro, y verso il basso); psi positivo verso l'esterno */
const mirror=p=>p.map(q=>[-q[0],q[1]]);
function clean(pts){const o=[];pts.forEach(q=>{const p=o[o.length-1];if(!p||Math.abs(p[0]-q[0])>1e-6||Math.abs(p[1]-q[1])>1e-6)o.push(q);});
  if(o.length>1&&Math.abs(o[0][0]-o[o.length-1][0])<1e-6&&Math.abs(o[0][1]-o[o.length-1][1])<1e-6)o.pop();
  const r=[];for(let i=0;i<o.length;i++){const a=o[(i+o.length-1)%o.length],b=o[i],c=o[(i+1)%o.length];
    const cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cr)>1e-9)r.push(b);}return r;}

/* ---- camma del listello (legge con angolo di pressione nullo) ---- */
function cam(){
  const n=160,a0=rad(A0),b=rad(BETA),pin=[],d=[0];
  for(let i=0;i<=n;i++){const be=b*i/n,al=a0-be;pin.push([-PIV+RC*Math.cos(al),RC*Math.sin(al)]);}   /* perno: x dall'asse, y verso l'alto */
  for(let i=1;i<=n;i++){const al=a0-b*(i-0.5)/n;d.push(d[i-1]+RC/Math.cos(al)*b/n);}                  /* corsa del listello verso il basso */
  const D=d[n],path=[];
  const yd=i=>-pin[i][1]-d[i];
  for(let k=0;k<=6;k++)path.push([pin[0][0],yd(0)+DW*(1-k/6)]);
  for(let i=1;i<=n;i++)path.push([pin[i][0],yd(i)]);
  for(let k=1;k<=6;k++)path.push([pin[n][0],yd(n)-DW*k/6]);
  const P=path.map(q=>[q[0],q[1]-DW]);   /* riferimento: listello a riposo (chiuso); primo punto = perno a riposo */
  return {path:P,D:D,travel:D+2*DW,pin:pin,d:d};}

/* ---- stecche ---- */
function bladeOutline(L){
  const ya=-Math.sqrt(BOSS*BOSS-LAT0*LAT0),yb=-Math.sqrt(BOSS*BOSS-LAT1*LAT1),er=(LAT1-LAT0)/2,ec=(LAT0+LAT1)/2;
  const top=arc(0,0,BOSS,Math.atan2(ya,LAT0),Math.atan2(yb,LAT1),14);
  const end=arc(ec,L-er,er,0,Math.PI,10);
  return clean([].concat(top,end));}
function lobeOutline(L){   /* guardia: stessa forma, ma con il lobo piu' grande verso il perno della camma */
  const ya=-Math.sqrt(LOBE*LOBE-LAT0*LAT0),yb=-Math.sqrt(LOBE*LOBE-LAT1*LAT1),er=(LAT1-LAT0)/2,ec=(LAT0+LAT1)/2;
  const top=arc(0,0,LOBE,Math.atan2(ya,LAT0),Math.atan2(yb,LAT1),16);
  return clean([].concat(top,arc(ec,L-er,er,0,Math.PI,10)));}
function slatPieces(f,side){
  const L=f.L,sg=side==='sx'?1:-1,mp=p=>sg>0?p:mirror(p),ps0=-(f.sig/2+5);
  const arcPath=r=>{const o=[];for(let i=0;i<=16;i++)o.push(polar(r,ps0+f.sig*i/16));return o;};
  const out=[];
  for(let k=0;k<f.n;k++){
    const guard=k===0,holes=[circ(0,0,1.6)];
    if(guard){const a=rad(A0);holes.push(circ(RC*Math.cos(a),-RC*Math.sin(a),1.0));}
    if(k<f.n-1)holes.push(circ.apply(null,[].concat(polar(k===0?R1:R2,ps0),[1.0])));
    if(k>0)holes.push(slotPoly(arcPath(k===1?R1:R2),PW));
    const pts=guard?lobeOutline(L):bladeOutline(L);
    out.push({name:(guard?'Guardia ':'Stecca '+(k+1)+' ')+f.key+' '+side,tag:guard?'guardia':'stecca',th:guard?3:2,pts:mp(pts),holes:holes.map(mp),fan:f.key,side:side,k:k});
  }
  return out;}
function capPiece(f,side){return {name:'Tappo '+f.key+' '+side,tag:'tappo',th:3,pts:[[0,0],[f.L+7,0],[f.L+7,8.6],[0,8.6]],holes:[],fan:f.key,side:side};}

/* ---- profili a gradini lungo l'asta (y verso il basso, x dall'asse) ---- */
function pockets(){return FANS.map(f=>[f.Yp-10,f.Yp+f.L+1]);}
function pSteps(layer){   /* strati di compensato dell'asta che reggono le stecche: pieni, tranne la nicchia dei ventagli */
  const z=pockets(),s=[];let y=0;
  const core=(y0,y1,h)=>s.push({y0:y0,y1:y1,xl:-h,xr:h});
  z.forEach((p,i)=>{
    if(p[0]>y)s.push({y0:y,y1:p[0],xl:-HW,xr:HW});
    if(layer===1){core(p[0],p[0]+20,2.0);core(p[0]+20,p[1],3);}else core(p[0],p[1],3);
    y=p[1];});
  s.push({y0:y,y1:HB,xl:-HW,xr:HW});return s;}
function headInfo(c){
  const ys=c.path.map(q=>q[1]),xs=c.path.map(q=>q[0]);
  return {y0:Math.min.apply(null,ys)-5,y1:Math.max.apply(null,ys)+5};}
function headZones(c){const h=headInfo(c);return FANS.map(f=>[f.Yp+h.y0,f.Yp+h.y1]);}
function railSteps(c,side){
  const zs=headZones(c),s=[];let y=0;const o=side==='sx'?-1:1,narrow=5.25,wide=9.05;
  const mk=(y0,y1,w)=>side==='sx'?s.push({y0:y0,y1:y1,xl:-HW,xr:-w}):s.push({y0:y0,y1:y1,xl:w,xr:HW});
  zs.forEach(z=>{const a=z[0]-0.25,b=z[1]+c.travel+0.25;if(a>y)mk(y,a,narrow);mk(a,b,wide);y=b;});
  mk(y,HB,narrow);return s;}
function sliderSteps(c){
  const zs=headZones(c),s=[];let y=zs[0][0];
  zs.forEach((z,i)=>{if(z[0]>y)s.push({y0:y,y1:z[0],xl:-5,xr:5});s.push({y0:z[0],y1:z[1],xl:-8.8,xr:8.8});y=z[1];});
  s.push({y0:y,y1:HB,xl:-5,xr:5});s.push({y0:HB,y1:HA,xl:-HW,xr:HW});return s;}

/* poligono di un tratto [ya,yb] di un profilo a gradini, con coda di rondine/incastro opzionali */
function seg(steps,ya,yb,o){
  o=o||{};const dt=o.dt||{b0:6,b1:9,tl:8,c:0.1};
  const R=[],L=[];
  steps.forEach(s=>{const a=Math.max(s.y0,ya),b=Math.min(s.y1,yb);if(b-a<1e-6)return;R.push([s.xr,a],[s.xr,b]);L.push([s.xl,a],[s.xl,b]);});
  if(!R.length)return null;
  const pts=[];const xl0=L[0][0],xr0=R[0][0],xlN=L[L.length-1][0],xrN=R[R.length-1][0];
  pts.push([xl0,ya]);
  if(o.top)pts.push([-(dt.b0+dt.c),ya],[-(dt.b1+dt.c),ya+dt.tl],[dt.b1+dt.c,ya+dt.tl],[dt.b0+dt.c,ya]);
  pts.push([xr0,ya]);R.forEach(q=>pts.push(q));
  if(o.bot)pts.push([dt.b0,yb],[dt.b1,yb+dt.tl],[-dt.b1,yb+dt.tl],[-dt.b0,yb]);
  L.slice().reverse().forEach(q=>pts.push(q));
  return clean(pts);}
function cuts(list,end){const a=[0].concat(list,[end]);const o=[];for(let i=0;i<a.length-1;i++)o.push([a[i],a[i+1]]);return o;}
function pivotHoles(ya,yb,sides){const h=[];FANS.forEach(f=>{if(f.Yp>ya+2&&f.Yp<yb-2)sides.forEach(s=>h.push(circ(s*PIV,f.Yp,1.6)));});return h;}

/* ---- tutti i pezzi ---- */
function allPieces(){
  const c=cam(),P=[];
  /* piastre posteriore e anteriore con coda di rondine */
  const plate=(name,tag,list)=>cuts(list,HB).forEach((r,i,a)=>{
    const pts=seg([{y0:0,y1:HB,xl:-HW,xr:HW}],r[0],r[1],{top:i>0,bot:i<a.length-1});
    P.push({name:name+' '+(i+1)+'/'+a.length,tag:tag,th:3,pts:pts,holes:pivotHoles(r[0],r[1],[-1,1]),y0:r[0]});});
  plate('Piastra posteriore','dietro',[330,660,990,1320]);
  plate('Piastra anteriore','fronte',[165,495,825,1155,1485]);
  /* strato del listello: guide laterali */
  [['sx',-1],['dx',1]].forEach(s=>{const st=railSteps(c,s[0]);
    cuts([247,577,907,1237],HB).forEach((r,i,a)=>{const pts=seg(st,r[0],r[1]);if(pts)P.push({name:'Guida '+s[0]+' '+(i+1)+'/'+a.length,tag:'guida',th:3,pts:pts,holes:pivotHoles(r[0],r[1],[s[1]]),y0:r[0]});});});
  /* tre strati che reggono le stecche */
  [[1,[200,520,840,1160,1480]],[2,[280,600,920,1240,1560]],[3,[120,440,760,1080,1400]]].forEach(l=>{const st=pSteps(l[0]);
    cuts(l[1],HB).forEach((r,i,a)=>{const pts=seg(st,r[0],r[1]);if(pts)P.push({name:'Strato '+l[0]+' '+(i+1)+'/'+a.length,tag:'strato',th:3,pts:pts,holes:[],y0:r[0]});});});
  /* listello (con teste a camma, coda di rondine) */
  const ss=sliderSteps(c),zs=headZones(c),y0s=zs[0][0];
  const cl=[y0s+300,y0s+610,y0s+920,y0s+1230];
  const bad=y=>zs.some(z=>y>z[0]-14&&y<z[1]+14);
  for(let i=0;i<cl.length;i++)while(bad(cl[i]))cl[i]+=20;
  const dts={b0:2.2,b1:3.4,tl:6,c:0.1};
  const bnd=[y0s].concat(cl,[HA]);
  for(let i=0;i<bnd.length-1;i++){
    const ya=bnd[i],yb=bnd[i+1];if(yb-ya<1)continue;
    const last=i===bnd.length-2,pts=seg(ss,ya,yb,{top:i>0,bot:!last,dt:dts}),holes=[];
    FANS.forEach(f=>{const ys=f.Yp;if(ys+headInfo(c).y0>ya-1&&ys+headInfo(c).y1<yb+1)[-1,1].forEach(sg=>{
      holes.push(slotPoly(c.path.map(q=>[sg<0?q[0]:-q[0],ys+q[1]]),PW));});});
    P.push({name:'Listello '+(i+1)+'/'+(bnd.length-1),tag:'listello',th:3,pts:pts,holes:holes,y0:ya});}
  /* puntale: 5 strati uguali che si incollano all'estremita' larga del listello */
  for(let i=0;i<5;i++)P.push({name:'Puntale '+(i+1)+'/5',tag:'puntale',th:3,pts:[[-HW,0],[HW,0],[HW,PUN],[-HW,PUN]],holes:[]});
  /* placche a rombo: davanti e dietro */
  for(let i=0;i<4;i++){
    const side=i<2?'fronte':'dietro';
    const h8=8.485;
    P.push({name:'Placca base '+side+' '+(i%2+1),tag:'placca',th:3,pts:[[0,0],[100,0],[100,100],[0,100]],holes:[circ(50+h8,50-h8,3.6),circ(50-h8,50+h8,3.6)]});
    P.push({name:'Placca piano '+side+' '+(i%2+1),tag:'placca',th:3,pts:[[0,0],[80,0],[80,80],[0,80]],holes:[]});}
  /* stecche, guardie e tappi */
  FANS.forEach(f=>['sx','dx'].forEach(s=>{slatPieces(f,s).forEach(p=>P.push(p));P.push(capPiece(f,s));}));
  return {pieces:P,cam:c};}

window.BastoneGeo={HA:HA,HB:HB,PUN:PUN,HW:HW,PIV:PIV,FANS:FANS,BETA:BETA,RC:RC,A0:A0,DW:DW,PW:PW,R1:R1,R2:R2,cam:cam,allPieces:allPieces,headZones:headZones,headInfo:headInfo,slotPoly:slotPoly,polar:polar,circ:circ,arc:arc,clean:clean};
})();
