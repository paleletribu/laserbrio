/* laserBrio · telefono come camera: il video del telefono arriva in diretta sul PC (WebRTC, collegamento tramite PeerJS) */
(function(){
'use strict';
const PEER_JS='https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const QR_JS='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const $=id=>document.getElementById(id);
const loaded={};
function load(src){
  return loaded[src]||(loaded[src]=new Promise((res,rej)=>{
    const s=document.createElement('script');s.src=src;s.onload=res;
    s.onerror=()=>{delete loaded[src];rej(new Error('load '+src));};
    document.head.appendChild(s);
  }));
}
function rid(n){const a='abcdefghjkmnpqrstuvwxyz23456789',r=crypto.getRandomValues(new Uint8Array(n));let o='';for(const b of r)o+=a[b%a.length];return o;}
function mkPeer(id){const o=window.__peerOpts;return id?new Peer(id,o):new Peer(o);}

/* ---------- lato PC: aspetta il video del telefono ---------- */
async function receive(cb){
  await load(PEER_JS);
  const id='lb-'+rid(8);
  let dead=false;
  const peer=mkPeer(id);
  peer.on('open',i=>cb.onState('open',i));
  peer.on('call',call=>{
    call.answer();
    call.on('stream',s=>cb.onStream(s));
    call.on('close',()=>cb.onState('closed'));
    call.on('error',()=>cb.onState('closed'));
  });
  peer.on('connection',c=>{c.on('data',d=>{if(cb.onData)cb.onData(d);try{c.send('ok');}catch(e){}});});
  peer.on('disconnected',()=>{if(!dead){try{peer.reconnect();}catch(e){}}});
  peer.on('error',e=>cb.onState('error',e&&e.type));
  return {id,stop(){dead=true;try{peer.destroy();}catch(e){}}};
}
async function qr(el,text){
  await load(QR_JS);
  const q=qrcode(0,'M');q.addData(text);q.make();
  el.innerHTML=q.createSvgTag(4,2);
  const s=el.firstChild;s.style.width='230px';s.style.height='230px';s.style.display='block';
}

/* ---------- lato telefono: manda il video al PC ---------- */
function phone(id){
  try{localStorage.setItem('lb_pc',id);}catch(e){}
  const v=$('telVid'),go=$('telGo'),stopB=$('telStop'),sel=$('telCam');
  const msg=(t,bad)=>{const m=$('telMsg');m.textContent=t||'';m.style.color=bad?'var(--bad)':'var(--mute)';};
  let stream=null,peer=null,call=null,timer=0,wl=null;
  async function cams(){
    try{
      const d=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==='videoinput'),cur=sel.value;
      sel.innerHTML='<option value="">Camera posteriore (consigliata)</option>';
      d.forEach((x,i)=>{const o=document.createElement('option');o.value=x.deviceId;o.textContent=x.label||('Camera '+(i+1));sel.appendChild(o);});
      if([...sel.options].some(o=>o.value===cur))sel.value=cur;
    }catch(e){}
  }
  async function open(){
    const vc={width:{ideal:1920},height:{ideal:1080}};
    if(sel.value)vc.deviceId={exact:sel.value};else vc.facingMode={ideal:'environment'};
    const s=await navigator.mediaDevices.getUserMedia({video:vc,audio:false});
    return s;
  }
  function cleanup(){
    clearInterval(timer);
    if(call){try{call.close();}catch(e){}call=null;}
    if(peer){try{peer.destroy();}catch(e){}peer=null;}
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
    v.srcObject=null;
    if(wl){try{wl.release();}catch(e){}wl=null;}
    go.hidden=false;stopB.hidden=true;
  }
  function watch(){
    clearInterval(timer);
    let was=false;
    timer=setInterval(()=>{
      const pc=call&&call.peerConnection;if(!pc)return;
      const s=pc.connectionState||pc.iceConnectionState;
      if(s==='connected'||s==='completed'){was=true;msg('Collegato al PC. Tieni questa pagina aperta e il telefono fermo.');}
      else if(s==='failed'||s==='disconnected'||s==='closed')msg(was?'Il collegamento si è interrotto. Premi "Ferma" e poi "Invia il video al PC".':'Non riesco a collegarmi al PC. Controlla che il PC sia ancora in attesa e che entrambi abbiano internet.',true);
    },1000);
  }
  go.onclick=async()=>{
    msg('Accendo la camera…');go.hidden=true;stopB.hidden=false;
    try{
      stream=await open();
      v.srcObject=stream;try{await v.play();}catch(e){}
      await cams();
      try{if(navigator.wakeLock)wl=await navigator.wakeLock.request('screen');}catch(e){}
    }catch(e){
      cleanup();
      msg(e&&e.name==='NotAllowedError'?'Serve il permesso di usare la camera: consentilo e riprova.':'Non riesco ad accendere la camera ('+((e&&e.name)||'errore')+').',true);
      return;
    }
    msg('Mi collego al PC…');
    try{await load(PEER_JS);}catch(e){cleanup();msg('Non riesco a collegarmi: serve internet sul telefono.',true);return;}
    peer=mkPeer();
    peer.on('open',()=>{call=peer.call(id,stream);watch();});
    peer.on('error',e=>{
      const t=e&&e.type;
      msg(t==='peer-unavailable'?'Il PC non sta aspettando. Sul PC premi "Usa il telefono come camera" e apri il nuovo codice.':'Non riesco a collegarmi ('+(t||'errore')+'). Serve internet su telefono e PC.',true);
    });
  };
  stopB.onclick=()=>{cleanup();msg('Fermato.');};
  sel.onchange=async()=>{
    if(!stream||!call)return;
    try{
      const ns=await open(),nt=ns.getVideoTracks()[0],snd=call.peerConnection.getSenders().find(x=>x.track&&x.track.kind==='video');
      if(snd)await snd.replaceTrack(nt);
      stream.getTracks().forEach(t=>t.stop());stream=ns;v.srcObject=ns;
    }catch(e){msg('Non riesco a cambiare camera.',true);}
  };
  msg('Premi il pulsante per mandare il video al PC.');
  cams();
}
/* il telefono manda al PC il materiale letto dal QR della scheda */
async function send(id,data){
  await load(PEER_JS);
  return new Promise(res=>{
    const peer=mkPeer();let done=false;
    const end=ok=>{if(done)return;done=true;try{peer.destroy();}catch(e){}res(ok);};
    setTimeout(()=>end(false),12000);
    peer.on('error',()=>end(false));
    peer.on('open',()=>{const c=peer.connect(id,{reliable:true});c.on('open',()=>{c.send(data);});c.on('data',()=>end(true));c.on('error',()=>end(false));});
  });
}
window.Tel={receive,qr,phone,send};
})();
