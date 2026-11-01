/* Istruzioni illustrate del bastone: testi, figure in SVG e stampa */
(function(){
'use strict';
const C={k:'#3a2f25',w:'#d9b98a',w2:'#b98f5a',r:'#c0392b',b:'#2c6fa6',g:'#e9dcc6'};
const svg=(w,h,body)=>'<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;max-width:'+w+'px;height:auto;background:#fffaf2;border:1px solid #ddd3c3;border-radius:8px" font-family="sans-serif" font-size="11">'+body+'</svg>';
const T=(x,y,t,a,c)=>'<text x="'+x+'" y="'+y+'" fill="'+(c||C.k)+'" text-anchor="'+(a||'start')+'">'+t+'</text>';
const R=(x,y,w,h,f,s)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+(f||'none')+'" stroke="'+(s||C.k)+'" stroke-width="1"/>';
const L=(x1,y1,x2,y2,c,d)=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(c||C.k)+'" stroke-width="1.2"'+(d?' stroke-dasharray="4 3"':'')+'/>';
const PL=(pts,f,s)=>'<polygon points="'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')+'" fill="'+(f||'none')+'" stroke="'+(s||C.k)+'" stroke-width="1"/>';

/* 1. sezione a strati */
function figStrati(){
  const lay=[['Dietro',C.w2,'piastra posteriore'],['Strato listello',C.g,'guide laterali + listello al centro'],['P1',C.w,'guardie (prima stecca)'],['P2',C.w,'seconda stecca'],['P3',C.w,'terza stecca'],['Davanti',C.w2,'piastra anteriore']];
  let b='',y=22;
  lay.forEach((l,i)=>{b+=R(60,y,200,20,l[1]);
    if(i===1)b+=R(135,y,50,20,'#e8c9a0');
    if(i>=2&&i<=4){b+=R(135,y,50,20,'#fffaf2');b+=R(60,y,8,20,'#fffaf2');b+=R(252,y,8,20,'#fffaf2');}
    b+=T(270,y+14,l[0]+' · '+l[2]);y+=28;});
  b+=T(160,12,'sezione a metà ventaglio (da sopra)','middle');
  b+=T(160,y+8,'larghezza 40 mm, spessore circa 18 mm','middle');
  return svg(520,y+20,b);}

/* 2. vista laterale: posizione dei ventagli e dei giunti */
function figAsta(){
  const g=BastoneGeo,H=g.HA,sc=0.2,x0=40;let b='';
  b+=R(x0,10,24,H*sc,C.g);
  g.FANS.forEach(f=>{b+=R(x0+2,10+(f.Yp-10)*sc,20,(f.L+11)*sc,'#fffaf2');b+=L(x0-6,10+f.Yp*sc,x0+30,10+f.Yp*sc,C.r,1);
    b+=T(x0+36,10+f.Yp*sc+4,'perno a '+(f.Yp/10)+' cm dalla cima'+(f.n===3?': ventaglio alto, 3+3 stecche':': ventaglio basso, 2+2 stecche'));});
  b+=R(x0,10+g.HB*sc,24,g.PUN*sc+2,C.b);
  b+=T(x0+36,10+g.HB*sc+8,'puntale (si tira per aprire)');
  [330,660,990,1320].forEach(y=>b+=L(x0-8,10+y*sc,x0,10+y*sc,C.k));
  b+=T(x0-10,14+330*sc,'giunti','end');
  return svg(420,H*sc+30,b);}

/* 3. coda di rondine */
function figCoda(){
  let b='';
  b+=PL([[40,20],[100,20],[100,60],[80,60],[88,90],[52,90],[60,60],[40,60]],C.w);
  b+=PL([[40,96],[60,96],[52,126],[88,126],[80,96],[100,96],[100,150],[40,150]],C.w);
  b+=T(120,45,'ogni pezzo ha la coda a un capo');b+=T(120,62,'e l\'incastro all\'altro');
  b+=T(120,125,'incastra il pezzo dall\'alto,');b+=T(120,140,'con una goccia di colla vinilica');
  b+=T(40,172,'I giunti dei vari strati sono sfalsati: l\'asta non si piega in un punto solo.');
  return svg(480,185,b);}

/* 4. meccanismo: asola e perno */
function figCamma(){
  const g=BastoneGeo,c=g.cam(),sc=7;let b='';
  const ox=140,oy=215;
  b+=R(ox-8.8*sc,oy-26*sc,17.6*sc,34*sc,C.g);
  b+=PL(g.slotPoly(c.path,g.PW).map(q=>[ox+q[0]*sc,oy+q[1]*sc]),'#fffaf2');
  b+=T(ox,oy-26*sc-6,'testa del listello (vista di fronte)','middle');
  const p0=c.path[0],pe=c.path[c.path.length-1];
  b+='<circle cx="'+(ox+p0[0]*sc)+'" cy="'+(oy+p0[1]*sc)+'" r="4" fill="'+C.r+'"/>'+T(ox+p0[0]*sc+10,oy+p0[1]*sc+4,'perno a ventaglio chiuso',null,C.r);
  b+='<circle cx="'+(ox+pe[0]*sc)+'" cy="'+(oy+pe[1]*sc)+'" r="4" fill="'+C.b+'"/>'+T(ox+pe[0]*sc+10,oy+pe[1]*sc+4,'perno a ventaglio aperto',null,C.b);
  b+=T(250,40,'Tirando il listello verso il basso di '+c.travel.toFixed(0)+' mm');
  b+=T(250,56,'il perno della guardia percorre l\'asola');
  b+=T(250,72,'e il ventaglio ruota di '+g.BETA+'°.');
  b+=T(250,96,'Nei due tratti verticali alle estremità');
  b+=T(250,112,'il perno non può muoversi: il ventaglio');
  b+=T(250,128,'è bloccato, sia chiuso sia aperto.');
  return svg(520,255,b);}

/* 5. ventaglio chiuso e aperto, visto da davanti */
function figVentaglio(){
  let b='';
  const mk=(ox,open,title)=>{
    b+=R(ox-20,20,40,150,C.g);
    if(!open){b+=R(ox-20,40,8,100,C.w2);b+=R(ox+12,40,8,100,C.w2);b+=T(ox,185,'tappo: chiude la fessura','middle');}
    else{[0,27,53,80].forEach((a,i)=>{[-1,1].forEach(sg=>{const r=a*Math.PI/180;b+=L(ox+sg*12,40,ox+sg*12+sg*Math.sin(r)*110,40+Math.cos(r)*110,i?C.w2:C.r);});});b+=T(ox,185,'ventaglio aperto (80°)','middle');}
    b+=T(ox,12,title,'middle');};
  mk(80,false,'CHIUSO');mk(290,true,'APERTO');
  return svg(440,200,b);}

/* 6. ordine di montaggio */
function figOrdine(){
  const s=['1 Piastra dietro','2 Guide + listello','3 Strato P1 + guardie','4 Strato P2 + stecche','5 Strato P3 + stecche','6 Piastra davanti'];
  let b='',y=10;s.forEach((t,i)=>{b+=R(10,y,26,18,i%5===0?C.w2:C.w)+T(46,y+13,t);y+=24;});
  b+=T(10,y+10,'Le viti M3 dei perni si inseriscono prima di chiudere con la piastra davanti.');
  return svg(480,y+22,b);}

const FIG={strati:figStrati,asta:figAsta,coda:figCoda,camma:figCamma,ventaglio:figVentaglio,ordine:figOrdine};

const PASSI=[
 {t:'Prepara i fogli',x:'Prima taglia tutto su cartone per provare. Poi taglia i fogli da 3 mm e quello da 2 mm (le stecche). Carteggia i bordi con grana 240 e dai olio o vernice sulle stecche: devono scorrere senza attrito. Tieni insieme i pezzi di ogni strato e segna con la matita il nome sul retro.',f:null},
 {t:'Capisci com\'è fatta l\'asta',x:'L\'asta è alta 165 cm e larga 40 mm. È fatta di 6 strati incollati: due piastre (dietro e davanti), lo strato del listello e tre strati che reggono le stecche. Dove stanno i ventagli quei tre strati sono vuoti ai lati: lì le stecche stanno impilate a riposo.',f:'strati'},
 {t:'Unisci i pezzi alla lunghezza che vuoi',x:'Piastre e listello sono divisi in pezzi con coda di rondine. Incastrali dall\'alto a secco e controlla che combacino. Puoi accorciare o allungare l\'asta aggiungendo o togliendo pezzi uguali nelle zone senza ventagli; i ventagli restano dove sono disegnati.',f:'coda'},
 {t:'Dove vanno i ventagli',x:'Il ventaglio alto ha il perno a 41 cm dalla cima e 3 + 3 stecche lunghe 45 cm. Quello basso ha il perno a 134 cm e 2 + 2 stecche lunghe 22 cm. Ogni ventaglio si apre di 80°.',f:'asta'},
 {t:'Monta le stecche',x:'Per ogni lato: la guardia (3 mm, la prima stecca, con lo spinotto per l\'asola) va nello strato P1, la seconda stecca nel P2 e la terza (solo ventaglio alto) nel P3. Fra una stecca e l\'altra metti uno spinotto da 2 mm nel foro e nell\'asola ad arco della stecca vicina: quando la guardia gira trascina anche le altre. Incolla il tappo sul lato esterno della guardia: a ventaglio chiuso fa sembrare l\'asta intera.',f:'ventaglio'},
 {t:'Il meccanismo nascosto',x:'Il listello scorre dentro l\'asta, nello strato del listello. Lo spinotto di ogni guardia entra nell\'asola della testa del listello. Tirando il puntale verso il basso i due spinotti seguono l\'asola e aprono entrambi i ventagli insieme; a fine corsa restano bloccati perché l\'asola diventa dritta. Riportando il puntale a filo i ventagli si chiudono e si bloccano.',f:'camma'},
 {t:'Chiudi il sandwich',x:'Incolla gli strati nell\'ordine indicato, senza colla nelle asole e nel canale del listello. Infila le viti M3 dei perni prima di chiudere la piastra davanti, con una rondella fra le stecche e una sotto il dado. Stringi il dado autobloccante senza bloccare: le stecche devono girare.',f:'ordine'},
 {t:'Placche a rombo',x:'Incolla il piano 80 × 80 sulla base 100 × 100, ruota il quadrato a rombo (l\'asta passa per due punte opposte) e incollalo sulla testa della vite, davanti e dietro. I due fori nella base lasciano posto a vite e dado. I medaglioni restano vuoti per ora.',f:null},
 {t:'Prova',x:'Tira il puntale: i ventagli si devono aprire insieme. Se uno si impunta, carteggia il bordo della stecca o allenta il dado di un quarto di giro. Incolla la tela solo quando tutto scorre bene.',f:null}
];

function testi(){return PASSI.map((p,i)=>(i+1)+'. '+p.t+': '+p.x);}
function html(){return PASSI.map((p,i)=>'<section style="margin:0 0 16px;break-inside:avoid"><h3 style="margin:0 0 6px">'+(i+1)+'. '+p.t+'</h3><p style="margin:0 0 8px;line-height:1.45">'+p.x+'</p>'+(p.f?FIG[p.f]():'')+'</section>').join('');}
function monta(el){el.innerHTML='<h3>Istruzioni illustrate</h3>'+html();}
function stampa(){const w=window.open('','_blank');if(!w){alert('Il browser ha bloccato la finestra di stampa.');return;}
  w.document.write('<!doctype html><meta charset="utf-8"><title>Bastone con ventagli</title><body style="font-family:sans-serif;max-width:700px;margin:20px auto;color:#3a2f25"><h2>Bastone con ventagli - istruzioni</h2>'+html()+'<script>setTimeout(function(){print()},400)<\/script>');w.document.close();}
window.BastoneGuida={testi:testi,monta:monta,stampa:stampa,html:html};
})();
