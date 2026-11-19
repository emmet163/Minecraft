import assert from 'node:assert/strict';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser();
const context=await browser.newContext({viewport:{width:1280,height:720}});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  const url=new URL(process.env.STONEWAKE_URL||'http://127.0.0.1:5173/');url.searchParams.set('test','1');
  await page.goto(url.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  const before=await page.evaluate(async()=>{
    const game=window.__stonewakeGame,x=Math.round(game.player.position.x)+6,z=Math.round(game.player.position.z)+6,y=90;
    game.paused=true;game.world.ensureLoaded(x,z);game.clearDrops();
    const edit=async type=>game.world.apply([{x,y,z,state:{type,properties:0}}]);
    const mine=async type=>{game.target={x,y,z,state:{type,properties:0}};await game.mine();};
    if(!await edit(3))throw Error('Fixture edit failed');
    game.items.slots.set(0,{id:'dirt',count:1,damage:0});game.items.select(0);
    await mine(3);const hand={drops:game.drops.length,block:game.world.get(x,y,z)};
    if(!await edit(3))throw Error('Fixture replacement failed');
    game.items.slots.set(0,{id:'wood_pickaxe',count:1,damage:0});
    await mine(3);await mine(3);const pick={drops:game.drops.map(d=>d.item.id),damage:game.items.slots.get(0).damage,
      block:game.world.get(x,y,z),rendered:!!game.dropVisuals.materialsFor('stone').map};
    await game.saveNow();return {hand,pick,x,y,z};
  });
  assert.deepEqual(before.hand,{drops:0,block:0});
  assert.deepEqual(before.pick,{drops:['stone'],damage:1,block:0,rendered:true});
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  const after=await page.evaluate(({x,y,z})=>{const game=window.__stonewakeGame;
    game.world.ensureLoaded(x,z);return {drops:game.drops.map(d=>d.item.id),damage:game.items.slots.get(0).damage,
      block:game.world.get(x,y,z)};},before);
  assert.deepEqual(after,{drops:['stone'],damage:1,block:0});
  assert.deepEqual(errors,[]);
  console.log('MINING BROWSER PASS: hand stone has no drop; wood pickaxe drops one rendered stone, loses durability, and persists after reload; no console/page errors');
}finally{await browser.close();}
