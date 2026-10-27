// SPDX-License-Identifier: MPL-2.0
// Shared motion state: no device actions, no household-specific data.
// Original camera orbits around +Y in 300 seconds. OrbitControls subtracts
// its auto-rotation angle, so its speed must be negative to preserve direction.
export const HOME_AUTO_ROTATE_SPEED = -60 / 300;
export function createViewMotion({ now = () => performance.now(), idleMs = 10000, settleMs = 6000, onReset = () => {} } = {}) {
  let active=true, visible=true, overlay=false, reduced=false, pressed=false, browsing=false, last=now(), readyAt=now()+settleMs;
  const arm=()=>{readyAt=now()+settleMs;};
  return {
    configure(next={}) { const before=[active,visible,overlay,reduced].join();if(next.active!==undefined)active=next.active;if(next.visible!==undefined)visible=next.visible;if(next.overlay!==undefined)overlay=next.overlay;if(next.reduced!==undefined)reduced=next.reduced;if(before!==[active,visible,overlay,reduced].join()){last=now();arm();} },
    pointer(value) { if(pressed!==value)arm();pressed=value;last=now(); },
    browse() { browsing=true;last=now(); },
    activity() { last=now(); },
    reset() { browsing=false;last=now();arm();onReset(); },
    tick() { if(browsing&&!pressed&&active&&visible&&!overlay&&now()-last>=idleMs)this.reset();const eligible=active&&visible&&!overlay&&!reduced&&!pressed&&!browsing;return { browsing, rotating:eligible&&now()>=readyAt, waiting:eligible&&now()<readyAt, speed:1-Math.exp(-Math.max(0,now()-readyAt)/1500), active:active&&visible }; },
  };
}
export function swipeDestination({page,dx,dy,width,velocity=0}) {
  if(Math.abs(dx)<24||Math.abs(dx)<Math.abs(dy)*1.25)return page;
  if(Math.abs(dx)<Math.min(110,width*.23)&&Math.abs(velocity)<.5)return page;
  return page==='home'&&dx<0?'devices':page==='devices'&&dx>0?'home':page;
}
export function moveDevice(order,source,target) {
  if(source===target||!order.includes(source)||!order.includes(target))return [...order];
  const next=order.filter(k=>k!==source);next.splice(order.indexOf(target),0,source);return next;
}
