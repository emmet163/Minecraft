import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser();
const context=await browser.newContext({viewport:{width:1280,height:720}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const readEdits=()=>page.evaluate(async()=>{
  const request=indexedDB.open('stonewake-web-edits',2);
  const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const transaction=db.transaction('edits','readonly');
  const query=transaction.objectStore('edits').getAll();
  return await new Promise((resolve,reject)=>{query.onsuccess=()=>resolve(query.result);query.onerror=()=>reject(query.error);});
});
try {
  await page.goto(process.env.STONEWAKE_URL || 'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  try { await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'),undefined,{timeout:10000}); }
  catch(error) { console.log('Startup errors:',errors,'Body:',(await page.locator('body').textContent()).slice(0,800)); throw error; }
  assert.equal(await page.title(),'Stonewake — Voxel Survival');
  await mkdir('.artifacts',{recursive:true});
  await page.screenshot({path:'.artifacts/browser-pause.png'});
  await page.locator('#resume').click();
  await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden')===false);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
  await page.keyboard.press('Digit2');
  assert.match(await page.locator('#tool').textContent(),/Stone/);
  await page.waitForTimeout(1500);
  const chunks=Number((await page.locator('#world-info').textContent()).match(/(\d+) chunks/)?.[1]);
  assert.ok(chunks>=1,`No rendered chunk: ${chunks}`);
  const metrics=await page.evaluate(async()=>{
    const samples=[];let last=performance.now();
    for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now;}
    return {meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,maxMs:Math.max(...samples),heapMb:performance.memory?.usedJSHeapSize/1048576??null};
  });
  await page.screenshot({path:'.artifacts/browser-game.png'});
  for(let i=0;i<8 && !(await page.locator('#target').textContent());i++) {
    await page.keyboard.down('KeyW');await page.waitForTimeout(350);await page.keyboard.up('KeyW');
  }
  // Spawn terrain can sit beyond the six-block ray reach; tilt toward nearby ground.
  if(!(await page.locator('#target').textContent())){
    await page.mouse.move(640,360);await page.mouse.move(640,550);
    await page.waitForTimeout(350);
  }
  const target=await page.locator('#target').textContent();
  assert.ok(target, 'No selectable block reached');
  await page.mouse.down({button:'left'});
  let saved=[];
  for(let i=0;i<60;i++){await page.waitForTimeout(250);saved=await readEdits();if(saved.length)break;}
  await page.mouse.up({button:'left'});
  assert.ok(saved.length>=1,'Mined edit was not persisted in IndexedDB');
  await page.mouse.move(640,360);
  await page.mouse.move(640,550);
  await page.waitForTimeout(250);
  const placeTarget=await page.locator('#target').textContent();
  assert.ok(placeTarget,'No block target for placement');
  await page.mouse.click(640,430,{button:'right'});
  await page.waitForTimeout(350);
  const placed=await readEdits();
  assert.notDeepEqual(placed,saved,'Placed edit was not persisted in IndexedDB');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('#overlay')?.classList.contains('hidden')===false);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  assert.deepEqual(await readEdits(),placed,'Saved edits changed after reload');
  await page.locator('#sensitivity').fill('0.26');
  await page.locator('#apply').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('stonewake-web-settings')||'{}').sensitivity===.26);
  assert.deepEqual(errors,[]);
  console.log(`BROWSER PASS: WebGL scene, ${chunks} chunks, pointer lock, movement, hotbar, mining, placement, ${placed.length} saved edits after reload, pause; no console/page errors; mean rAF ${metrics.meanMs.toFixed(1)} ms, max ${metrics.maxMs.toFixed(1)} ms, JS heap ${metrics.heapMb?.toFixed(1)??'unavailable'} MB`);
} finally { await browser.close(); }
