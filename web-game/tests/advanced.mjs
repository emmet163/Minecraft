import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser();
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const base=process.env.STONEWAKE_URL||'http://127.0.0.1:5173/';
async function value(code){return page.evaluate(source=>(new Function('game',source))(window.__stonewakeGame),code);}
async function until(code,timeout=20000){await page.waitForFunction(source=>(new Function('game',source))(window.__stonewakeGame),code,{timeout});}
try{
  const url=new URL(base);url.searchParams.set('test','1');await page.goto(url.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  const cell=await value(`return (async()=>{const p=game.player.position,x=Math.round(p.x)+5,z=Math.round(p.z),y=Math.round(p.y)+7;
    for(const dx of [-1,10])for(const dz of [-1,8])game.world.ensureLoaded(x+dx,z+dz);
    const edits=[];for(let dx=0;dx<=9;dx++)for(let dz=0;dz<=8;dz++){
      edits.push({x:x+dx,y:y-1,z:z+dz,state:{type:3,properties:0}});
      for(let dy=0;dy<=2;dy++)edits.push({x:x+dx,y:y+dy,z:z+dz,state:{type:0,properties:0}});
    }
    for(let dx=-1;dx<=3;dx++)for(const dz of [-1,1])edits.push({x:x+dx,y,z:z+dz,state:{type:3,properties:0}});
    for(let dz=-1;dz<=1;dz++)for(const dx of [-1,3])edits.push({x:x+dx,y,z:z+dz,state:{type:3,properties:0}});
    await game.world.apply(edits);return {x,y,z};})();`);
  const {x,y,z}=cell;
  await value(`return game.world.apply([{x:${x},y:${y},z:${z},state:{type:7,properties:0}}]);`);
  await until(`return game.world.get(${x+1},${y},${z})===28;`);
  await value(`return game.world.apply([{x:${x+2},y:${y},z:${z},state:{type:29,properties:0}}]);`);
  try{await until(`return game.world.get(${x+2},${y},${z})===3;`);}catch(error){
    console.log('fluid diagnostic',await value(`return {paused:game.paused,pending:game.fluids.pendingCount,
      source:game.world.getState(${x},${y},${z}),flow:game.world.getState(${x+1},${y},${z}),lava:game.world.getState(${x+2},${y},${z})};`));throw error;}
  await value(`return game.world.apply([
    {x:${x},y:${y},z:${z+3},state:{type:32,properties:0}},
    {x:${x+1},y:${y},z:${z+3},state:{type:31,properties:0}},
    {x:${x+2},y:${y},z:${z+3},state:{type:36,properties:0}},
    {x:${x+4},y:${y},z:${z+3},state:{type:38,properties:0}},
    {x:${x+5},y:${y},z:${z+3},state:{type:39,properties:0}}
  ]);`);
  await value(`return game.automation.toggle(${x},${y},${z+3});`);
  try{await until(`return (game.world.getState(${x+2},${y},${z+3}).properties&16)!==0;`);}catch(error){
    console.log('circuit diagnostic',await value(`return {paused:game.paused,pending:game.automation.pending.size,
      switch:game.world.getState(${x},${y},${z+3}),wire:game.world.getState(${x+1},${y},${z+3}),lamp:game.world.getState(${x+2},${y},${z+3})};`));throw error;}
  await value(`return game.world.apply([
    {x:${x},y:${y},z:${z+6},state:{type:38,properties:0}},
    {x:${x},y:${y+1},z:${z+6},state:{type:39,properties:0}},
    {x:${x+2},y:${y},z:${z+6},state:{type:7,properties:0}},
    {x:${x+4},y:${y},z:${z+6},state:{type:41,properties:0}},
    {x:${x+5},y:${y},z:${z+6},state:{type:41,properties:0}},
    {x:${x+6},y:${y},z:${z+6},state:{type:41,properties:0}}
  ]);`);
  const planted=await value(`game.farming.tick(8);return game.vehicles.place('cart',${x+4},${y},${z+6});`);
  assert.equal(planted,true);
  await until(`return (game.world.getState(${x},${y+1},${z+6}).properties&3)>0;`);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden'));
  await value(`game.items.slots.set(9,{id:'swift_tonic',count:1,damage:0});game.items.selected=9;game.useSelected();return game.saveNow();`);
  assert.ok(await value('return game.effects.swift>0;'));
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  assert.equal(await value(`return game.world.get(${x+2},${y},${z});`),3,'Water-lava stone did not survive reload');
  assert.equal(await value(`return game.world.get(${x+2},${y},${z+3});`),36,'Lamp did not survive reload');
  assert.equal(await value('return game.vehicles.vehicles.length;'),1,'Cart did not survive reload');
  assert.ok(await value('return game.effects.swift>0;'),'Status effect did not survive reload');
  await value(`game.player.position.set(${x+4},${y+1},${z+6});game.player.yaw=-Math.PI/2;game.player.object.rotation.y=-Math.PI/2;return true;`);
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.keyboard.press('KeyV');assert.ok(await value('return game.vehicles.mounted!==null;'));
  const cartBefore=await value('return game.vehicles.vehicles[0].x;');
  await page.keyboard.down('KeyW');await page.waitForTimeout(900);await page.keyboard.up('KeyW');
  assert.ok(await value(`return game.vehicles.vehicles[0].x>${cartBefore+.15};`),'Mounted cart did not move along rail');
  const metrics=await page.evaluate(async()=>{const intervals=[];let previous=performance.now();for(let i=0;i<30;i++){
    await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-previous);previous=now;}
    return {mean:intervals.reduce((sum,v)=>sum+v,0)/intervals.length,max:Math.max(...intervals),heapMb:performance.memory?.usedJSHeapSize/1048576??null};});
  await page.keyboard.press('KeyV');assert.equal(await value('return game.vehicles.mounted;'),null);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden'));
  const enterStart=Date.now();await value('return game.crossRealm();');const enterMs=Date.now()-enterStart;
  assert.equal(await value('return game.realm;'),'veil');
  assert.equal(await value('return game.world.generator.realm;'),'veil');
  assert.match(await page.locator('#advanced-info').textContent(),/THE VEIL/);
  assert.match(await page.locator('#world-info').textContent(),/Mountains/);
  assert.equal(await value('return game.vehicles.vehicles.length;'),0,'Overworld cart leaked into the Veil');
  assert.equal(await value('return game.world.generator.structures.nearby(0,0,200).length;'),0);
  assert.equal(await value("const p=game.player.position;game.world.ensureLoaded(p.x,p.z-3);return game.creatures.spawnAt('veil_shade',p.x,p.y,p.z-3)?.def.id;"),'veil_shade');
  await value('game.hud.setPaused(false);game.renderer.render(game.scene,game.player.camera);return true;');await mkdir('.artifacts',{recursive:true});
  await page.screenshot({path:'.artifacts/veil.png'});await value('game.hud.setPaused(true);return true;');
  const returnStart=Date.now();await value('return game.crossRealm();');const returnMs=Date.now()-returnStart;
  assert.equal(await value('return game.realm;'),'overworld');
  assert.equal(await value('return game.vehicles.vehicles.length;'),1);
  assert.equal(await value(`return game.world.get(${x+2},${y},${z});`),3);
  assert.deepEqual(errors,[]);
  console.log(`ADVANCED PASS: fluid flow/reaction, powered lamp, crop growth, cart ride, effect and edits across IndexedDB reload, two-way Veil transition; mean rAF ${metrics.mean.toFixed(1)} ms/max ${metrics.max.toFixed(1)} ms, heap ${metrics.heapMb?.toFixed(1)??'unavailable'} MB, realm entry ${enterMs} ms/return ${returnMs} ms; no browser errors`);
}finally{await browser.close();}
