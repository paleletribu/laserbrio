/* laserBrio · camera: video dal vivo, calibrazione a 4 angoli, correzione obiettivo, sovrapposizione del lavoro */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=window.__camApi||{job:()=>null,area:()=>({w:400,h:400})};
const K='ls_cam';
const st={stream:null,pts:[],k1:0,rw:400,rh:400,ox:0,oy:0,op:0.6,mode:'adjust',show:true,grid:true,
  Hb2i:null,Hi2b:null,raf:0,ov:null,ovDirty:true,ovHas:false,drag:null,W:0,H:0,src:'usb',peerH:null,label:''};

/* ---------- matematica ---------- */
function solveH(src,dst){
  const M=[];
  for(let i=0;i<4;i++){
    const x=src[i][0],y=src[i][1],u=dst[i][0],v=dst[i][1];
    M.push([x,y,1,0,0,0,-u*x,-u*y,u]);
    M.push([0,0,0,x,y,1,-v*x,-v*y,v]);
  }
  const n=8;
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    if(Math.abs(M[p][c])<1e-12)return null;
    const t=M[c];M[c]=M[p];M[p]=t;
    for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c]/M[c][c];for(let k=c;k<=n;k++)M[r][k]-=f*M[c][k];}
  }
  const h=M.map((row,i)=>row[n]/row[i]);h.push(1);return h;
}
function ap(h,x,y){const w=h[6]*x+h[7]*y+h[8];return[(h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w];}
function und(u,v){const f=st.W,x=(u-st.W/2)/f,y=(v-st.H/2)/f,s=1+st.k1*(x*x+y*y);return[x*s,y*s];}
function dist(px,py){let x=px,y=py;for(let i=0;i<12;i++){const s=1+st.k1*(x*x+y*y);x=px/s;y=py/s;}return[st.W/2+x*st.W,st.H/2+y*st.W];}
function calib(){
  st.Hb2i=st.Hi2b=null;st.ovDirty=true;
  if(st.pts.length<4||!st.W||st.rw<=0||st.rh<=0)return;
  const bed=[[0,0],[st.rw,0],[st.rw,st.rh],[0,st.rh]];
  const pu=st.pts.map(p=>und(p[0]*st.W,p[1]*st.H));
  const a=solveH(bed,pu),b=solveH(pu,bed);
  if(a&&b){st.Hb2i=a;st.Hi2b=b;}
}
function b2c(x,y){const q=ap(st.Hb2i,x,y);return dist(q[0],q[1]);}
function c2b(u,v){const q=und(u,v);return ap(st.Hi2b,q[0],q[1]);}
const ok=p=>isFinite(p[0])&&isFinite(p[1]);

/* ---------- sovrapposizione del lavoro (disegnata una volta, poi riusata) ---------- */
function subdiv(pts,close){
  const out=[],n=pts.length;
  for(let i=0;i<(close?n:n-1);i++){
    const a=pts[i],b=pts[(i+1)%n],L=Math.hypot(b[0]-a[0],b[1]-a[1]),m=Math.max(1,Math.ceil(L/6));
    for(let k=0;k<m;k++)out.push([a[0]+(b[0]-a[0])*k/m,a[1]+(b[1]-a[1])*k/m]);
  }
  if(!close)out.push(pts[n-1]);
  return out;
}
function tri(c,img,s,d){
  const p1=s[1][0]-s[0][0],q1=s[1][1]-s[0][1],p2=s[2][0]-s[0][0],q2=s[2][1]-s[0][1],den=p1*q2-p2*q1;
  if(!den)return;
  const dx1=d[1][0]-d[0][0],dx2=d[2][0]-d[0][0],dy1=d[1][1]-d[0][1],dy2=d[2][1]-d[0][1];
  const a=(dx1*q2-dx2*q1)/den,cc=(p1*dx2-p2*dx1)/den,b=(dy1*q2-dy2*q1)/den,dd=(p1*dy2-p2*dy1)/den;
  const e=d[0][0]-a*s[0][0]-cc*s[0][1],f=d[0][1]-b*s[0][0]-dd*s[0][1];
  const gx=(d[0][0]+d[1][0]+d[2][0])/3,gy=(d[0][1]+d[1][1]+d[2][1])/3;
  c.save();c.beginPath();
  d.forEach((q,i)=>{const l=Math.hypot(q[0]-gx,q[1]-gy)||1,x=q[0]+(q[0]-gx)/l*0.7,y=q[1]+(q[1]-gy)/l*0.7;if(i)c.lineTo(x,y);else c.moveTo(x,y);});
  c.closePath();c.clip();c.setTransform(a,b,cc,dd,e,f);c.drawImage(img,0,0);c.restore();
}
function buildOv(){
  st.ovDirty=false;st.ovHas=false;
  if(!st.ov)st.ov=document.createElement('canvas');
  st.ov.width=st.W;st.ov.height=st.H;
  const c=st.ov.getContext('2d');c.clearRect(0,0,st.W,st.H);
  const job=A.job();if(!job||!st.Hb2i)return;
  const lw=Math.max(2,st.W/500);
  if(job.kind==='img'&&job.canvas&&job.canvas.width>1){
    const N=24,pc=job.canvas.width,pr=job.canvas.height,G=[];
    for(let j=0;j<=N;j++){G[j]=[];for(let i=0;i<=N;i++)G[j][i]=b2c(st.ox+job.w*i/N,st.oy+job.h*(1-j/N));}
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){
      const S=(a,b)=>[a/N*pc,b/N*pr];
      const q=[G[j][i],G[j][i+1],G[j+1][i+1],G[j+1][i]];
      if(!q.every(ok))continue;
      tri(c,job.canvas,[S(i,j),S(i+1,j),S(i+1,j+1)],[q[0],q[1],q[2]]);
      tri(c,job.canvas,[S(i,j),S(i+1,j+1),S(i,j+1)],[q[0],q[2],q[3]]);
    }
    st.ovHas=true;
  }else if(job.kind==='cut'&&job.items){
    for(const it of job.items)for(const p of it.paths){
      const pts=subdiv(p.pts,true).map(q=>b2c(q[0]+st.ox,q[1]+st.oy)).filter(ok);
      if(pts.length<3)continue;
      c.beginPath();pts.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath();
      if(!p.hole){c.fillStyle='rgba(34,255,136,.16)';c.fill();}
      c.lineWidth=lw+2;c.strokeStyle='rgba(0,0,0,.7)';c.stroke();
      c.lineWidth=lw;c.strokeStyle=p.hole?'#ff4fd8':'#22ff88';c.stroke();
    }
    st.ovHas=true;
  }
}

