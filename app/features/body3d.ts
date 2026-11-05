// ŻELAZO — Postęp → „Sylwetka 3D”: model MakeHuman (CC0) dopasowany do obwodów i wzrostu, porównanie ze startem.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
// three.js i plik modelu ładują się dopiero po „Pokaż sylwetkę” (osobny kawałek pakietu, ok. 0,5 MB modelu).
import { APP_VER } from '../core/shell';
import { S } from '../core/state';
import { applyBody, bodyTimeline, fitBody, parseBody, type BodyModel } from '../lib/body';

export let B3;

const LABEL = {waist:'Pas', chest:'Klatka', arm:'Ramię', thigh:'Udo', hips:'Biodra'};
const DOWN = {waist:1, hips:1}, NEUTRAL = {chest:1, arm:1, thigh:1};   // spadek pasa i bioder = dobrze; reszta bez oceny (zależy od celu)

function modelUrl(sex){ return new URL((APP_VER==='stable'?'':'../')+'models/body-'+sex+'.zbm', location.href).href; }

async function loadModel(sex): Promise<BodyModel>{
  if(B3.models[sex]) return B3.models[sex];
  if(typeof DecompressionStream==='undefined') throw new Error('Ta przeglądarka nie potrafi rozpakować modelu — zaktualizuj ją.');
  const r=await fetch(modelUrl(sex)); if(!r.ok || !r.body) throw new Error('Nie udało się pobrać modelu sylwetki ('+r.status+').');
  const buf=await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return B3.models[sex]=parseBody(buf);
}

// dane do pokazania: oś czasu pomiarów (brakujące = poprzednia wartość) i płeć z profilu
function bodyData(){
  const p=S.profile||{};
  return {sex:p.sex==='f'?'female':'male', tl:bodyTimeline(S.measures||[], +p.height||undefined), height:+p.height||0};
}

export async function bodyOpen(){
  const box=document.getElementById('b3Stage'); if(!box || B3.on) return;
  B3.on=true; try{ localStorage.setItem('zelazo_body3d','1'); }catch(e){}
  document.getElementById('b3Intro').style.display='none';
  document.getElementById('b3View').style.display='';
  const msg=document.getElementById('b3Msg'); msg.textContent='Ładowanie modelu…'; msg.style.display='';
  try{
    const [THREE, model]=await Promise.all([import('three'), loadModel(bodyData().sex)]);
    B3.THREE=THREE; B3.model=model;
    bodySetup(); msg.style.display='none'; bodyRefresh();
  }catch(e){ msg.textContent='⚠️ '+(e && e.message || e); B3.on=false; }
}

function bodySetup(){
  const THREE=B3.THREE, box=document.getElementById('b3Stage');
  const r=new THREE.WebGLRenderer({antialias:true, alpha:true});
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.outputColorSpace=THREE.SRGBColorSpace;
  box.prepend(r.domElement);
  const scene=new THREE.Scene(), cam=new THREE.PerspectiveCamera(28, 1, 0.1, 1000);
  scene.add(new THREE.AmbientLight(0x404050, 0.9));
  const key=new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(3,8,6); scene.add(key);
  const fill=new THREE.DirectionalLight(0x6688cc, 0.45); fill.position.set(-3,4,-2); scene.add(fill);
  const rim=new THREE.DirectionalLight(0xff7a1a, 0.35); rim.position.set(0,3,-6); scene.add(rim);
  Object.assign(B3, {r, scene, cam});
  bodyMeshes();
  new ResizeObserver(()=>{ const w=box.clientWidth, h=box.clientHeight; r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); bodyDraw(); }).observe(box);
  // obrót przeciągnięciem w poziomie (przewijanie strony w pionie działa dalej: touch-action pan-y)
  let drag=null;
  r.domElement.addEventListener('pointerdown', e=>{ drag=e.clientX; B3.auto=false; bodyRotUi(); r.domElement.setPointerCapture(e.pointerId); });
  r.domElement.addEventListener('pointermove', e=>{ if(drag==null) return; B3.angle+=(e.clientX-drag)*0.01; drag=e.clientX; bodyDraw(); });
  const up=()=>{ drag=null; }; r.domElement.addEventListener('pointerup', up); r.domElement.addEventListener('pointercancel', up);
}

// siatka sylwetki i „duch” startu (przezroczysta siatka) — dla płci z profilu
function bodyMeshes(){
  const THREE=B3.THREE, m=B3.model;
  if(B3.mesh){ B3.scene.remove(B3.mesh); B3.scene.remove(B3.ghost); B3.mesh.geometry.dispose(); B3.ghost.geometry.dispose(); }
  const G=m.header.groups;
  const geo=()=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m.positions.length),3)); g.setIndex(new THREE.BufferAttribute(m.indices,1)); return g; };
  // skóra (szara) z kolorem sportowego topu z pliku modelu; spodenki (ciemne) jako druga grupa trójkątów
  const g=geo(), skin=new THREE.Color(0x9aa0a8), top=new THREE.Color(0x2c333a), col=new Float32Array(m.header.nv*3);
  for(let i=0;i<m.header.nv;i++) (m.top[i]?top:skin).toArray(col, i*3);
  g.setAttribute('color', new THREE.BufferAttribute(col,3));
  g.addGroup(G.skin[0]*3, G.skin[1]*3, 0); g.addGroup(G.cloth[0]*3, G.cloth[1]*3, 1);
  B3.mesh=new THREE.Mesh(g, [new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.55, metalness:0.1}),
    new THREE.MeshStandardMaterial({color:0x23292f, roughness:0.8, metalness:0, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2})]);
  B3.ghost=new THREE.Mesh(geo(), new THREE.MeshBasicMaterial({color:0x5fa8d3, wireframe:true, transparent:true, opacity:0.22, depthWrite:false}));
  B3.scene.add(B3.mesh); B3.scene.add(B3.ghost);
  B3.sex=m.header.sex;
}

