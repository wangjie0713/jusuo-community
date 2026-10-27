// SPDX-License-Identifier: MPL-2.0
// Publication checks for the locally generated fictional model, not a general glTF loader.
export function inspectModel(bytes) {
  const fail=message=>{throw new Error(message);};
  if(bytes.length<28||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)fail('Invalid GLB header');
  if(bytes.length>16*1024*1024)fail('Model exceeds the preview size budget');
  const jsonSize=bytes.readUInt32LE(12);
  if(bytes.readUInt32LE(16)!==0x4e4f534a||20+jsonSize+8>bytes.length)fail('Invalid JSON chunk');
  const json=JSON.parse(bytes.subarray(20,20+jsonSize).toString('utf8'));
  const binHeader=20+jsonSize,binStart=binHeader+8;
  if(bytes.readUInt32LE(binHeader+4)!==0x004e4942||binStart+bytes.readUInt32LE(binHeader)!==bytes.length)fail('Invalid binary chunk');
  if((json.buffers||[]).length!==1||json.buffers.some(x=>x.uri))fail('External buffers are not allowed');
  if(!json.images?.length||json.images.some(x=>x.uri||!Number.isInteger(x.bufferView)||x.mimeType!=='image/png'))fail('Only embedded PNG textures are allowed');
  if(json.cameras?.length||json.animations?.length||json.skins?.length)fail('Unexpected cameras or animation data');
  function noExtras(value){if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){if(key==='extras')fail('Custom metadata is not allowed');noExtras(child);}}
  noExtras(json);
  for(const view of json.bufferViews||[])if((view.byteOffset||0)+view.byteLength>bytes.readUInt32LE(binHeader)||view.buffer!==0)fail('Invalid embedded resource bounds');
  let triangles=0;
  for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[]){
    if(primitive.mode!==undefined&&primitive.mode!==4)fail('Expected triangle mesh');
    triangles+=(json.accessors[primitive.indices]?.count||0)/3;
  }
  if(!Number.isInteger(triangles)||triangles<1000||triangles>200000)fail('Unexpected mesh complexity');
  const images=json.images.map(image=>{
    const view=json.bufferViews[image.bufferView];const offset=binStart+(view.byteOffset||0);
    if(bytes.subarray(offset,offset+8).toString('hex')!=='89504e470d0a1a0a')fail('Invalid PNG texture');
    const width=bytes.readUInt32BE(offset+16),height=bytes.readUInt32BE(offset+20);
    if(width>4096||height>4096)fail('Texture exceeds preview memory budget');
    return {width,height};
  });
  return {json,triangles,images,bytes:bytes.length};
}