/* ---------- disegno ad ogni fotogramma ---------- */
function poly(c,pts){let first=true;for(const q of pts){if(!ok(q)){first=true;continue;}if(first){c.moveTo(q[0],q[1]);first=false;}else c.lineTo(q[0],q[1]);}}
function frame(){
  if(!st.stream)return;
  const v=$('camVid'),cv=$('camCv');
  if(v.videoWidth&&(cv.width!==v.videoWidth||cv.height!==v.videoHeight)){
    cv.width=v.videoWidth;cv.height=v.videoHeight;st.W=cv.width;st.H=cv.height;calib();ui();
  }
  if(cv.width>2&&v.readyState>=2){
    const c=cv.getContext('2d'),W=st.W,lw=Math.max(2,W/600),r=Math.max(9,W/110);
    c.clearRect(0,0,W,st.H);
    if(st.Hb2i){
      if(st.ovDirty)buildOv();
      if(st.show&&st.ovHas){c.globalAlpha=st.op;c.drawImage(st.ov,0,0);c.globalAlpha=1;}
      if(st.grid){
        const step=Math.max(st.rw,st.rh)>150?50:10;
        c.beginPath();c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=Math.max(1,lw/2);
        for(let x=step;x<st.rw;x+=step){const l=[];for(let k=0;k<=20;k++)l.push(b2c(x,st.rh*k/20));poly(c,l);}
        for(let y=step;y<st.rh;y+=step){const l=[];for(let k=0;k<=20;k++)l.push(b2c(st.rw*k/20,y));poly(c,l);}
        c.stroke();
      }
      const e=[];
      for(let k=0;k<=24;k++)e.push(b2c(st.rw*k/24,0));
      for(let k=0;k<=24;k++)e.push(b2c(st.rw,st.rh*k/24));
      for(let k=0;k<=24;k++)e.push(b2c(st.rw*(1-k/24),st.rh));
      for(let k=0;k<=24;k++)e.push(b2c(0,st.rh*(1-k/24)));
      c.beginPath();poly(c,e);c.lineWidth=lw+2;c.strokeStyle='rgba(0,0,0,.6)';c.stroke();
      c.lineWidth=lw;c.strokeStyle='#ffd400';c.stroke();
      const o=b2c(st.ox,st.oy);
      if(ok(o)){c.beginPath();c.arc(o[0],o[1],r*0.7,0,7);c.fillStyle='#ff3b30';c.fill();c.lineWidth=lw;c.strokeStyle='#fff';c.stroke();
        c.font=Math.round(r*1.5)+'px system-ui,sans-serif';c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=3;c.strokeText('0,0',o[0]+r,o[1]-r*0.5);c.fillText('0,0',o[0]+r,o[1]-r*0.5);}
    }
    if(!st.Hb2i||st.mode==='adjust'){
      st.pts.forEach((p,i)=>{
        const x=p[0]*W,y=p[1]*st.H;
        c.beginPath();c.arc(x,y,r,0,7);c.fillStyle='rgba(255,212,0,.35)';c.fill();c.lineWidth=lw;c.strokeStyle='#ffd400';c.stroke();
        c.font='bold '+Math.round(r*1.3)+'px system-ui,sans-serif';c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=3;
        c.strokeText(String(i+1),x+r*1.1,y-r*1.1);c.fillText(String(i+1),x+r*1.1,y-r*1.1);
      });
    }
  }
  st.raf=requestAnimationFrame(frame);
}

