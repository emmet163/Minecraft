import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser(),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const slot=(group,index)=>page.locator(`[data-grid="${group}"][data-index="${index}"]`);
async function drag(group,indexes,button='left'){
  const first=await slot(group,indexes[0]).boundingBox();
  await page.mouse.move(first.x+first.width/2,first.y+first.height/2);await page.mouse.down({button});
  for(const i of indexes.slice(1)){const box=await slot(group,i).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:5});}
  await page.mouse.up({button});
}
try{
  const url=new URL(process.env.STONEWAKE_URL||'http://127.0.0.1:5173/');url.searchParams.set('test','1');
  await page.goto(url.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.evaluate(()=>{const game=window.__stonewakeGame;game.items.slots.set(9,{id:'wood',count:3,damage:0});game.items.slots.set(0,{id:'',count:0,damage:0});});
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__stonewakeGame?.inventory.open);
  assert.equal(await slot('craft',0).count(),1);assert.equal(await page.locator('[data-grid="craft"]').count(),4);
  assert.equal(await page.locator('#craft-output').isDisabled(),true);
  await slot('bag',9).click();await slot('craft',0).click();
  assert.match(await page.locator('#craft-output').textContent(),/Wood Plank/);
  await mkdir('.artifacts',{recursive:true});await page.screenshot({path:'.artifacts/crafting-personal.png'});
  await page.locator('#craft-output').click();await page.locator('#craft-output').click();
  let state=await page.evaluate(()=>({wood:window.__stonewakeGame.items.personal.get(0).count,cursor:window.__stonewakeGame.items.cursor}));
  assert.equal(state.wood,1);assert.equal(state.cursor.count,8);
  await slot('bag',10).click({button:'right'});await page.locator('#close-inventory').click();
  await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  state=await page.evaluate(()=>({cursor:window.__stonewakeGame.items.cursor,planks:window.__stonewakeGame.items.slots.count('plank')}));
  assert.equal(state.cursor.count,0);assert.equal(state.planks,8);
  await page.keyboard.press('KeyE');await slot('bag',10).click({modifiers:['Shift']});
  assert.match(await slot('bag',0).textContent(),/Wood Plank/);
  await page.evaluate(()=>{const game=window.__stonewakeGame;game.items.cursor={id:'stone',count:8,damage:0};game.inventory.render();});
  await drag('craft',[1,2,3]);
  state=await page.evaluate(()=>({counts:[1,2,3].map(i=>window.__stonewakeGame.items.personal.get(i).count),cursor:window.__stonewakeGame.items.cursor.count}));
  assert.deepEqual(state.counts,[3,3,2]);assert.equal(state.cursor,0);
  await page.evaluate(()=>{const game=window.__stonewakeGame;game.items.cursor={id:'stone',count:5,damage:0};game.inventory.render();});
  await drag('bag',[18,19,20],'right');
  state=await page.evaluate(()=>({counts:[18,19,20].map(i=>window.__stonewakeGame.items.slots.get(i).count),cursor:window.__stonewakeGame.items.cursor.count}));
  assert.deepEqual(state.counts,[1,1,1]);assert.equal(state.cursor,2);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__stonewakeGame?.inventory.open);
  await page.evaluate(()=>{const game=window.__stonewakeGame,g=game.items.station('fixture');g.load([]);
    for(const i of [0,1,2])g.set(i,{id:'plank',count:1,damage:0});for(const i of [4,7])g.set(i,{id:'stick',count:1,damage:0});
    game.openInventory('station','fixture');});
  assert.equal(await page.locator('[data-grid="craft"]').count(),9);
  assert.match(await page.locator('#craft-output').textContent(),/Wood Pickaxe/);
  await page.screenshot({path:'.artifacts/crafting-station.png'});
  await page.locator('#craft-output').click();
  state=await page.evaluate(()=>({cursor:window.__stonewakeGame.items.cursor,grid:window.__stonewakeGame.items.station('fixture').snapshot()}));
  assert.equal(state.cursor.id,'wood_pickaxe');assert.ok(state.grid.every(s=>!s.id));
  await page.locator('#close-inventory').click();await page.evaluate(()=>window.__stonewakeGame.saveNow());
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  state=await page.evaluate(()=>({pickaxe:window.__stonewakeGame.items.slots.count('wood_pickaxe'),wood:window.__stonewakeGame.items.personal.get(0).count,
    stones:[1,2,3].map(i=>window.__stonewakeGame.items.personal.get(i).count)}));
  assert.equal(state.pickaxe,1);assert.equal(state.wood,1);assert.deepEqual(state.stones,[3,3,2]);
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.evaluate(()=>{const game=window.__stonewakeGame;game.items.slots.load(Array.from({length:36},()=>({id:'stone',count:64,damage:0})));
    game.items.cursor={id:'wood_pickaxe',count:1,damage:12};});
  await page.keyboard.press('KeyE');await page.locator('#close-inventory').click();
  state=await page.evaluate(()=>window.__stonewakeGame.items.cursor);
  assert.deepEqual(state,{id:'wood_pickaxe',count:1,damage:12});
  await page.evaluate(()=>window.__stonewakeGame.saveNow());await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  state=await page.evaluate(()=>window.__stonewakeGame.items.cursor);
  assert.deepEqual(state,{id:'wood_pickaxe',count:1,damage:12});
  assert.deepEqual(errors,[]);
  console.log('CRAFTING OVERHAUL PASS: 2x2 and 3x3 output, repeated crafting, split, shift transfer, left/right drag, close and IndexedDB reload; no browser errors');
}finally{await browser.close();}
