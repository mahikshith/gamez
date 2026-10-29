import * as P from 'planck';
const {World, Vec2, Polygon} = P;
const world = new World({gravity: Vec2(0,-10)});
function ring(r, th, gapA, gapW, segs=72){
  const b = world.createBody({type:'kinematic'});
  for(let i=0;i<segs;i++){
    const a0=i/segs*2*Math.PI, a1=(i+1)/segs*2*Math.PI, am=(a0+a1)/2;
    let d=Math.atan2(Math.sin(am-gapA),Math.cos(am-gapA));
    if(Math.abs(d)<gapW/2) continue;
    const ri=r-th/2, ro=r+th/2;
    b.createFixture({shape:new Polygon([Vec2(ri*Math.cos(a0),ri*Math.sin(a0)),Vec2(ro*Math.cos(a0),ro*Math.sin(a0)),Vec2(ro*Math.cos(a1),ro*Math.sin(a1)),Vec2(ri*Math.cos(a1),ri*Math.sin(a1))]),friction:0.7,restitution:0.1});
  }
  return b;
}
function eggVerts(h, w, n=12){
  const v=[]; for(let i=0;i<n;i++){const t=i/n*2*Math.PI; const y=Math.sin(t)*h/2; const k=1-0.18*Math.sin(t); v.push(Vec2(Math.cos(t)*w/2*k*(1+0.0), y));} return v;
}
const r0=ring(1.0,0.12,-Math.PI/2+1.2,0.9), r1=ring(2.0,0.12,-Math.PI/2+2.0,0.9);
const eggs=[];
for(let i=0;i<3;i++){const e=world.createDynamicBody({position:Vec2(-0.3+i*0.3,-0.4),bullet:true,angularDamping:0.4});
 e.createFixture({shape:new Polygon(eggVerts(0.5,0.38)),density:1,friction:0.6,restitution:0.15}); e.maxImp=0; eggs.push(e);}
world.on('post-solve',(c,imp)=>{for(const e of eggs){ if(c.getFixtureA().getBody()===e||c.getFixtureB().getBody()===e){ const m=Math.max(...imp.normalImpulses)/e.getMass(); if(m>e.maxImp)e.maxImp=m; } }});
const log=(t)=>console.log(t.toFixed(2), eggs.map(e=>{const p=e.getPosition();return `(${p.x.toFixed(2)},${p.y.toFixed(2)}) r=${Math.hypot(p.x,p.y).toFixed(2)} dv=${e.maxImp.toFixed(2)}`}).join(' | '));
let t=0;
for(let s=0;s<60*8;s++){
  // phase: settle 1s, rotate ring0 so gap goes to bottom (gap at -90+69deg -> rotate -1.2 rad), then ring1
  const w0 = (t>1 && t<2.2)? -1.0 : 0; r0.setAngularVelocity(w0);
  const w1 = (t>4 && t<6)? -1.0 : 0; r1.setAngularVelocity(w1);
  for(const e of eggs) e.maxImp=0;
  world.step(1/60,8,3); t+=1/60;
  if(s%30==0) log(t);
}