function shape(mesh, measures){
  const a=mesh.geometry.attributes.position;
  applyBody(B3.model, fitBody(B3.model.header, measures), a.array);
  a.needsUpdate=true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox();
}

/** Po zmianie obwodów, wzrostu albo płci (wywołuje też renderMeasures). */
export async function bodyRefresh(){
  if(!B3 || !B3.on || !B3.model) return;
  const D=bodyData();
  if(D.sex!==B3.sex){ B3.model=await loadModel(D.sex); bodyMeshes(); }
  const tl=D.tl, n=tl.length, sl=document.getElementById('b3Tl') as HTMLInputElement;
  document.getElementById('b3Empty').style.display=n?'none':'';
  document.getElementById('b3Ctl').style.display=n?'':'none';
  if(B3.idx==null || B3.idx>=n) B3.idx=n-1;
  sl.max=String(Math.max(0,n-1)); sl.value=String(Math.max(0,B3.idx)); sl.parentElement.style.display=n>1?'':'none';
  document.querySelectorAll('#b3Mode button').forEach(b=>{ (b as HTMLElement).style.display=(n>1||b.getAttribute('data-m')==='now')?'':'none'; });
  if(n<2) B3.mode='now';
  const cur=n?tl[B3.idx]:{d:'', m:D.height?{height:D.height}:{}}, st=n?tl[0]:cur;
  shape(B3.mesh, B3.mode==='start'?st.m:cur.m);
  B3.ghost.visible=B3.mode==='cmp' && n>1 && B3.idx>0;
  if(B3.ghost.visible) shape(B3.ghost, st.m);
  const fmt=d=>d?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4):'—', n1=v=>(Math.round(v*10)/10).toString().replace('.',',');
  document.getElementById('b3Date').textContent=fmt((B3.mode==='start'?st:cur).d);
  document.getElementById('b3Leg').innerHTML=B3.ghost.visible?`<span><i style="background:#c9cdd2"></i>${fmt(cur.d).slice(0,5)}</span><span><i style="background:var(--steel)"></i>start ${fmt(st.d).slice(0,5)}</span>`:'';
  document.querySelectorAll('#b3Mode button').forEach(b=>b.classList.toggle('on', b.getAttribute('data-m')===B3.mode));
  document.getElementById('b3Chg').innerHTML=n?Object.keys(LABEL).filter(k=>cur.m[k]).map(k=>{
    const dv=(cur.m[k]||0)-(st.m[k]||0), cls=!dv||NEUTRAL[k]?'same':((DOWN[k]?dv<0:dv>0)?'good':'bad');
    return `<div><span>${LABEL[k]}</span><b>${n1(cur.m[k])}${B3.idx>0?` <small class="${cls}">${dv>0?'+':''}${dv?n1(dv):'±0'}</small>`:''}</b></div>`; }).join(''):'';
  bodyDraw();
}

export function bodyDraw(){
  if(!B3 || !B3.r) return;
  if(B3.raf) return;
  B3.raf=requestAnimationFrame(()=>{
    B3.raf=0;
    const bb=B3.mesh.geometry.boundingBox, H=bb.max.y-bb.min.y, cy=(bb.max.y+bb.min.y)/2, dist=H*2.35;
    if(B3.auto){ B3.angle+=0.01; bodyDraw(); }
    B3.cam.position.set(Math.sin(B3.angle)*dist, cy, Math.cos(B3.angle)*dist); B3.cam.lookAt(0, cy, 0);
    B3.r.render(B3.scene, B3.cam);
  });
}

function bodyRotUi(){ document.getElementById('b3Rot').textContent=B3.auto?'⏸ Stop':'▶ Obracaj'; }

export function __init_30(){
B3 = {on:false, models:{}, mode:'now', idx:null, angle:0, auto:false, raf:0};
document.getElementById('b3Open').onclick=()=>bodyOpen();
document.querySelectorAll('#b3Mode button').forEach(b=>(b as HTMLElement).onclick=()=>{ B3.mode=b.getAttribute('data-m'); bodyRefresh(); });
document.getElementById('b3Tl').oninput=e=>{ B3.idx=+(e.target as HTMLInputElement).value; bodyRefresh(); };
document.getElementById('b3Rot').onclick=()=>{ B3.auto=!B3.auto; bodyRotUi(); bodyDraw(); };
document.getElementById('b3Front').onclick=()=>{ B3.angle=0; B3.auto=false; bodyRotUi(); bodyDraw(); };
document.getElementById('b3Side').onclick=()=>{ B3.angle=Math.PI/2; B3.auto=false; bodyRotUi(); bodyDraw(); };
// raz otwarta na tym urządzeniu — przy następnych wejściach w Postęp ładuje się sama
try{ if(localStorage.getItem('zelazo_body3d')==='1') document.querySelector('.nav button[data-v="progress"]').addEventListener('click', ()=>bodyOpen(), {once:true}); }catch(e){}
}
