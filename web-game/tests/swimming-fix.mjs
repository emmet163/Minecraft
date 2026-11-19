import assert from 'node:assert/strict';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser(),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  const url=new URL(process.env.STONEWAKE_URL||'http://127.0.0.1:5173/');url.searchParams.set('test','1');
  await page.goto(url.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  const result=await page.evaluate(async()=>{const game=window.__stonewakeGame,p=game.player,world=game.world;
    game.paused=true;const x=Math.floor(p.position.x/16)*16+8,z=Math.floor(p.position.z/16)*16+8;
    world.ensureLoaded(x,z);const edits=[];
    for(let dx=-2;dx<=7;dx++)for(let dz=-2;dz<=2;dz++)for(let y=79;y<=83;y++)
      edits.push({x:x+dx,y,z:z+dz,state:{type:dx<=2&&y>79?7:3,properties:0}});
    if(!await world.apply(edits))throw Error('Could not create shoreline pool');
    const advance=(seconds,keys=[])=>{p.keys.clear();for(const key of keys)p.keys.add(key);
      let high=p.position.y;for(let i=0;i<Math.round(seconds*60);i++){p.update(1/60);high=Math.max(high,p.position.y);}return high;};
    p.position.set(x,81.5,z);p.velocity.set(0,0,0);p.grounded=false;
    advance(3);const bottom=p.position.y,underwater=p.headSubmerged;
    advance(1.5,['Space']);const rose=p.position.y;
    advance(.8);const released=p.position.y;
    p.position.set(x,81.5,z);p.velocity.set(0,0,0);advance(.5,['ShiftLeft']);const dive=p.position.y;
    p.position.set(x+1.9,82.45,z);p.velocity.set(0,0,0);p.grounded=false;
    p.keys.clear();p.keys.add('Space');p.keys.add('KeyD');let peak=p.position.y;
    for(let i=0;i<150&&p.position.x<x+4.1;i++){p.update(1/60);peak=Math.max(peak,p.position.y);}
    const exitX=p.position.x;p.keys.clear();advance(1);const landY=p.position.y,grounded=p.grounded,mode=p.waterMode;
    await game.saveNow();return {x,z,bottom,underwater,rose,released,dive,exitX,peak,landY,grounded,mode};
  });
  assert.ok(result.bottom>79.49&&result.bottom<79.8,JSON.stringify(result));assert.equal(result.underwater,true);
  assert.ok(result.rose>result.bottom+1,JSON.stringify(result));assert.ok(result.released<result.rose-.15,JSON.stringify(result));
  assert.ok(result.dive<81.5,JSON.stringify(result));assert.ok(result.exitX>result.x+3,JSON.stringify(result));
  assert.ok(result.peak<86,JSON.stringify(result));assert.ok(result.landY>83.4&&result.landY<83.8,JSON.stringify(result));
  assert.equal(result.grounded,true);assert.equal(result.mode,'land');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  const restored=await page.evaluate(({x,z})=>{const g=window.__stonewakeGame;return {y:g.player.position.y,water:g.world.get(x,82,z),shore:g.world.get(x+3,83,z)};},result);
  assert.equal(restored.y,result.landY);assert.equal(restored.water,7);assert.equal(restored.shore,3);
  assert.deepEqual(errors,[]);
  console.log('SWIMMING FIX PASS: sink, rise, release, dive, climb shore, grounded land state and IndexedDB reload; no browser errors');
}finally{await browser.close();}
