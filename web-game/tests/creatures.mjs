import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser();
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const base=process.env.STONEWAKE_URL||'http://127.0.0.1:5173/';
async function gameValue(script){return page.evaluate(source=>(new Function('game',source))(window.__stonewakeGame),script);}
try{
  const url=new URL(base);url.searchParams.set('test','1');await page.goto(url.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.waitForTimeout(1600);
  await gameValue("game.creatures.configure(2026);game.cycle.time=.75;return true;");
  let natural=[];
  for(let i=0;i<40;i++){natural=await gameValue("return game.creatures.creatures.map(c=>c.def.kind);");if(natural.includes('hostile'))break;await page.waitForTimeout(500);}
  const spawnInfo=await gameValue("const p=game.player.position;return {paused:game.paused,position:p.toArray(),biome:game.world.generator.biomeAt(p.x,p.z),surface:game.world.generator.surfaceHeight(Math.round(p.x),Math.round(p.z)),loaded:game.world.loadedCount,spawnClock:game.creatures.spawnClock,daylight:game.cycle.daylight};");
  assert.ok(natural.includes('hostile'),`Night spawning did not produce a hostile creature: ${JSON.stringify(natural)} ${JSON.stringify(spawnInfo)}`);
  const metrics=await page.evaluate(async()=>{const intervals=[];let previous=performance.now();for(let i=0;i<60;i++){
    await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-previous);previous=now;}
    return {mean:intervals.reduce((sum,value)=>sum+value,0)/intervals.length,max:Math.max(...intervals),
      heapMb:performance.memory?.usedJSHeapSize/1048576??null};});

  const setup=await gameValue(`game.creatures.clear();game.cycle.time=.12;game.life.health=20;
    game.items.equipment.set(3,{id:'iron_sword',count:1,damage:0});
    game.items.equipment.set(1,{id:'iron_helmet',count:1,damage:0});
    game.items.equipment.set(2,{id:'iron_chestplate',count:1,damage:0});
    const p=game.player.position;game.player.yaw=0;game.player.object.rotation.y=0;
    game.player.pitch=-.13;game.player.camera.rotation.x=-.13;
    const c=game.creatures.spawnAt('crag_guardian',p.x,p.y,p.z-2.2);return {id:c?.id,position:p.toArray()};`);
  assert.ok(setup.id,`Could not place neutral creature: ${JSON.stringify(setup)}`);
  await page.waitForFunction(()=>document.querySelector('#target')?.textContent?.includes('Crag Guardian'),undefined,{timeout:5000});
  await mkdir('.artifacts',{recursive:true});await page.screenshot({path:'.artifacts/creature-combat.png'});
  assert.equal(await gameValue("const c=game.creatures.creatures.find(c=>c.def.id==='crag_guardian');const p=game.player.position;c.position.set(p.x,p.y,p.z-1.6);c.velocityY=0;game.player.yaw=0;game.player.object.rotation.y=0;game.player.pitch=-.13;game.player.camera.rotation.x=-.13;game.updateTarget();return game.creatureTarget?.id;"),setup.id);
  await page.evaluate(()=>document.querySelector('#game').dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true})));
  await page.waitForFunction(()=>window.__stonewakeGame.creatures.creatures.find(c=>c.def.id==='crag_guardian')?.health<24,undefined,{timeout:5000});
  await page.mouse.up({button:'left'});
  const provoked=await gameValue("const c=game.creatures.creatures.find(c=>c.def.id==='crag_guardian');return {health:c?.health,aggression:c?.aggression,weaponDamage:game.items.equipment.get(3).damage};");
  assert.ok(provoked.health<24&&provoked.aggression>0&&provoked.weaponDamage>0,`Neutral attack failed: ${JSON.stringify(provoked)}`);
  await gameValue("const c=game.creatures.creatures.find(c=>c.def.id==='crag_guardian');const p=game.player.position;c.position.set(p.x,p.y,p.z-1.3);c.aggression=8;return true;");
  await page.waitForFunction(()=>window.__stonewakeGame.life.health<20,undefined,{timeout:8000});
  const retaliation=await gameValue("return {health:game.life.health,armorDamage:game.items.equipment.get(2).damage};");
  assert.ok(retaliation.health<20&&retaliation.armorDamage>0,`Armored retaliation failed: ${JSON.stringify(retaliation)}`);
  await page.evaluate(()=>document.querySelector('#game').dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true})));
  await page.waitForFunction(id=>{const game=window.__stonewakeGame;return game.creatures.creatures.find(c=>c.id===id)?.health<=0||!game.creatures.creatures.some(c=>c.id===id);},setup.id,{timeout:8000});
  await page.mouse.up({button:'left'});
  const defeated=await gameValue(`return {xp:game.life.experience,dropCount:game.drops.length,guardian:game.creatures.creatures.find(c=>c.id===${setup.id})?.health};`);
  assert.ok(defeated.xp>=5&&(defeated.guardian===undefined||defeated.guardian===0),`Creature death/rewards failed: ${JSON.stringify(defeated)}`);

  await gameValue(`game.creatures.clear();game.life.health=20;const p=game.player.position;
    game.player.pitch=-.2;game.player.camera.rotation.x=-.2;
    game.creatures.spawnAt('ember_spitter',p.x,p.y,p.z-5);return true;`);
  for(let i=0;i<28&&await gameValue("return game.life.health>=20;");i++)await page.waitForTimeout(250);
  const ranged=await gameValue("return {health:game.life.health,armorDamage:game.items.equipment.get(2).damage};");
  assert.ok(ranged.health<20&&ranged.armorDamage>retaliation.armorDamage,`Ranged attack failed: ${JSON.stringify(ranged)}`);
  const stressCount=await gameValue(`game.creatures.clear();game.life.setMode('creative');const p=game.player.position;
    for(let i=0;i<24;i++)game.creatures.spawnAt('mossback',p.x+(i%6)-3,p.y,p.z-2-Math.floor(i/6)*2);
    return game.creatures.creatures.length;`);
  assert.equal(stressCount,24,'Population stress fixture did not reach the cap');
  const stress=await page.evaluate(async()=>{const intervals=[];let previous=performance.now();for(let i=0;i<60;i++){
    await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-previous);previous=now;}
    return {mean:intervals.reduce((sum,value)=>sum+value,0)/intervals.length,max:Math.max(...intervals),
      heapMb:performance.memory?.usedJSHeapSize/1048576??null};});
  assert.equal(await gameValue("game.creatures.clear();return game.creatures.group.children.length;"),0);
  assert.deepEqual(errors,[]);
  console.log(`CREATURES PASS: night spawning, targeting, sword damage/wear, neutral retaliation, armor, defeat/XP, ranged damage, 24-creature cap/clear; ${natural.length} spawned at night; 1-creature rAF ${metrics.mean.toFixed(1)} ms mean/${metrics.max.toFixed(1)} max, ${metrics.heapMb?.toFixed(1)??'unavailable'} MB JS heap; 24-creature rAF ${stress.mean.toFixed(1)} ms mean/${stress.max.toFixed(1)} max, ${stress.heapMb?.toFixed(1)??'unavailable'} MB heap; no browser errors`);
}finally{await browser.close();}
