// laserBrio - vista 3D del supporto telefono montato (si carica solo quando serve)
(function(){
'use strict';
var CDN=['https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js','https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
var loading=null,V=null,last=null,opts={phone:true,rail:true,explode:0};
function loadScript(src){return new Promise(function(ok,ko){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=function(){ko(new Error(src));};document.head.appendChild(s);});}
function ensure(){
  if(window.THREE&&THREE.OrbitControls)return Promise.resolve();
  if(!loading)loading=loadScript(CDN[0]).then(function(){return loadScript(CDN[1]);}).catch(function(e){loading=null;throw e;});
  return loading;
}
function shapeFrom(paths){
  var outer=null,i;
  for(i=0;i<paths.length;i++)if(!paths[i].hole){outer=paths[i];break;}
  var sh=new THREE.Shape(outer.pts.map(function(q){return new THREE.Vector2(q[0],q[1]);}));
  paths.forEach(function(p){if(p.hole)sh.holes.push(new THREE.Path(p.pts.map(function(q){return new THREE.Vector2(q[0],q[1]);})));});
  return sh;
}
function basis(ex,ey,ez,pos){
  var m=new THREE.Matrix4();m.makeBasis(new THREE.Vector3(ex[0],ex[1],ex[2]),new THREE.Vector3(ey[0],ey[1],ey[2]),new THREE.Vector3(ez[0],ez[1],ez[2]));
  m.setPosition(pos[0],pos[1],pos[2]);return m;
}
function addGeo(group,geo,mat,edgeCol){
  var mesh=new THREE.Mesh(geo,mat);group.add(mesh);
  var ln=new THREE.LineSegments(new THREE.EdgesGeometry(geo,35),new THREE.LineBasicMaterial({color:edgeCol||0x4a2f17}));group.add(ln);
}
function plate(group,paths,depth,m,mat){
  var geo=new THREE.ExtrudeGeometry(shapeFrom(paths),{depth:depth,bevelEnabled:false,curveSegments:1,steps:1});
  geo.applyMatrix4(m);addGeo(group,geo,mat);
}
function box(group,sx,sy,sz,cx,cy,cz,mat,edge){
  var geo=new THREE.BoxGeometry(sx,sy,sz);geo.translate(cx,cy,cz);addGeo(group,geo,mat,edge);
}
function cyl(group,r,len,axis,cx,cy,cz,mat){
  var geo=new THREE.CylinderGeometry(r,r,len,14);
  if(axis==='z')geo.rotateX(Math.PI/2);
  geo.translate(cx,cy,cz);addGeo(group,geo,mat,0x333333);
}
function pathsOf(plan,tag){for(var i=0;i<plan.parts.length;i++)if(plan.parts[i].tag===tag)return plan.parts[i].paths;return null;}

function build(plan,P){
  var I=plan.info,t=P.t,n=P.n,Wr=P.Wr,Hr=P.Hr,ytop=I.ytop,ys=I.ys,pw=I.pw,k=I.k,tabL=I.tabL;
  var w=(P.wMin+P.wMax)/2,wi=w/2+0.5,u0=P.R+I.cb+5,zh=wi+I.footOff;
  var zArm=Wr+n*t;  // faccia esterna del montante
  var woodA=new THREE.MeshLambertMaterial({color:0xe3c392,side:THREE.DoubleSide});
  var woodB=new THREE.MeshLambertMaterial({color:0xd8b684,side:THREE.DoubleSide});
  var metal=new THREE.MeshLambertMaterial({color:0x9aa0a6});
  var railM=new THREE.MeshLambertMaterial({color:0x6c7580,transparent:true,opacity:0.55});
  var phoneM=new THREE.MeshLambertMaterial({color:0x2d5fbf,transparent:true,opacity:0.5});
  var G={},g,i;
  function grp(name,ex){g=new THREE.Group();g.userData.ex=ex;G[name]=g;return g;}

  // profilo del telaio
  g=grp('rail',[0,0,0]);
  box(g,pw+90,Hr,Wr,pw/2,Hr/2,Wr/2,railM,0x445566);

  // montante (n strati)
  g=grp('post',[0,0,22]);
  var postP=pathsOf(plan,'montante');
  for(i=0;i<n;i++)plate(g,postP,t,basis([1,0,0],[0,1,0],[0,0,1],[0,ys,Wr+i*t]),i%2?woodB:woodA);

  // piastra interna (3 strati)
  g=grp('inner',[0,0,-45]);
  var inP=pathsOf(plan,'piastra');
  for(i=0;i<I.nIn;i++)plate(g,inP,t,basis([1,0,0],[0,1,0],[0,0,1],[0,ys,-I.nIn*t+i*t]),i%2?woodB:woodA);

  // braccio: n-2 strati senza culla + 2 con culla. forma (u,v): u->Z, v->X, spessore->Y
  g=grp('arm',[0,0,70]);
  var armP=pathsOf(plan,'braccioP'),armF=pathsOf(plan,'braccioF');
  for(i=0;i<n;i++){
    var y=ytop-n*t+i*t;
    plate(g,i<n-2?armP:armF,t,basis([0,0,1],[1,0,0],[0,1,0],[pw/2,y,zArm]),i%2?woodB:woodA);
  }

  // ganasce (mensola + strisce) e viti
  var jawP=pathsOf(plan,'mensola');
  [-1,1].forEach(function(s){
    g=grp('jaw'+s,[0,45,0]);
    var m=s>0?basis([0,0,1],[1,0,0],[0,1,0],[pw/2+(wi-I.lipW),ytop,zArm+u0])
             :basis([0,0,1],[-1,0,0],[0,1,0],[pw/2-(wi-I.lipW),ytop,zArm+u0]);
    plate(g,jawP,t,m,woodA);
    for(var j=0;j<k;j++){
      var cx=pw/2+s*(wi-I.lipW+I.lipW+I.wallT/2);
      box(g,I.wallT,t,I.Lj,cx,ytop+t+j*t+t/2,zArm+u0+I.Lj/2,j%2?woodA:woodB,0x4a2f17);
    }
  });
  g=grp('jawbolts',[0,85,0]);
  [-1,1].forEach(function(s){[I.jawEdge,I.Lj-I.jawEdge].forEach(function(a){
    cyl(g,2.5,I.Ljaw,'y',pw/2+s*zh,ytop+t+3-I.Ljaw/2,zArm+u0+a,metal);
    box(g,12,3,12,pw/2+s*zh,ytop+t+4.5,zArm+u0+a,metal,0x333333);
  });});
  g=grp('clampbolts',[0,0,100]);
  [-15,15].forEach(function(dx){
    cyl(g,2.5,I.Lclamp,'z',pw/2+dx,I.boltY,-I.nIn*t-3+I.Lclamp/2,metal);
    box(g,12,12,3,pw/2+dx,I.boltY,-I.nIn*t-4.5,metal,0x333333);
  });

  // telefono (fantasma)
  g=grp('phone',[0,120,0]);
  var T=Math.max(4,P.Tmax-1);
  box(g,w,T,150,pw/2,ytop+t+T/2,zArm+u0+I.Lj/2,phoneM,0x1d3f85);
  G.phone.userData.isPhone=true;G.rail.userData.isRail=true;
  return G;
}

function apply(){
  if(!V)return;
  var e=opts.explode,name,g;
  for(name in V.G){
    g=V.G[name];var ex=g.userData.ex;
    g.position.set(ex[0]*e,ex[1]*e,ex[2]*e);
    if(g.userData.isPhone)g.visible=opts.phone;
    if(g.userData.isRail)g.visible=opts.rail;
  }
  V.dirty=true;
}
function frame(){
  if(!V)return;
  V.raf=requestAnimationFrame(frame);
  if(V.controls.update()||V.dirty){V.dirty=false;V.renderer.render(V.scene,V.camera);}
}
function size(){
  var c=V.box,w=Math.max(200,c.clientWidth),h=Math.max(220,c.clientHeight||320);
  V.renderer.setSize(w,h,false);V.camera.aspect=w/h;V.camera.updateProjectionMatrix();V.dirty=true;
}
function init(box){
  var r=new THREE.WebGLRenderer({antialias:true});
  r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));r.setClearColor(0xf3ebe0,1);
  r.domElement.style.width='100%';r.domElement.style.height='100%';r.domElement.style.display='block';
  box.innerHTML='';box.appendChild(r.domElement);
  var sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(35,1,5,3000);
  sc.add(new THREE.AmbientLight(0xffffff,0.75));
  var d=new THREE.DirectionalLight(0xffffff,0.55);d.position.set(200,400,300);sc.add(d);
  var d2=new THREE.DirectionalLight(0xffffff,0.25);d2.position.set(-250,100,-200);sc.add(d2);
  var ctl=new THREE.OrbitControls(cam,r.domElement);
  ctl.enableDamping=true;ctl.dampingFactor=0.12;ctl.enablePan=true;
  V={box:box,renderer:r,scene:sc,camera:cam,controls:ctl,G:null,root:new THREE.Group(),dirty:true,raf:0};
  sc.add(V.root);
  if(window.ResizeObserver){V.ro=new ResizeObserver(function(){size();});V.ro.observe(box);}
  else window.addEventListener('resize',size);
  size();frame();
}
function fit(P,plan){
  var I=plan.info,zEnd=P.Wr+P.n*P.t+P.R+I.cb+5+I.Lj+20;
  var asp=V.camera.aspect||1.5;
  var vNeed=I.ytop+130,hNeed=zEnd+40;
  var cx=I.pw/2,cy=vNeed/2-10,cz=zEnd*0.5-10;
  V.controls.target.set(cx,cy,cz);
  var dist=Math.max(vNeed,hNeed/asp)/(2*Math.tan(17.5*Math.PI/180))*1.1;
  var d=new THREE.Vector3(1.0,0.55,0.4).normalize().multiplyScalar(dist);
  V.camera.position.set(cx+d.x,cy+d.y,cz+d.z);
  V.camera.far=dist*6;V.camera.updateProjectionMatrix();
  V.controls.update();V.dirty=true;
}
function update(box,plan,P){
  last={plan:plan,P:P};
  return ensure().then(function(){
    if(!V||V.box!==box){if(V)dispose();init(box);}
    var first=!V.G;
    if(V.G)V.root.remove.apply(V.root,V.root.children.slice());
    V.G=build(plan,P);
    for(var n in V.G)V.root.add(V.G[n]);
    if(first||V.sig!==sig(P))fit(P,plan);
    V.sig=sig(P);apply();
  });
}
function sig(P){return [P.Wr,P.Hr,P.H,P.R,P.n].join('|');}
function dispose(){
  if(!V)return;cancelAnimationFrame(V.raf);if(V.ro)V.ro.disconnect();
  try{V.renderer.dispose();}catch(e){}V=null;
}
function set(o){for(var k in o)opts[k]=o[k];apply();}
function resetView(){if(V&&last)fit(last.P,last.plan);}
window.Vista3D={update:update,set:set,resetView:resetView,dispose:dispose,_state:function(){return V;}};
})();
