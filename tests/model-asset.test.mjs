// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectModel} from '../scripts/inspect-model.mjs';
import {modelLightLevels} from '../public/detailed-model.mjs';

const asset=await readFile(new URL('../public/assets/community-detail-v6.glb',import.meta.url));

test('model lights separate known on/off from missing, offline and unknown states',()=>{
  const living={device_key:'demo-living-light',online:true,state:'on'};
  const bedroom={device_key:'demo-bedroom-light',online:true,state:'off'};
  assert.deepEqual(modelLightLevels([living,bedroom]),[1,0,.45]);
  assert.deepEqual(modelLightLevels([{...living,state:'off'},bedroom]),[0,0,.45]);
  assert.deepEqual(modelLightLevels([{...living,online:false},{...bedroom,state:'unknown'}]),[.45,.45,.45]);
  assert.deepEqual(modelLightLevels([]),[.45,.45,.45]);
});

test('fictional model contains bounded geometry and embedded textures without private metadata',()=>{
  const result=inspectModel(asset);
  assert.equal(result.json.meshes.length,1);
  assert.deepEqual(result.images,[{width:4096,height:4096}]);
  assert.ok(result.triangles>1000&&result.triangles<200000);
  assert.doesNotMatch(JSON.stringify(result.json),/\/Users\/|entity_id|latitude|longitude|rtsp:|192\.168\./i);
});

function withJSON(change){
  const oldLength=asset.readUInt32LE(12),json=JSON.parse(asset.subarray(20,20+oldLength));change(json);
  const raw=JSON.stringify(json);const text=Buffer.from(raw+' '.repeat((4-Buffer.byteLength(raw)%4)%4));
  const header=Buffer.from(asset.subarray(0,20)),binary=asset.subarray(20+oldLength);
  header.writeUInt32LE(20+text.length+binary.length,8);header.writeUInt32LE(text.length,12);return Buffer.concat([header,text,binary]);
}

test('release audit rejects externally linked textures and unexpected model metadata',()=>{
  assert.throws(()=>inspectModel(withJSON(json=>{json.images[0].uri='https://example.invalid/private.png';})),/embedded PNG/);
  assert.throws(()=>inspectModel(withJSON(json=>{json.nodes[0].extras={household:'not-for-release'};})),/metadata/);
  assert.throws(()=>inspectModel(asset.subarray(0,asset.length-4)),/header/);
});
