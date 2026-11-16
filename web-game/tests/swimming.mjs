import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser();
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  const url=new URL(process.env.STONEWAKE_URL||'http://127.0.0.1:5173/');url.searchParams.set('test','1');
  await page.goto(url.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  const result=await page.evaluate(async()=>{
    const game=window.__stonewakeGame,p=game.player,world=game.world;
    game.paused=true;const x=Math.floor(p.position.x/16)*16+8,z=Math.floor(p.position.z/16)*16+8;
    world.ensureLoaded(x,z);const edits=[];
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let y=79;y<=83;y++)
      edits.push({x:x+dx,y,z:z+dz,state:{type:y===79?3:7,properties:0}});
    if(!await world.apply(edits))throw Error('Could not construct water pool');
    p.position.set(x,81.5,z);p.velocity.set(0,0,0);p.grounded=false;p.keys.clear();
    for(let i=0;i<6;i++)p.update(1/60);
    const before=p.position.y,underwater=p.headSubmerged,mode=p.waterMode;
    p.keys.add('Space');for(let i=0;i<24;i++)p.update(1/60);p.keys.delete('Space');const raised=p.position.y;
    p.keys.add('ShiftLeft');for(let i=0;i<35;i++)p.update(1/60);p.keys.delete('ShiftLeft');const dived=p.position.y;
    p.position.set(x,81.5,z);p.velocity.set(0,0,0);p.update(1/60);
    game.life.oxygen=10;game.life.tick(2,false,p.headSubmerged,false,false,false);
    for(let i=0;i<60;i++)game.updateWaterView(1/60);
    game.renderer.render(game.scene,p.camera);await game.saveNow();
    return {x,z,before,raised,dived,underwater,mode,oxygen:game.life.oxygen,fogFar:game.scene.fog.far,
      bubbles:game.waterEffects.mesh.count,block:world.get(x,82,z)};
  });
  assert.equal(result.underwater,true);assert.equal(result.mode,'swimming');
  assert.ok(result.raised>result.before+.1);assert.ok(result.dived<result.raised-.1);
  assert.equal(result.block,7);assert.ok(result.oxygen<10);assert.ok(result.fogFar<30);assert.ok(result.bubbles>0);
  await mkdir('.artifacts',{recursive:true});await page.screenshot({path:'.artifacts/swimming-underwater.png'});
  await page.evaluate(()=>{const game=window.__stonewakeGame,p=game.player;
    p.position.y=84.1;p.velocity.set(0,0,0);p.camera.rotation.x=-.48;
    p.update(1/60);for(let i=0;i<80;i++)game.updateWaterView(1/60);
    game.renderer.render(game.scene,p.camera);});
  await page.screenshot({path:'.artifacts/swimming-surface.png'});
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  const restored=await page.evaluate(({x,z})=>{const game=window.__stonewakeGame;
    game.player.update(1/60);return {x:game.player.position.x,z:game.player.position.z,
      block:game.world.get(x,82,z),oxygen:game.life.oxygen,underwater:game.player.headSubmerged};},result);
  assert.equal(restored.x,result.x);assert.equal(restored.z,result.z);assert.equal(restored.block,7);
  assert.equal(restored.oxygen,result.oxygen);assert.equal(restored.underwater,true);
  assert.deepEqual(errors,[]);
  console.log('SWIMMING PASS: deep-water ascent/dive, head submersion, oxygen, blue fog, bubbles, water and player state after IndexedDB reload; screenshot captured; no browser errors');
}finally{await browser.close();}