/* ---------- interfaccia ---------- */
const NAMES=['basso a sinistra (vicino a te, a sinistra)','basso a destra','alto a destra','alto a sinistra'];
function msg(t,bad){const m=$('camMsg');m.textContent=t||'';m.style.color=bad?'var(--bad)':'var(--mute)';}
function save(){
  try{localStorage.setItem(K,JSON.stringify({dev:$('camDev').value,res:$('camRes').value,src:st.src,pts:st.pts,k1:st.k1,rw:st.rw,rh:st.rh,ox:st.ox,oy:st.oy,op:st.op,show:st.show,grid:st.grid}));}catch(e){}
}
function ui(){
  const on=!!st.stream,n=st.pts.length;
  $('camStart').hidden=on;$('camStop').hidden=!on;$('camShot').disabled=!on;$('camStage').hidden=!on;
  $('camModeAdj').classList.toggle('on',st.mode==='adjust');
  $('camModeMove').classList.toggle('on',st.mode==='move');
  $('camModeMove').disabled=!st.Hb2i;$('camModeAdj').disabled=n<4;
  $('camKv').textContent='('+st.k1.toFixed(2)+')';
  let t;
  if(n<4)t='Clicca sul video l\'angolo '+(n+1)+' di 4: '+NAMES[n]+'.';
  else if(st.mode==='move')t='Trascina sul video per spostare il disegno. I numeri qui sotto dicono di quanti mm (X, Y) parte dall\'angolo in basso a sinistra del riferimento. Il pallino rosso 0,0 è dove deve stare il laser per iniziare.';
  else t='Puoi trascinare gli angoli gialli per sistemarli. Se a metà lato la linea gialla non segue il bordo vero, muovi "Correzione dell\'obiettivo".';
  $('camStep').textContent=on?t:'';
  if(on){const s=$('camStream');if(s)s.textContent=(st.label?st.label+' · ':'')+(st.W?st.W+' × '+st.H:'in attesa dell\'immagine…');}
}
async function listDevices(){
  try{
    const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    const sel=$('camDev'),cur=sel.value;
    sel.innerHTML='<option value="">Quella predefinita</option>';
    ds.forEach((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||('Camera '+(i+1));sel.appendChild(o);});
    if([...sel.options].some(o=>o.value===cur))sel.value=cur;
  }catch(e){}
}
function useSrc(k){
  if(st.src!==k&&st.pts.length){st.pts=[];calib();st.mode='adjust';msg('Hai cambiato camera: rifai i 4 angoli sul nuovo video.');}
  st.src=k;
}
function loadJs(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
function adopt(s){
  if(st.stream&&st.stream!==s)st.stream.getTracks().forEach(t=>t.stop());
  st.stream=s;useSrc('phone');st.label='Telefono';
  const v=$('camVid');v.srcObject=s;v.play().catch(()=>{});
  $('telBox').hidden=true;msg('');
  cancelAnimationFrame(st.raf);st.raf=requestAnimationFrame(frame);
  save();ui();
}
async function phone(){
  stop(true);msg('');
  if(!/^https?:$/.test(location.protocol)){msg('Il collegamento col telefono funziona solo aprendo l\'app dal suo indirizzo internet.',true);return;}
  $('telBox').hidden=false;$('telQr').innerHTML='';$('telLink').textContent='';
  $('telStep').textContent='Preparo il collegamento…';
  try{
    if(!window.Tel)await loadJs('telefono.js');
    st.peerH=await Tel.receive({
      onStream:adopt,
      onState:(s,x)=>{
        if(s==='open'){
          const link=location.origin+location.pathname+'?tel='+x;
          $('telStep').textContent='Sul telefono: inquadra il codice con la fotocamera e apri il link, poi premi "Invia il video al PC".';
          $('telLink').textContent=link;
          Tel.qr($('telQr'),link).catch(()=>{});
        }else if(s==='closed'){
          if(st.src==='phone'&&st.stream){st.stream=null;cancelAnimationFrame(st.raf);ui();}
          $('telBox').hidden=false;
          $('telStep').textContent='Il telefono si è scollegato. Puoi riprovare con lo stesso codice.';
        }else if(s==='error'){
          $('telStep').textContent=(x==='network'||x==='server-error'||x==='socket-error'||x==='socket-closed'||x==='browser-incompatible')
            ?'Non riesco a usare il servizio di collegamento: serve internet su PC e telefono.':'Errore nel collegamento ('+x+'). Premi "Annulla" e riprova.';
        }
      }
    });
  }catch(e){$('telStep').textContent='Non riesco a caricare il collegamento: serve internet.';}
}
async function start(){
  stop(true);msg('');
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){msg('Questo browser non può usare la camera. Apri l\'app dal suo indirizzo internet con Chrome o Edge.',true);return;}
  const vc={},dev=$('camDev').value,res=$('camRes').value;
  if(dev)vc.deviceId={exact:dev};
  if(res==='max'){vc.width={ideal:2592};vc.height={ideal:1944};}
  else if(res==='1080'){vc.width={ideal:1920};vc.height={ideal:1080};}
  else{vc.width={ideal:1280};vc.height={ideal:720};}
  try{
    st.stream=await navigator.mediaDevices.getUserMedia({video:vc,audio:false});
  }catch(e){
    const n=e&&e.name;
    msg(n==='NotAllowedError'?'Il browser non ha il permesso di usare la camera: clicca il lucchetto vicino all\'indirizzo e consentila.'
      :n==='NotFoundError'||n==='OverconstrainedError'?'Non trovo la camera: controlla il cavo USB e scegline un\'altra dall\'elenco.'
      :n==='NotReadableError'?'La camera è usata da un altro programma (per esempio LightBurn): chiudilo e riprova.'
      :'Non riesco ad accendere la camera ('+(n||'errore')+').',true);
    return;
  }
  useSrc('usb');$('telBox').hidden=true;
  const v=$('camVid');v.srcObject=st.stream;
  try{await v.play();}catch(e){}
  await listDevices();
  const trk=st.stream.getVideoTracks()[0],id=trk.getSettings().deviceId;st.label=trk.label||'';
  if(id&&[...$('camDev').options].some(o=>o.value===id))$('camDev').value=id;
  save();ui();
  st.raf=requestAnimationFrame(frame);
  const s0=st.stream;
  setTimeout(()=>{
    if(st.stream===s0&&!$('camVid').videoWidth)msg('La camera è accesa ma non arriva nessuna immagine. Prova a scegliere "1280 × 720" in "Qualità", oppure scollega e ricollega il cavo USB.',true);
  },4000);
}
function stop(quiet){
  cancelAnimationFrame(st.raf);
  if(st.peerH){st.peerH.stop();st.peerH=null;}
  if(st.stream){st.stream.getTracks().forEach(t=>t.stop());st.stream=null;}
  const v=$('camVid');if(v)v.srcObject=null;
  if(!quiet)ui();
}
function pos(e){const cv=$('camCv'),r=cv.getBoundingClientRect();return[(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height];}
function setNum(id,v){$(id).value=String(Math.round(v*10)/10);}
function bind(){
  const cv=$('camCv');
  cv.onpointerdown=e=>{
    if(!st.stream||!st.W)return;
    const p=pos(e);
    try{cv.setPointerCapture(e.pointerId);}catch(_){}
    if(st.pts.length<4){
      st.pts.push([p[0]/st.W,p[1]/st.H]);
      if(st.pts.length===4){calib();st.mode='adjust';}
      save();ui();return;
    }
    if(st.mode==='adjust'){
      let bi=-1,bd=Infinity;
      st.pts.forEach((q,i)=>{const d=Math.hypot(q[0]*st.W-p[0],q[1]*st.H-p[1]);if(d<bd){bd=d;bi=i;}});
      if(bd<st.W/12)st.drag={i:bi};
    }else if(st.Hi2b){
      const b=c2b(p[0],p[1]);st.drag={bx:b[0],by:b[1],ox:st.ox,oy:st.oy};
    }
  };
  cv.onpointermove=e=>{
    if(!st.drag)return;const p=pos(e);
    if(st.drag.i!=null){st.pts[st.drag.i]=[Math.min(1,Math.max(0,p[0]/st.W)),Math.min(1,Math.max(0,p[1]/st.H))];calib();}
    else if(st.Hi2b){const b=c2b(p[0],p[1]);if(ok(b)){st.ox=st.drag.ox+(b[0]-st.drag.bx);st.oy=st.drag.oy+(b[1]-st.drag.by);setNum('camOx',st.ox);setNum('camOy',st.oy);st.ovDirty=true;}}
  };
  const up=()=>{if(st.drag){st.drag=null;save();}};
  cv.onpointerup=up;cv.onpointercancel=up;
  $('camStart').onclick=start;
  $('telStart').onclick=phone;
  $('telCancel').onclick=()=>{if(st.peerH){st.peerH.stop();st.peerH=null;}$('telBox').hidden=true;};
  $('camStop').onclick=()=>stop();
  $('camDev').onchange=()=>{save();if(st.stream)start();};
  $('camRes').onchange=()=>{save();if(st.stream)start();};
  $('camShot').onclick=()=>{
    const v=$('camVid');if(!v.videoWidth)return;
    const t=document.createElement('canvas');t.width=v.videoWidth;t.height=v.videoHeight;t.getContext('2d').drawImage(v,0,0);
    t.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='laserbrio-foto-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);},'image/png');
  };
  $('camRw').oninput=()=>{st.rw=Number($('camRw').value)||0;calib();save();};
  $('camRh').oninput=()=>{st.rh=Number($('camRh').value)||0;calib();save();};
  $('camBtnArea').onclick=()=>{const a=A.area();st.rw=a.w;st.rh=a.h;$('camRw').value=a.w;$('camRh').value=a.h;calib();save();};
  $('camBtnJob').onclick=()=>{const j=A.job();if(!j){msg('Prima scegli un\'immagine o un progetto.',true);return;}msg('');st.rw=Math.ceil(j.w);st.rh=Math.ceil(j.h);st.ox=0;st.oy=0;setNum('camOx',0);setNum('camOy',0);$('camRw').value=st.rw;$('camRh').value=st.rh;calib();save();};
  $('camUndo').onclick=()=>{st.pts.pop();calib();st.mode='adjust';save();ui();};
  $('camReset').onclick=()=>{st.pts=[];calib();st.mode='adjust';save();ui();};
  $('camK').oninput=()=>{st.k1=Number($('camK').value)/100;calib();save();ui();};
  $('camModeAdj').onclick=()=>{st.mode='adjust';ui();};
  $('camModeMove').onclick=()=>{st.mode='move';ui();};
  $('camShow').onchange=()=>{st.show=$('camShow').checked;save();};
  $('camGrid').onchange=()=>{st.grid=$('camGrid').checked;save();};
  $('camOx').oninput=()=>{st.ox=Number($('camOx').value)||0;st.ovDirty=true;save();};
  $('camOy').oninput=()=>{st.oy=Number($('camOy').value)||0;st.ovDirty=true;save();};
  $('camOp').oninput=()=>{st.op=Number($('camOp').value)/100;save();};
}
function restore(){
  let o=null;try{o=JSON.parse(localStorage.getItem(K)||'null');}catch(e){}
  if(o){
    if(o.src==='phone'||o.src==='usb')st.src=o.src;
    if(Array.isArray(o.pts)&&o.pts.length<=4&&o.pts.every(p=>Array.isArray(p)&&p.length===2&&isFinite(p[0])&&isFinite(p[1])))st.pts=o.pts;
    if(isFinite(o.k1))st.k1=Math.max(-.6,Math.min(.6,o.k1));
    if(o.rw>0)st.rw=o.rw;if(o.rh>0)st.rh=o.rh;
    if(isFinite(o.ox))st.ox=o.ox;if(isFinite(o.oy))st.oy=o.oy;
    if(o.op>=.1&&o.op<=1)st.op=o.op;
    if(typeof o.show==='boolean')st.show=o.show;if(typeof o.grid==='boolean')st.grid=o.grid;
    if(o.res&&[...$('camRes').options].some(x=>x.value===o.res))$('camRes').value=o.res;
    if(o.dev)window.__camDevWanted=o.dev;
  }
  $('camRw').value=st.rw;$('camRh').value=st.rh;$('camK').value=Math.round(st.k1*100);
  setNum('camOx',st.ox);setNum('camOy',st.oy);$('camOp').value=Math.round(st.op*100);
  $('camShow').checked=st.show;$('camGrid').checked=st.grid;
  if(window.__camDevWanted){const s=$('camDev');const o2=document.createElement('option');o2.value=window.__camDevWanted;o2.textContent='La camera usata l\'ultima volta';s.appendChild(o2);s.value=window.__camDevWanted;}
}
window.Cam={dirty(){st.ovDirty=true;},_t:{st,b2c,c2b,solveH,ap,calib},start,stop,phone};
restore();bind();ui();
})();
