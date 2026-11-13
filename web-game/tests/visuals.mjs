import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser();
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const base=process.env.STONEWAKE_URL||'http://127.0.0.1:5173/';
try{
  const url=new URL(base);url.searchParams.set('test','1');await page.goto(url.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  await mkdir('.artifacts',{recursive:true});await page.screenshot({path:'.artifacts/phase9-settings.png'});
  assert.equal(await page.locator('#quality').inputValue(),'low');
  await page.locator('#quality').selectOption('medium');
  assert.equal(await page.evaluate(()=>window.__stonewakeGame.renderer.shadowMap.enabled),true);
  await page.locator('#quality').selectOption('high');
  assert.equal(await page.evaluate(()=>window.__stonewakeGame.sun.shadow.mapSize.x),2048);
  await page.locator('#quality').selectOption('low');
  assert.equal(await page.evaluate(()=>window.__stonewakeGame.world.shadows),false);
  await page.locator('#effects-volume').fill('25');await page.locator('#ambience-volume').fill('10');await page.locator('#music-volume').fill('0');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('stonewake-web-settings')).audio.effects),.25);
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.keyboard.down('KeyW');await page.waitForTimeout(600);await page.keyboard.up('KeyW');
  await page.waitForFunction(()=>window.__stonewakeGame.world.loadedCount>=9);
  const scene=await page.evaluate(()=>{const game=window.__stonewakeGame,group=game.world.group;
    const chunks=group.children.length,colors=group.children.map(c=>c.children.find(m=>m.geometry?.getAttribute('color'))).filter(Boolean).length;
    return {chunks,colors,sky:game.sky.mesh.visible,hand:game.firstPerson.group.visible,audio:game.sounds.settings.effects,
      particles:game.particles.mesh.count,pixelRatio:game.renderer.getPixelRatio()};});
  assert.ok(scene.chunks>=9&&scene.colors>=9);assert.equal(scene.sky,true);assert.equal(scene.hand,true);assert.equal(scene.audio,.25);
  await page.screenshot({path:'.artifacts/phase9-day.png'});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden'));
  await page.locator('#quality').selectOption('medium');await page.locator('#resume').click();
  await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.waitForTimeout(450);await page.screenshot({path:'.artifacts/phase9-shadows.png'});
  const shadow=await page.evaluate(async()=>{const game=window.__stonewakeGame,samples=[];let last=performance.now();
    for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now;}
    return {enabled:game.renderer.shadowMap.enabled,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,
      heapMb:performance.memory?.usedJSHeapSize/1048576??null};});
  assert.equal(shadow.enabled,true);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden'));
  await page.locator('#quality').selectOption('low');await page.locator('#resume').click();
  await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.evaluate(()=>{const game=window.__stonewakeGame;game.cycle.time=.83;game.updateLighting();});
  await page.screenshot({path:'.artifacts/phase9-night.png'});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#overlay')?.classList.contains('hidden'));
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  assert.equal(await page.locator('#effects-volume').inputValue(),'25');assert.equal(await page.locator('#quality').inputValue(),'low');
  assert.deepEqual(errors,[]);
  console.log(`PHASE 9 BROWSER PASS: quality presets, audio persistence, scene and hand, day/night/shadow captures, ${scene.chunks} chunks, ${scene.colors} shaded chunks, low pixel ratio ${scene.pixelRatio}, medium rAF ${shadow.meanMs.toFixed(1)} ms, heap ${shadow.heapMb?.toFixed(1)??'unavailable'} MB; no console/page errors`);
}finally{await browser.close();}
