import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const base=process.env.STONEWAKE_URL||'http://127.0.0.1:5173/';
async function gameValue(source){return page.evaluate(code=>(new Function('game',code))(window.__stonewakeGame),source);}
async function saved(){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('stonewake-web-edits',2);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  return await new Promise((resolve,reject)=>{const q=db.transaction('players').objectStore('players').get(12345);q.onsuccess=()=>resolve(q.result?.save);q.onerror=()=>reject(q.error);});});}
try{
  const url=new URL(base);url.searchParams.set('test','1');await page.goto(url.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  const site=await gameValue(`return (async()=>{const gameSeed=game.world.seed;
    const site=game.world.generator.structures.nearby(0,0,800).find(s=>s.kind==='village');
    if(!site)return null;game.player.position.set(site.x,site.y+3,site.z);
    await game.world.configure(gameSeed,2,site.x,site.z);game.creatures.configure(gameSeed);return site;})();`);
  assert.ok(site,'No seeded village found for browser fixture');
  for(let i=0;i<40&&!await gameValue(`return game.exploration.discovered.has('${site.id}');`);i++)await page.waitForTimeout(250);
  assert.ok(await gameValue(`return game.exploration.discovered.has('${site.id}');`),'Village discovery did not trigger');
  await page.waitForTimeout(700);await mkdir('.artifacts',{recursive:true});await page.screenshot({path:'.artifacts/village.png'});
  assert.match(await page.locator('#navigation-info').textContent(),/X .* Z /);
  await page.keyboard.press('KeyM');await page.waitForFunction(()=>!document.querySelector('#map')?.classList.contains('hidden'));
  assert.match(await page.locator('#map').textContent(),/Village/);
  await page.locator(`#map [data-track="${site.id}"]`).click();
  assert.equal(await gameValue("return game.exploration.tracked;"),site.id);
  await page.locator('#close-map').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));

  const chest=site.chests[0],key=`${chest.x},${chest.y},${chest.z}`;
  await gameValue(`game.world.ensureLoaded(${chest.x},${chest.z});game.openInventory('chest','${key}');return true;`);
  await page.waitForFunction(()=>!document.querySelector('#inventory')?.classList.contains('hidden'));
  assert.equal(await page.locator('[data-grid="storage"]').count(),27);
  const firstLoot=await gameValue(`return game.items.chest('${key}').get(0);`);
  assert.ok(firstLoot.id&&firstLoot.count>0,'Generated village chest was empty');
  await page.locator('[data-grid="storage"][data-index="0"]').click();await page.locator('[data-grid="bag"][data-index="9"]').click();
  await page.locator('#close-inventory').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  const farmer=await gameValue(`game.creatures.ensureVillage(game.world.generator.structures.nearby(${site.x},${site.z},10)[0],game.villages.deceased);
    const c=game.creatures.creatures.find(c=>c.inhabitant?.occupation==='farmer');if(!c)return null;
    game.items.slots.set(10,{id:'plant',count:8,damage:0});game.openTrade(c);return c.inhabitant.key;`);
  assert.ok(farmer,'No farmer appeared at the village');
  await page.waitForFunction(()=>!document.querySelector('#trade')?.classList.contains('hidden'));
  await page.locator('#trade [data-offer="0"]').click();assert.match(await page.locator('#trade-message').textContent(),/Trade complete/);
  assert.equal(await gameValue(`return game.villages.used('${farmer}',0,game.cycle.day);`),1);
  await page.locator('#close-trade').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  for(let i=0;i<30;i++){const record=await saved();if(record?.villages?.trades?.length&&record?.items?.generatedLoot?.includes(key))break;await page.waitForTimeout(200);}
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  const restored=await saved();
  assert.ok(restored.exploration.discovered.includes(site.id));assert.equal(restored.exploration.tracked,site.id);
  assert.ok(restored.items.generatedLoot.includes(key));
  assert.equal(restored.items.chests.find(([cell])=>cell===key)?.[1][0].id,'');
  assert.equal(restored.items.slots[9].id,firstLoot.id);
  assert.equal(restored.villages.trades.find(([id])=>id===farmer)?.[1].uses[0],1);
  await gameValue(`game.world.ensureLoaded(${chest.x},${chest.z});game.openInventory('chest','${key}');return true;`);
  assert.equal(await gameValue(`return game.items.chest('${key}').get(0).id;`),'','Loot refilled after reload');
  assert.deepEqual(errors,[]);
  console.log(`EXPLORATION PASS: seeded village, discovery/map/compass, generated chest loot, trade, IndexedDB reload without loot duplication; no browser errors`);
}finally{await browser.close();}
