import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchTestBrowser} from './launch.mjs';

const browser=await launchTestBrowser(),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  const url=new URL(process.env.STONEWAKE_URL||'http://127.0.0.1:5173/');url.searchParams.set('test','1');
  await page.goto(url.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__stonewakeGame?.loaded);
  await page.locator('#resume').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await mkdir('.artifacts',{recursive:true});
  for(const [label,ids] of [['animals',['cow','pig','sheep','chicken']],['hostiles',['zombie','skeleton','creeper','spider']]]){
    const result=await page.evaluate(ids=>{
      const game=window.__stonewakeGame;game.paused=true;game.creatures.clear();game.world.group.visible=false;
      game.sky.mesh.visible=false;game.weather.group.visible=false;game.scene.fog=null;
      game.scene.background.set('#71869a');game.player.position.set(0,75,0);
      game.player.yaw=0;game.player.pitch=0;game.player.object.rotation.y=0;game.player.camera.rotation.x=0;
      const creatures=ids.map((id,i)=>{
        const x=(i-1.5)*1.8,z=-5.8;game.world.ensureLoaded(x,z);
        const c=game.creatures.spawnAt(id,x,75,z);
        if(c)c.group.rotation.y=Math.PI;
        return {id,created:!!c,parts:c?.meshes.length,renderMeshes:c?.group.children.length,legs:c?.legs.length,head:c?.heads.length,
          width:c?.def.radius*2,height:c?.def.height};
      });
      game.renderer.render(game.scene,game.player.camera);return creatures;
    },ids);
    assert.ok(result.every(c=>c.created&&c.parts>=6&&c.head===1&&c.renderMeshes>=c.parts+1&&c.renderMeshes<=c.parts+2),JSON.stringify(result));
    await page.screenshot({path:`.artifacts/mob-overhaul-${label}.png`});
  }
  const drops=await page.evaluate(()=>{const game=window.__stonewakeGame;game.creatures.clear();game.clearDrops();
    for(const id of ['cow','pig','sheep','chicken','zombie','skeleton','creeper','spider']){
      const c=game.creatures.spawnAt(id,0,75,-5.8);game.creatures.hit(c,100,game.player.position);
    }
    return game.drops.map(drop=>drop.item.id);});
  assert.deepEqual(drops,['raw_beef','raw_pork','wool','raw_chicken','feather','coal','bone','fuse_spore','spider_silk']);
  assert.deepEqual(errors,[]);
  console.log('MOB BROWSER PASS: eight distinct models rendered in animal/hostile screenshots, all creature drops checked, no console/page errors');
}finally{await browser.close();}
