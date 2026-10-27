// SPDX-License-Identifier: MPL-2.0
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createViewMotion, HOME_AUTO_ROTATE_SPEED } from './view-motion.mjs';
import { createWarmLook, addWarmLighting, furnitureBox } from './scene-look.mjs';
import { loadDetailedModel } from './detailed-model.mjs';

// An original, fictional apartment. No measurements or assets from a real home.
export function createSpace(container, { onSelect = () => {}, onBrowse = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const {materials,surface:mat,contactShadow}=createWarmLook(renderer);
  container.prepend(renderer.domElement); renderer.domElement.setAttribute('aria-label','虚构公寓的可旋转三维模型'); renderer.domElement.setAttribute('role','img');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8,8,5.8,-5.8,.1,100); camera.position.set(10,12,13);
  const controls = new OrbitControls(camera,container); controls.target.set(0,.1,0); controls.enablePan=false; controls.enableZoom=true;controls.minZoom=.7;controls.maxZoom=2.5;controls.zoomSpeed=.65;controls.autoRotateSpeed=HOME_AUTO_ROTATE_SPEED;controls.touches.ONE=null;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE; controls.minPolarAngle=.35; controls.maxPolarAngle=1.15; controls.enableDamping=false; controls.update(); controls.saveState();
  addWarmLighting(scene);
  const {wall,floor,edge,stone,dark,linen,fabric,wood,gold,tile,rug,screen,glass}=materials;
  const softSurfaces=new Set([linen,fabric,wood,stone]);
  function box(w,h,d,x,y,z,m){const geometry=softSurfaces.has(m)&&Math.min(w,h,d)>.12?furnitureBox(w,h,d):new THREE.BoxGeometry(w,h,d);const o=new THREE.Mesh(geometry,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);if(softSurfaces.has(m)&&h>.25&&y-h/2>=.04&&y-h/2<.28)contactShadow(scene,w,d,x,z);return o;}
  function cylinder(r,h,x,y,z,m){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,40),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
  box(8.6,.3,6.6,0,-.25,0,edge);box(8.3,.16,6.3,0,-.03,0,floor);
  // Only rear walls are tall, so the interior remains legible on a phone.
  box(8.4,1.65,.15,0,.8,-3.13,wall);box(.15,1.65,6.3,-4.13,.8,0,wall);box(.15,.3,6.3,4.13,.12,0,wall);box(8.4,.3,.15,0,.12,3.13,wall);
  box(.12,1.2,3.6,1.05,.57,-1.3,wall);box(3,.85,.12,2.6,.4,.65,wall);box(.12,.8,1.4,1.05,.37,2.45,wall);
  // Bedroom, living room, kitchen and a small entry hall.
  box(2.9,.03,3.55,2.59,.07,-1.25,floor);box(3,.03,2.2,2.6,.07,1.9,tile);
  // Plank joints are procedural texture detail, rather than intersecting strips.
  box(3.1,.035,2.6,-1.8,.08,.65,rug);
  box(2.8,.4,.85,-1.8,.35,-.55,linen);box(2.8,.6,.2,-1.8,.6,-.94,fabric);box(.24,.53,.95,-3.12,.46,-.48,linen);box(.24,.53,.95,-.47,.46,-.48,linen);
  for(const x of [-2.6,-1.8,-1]){box(.72,.15,.65,x,.62,-.48,linen);const cushion=box(.55,.44,.16,x,.86,-.75,linen);cushion.rotation.x=-.12;}
  cylinder(.61,.12,-1.9,.44,.95,dark);cylinder(.12,.34,-1.9,.25,.95,dark);cylinder(.17,.08,-1.99,.54,.88,stone);box(.3,.04,.38,-1.65,.53,1.08,fabric);
  box(.34,.4,1.9,-3.7,.3,1.25,wood);box(.09,.82,1.35,-3.75,.97,1.25,dark);box(.1,.66,1.17,-3.69,1.01,1.25,screen);
  box(1.85,.3,2.4,2.65,.25,-1.5,wood);box(1.82,.23,2.35,2.65,.49,-1.5,linen);box(1.78,.12,1.45,2.65,.66,-1.1,fabric);box(1.95,.8,.14,2.65,.58,-2.73,wood);
  for(const x of [2.18,3.1])box(.7,.17,.46,x,.68,-2.26,stone);
  box(.54,.48,.55,1.44,.32,-2.3,wood);cylinder(.14,.05,1.44,.59,-2.3,gold);cylinder(.1,.25,1.44,.74,-2.3,linen);
  box(2.5,.85,.65,-2.5,.48,-2.65,wood);box(2.56,.08,.71,-2.5,.94,-2.65,stone);box(.65,.85,1.25,-3.43,.48,-1.74,wood);box(.72,.08,1.25,-3.43,.94,-1.74,stone);
  box(.6,.04,.43,-2.6,1,-2.65,dark);cylinder(.13,.02,-1.65,1,-2.66,dark);cylinder(.1,.02,-1.99,1,-2.66,dark);
  box(.8,1.45,.67,-.78,.8,-2.66,stone);box(.02,.37,.03,-.45,1,-2.3,dark);
  box(.7,.7,1.5,3.7,.43,1.85,wood);box(.72,.1,1.55,3.7,.83,1.85,stone);box(1.6,.03,1.1,2.2,.1,1.9,linen);
  // Windows and greenery are geometry, with no external textures.
  box(1.7,1,.05,-2,.91,-3.03,glass);box(.045,1,.06,-2,.91,-2.99,stone);box(1.7,.05,.06,-2,.91,-2.99,stone);
  box(.05,.9,1.3,-4.03,.95,.3,glass);
  function plant(x,z){cylinder(.18,.36,x,.27,z,stone);for(let i=0;i<6;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),mat(i%2?0x6f8469:0x4b6951));leaf.scale.set(.6,1.8,.6);leaf.position.set(x+Math.sin(i)*.15,.65+i*.055,z+Math.cos(i)*.15);leaf.rotation.z=Math.sin(i)*.5;scene.add(leaf);}}
  plant(-3.5,2.7);plant(3.7,-2.7);plant(.5,-2.7);
  const lightMaterials={};
  for(const [key,x,z] of [['demo-living-light',-1.8,.4],['demo-bedroom-light',2.6,-1.4],['demo-kitchen-light',-2.5,-2.3]]){
    const material=new THREE.MeshStandardMaterial({color:0xf7d99b,emissive:0xffcc75,emissiveIntensity:.6,transparent:true,opacity:.24,depthWrite:false});
    const pool=new THREE.Mesh(new THREE.CircleGeometry(key.includes('kitchen')?.7:1.25,48),material);pool.rotation.x=-Math.PI/2;pool.position.set(x,.105,z);scene.add(pool);lightMaterials[key]=material;
    const point=new THREE.PointLight(0xffd08b,2.5,4,2);point.position.set(x,1.4,z);scene.add(point);lightMaterials[key].userData.light=point;
  }
  // Generic AC bodies, bound only to fictional demo keys.
  box(.16,.35,.86,-3.99,1.3,1.7,stone);box(.02,.06,.72,-3.89,1.21,1.7,dark);
  box(.88,.35,.16,2.6,1.3,-3.01,stone);box(.72,.06,.02,2.6,1.21,-2.91,dark);
  const hotspotRoot=document.getElementById('device-hotspots');
  const hotspots=[['demo-living-light',-1.8,.8,.4],['demo-bedroom-light',1.44,.95,-2.3],['demo-kitchen-light',-2.5,1.12,-2.3],['demo-entry-light',3.7,1,1.85],['demo-living-climate',-3.85,1.4,1.7],['demo-bedroom-climate',2.6,1.4,-2.85]].map(([key,x,y,z])=>{
    const element=document.createElement('button');element.type='button';element.className='spatial-target';element.dataset.deviceKey=key;element.hidden=true;hotspotRoot.append(element);
    element.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();return;}onSelect(key);});
    return {key,element,point:new THREE.Vector3(x,y,z),available:false};
  });
  const raycaster=new THREE.Raycaster();const solids=scene.children.filter(o=>o.isMesh&&o.material.opacity===1);
  // Keep simple geometry for hotspot occlusion instead of raycasting detailed
  // upholstery every frame. Both models use the same fictional room boundaries.
  const baseObjects=[...scene.children];let detailed=null,lastDevices=[];
  let lastBrowsing=false,suppressClickUntil=0,lastTap=null,lastFrame=performance.now(),enabled=true,needsRender=true;
  controls.addEventListener('change',()=>{needsRender=true;});
  const pointers=new Map();const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const motion=createViewMotion({onReset:()=>{controls.reset();camera.zoom=1;camera.updateProjectionMatrix();onBrowse(false);}});
  motion.configure({visible:!document.hidden,reduced:reduced.matches});
  function render(){
    renderer.render(scene,camera);needsRender=false;const rect=container.getBoundingClientRect();
    for(const {element,point,available} of hotspots){
      const p=point.clone().project(camera);raycaster.setFromCamera(new THREE.Vector2(p.x,p.y),camera);const distance=point.distanceTo(raycaster.ray.origin);const hit=raycaster.intersectObjects(solids,false)[0];
      element.hidden=!available||p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1||Boolean(hit&&hit.distance<distance-.22);
      element.style.left=`${(p.x+1)/2*rect.width}px`;element.style.top=`${(1-p.y)/2*rect.height}px`;
    }
  }
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h,extent=Math.max(5.8,6.2/aspect);camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;camera.updateProjectionMatrix();render();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function browse(){motion.browse();onBrowse(true);}
  controls.addEventListener('start',()=>{motion.pointer(true);if(pointers.size>1)browse();});
  controls.addEventListener('end',()=>{motion.pointer(pointers.size>0);motion.activity();});
  container.addEventListener('wheel',()=>browse(),{passive:true});
  container.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,moved:false,type:e.pointerType,key:e.target.closest('[data-device-key]')?.dataset.deviceKey});motion.pointer(true);if(pointers.size>1){lastTap=null;for(const p of pointers.values())p.moved=true;}},true);
  container.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>8){p.moved=true;motion.activity();if(p.type!=='touch'||pointers.size>1||motion.tick().browsing)browse();}},true);
  function endPointer(e,cancel=false){const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);motion.pointer(pointers.size>0);if(!p)return;if(p.moved||cancel){suppressClickUntil=performance.now()+450;lastTap=null;return;}if(p.key&&pointers.size===0){if(performance.now()>=suppressClickUntil){onSelect(p.key);suppressClickUntil=performance.now()+450;}lastTap=null;return;}if(p.type==='touch'&&!e.target.closest('button')&&pointers.size===0){const t=performance.now();if(lastTap&&t-lastTap.t<320&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<28){motion.reset();lastTap=null;suppressClickUntil=t+400;}else lastTap={t,x:e.clientX,y:e.clientY};}}
  window.addEventListener('pointerup',e=>endPointer(e));window.addEventListener('pointercancel',e=>endPointer(e,true));
  container.addEventListener('dblclick',e=>{if(e.target.closest('button'))return;e.preventDefault();motion.reset();});
  document.addEventListener('visibilitychange',()=>motion.configure({visible:!document.hidden}));
  reduced.addEventListener('change',()=>motion.configure({reduced:reduced.matches}));
  function frame(time){
    const state=motion.tick();controls.autoRotate=state.rotating&&enabled;controls.autoRotateSpeed=HOME_AUTO_ROTATE_SPEED*state.speed;controls.enabled=enabled&&state.active;controls.touches.ONE=state.browsing?THREE.TOUCH.ROTATE:null;
    if(state.browsing!==lastBrowsing){onBrowse(state.browsing);lastBrowsing=state.browsing;}
    container.dataset.viewMode=state.browsing?'browse':'default';container.dataset.autoOrbit=controls.autoRotate?'running':state.waiting&&enabled?'waiting':'paused';
    if(state.active){controls.update(Math.min(.05,(time-lastFrame)/1000));if(needsRender)render();}
    lastFrame=time;requestAnimationFrame(frame);
  }
  document.getElementById('scene-fallback').hidden=true;requestAnimationFrame(frame);
  container.dataset.model='basic-loading';
  loadDetailedModel(renderer).then(model=>{
    detailed=model;model.update(lastDevices);
    const materialsToDispose=new Set(),texturesToDispose=new Set();
    for(const object of baseObjects){
      scene.remove(object);
      if(object.isMesh){object.geometry.dispose();materialsToDispose.add(object.material);}
      if(object.isLight&&object.shadow)object.shadow.dispose();
    }
    for(const material of materialsToDispose){for(const key of ['map','bumpMap'])if(material[key])texturesToDispose.add(material[key]);material.dispose();}
    for(const texture of texturesToDispose)texture.dispose();
    scene.add(model.object);container.dataset.model='detailed-baked';needsRender=true;
    if(motion.tick().active)render();
  }).catch(()=>{container.dataset.model='basic-fallback';});
  return {
    update(devices){lastDevices=devices;if(detailed)detailed.update(devices);else for(const [key,material] of Object.entries(lightMaterials)){const on=devices.some(d=>d.device_key===key&&d.online&&d.state==='on');material.opacity=on?.26:.025;material.emissiveIntensity=on?.6:0;material.userData.light.intensity=on?2.5:0;}for(const h of hotspots){const d=devices.find(d=>d.device_key===h.key);h.available=Boolean(d);if(d)h.element.setAttribute('aria-label',`${d.name}，查看详情`);}render();},
    configure(options){motion.configure(options);},
    setEnabled(value){enabled=value;},
    get browsing(){return motion.tick().browsing;},
    reset(){motion.reset();},
  };
}
