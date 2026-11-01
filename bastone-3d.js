/* Anteprima 3D del bastone (three.js 0.128 dalla rete, si carica solo quando serve) */
(function(){
'use strict';
const CDN=['https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js','https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
function js(src){return new Promise((ok,ko)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=()=>ko(new Error(src));document.head.appendChild(e);});}
function ensure(){if(window.THREE&&THREE.OrbitControls)return Promise.resolve();return js(CDN[0]).then(()=>js(CDN[1]));}
function start(box,rOpen,rExp,bReset,b){
  return ensure().then(()=>{
    const g=BastoneGeo,HA=g.HA,HB=g.HB,HW=g.HW,cam=g.cam(),Y=y=>HA/2-y;
    const sc=new THREE.Scene();sc.background=new THREE.Color(0xf3ebe0);
    const w=box.clientWidth||600,h=box.clientHeight||460;
    const rd=new THREE.WebGLRenderer({antialias:true});rd.setSize(w,h);rd.setPixelRatio(Math.min(2,window.devicePixelRatio||1));box.innerHTML='';box.appendChild(rd.domElement);
    const ca=new THREE.PerspectiveCamera(32,w/h,10,20000),ctl=new THREE.OrbitControls(ca,rd.domElement);
    sc.add(new THREE.HemisphereLight(0xffffff,0x8a7a66,0.9));const dl=new THREE.DirectionalLight(0xffffff,0.7);dl.position.set(400,600,900);sc.add(dl);
    const mat=(c,o)=>new THREE.MeshStandardMaterial({color:c,roughness:0.8,transparent:o<1,opacity:o});
    const box3=(x0,x1,y0,y1,z0,z1,m)=>{const me=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,Math.abs(y1-y0),z1-z0),m);me.position.set((x0+x1)/2,Y((y0+y1)/2),(z0+z1)/2);return me;};
    const lay={};  /* strato -> gruppo (per l'esploso) */
    const LAY=[['dietro',-9,-6,0xb98f5a,1],['listello',-6,-3,0xe8c9a0,1],['p1',-3,0,0xd9b98a,1],['p2',0,3,0xd9b98a,1],['p3',3,6,0xd9b98a,1],['davanti',6,9,0xb98f5a,0.35]];
    LAY.forEach((l,i)=>{const gr=new THREE.Group();gr.userData.i=i;sc.add(gr);lay[l[0]]=gr;});
    const pk=g.FANS.map(f=>[f.Yp-10,f.Yp+f.L+1]);
    const addL=(name,fn)=>{const l=LAY.find(x=>x[0]===name);fn(lay[name],l[1],l[2],mat(l[3],l[4]));};
    addL('dietro',(gr,z0,z1,m)=>gr.add(box3(-HW,HW,0,HB,z0,z1,m)));
    addL('davanti',(gr,z0,z1,m)=>gr.add(box3(-HW,HW,0,HB,z0,z1,m)));
    /* strati delle stecche: pieni fuori dalle nicchie, solo anima dentro */
    ['p1','p2','p3'].forEach(n=>addL(n,(gr,z0,z1,m)=>{let y=0;pk.forEach(p=>{if(p[0]>y)gr.add(box3(-HW,HW,y,p[0],z0,z1,m));gr.add(box3(-3,3,p[0],p[1],z0,z1,m));y=p[1];});gr.add(box3(-HW,HW,y,HB,z0,z1,m));}));
    /* strato del listello: guide ai lati (compresa la testa larga) */
    const zs=g.headZones(cam);
    addL('listello',(gr,z0,z1,m)=>{let y=0;const wide=zs.map(z=>[z[0],z[1]+cam.travel]);wide.forEach(z=>{if(z[0]>y){gr.add(box3(-HW,-5.25,y,z[0],z0,z1,m));gr.add(box3(5.25,HW,y,z[0],z0,z1,m));}gr.add(box3(-HW,-9.05,z[0],z[1],z0,z1,m));gr.add(box3(9.05,HW,z[0],z[1],z0,z1,m));y=z[1];});gr.add(box3(-HW,-5.25,y,HB,z0,z1,m));gr.add(box3(5.25,HW,y,HB,z0,z1,m));});
    /* listello e puntale */
    const sl=new THREE.Group();lay.listello.add(sl);
    {const m=mat(0xc9a06a,1);sl.add(box3(-5,5,zs[0][0],HA,-6,-3,m));zs.forEach(z=>sl.add(box3(-8.8,8.8,z[0],z[1],-6,-3,m)));
     const pm=mat(0x2c6fa6,1);sl.add(box3(-HW,HW,HB,HA,-9,9,pm));}
    /* ventagli */
    const fans=[];
    g.FANS.forEach(f=>[-1,1].forEach(sx=>{
      for(let k=0;k<f.n;k++){
        const gr=new THREE.Group(),z0=k===0?-3:k===1?0:3,z1=z0+(k===0?3:2),m=mat(k===0?0xe0b878:0xd9b98a,1);
        const me=box3(-6.5,6.5,0,f.L,z0,z1,m);me.position.set(-sx*1.5,0-f.L/2,(z0+z1)/2);gr.add(me);
        if(k===0){const tp=new THREE.Mesh(new THREE.BoxGeometry(3,f.L+7,8.6),mat(0xb98f5a,1));tp.position.set(sx*6.5,-(f.L+7)/2+3,1.5-(z0+z1)/2+(z0+z1)/2);tp.position.set(sx*(7+0),-(f.L)/2,1.5);tp.position.x=sx*(18.5-12)*1;gr.add(tp);}
        gr.position.set(sx*12,Y(f.Yp),0);gr.userData={f:f,k:k,sx:sx,z:(z0+z1)/2};sc.add(gr);fans.push(gr);
        const pin=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,22,10),mat(0x888888,1));pin.rotation.x=Math.PI/2;pin.position.set(sx*12,Y(f.Yp),0);sc.add(pin);
      }}));
    /* placche a rombo (davanti e dietro, su ogni perno) */
    const pl=[];
    g.FANS.forEach(f=>[9.2,-9.2].forEach(z=>{const me=new THREE.Mesh(new THREE.BoxGeometry(80*0.7071*2/1.4142*1.0,80*0.7071*2/1.4142*1.0,3),mat(0x7a5a3a,1));me.geometry=new THREE.BoxGeometry(80,80,3);me.rotation.z=Math.PI/4;me.position.set(0,Y(f.Yp),z>0?10.5:-10.5);sc.add(me);pl.push(me);}));
    function apply(){
      const t=Number(rOpen.value)/100,e=Number(rExp.value)/100;
      Object.keys(lay).forEach(n=>{const gr=lay[n];gr.position.z=(gr.userData.i-2.5)*e*70;});
      sl.position.y=-t*cam.travel;
      const psi=(f,k)=>t*g.BETA*(1-k/f.n)*(f.n===3?1:1);
      fans.forEach(gr=>{const d=gr.userData,a=(d.f.n===3?[80,53,27]:[80,40])[d.k]*t*Math.PI/180;gr.rotation.z=-d.sx*a;gr.position.z=(d.k===0?-1.5:d.k===1?1.5:4.5)*0+ (lay[d.k===0?'p1':d.k===1?'p2':'p3'].position.z);});
      pl.forEach(p=>{p.position.z=(p.position.z>0?10.5:-10.5)+(p.position.z>0?1:-1)*e*60;});}
    function fit(){ca.position.set(260,520,1500);ctl.target.set(0,Y(700),0);ctl.update();}
    rOpen.oninput=apply;rExp.oninput=apply;bReset.onclick=fit;apply();fit();
    (function loop(){requestAnimationFrame(loop);ctl.update();rd.render(sc,ca);})();
  });}
window.Bastone3D={start:start};
})();
