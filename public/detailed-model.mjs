// SPDX-License-Identifier: MPL-2.0
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

const LIGHT_KEYS=['demo-living-light','demo-bedroom-light','demo-kitchen-light'];
export function modelLightLevels(devices) {
  return LIGHT_KEYS.map(key=>{
    const device=devices.find(d=>d.device_key===key);
    if(!device?.online||!['on','off'].includes(device.state))return .45;
    return device.state==='on'?1:0;
  });
}

// A fully fictional, locally authored asset. Embedded textures only; no network service.
export async function loadDetailedModel(renderer) {
  const gltf=await new GLTFLoader().loadAsync('./assets/community-detail-v6.glb');
  const levels={value:modelLightLevels([])};const meshes=[];
  gltf.scene.traverse(object=>{
    if(!object.isMesh)return;
    const source=object.material;
    const map=source.emissiveMap||source.map;
    if(!map)throw new Error('Model texture missing');
    map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    // The float bake has already passed through AgX before PNG export.
    // A second tone-map would flatten its restored highlights again.
    const material=new THREE.MeshBasicMaterial({map,toneMapped:false});
    material.onBeforeCompile=shader=>{
      shader.uniforms.ceLightLevels=levels;
      shader.vertexShader='varying vec3 vCEPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCEPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader='varying vec3 vCEPosition;\nuniform float ceLightLevels[3];\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float rightRoom=smoothstep(0.98,1.12,vCEPosition.x);
        float kitchen=1.0-smoothstep(-1.26,-1.04,vCEPosition.z);
        float entry=smoothstep(0.59,0.71,vCEPosition.z);
        float leftLight=mix(ceLightLevels[0],ceLightLevels[2],kitchen);
        float rightLight=mix(ceLightLevels[1],0.45,entry);
        float level=mix(leftLight,rightLight,rightRoom);
        // A low ambient floor keeps furniture readable when a light is off.
        // Limit the lit gain: the texture already contains baked illumination.
        vec2 livingDelta=(vCEPosition.xz-vec2(-1.8,0.4))/vec2(2.0,1.6);
        vec2 kitchenDelta=(vCEPosition.xz-vec2(-2.5,-2.3))/vec2(1.5,1.0);
        vec2 bedroomDelta=(vCEPosition.xz-vec2(1.44,-2.3))/vec2(1.7,1.5);
        float pool=mix(
          mix(exp(-dot(livingDelta,livingDelta))*ceLightLevels[0],exp(-dot(kitchenDelta,kitchenDelta))*ceLightLevels[2],kitchen),
          exp(-dot(bedroomDelta,bedroomDelta))*ceLightLevels[1]*(1.0-entry),rightRoom);
        vec3 tint=mix(vec3(0.84,0.90,1.0),vec3(1.0,0.98,0.94),level);
        float gain=0.06+0.31*level+0.055*pool;
        // The outside foundation is decorative and does not belong to a room.
        if(vCEPosition.y<0.04){gain=0.40;tint=vec3(1.0);}
        diffuseColor.rgb*=gain*tint;
      `);
    };
    material.customProgramCacheKey=()=> 'ce-fictional-agx-texture-v3';
    object.material=material;object.castShadow=false;object.receiveShadow=false;
    source.dispose();meshes.push(object);
  });
  if(!meshes.length)throw new Error('Model geometry missing');
  return {
    object:gltf.scene,
    update(devices) {
      const next=modelLightLevels(devices);
      if(next.some((value,index)=>value!==levels.value[index])){
        levels.value=next;
        // Refresh custom uniforms even when this is the scene's only material.
        for(const mesh of meshes)mesh.material.needsUpdate=true;
      }
    },
  };
}
