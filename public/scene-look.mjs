// SPDX-License-Identifier: MPL-2.0
import * as THREE from './vendor/three.module.js';

// Style only: original procedural textures, no floorplan, UV atlas or external assets.
export function createWarmLook(renderer) {
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.04;
  const textures = new Map();
  const random = (()=>{let seed=68321;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};})();
  function texture(kind) {
    if(textures.has(kind))return textures.get(kind);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=kind==='planks'?1024:512;
    const ctx=canvas.getContext('2d');const size=canvas.width;
    ctx.fillStyle=kind==='planks'||kind==='wood'?'#c8a477':kind==='tile'?'#d1c4ad':'#c5c1b4';ctx.fillRect(0,0,size,size);
    if(kind==='wood'||kind==='planks') {
      const rows=kind==='planks'?16:1;const rowHeight=size/rows;
      for(let row=0;row<rows;row++) {
        const light=61+random()*10;ctx.fillStyle=`hsl(33 33% ${light}%)`;ctx.fillRect(0,row*rowHeight,size,rowHeight);
        for(let line=0;line<(kind==='planks'?65:560);line++) {
          const y=row*rowHeight+random()*rowHeight;const phase=random()*7;const amplitude=random()*(kind==='planks'?2:7);
          ctx.strokeStyle=`rgba(67,40,17,${.04+random()*.08})`;ctx.lineWidth=.4+random()*.9;ctx.beginPath();
          for(let x=0;x<=size;x+=12){const yy=y+Math.sin(x/95+phase)*amplitude+Math.sin(x/29+phase)*amplitude*.15;if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();
        }
        if(kind==='planks') {
          ctx.fillStyle='rgba(62,37,18,.24)';ctx.fillRect(0,row*rowHeight,size,1.5);
          const seam=(row%3)*size/3;
          for(let x=seam;x<size;x+=size/2){ctx.fillRect(x,row*rowHeight,1.5,rowHeight);ctx.fillStyle='rgba(255,238,199,.13)';ctx.fillRect(x+2,row*rowHeight,1,rowHeight);ctx.fillStyle='rgba(62,37,18,.24)';}
        }
      }
    } else if(kind==='tile') {
      for(let i=0;i<=4;i++){ctx.fillStyle='rgba(75,61,42,.2)';ctx.fillRect(i*size/4,0,2,size);ctx.fillRect(0,i*size/4,size,2);ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(i*size/4+2,0,1,size);ctx.fillRect(0,i*size/4+2,size,1);}
    } else {
      const image=ctx.getImageData(0,0,size,size);
      for(let i=0;i<image.data.length;i+=4){const n=(random()-.5)*(kind==='fabric'?20:12);image.data[i]+=n;image.data[i+1]+=n;image.data[i+2]+=n;}ctx.putImageData(image,0,0);
      if(kind==='fabric')for(let i=0;i<size;i+=3){ctx.strokeStyle=i%2?'rgba(255,255,255,.09)':'rgba(36,30,20,.08)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,size);ctx.moveTo(0,i);ctx.lineTo(size,i);ctx.stroke();}
    }
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    textures.set(kind,map);return map;
  }
  function surface(color,{kind,roughness=.85,metalness=0,bumpScale=.015}={}) {
    const material=new THREE.MeshStandardMaterial({color,roughness,metalness});
    if(kind){material.map=texture(kind);material.bumpMap=material.map;material.bumpScale=bumpScale;}
    return material;
  }
  const materials={
    wall:surface('#f1e6d2',{kind:'plaster',roughness:.96,bumpScale:.024}),
    floor:surface('#d5ac7b',{kind:'planks',roughness:.78,bumpScale:.014}),
    edge:surface('#3c3b33',{roughness:.93}),
    stone:surface('#e9dfcb',{roughness:.64}),
    dark:surface('#292820',{roughness:.76}),
    linen:surface('#f3e7d0',{kind:'fabric',roughness:.97,bumpScale:.018}),
    fabric:surface('#96996c',{kind:'fabric',roughness:.99,bumpScale:.024}),
    wood:surface('#c99962',{kind:'wood',roughness:.74,bumpScale:.012}),
    gold:surface('#ad8c55',{roughness:.44,metalness:.42}),
    tile:surface('#e6dcc8',{kind:'tile',roughness:.8,bumpScale:.01}),
    rug:surface('#d5c8ac',{kind:'fabric',roughness:1,bumpScale:.015}),
    screen:surface('#282c28',{roughness:.34}),
    glass:surface('#a5a78d',{roughness:.3,metalness:.12}),
  };
  const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;
  const contactCtx=contactCanvas.getContext('2d');const contactImage=contactCtx.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++) {
    const dx=Math.max(0,Math.abs((x-63.5)/63.5)-.6)/.4,dy=Math.max(0,Math.abs((y-63.5)/63.5)-.6)/.4;
    const a=Math.max(0,1-Math.hypot(dx,dy));const index=(y*128+x)*4;
    contactImage.data[index]=42;contactImage.data[index+1]=29;contactImage.data[index+2]=16;contactImage.data[index+3]=Math.round(a*a*72);
  }
  contactCtx.putImageData(contactImage,0,0);const contactMap=new THREE.CanvasTexture(contactCanvas);
  const contactMaterial=new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,toneMapped:false});
  function contactShadow(scene,width,depth,x,z) {
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(width+.28,depth+.28),contactMaterial);
    shadow.rotation.x=-Math.PI/2;shadow.position.set(x,.104,z);shadow.renderOrder=1;scene.add(shadow);
  }
  return {materials,surface,contactShadow};
}

// A small edge bevel gives furniture a soft highlight while preserving its
// existing bounding box. Wall and floor geometry never pass through this helper.
export function furnitureBox(width,height,depth) {
  const radius=Math.min(.024,width*.06,height*.06,depth*.06);
  const x=width/2-radius,y=height/2-radius;
  const shape=new THREE.Shape();shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:depth-2*radius,steps:1,bevelEnabled:true,bevelThickness:radius,bevelSize:radius,bevelSegments:2,curveSegments:1});
  geometry.translate(0,0,-depth/2+radius);return geometry;
}

export function addWarmLighting(scene) {
  scene.add(new THREE.HemisphereLight('#fff0d7','#59432b',1.12));
  const key=new THREE.DirectionalLight('#ffe1b5',3.1);key.position.set(-3,10,7);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-9;key.shadow.camera.right=9;key.shadow.camera.top=9;key.shadow.camera.bottom=-9;
  key.shadow.normalBias=.022;key.shadow.bias=-.00015;key.shadow.radius=3;
  scene.add(key);
  const fill=new THREE.DirectionalLight('#e4e7dc',.65);fill.position.set(7,5,-4);scene.add(fill);
}
