// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createViewMotion,swipeDestination,moveDevice,HOME_AUTO_ROTATE_SPEED} from '../public/view-motion.mjs';
import {OrthographicCamera,Vector3} from '../public/vendor/three.module.js';
import {OrbitControls} from '../public/vendor/OrbitControls.js';

test('actual camera motion matches the original positive-Y orbit at different frame rates',()=>{
  for(const fps of [30,60,120]) {
    const camera=new OrthographicCamera(-8,8,6,-6,.1,100);
    camera.position.set(10,12,13);
    const controls=new OrbitControls(camera,null);
    controls.target.set(0,.1,0);controls.update();
    const offset=camera.position.clone().sub(controls.target);
    const expected=offset.clone().applyAxisAngle(new Vector3(0,1,0),Math.PI*2/300).add(controls.target);
    controls.autoRotate=true;controls.autoRotateSpeed=HOME_AUTO_ROTATE_SPEED;
    for(let frame=0;frame<fps;frame++)controls.update(1/fps);
    assert.ok(camera.position.distanceTo(expected)<1e-9,`original direction and five-minute period at ${fps} fps`);
    assert.ok(Math.abs(camera.position.distanceTo(controls.target)-offset.length())<1e-9);
  }
});
test('auto rotation pauses on background, page, overlay, interaction and reduced motion',()=>{
  const m=createViewMotion({settleMs:0});assert.equal(m.tick().rotating,true);
  for(const [key,value] of [['active',false],['visible',false],['overlay',true],['reduced',true]]){m.configure({[key]:value});assert.equal(m.tick().rotating,false);m.configure({[key]:!value});assert.equal(m.tick().rotating,true);}
  m.pointer(true);assert.equal(m.tick().rotating,false);m.pointer(false);assert.equal(m.tick().rotating,true);
});
test('browse is preserved during touch and resets only after ten idle seconds',()=>{
  let time=0,resets=0;const m=createViewMotion({now:()=>time,settleMs:0,onReset:()=>resets++});m.browse();assert.equal(m.tick().rotating,false);time=9999;m.tick();assert.equal(resets,0);m.activity();time=15000;m.tick();assert.equal(resets,0);m.pointer(true);time=30000;m.tick();assert.equal(resets,0);m.pointer(false);time=40000;assert.equal(m.tick().rotating,true);assert.equal(resets,1);
});
test('opening a dialog and backgrounding do not reset or restart the camera',()=>{
  let time=0,resets=0;const m=createViewMotion({now:()=>time,settleMs:0,onReset:()=>resets++});m.browse();m.configure({overlay:true});time=30000;m.tick();assert.equal(resets,0);m.configure({overlay:false});assert.equal(m.tick().browsing,true);time+=10000;m.tick();assert.equal(resets,1);m.browse();m.configure({visible:false});time+=60000;m.tick();assert.equal(resets,1);
});
test('vertical scrolling and small gestures do not navigate, direction is bounded',()=>{
  assert.equal(swipeDestination({page:'home',dx:-130,dy:5,width:390}),'devices');assert.equal(swipeDestination({page:'devices',dx:130,dy:5,width:390}),'home');assert.equal(swipeDestination({page:'home',dx:140,dy:5,width:390}),'home');assert.equal(swipeDestination({page:'home',dx:-90,dy:150,width:390}),'home');assert.equal(swipeDestination({page:'home',dx:-10,dy:0,width:390,velocity:1}),'home');
});
test('local order move preserves the exact device set',()=>{const order=['a','b','c'];assert.deepEqual(moveDevice(order,'a','c'),['b','c','a']);assert.deepEqual(moveDevice(order,'unknown','c'),order);assert.deepEqual(order,['a','b','c']);});

test('original idle cadence waits six seconds and eases into the five-minute orbit',()=>{
 let time=0;const m=createViewMotion({now:()=>time});assert.equal(m.tick().waiting,true);time=5999;assert.equal(m.tick().rotating,false);time=6000;assert.equal(m.tick().rotating,true);assert.equal(m.tick().speed,0);time=12000;assert.ok(m.tick().speed>.98);m.pointer(true);m.pointer(false);assert.equal(m.tick().waiting,true);time=18000;assert.equal(m.tick().rotating,true);m.configure({overlay:true});assert.equal(m.tick().rotating,false);m.configure({overlay:false});assert.equal(m.tick().waiting,true);
});
