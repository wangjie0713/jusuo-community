// SPDX-License-Identifier: MPL-2.0
import { swipeDestination } from './view-motion.mjs';

export function mountPageGestures({getPage,setPage,isBrowsing,setSceneEnabled,isSorting}) {
  let start=null,suppressUntil=0;const touches=new Set();
  const finish=()=>{document.body.classList.remove('swiping');document.body.style.setProperty('--progress',getPage()==='devices'?'1':'0');setSceneEnabled(true);start=null;};
  document.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;touches.add(e.pointerId);
    if(touches.size!==1){finish();return;}
    if(isBrowsing()||e.target.closest('dialog,input,.room-filters,.temperature-control,.spatial-target'))return;
    start={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),page:getPage(),dragging:false};
  },true);
  document.addEventListener('pointermove',e=>{
    if(!start||e.pointerId!==start.id)return;if(isSorting()){finish();return;}
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(!start.dragging){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){finish();return;}if(Math.abs(dx)<16||Math.abs(dx)<Math.abs(dy)*1.25)return;start.dragging=true;setSceneEnabled(false);document.body.classList.add('swiping');}
    e.preventDefault();const p=(start.page==='devices'?1:0)-dx/innerWidth;document.body.style.setProperty('--progress',String(Math.max(0,Math.min(1,p))));
  },{capture:true,passive:false});
  const end=(e,cancel=false)=>{touches.delete(e.pointerId);if(!start||e.pointerId!==start.id)return;const s=start;if(s.dragging){suppressUntil=performance.now()+550;const dx=e.clientX-s.x,dy=e.clientY-s.y;const next=cancel?s.page:swipeDestination({page:s.page,dx,dy,width:innerWidth,velocity:dx/Math.max(1,performance.now()-s.time)});finish();setPage(next);}else finish();};
  document.addEventListener('pointerup',e=>end(e),true);document.addEventListener('pointercancel',e=>end(e,true),true);
  document.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  return {cancel:finish};
}

export function mountCardSort({grid,onMove,onAnnounce}) {
  let press=null,timer=null,active=false,suppressUntil=0,target=null;
  const cleanup=()=>{clearTimeout(timer);for(const el of grid.querySelectorAll('.is-dragging,.drop-target'))el.classList.remove('is-dragging','drop-target');document.body.classList.remove('is-drag-active');press=null;active=false;target=null;};
  grid.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('.quick-power'))return;const card=e.target.closest('[data-device]');if(!card)return;press={id:e.pointerId,key:card.dataset.device,x:e.clientX,y:e.clientY};timer=setTimeout(()=>{if(!press)return;active=true;card.classList.add('is-dragging');document.body.classList.add('is-drag-active');grid.setPointerCapture(e.pointerId);onAnnounce('拖到另一个设备的位置，松手保存到此浏览器');},500);});
  document.addEventListener('pointermove',e=>{if(!press||e.pointerId!==press.id)return;if(!active){if(Math.hypot(e.clientX-press.x,e.clientY-press.y)>9)cleanup();return;}e.preventDefault();for(const el of grid.querySelectorAll('.drop-target'))el.classList.remove('drop-target');const card=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-device]');target=card&&grid.contains(card)?card.dataset.device:null;if(target&&target!==press.key)card.classList.add('drop-target');},{passive:false});
  const end=(e,cancel=false)=>{if(!press||e.pointerId!==press.id)return;const source=press.key,to=target,wasActive=active;cleanup();if(wasActive){suppressUntil=performance.now()+600;if(!cancel&&to&&to!==source)onMove(source,to);}};
  document.addEventListener('pointerup',e=>end(e));document.addEventListener('pointercancel',e=>end(e,true));
  grid.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  grid.addEventListener('keydown',e=>{if(!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;const card=e.target.closest('[data-device]');if(!card)return;e.preventDefault();const cards=[...grid.querySelectorAll('[data-device]')],i=cards.indexOf(card),to=cards[i+(e.key==='ArrowLeft'?-1:1)];if(to)onMove(card.dataset.device,to.dataset.device);});
  return {get active(){return active;},cancel:cleanup};
}
