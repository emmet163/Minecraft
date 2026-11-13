import assert from 'node:assert/strict';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser(),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
async function sample(){return page.evaluate(async()=>{const values=[];let last=performance.now();
  for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);const now=performance.now();values.push(now-last);last=now;}
  return {meanMs:values.reduce((a,b)=>a+b,0)/values.length,maxMs:Math.max(...values),heapMb:performance.memory?.usedJSHeapSize/1048576??null};});}
try{
  await page.goto(process.env.STONEWAKE_URL||'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#world-info')?.textContent?.includes('chunks'));
  await page.locator('#resume').click();
  await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await page.waitForFunction(()=>/25 chunks · 0 loading/.test(document.querySelector('#world-info')?.textContent||''),undefined,{timeout:60000});
  const low720=await sample();await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(500);
  const low1080=await sample();assert.deepEqual(errors,[]);
  console.log(`PERFORMANCE: 25 chunks, Low quality, SwiftShader 1280x720 mean ${low720.meanMs.toFixed(1)} ms/max ${low720.maxMs.toFixed(1)} ms/heap ${low720.heapMb?.toFixed(1)??'n/a'} MB; 1920x1080 mean ${low1080.meanMs.toFixed(1)} ms/max ${low1080.maxMs.toFixed(1)} ms/heap ${low1080.heapMb?.toFixed(1)??'n/a'} MB; no browser errors`);
}finally{await browser.close();}
