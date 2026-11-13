import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const base=process.env.STONEWAKE_URL||'http://127.0.0.1:5173/';
async function saved(){return page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('stonewake-web-edits',2);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  return await new Promise((resolve,reject)=>{const q=db.transaction('players').objectStore('players').get(12345);q.onsuccess=()=>resolve(q.result?.save);q.onerror=()=>reject(q.error);});
});}
async function put(save,edit){await page.evaluate(async({save,edit})=>{
  const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('stonewake-web-edits',2);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  const tx=db.transaction(['players','edits'],'readwrite');tx.objectStore('players').put({seed:12345,save});if(edit)tx.objectStore('edits').put({seed:12345,...edit});
  await new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
},{save,edit});}
try{
  const testUrl=new URL(base);testUrl.searchParams.set('test','1');await page.goto(testUrl.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');
  await page.keyboard.press('Space');await page.waitForTimeout(1100);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden'));
  await page.waitForTimeout(200);
  const fixture=await saved();assert.ok(fixture,'Autosave did not create player record');
  fixture.life.health=18;fixture.life.hunger=10;fixture.cycle.time=.75;fixture.cycle.weather='storm';fixture.cycle.intensity=1;
  fixture.position[1]+=7;fixture.items.slots[0]={id:'berries',count:2,damage:0};fixture.items.slots[9]={id:'wood',count:1,damage:0};fixture.items.slots[10]={id:'wood_pickaxe',count:1,damage:0};
  await put(fixture);await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#health-bar')?.textContent?.includes('18/20'));
  assert.match(await page.locator('#cycle-info').textContent(),/00:00 · Thunderstorm/);
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.waitForTimeout(1800);assert.ok(Number((await page.locator('#health-bar').textContent()).match(/(\d+)\/20/)?.[1])<18,'Fall damage did not occur');
  await mkdir('.artifacts',{recursive:true});await page.screenshot({path:'.artifacts/night-storm.png'});
  await page.keyboard.press('Digit1');await page.keyboard.press('KeyF');
  const foodSave=await saved();const foodState={hunger:await page.locator('#hunger-bar').textContent(),health:await page.locator('#health-bar').textContent(),death:await page.locator('#death').getAttribute('class'),overlay:await page.locator('#overlay').getAttribute('class'),locked:await page.evaluate(()=>document.pointerLockElement===document.querySelector('#game')),selected:foodSave?.items.selected,slot0:foodSave?.items.slots[0],hotbar:await page.locator('#hotbar').textContent(),game:await page.evaluate(()=>({paused:window.__stonewakeGame?.paused,health:window.__stonewakeGame?.life.health,hunger:window.__stonewakeGame?.life.hunger,held:window.__stonewakeGame?.items.selectedStack()}))};
  assert.match(foodState.hunger||'',/13\/20/,JSON.stringify(foodState));
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>!document.querySelector('#inventory')?.classList.contains('hidden'));
  assert.equal(await page.locator('[data-grid="bag"]').count(),36);
  await page.screenshot({path:'.artifacts/inventory.png'});
  await page.locator('[data-grid="bag"][data-index="9"]').click();await page.locator('[data-grid="craft"][data-index="0"]').click();
  await page.locator('#craft-item').click();assert.match(await page.locator('.bag-grid').textContent(),/Wood Plank/);
  await page.locator('[data-grid="bag"][data-index="9"]').click();
  for(let i=0;i<4;i++)await page.locator(`[data-grid="craft"][data-index="${i}"]`).click({button:'right'});
  await page.locator('#craft-item').click();assert.match(await page.locator('.bag-grid').textContent(),/Crafting Station/);
  await page.locator('[data-grid="bag"][data-index="10"]').click();await page.locator('[data-grid="equip"][data-index="0"]').click();
  assert.match(await page.locator('.equip-grid').textContent(),/Wood Pickaxe/);
  await page.locator('#close-inventory').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.keyboard.press('KeyQ');
  for(let i=0;i<35&&!(await page.locator('#target').textContent());i++){
    await page.evaluate(()=>{const event=new MouseEvent('mousemove');Object.defineProperty(event,'movementY',{value:15});Object.defineProperty(event,'movementX',{value:0});document.dispatchEvent(event);});
    await page.waitForTimeout(40);
  }
  assert.ok(await page.locator('#target').textContent(),'No target for mining');
  await page.evaluate(()=>document.querySelector('#game').dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true})));
  await page.waitForFunction(()=>document.querySelector('#notice')?.textContent?.includes('Mined'),undefined,{timeout:8000});
  await page.mouse.up({button:'left'});
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
  const after=await saved();assert.ok(after.items.equipment[0].damage>0,'Tool did not lose durability');assert.ok(after.life.experience>=2,'Crafting/mining XP missing');
  assert.ok(after.items.slots.some(s=>s.id==='crafting_station'),'Crafted station was not saved');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  const reloaded=await saved();assert.deepEqual(reloaded.items.equipment[0],after.items.equipment[0]);assert.equal(reloaded.life.hunger,after.life.hunger);
  const bed={x:Math.round(reloaded.position[0])+8,y:Math.round(reloaded.position[1]),z:Math.round(reloaded.position[2])};
  reloaded.life.health=1;reloaded.life.bed=bed;reloaded.position[1]+=10;
  await put(reloaded,{...bed,state:{type:27,properties:0}});await page.reload({waitUntil:'networkidle'});
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.waitForFunction(()=>!document.querySelector('#death')?.classList.contains('hidden'),undefined,{timeout:12000});
  await page.locator('#respawn').click();await page.waitForTimeout(400);
  assert.equal(await page.locator('#death').evaluate(node=>node.classList.contains('hidden')),true);
  const respawned=await saved();assert.equal(respawned.life.health,20);assert.deepEqual(respawned.position,[bed.x,bed.y+1,bed.z]);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden'));
  await page.locator('#mode').selectOption('creative');await page.waitForTimeout(200);
  const beforeFlight=(await saved()).position[1];
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.waitForTimeout(600);
  await page.keyboard.down('Space');await page.waitForTimeout(800);await page.keyboard.up('Space');
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
  const afterFlight=await saved();assert.equal(afterFlight.life.mode,'creative');assert.ok(afterFlight.position[1]>beforeFlight+.5,`Creative flight did not rise: ${beforeFlight} -> ${afterFlight.position[1]}; position ${afterFlight.position.join(',')}`);
  assert.deepEqual(errors,[]);console.log('INTEGRATION PASS: spawn, move, jump, mine, craft, equip, fall, food, death, bed respawn, creative flight, IndexedDB reload; no browser errors');
}finally{await browser.close();}
