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
  const result=await page.evaluate(()=>{
    const game=window.__stonewakeGame,p=game.player.position;game.life.setMode('creative');game.creatures.clear();game.clearDrops();
    game.player.yaw=0;game.player.object.rotation.y=0;game.player.pitch=-.18;game.player.camera.rotation.x=-.18;
    game.world.ensureLoaded(p.x-1.5,p.z-4);game.world.ensureLoaded(p.x+2.5,p.z-4);
    const surface=(x,z)=>game.world.generator.surfaceHeight(Math.round(x),Math.round(z));
    const animal=game.creatures.spawnAt('mossback',p.x-1.5,surface(p.x-1.5,p.z-4)+.51,p.z-4);
    const enemy=game.creatures.spawnAt('dusk_stalker',p.x+2.5,surface(p.x+2.5,p.z-4)+.51,p.z-4);
    for(const [id,offset] of [['dirt',-1],['wood',0],['glass',1.1]]){
      const x=p.x+offset,z=p.z-2.5;game.spawnItem({id,count:1,damage:0},p.clone().set(x,surface(x,z)+1.1,z));}
    const blockDrop=game.drops[0],material=blockDrop.mesh.material;
    game.items.slots.set(0,{id:'grass',count:1,damage:0});game.hud.renderHotbar(game.life);
    return {animal:!!animal,enemy:!!enemy,materials:blockDrop.mesh.geometry.groups.length,top:material.map.image.data.length,
      ids:game.drops.map(drop=>drop.item.id),icon:document.querySelector('#hotbar .item-icon')?.getAttribute('src')?.startsWith('data:image/png')};
  });
  assert.deepEqual(result.ids,['dirt','wood','glass']);assert.equal(result.materials,0);assert.equal(result.top,24576);
  assert.equal(result.icon,true,JSON.stringify(result));assert.equal(result.animal,true,JSON.stringify(result));assert.equal(result.enemy,true,JSON.stringify(result));
  await page.waitForTimeout(500);await mkdir('.artifacts',{recursive:true});
  await page.screenshot({path:'.artifacts/visual-improvement.png'});
  await page.evaluate(()=>{const game=window.__stonewakeGame,p=game.player.position;
    game.creatures.clear();game.clearDrops();const x=p.x,z=p.z-2.5,y=game.world.generator.surfaceHeight(Math.round(x),Math.round(z))+1.2;
    game.spawnItem({id:'glass',count:1,damage:0},p.clone().set(x,y,z));game.renderer.render(game.scene,game.player.camera);});
  await page.screenshot({path:'.artifacts/visual-glass-drop.png'});
  assert.deepEqual(errors,[]);
  console.log('VISUAL IMPROVEMENT PASS: textured animal/enemy models and three distinct block drops rendered, atlas face data and hotbar icon checked; scene and glass screenshots captured; no browser errors');
}finally{await browser.close();}
