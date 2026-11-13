import assert from 'node:assert/strict';
import {launchTestBrowser} from './launch.mjs';
const browser=await launchTestBrowser();
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const base=process.env.STONEWAKE_URL||'http://127.0.0.1:5173/';
async function dbAction(action,value){return page.evaluate(async({action,value})=>{
  const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('stonewake-web-edits',2);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  const tx=db.transaction(['players','edits'],action==='read'?'readonly':'readwrite');
  if(action==='read')return await new Promise((resolve,reject)=>{const q=tx.objectStore('players').get(12345);q.onsuccess=()=>resolve(q.result?.save);q.onerror=()=>reject(q.error);});
  if(action==='save')tx.objectStore('players').put({seed:12345,save:value});
  if(action==='edit')tx.objectStore('edits').put({seed:12345,...value});
  await new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
},{action,value});}
async function reloadAim(blockName){await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));await page.locator('#resume').click();
  await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.waitForFunction(()=>document.querySelector('#overlay')?.classList.contains('hidden'));
  await aim(blockName);
}
async function reloadOpen(blockName){await reloadAim(blockName);
  await page.mouse.click(640,360,{button:'right'});await page.waitForFunction(()=>!document.querySelector('#inventory')?.classList.contains('hidden'));
}
async function aim(blockName){
  for(const movement of [...Array(40).fill(25),...Array(80).fill(-25)]){
    if((await page.locator('#target').textContent())?.startsWith(blockName))break;
    await page.evaluate(dy=>{const event=new MouseEvent('mousemove');Object.defineProperty(event,'movementY',{value:dy});Object.defineProperty(event,'movementX',{value:0});document.dispatchEvent(event);},movement);
    await page.waitForTimeout(25);
  }
  try{await page.waitForFunction(name=>document.querySelector('#target')?.textContent?.startsWith(name),blockName,{timeout:2000});}
  catch(error){const current=await dbAction('read');const edits=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('stonewake-web-edits',2);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});return await new Promise((resolve,reject)=>{const q=db.transaction('edits').objectStore('edits').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});});await page.screenshot({path:'.artifacts/station-debug.png'});console.log('Target diagnostics:',blockName,await page.locator('#target').textContent(),await page.locator('#world-info').textContent(),await page.locator('#tool').textContent(),current?.position,current?.life?.mode,edits,errors);throw error;}
}
try{
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  await page.locator('#resume').click();await page.keyboard.press('Escape');await page.waitForTimeout(200);
  const save=await dbAction('read');assert.ok(save);
  save.position=[0,75,0];save.yaw=0;save.pitch=0;save.life.mode='creative';save.items.slots[9]={id:'stone',count:5,damage:0};
  save.items.slots[10]={id:'iron',count:2,damage:0};save.items.slots[11]={id:'coal',count:2,damage:0};
  save.items.slots[12]={id:'stick',count:2,damage:0};save.items.slots[13]={id:'plank',count:3,damage:0};
  await dbAction('save',save);
  const cell={x:0,y:77,z:-3};await dbAction('edit',{...cell,state:{type:26,properties:0}});
  await reloadOpen('Chest');assert.equal(await page.locator('[data-grid="storage"]').count(),27);
  await page.locator('[data-grid="bag"][data-index="9"]').click();await page.locator('[data-grid="storage"][data-index="0"]').click();
  await page.locator('#close-inventory').click();await page.waitForTimeout(200);
  await reloadOpen('Chest');assert.match(await page.locator('[data-grid="storage"][data-index="0"]').textContent(),/Stone/);
  await page.locator('#close-inventory').click();await page.waitForTimeout(200);
  await dbAction('edit',{...cell,state:{type:25,properties:0}});
  await reloadOpen('Furnace');assert.equal(await page.locator('[data-grid="storage"]').count(),3);
  await page.locator('[data-grid="bag"][data-index="10"]').click();await page.locator('[data-grid="storage"][data-index="0"]').click();
  await page.locator('[data-grid="bag"][data-index="11"]').click();await page.locator('[data-grid="storage"][data-index="1"]').click();
  await page.locator('#close-inventory').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));await page.waitForTimeout(4700);
  await aim('Furnace');await page.mouse.click(640,360,{button:'right'});await page.waitForFunction(()=>!document.querySelector('#inventory')?.classList.contains('hidden'));
  assert.match(await page.locator('[data-grid="storage"][data-index="2"]').textContent(),/Iron Ingot/);
  await page.locator('#close-inventory').click();await page.waitForTimeout(250);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden'));
  const stationSave=await dbAction('read');stationSave.yaw=0;stationSave.pitch=0;await dbAction('save',stationSave);
  await dbAction('edit',{...cell,state:{type:24,properties:0}});
  await reloadOpen('Crafting Station');assert.equal(await page.locator('[data-grid="craft"]').count(),9);
  await page.locator('[data-grid="bag"][data-index="13"]').click();
  for(const i of [0,1,2])await page.locator(`[data-grid="craft"][data-index="${i}"]`).click({button:'right'});
  await page.locator('[data-grid="bag"][data-index="12"]').click();
  for(const i of [4,7])await page.locator(`[data-grid="craft"][data-index="${i}"]`).click({button:'right'});
  assert.match(await page.locator('#craft-item').textContent(),/Craft/);await page.locator('#craft-item').click();
  assert.match(await page.locator('.bag-grid').textContent(),/Wood Pickaxe/);
  await page.locator('#close-inventory').click();await page.waitForTimeout(250);
  const final=await dbAction('read');assert.equal(final.items.chests.length,1);assert.equal(final.items.furnaces.length,1);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden'));
  const bedSave=await dbAction('read');bedSave.yaw=0;bedSave.pitch=0;bedSave.cycle.time=.75;await dbAction('save',bedSave);
  await dbAction('edit',{...cell,state:{type:27,properties:0}});
  await reloadAim('Bed');await page.mouse.click(640,360,{button:'right'});await page.waitForTimeout(250);
  assert.match(await page.locator('#notice').textContent(),/morning has arrived/);
  const slept=await dbAction('read');assert.deepEqual(slept.life.bed,cell);assert.ok(slept.cycle.time<.1);
  assert.deepEqual(errors,[]);console.log('STATIONS PASS: chest transfer/reload, furnace fuel/smelting, 3x3 crafting, bed sleep/spawn, persistence; no browser errors');
}finally{await browser.close();}
