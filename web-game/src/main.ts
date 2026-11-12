import * as THREE from 'three';
import './style.css';
import {Block,blockNames,dropType,isReplaceable,isSolid,state} from './world/blocks';
import {VoxelWorld} from './world/world';
import {IndexedDbEditStore,type GameSave} from './persistence/edits';
import {PlayerController} from './player/controller';
import {traceBlocks,type Hit} from './world/raycast';
import {Hud} from './ui/hud';
import {InventoryView,type InventoryMode} from './ui/inventory';
import {HEIGHT} from './world/chunk';
import {BlockSounds} from './render/sounds';
import {WeatherVisual} from './render/weather';
import {GameItems,blockItem,isEmpty,item,stack,empty,type Stack} from './items/items';
import {SurvivalState,WorldCycle,type Mode} from './survival/state';
import {Biome} from './world/generator';

type Drop={mesh:THREE.Mesh;item:Stack;age:number;velocity:number};
const settingsKey='stonewake-web-settings';
const cellKey=(x:number,y:number,z:number)=>`${x},${y},${z}`;
class Game{
  readonly items=new GameItems();readonly life=new SurvivalState();readonly cycle=new WorldCycle();
  readonly hud=new Hud(this.items);readonly inventory=new InventoryView(this.hud.root,this.items,this.life);
  readonly scene=new THREE.Scene();readonly renderer=new THREE.WebGLRenderer({canvas:this.hud.canvas,antialias:true});
  readonly store=new IndexedDbEditStore();readonly world=new VoxelWorld(this.store);readonly player=new PlayerController(this.world);
  readonly clock=new THREE.Clock();readonly sounds=new BlockSounds();readonly weather=new WeatherVisual();
  readonly outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025,1.025,1.025)),new THREE.LineBasicMaterial({color:'#f5dc87',depthTest:false}));
  readonly sun=new THREE.DirectionalLight('#fff3d7',2.3);readonly moon=new THREE.DirectionalLight('#a8b8ff',0);
  readonly ambient=new THREE.HemisphereLight('#d8e8ff','#5b624f',2.2);readonly drops:Drop[]=[];
  paused=true;private leftHeld=false;private miningKey='';private miningTime=0;private target:Hit|null=null;
  private editBusy=false;private running=false;private loaded=false;private saveBlocked=false;private saveClock=0;
  private saveQueue:Promise<void>=Promise.resolve();private lightClock=0;private idleRenderClock=1;
  constructor(){
    this.scene.background=new THREE.Color('#91bde3');this.scene.fog=new THREE.Fog('#91bde3',75,145);
    this.sun.position.set(-45,95,55);this.moon.position.set(40,80,-45);
    this.scene.add(this.ambient,this.sun,this.moon,this.world.group,this.player.object,this.outline,this.weather.group);this.outline.visible=false;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.resize();window.addEventListener('resize',()=>this.resize());
    this.hud.onResume=()=>{void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.hud.onSettings=(seed,distance,sensitivity)=>void this.changeSettings(seed,distance,sensitivity);
    this.hud.onMode=mode=>this.setMode(mode);this.hud.onRespawn=()=>this.respawn();
    this.inventory.onClose=()=>{void this.saveNow();this.hud.renderHotbar(this.life);void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.inventory.onChange=()=>{this.hud.renderHotbar(this.life);void this.saveNow();};
    this.inventory.onCraft=recipe=>{if(this.life.mode==='survival')this.life.experience+=Math.max(1,recipe.count);};
    this.inventory.onDrop=value=>this.spawnItem(value,this.player.position.clone().add(new THREE.Vector3(0,1,0)));
    this.hud.canvas.addEventListener('click',()=>{if(this.paused&&!this.life.dead)void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));});
    document.addEventListener('pointerlockchange',()=>{
      if(this.inventory.open)return;
      this.setPaused(document.pointerLockElement!==this.hud.canvas);
    });
    document.addEventListener('mousemove',event=>{if(!this.paused&&!this.inventory.open&&!this.life.dead)this.player.look(event.movementX,event.movementY);});
    document.addEventListener('keydown',event=>this.keyDown(event));
    document.addEventListener('keyup',event=>this.player.keys.delete(event.code));
    window.addEventListener('blur',()=>{this.player.keys.clear();this.leftHeld=false;void this.saveNow();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)void this.saveNow();});
    this.hud.canvas.addEventListener('mousedown',event=>this.mouseDown(event));
    document.addEventListener('mouseup',event=>{if(event.button===0)this.leftHeld=false;});
    this.hud.canvas.addEventListener('wheel',event=>{event.preventDefault();if(!this.paused&&!this.inventory.open){this.hud.select(this.items.selected+(event.deltaY>0?1:-1));void this.saveNow();}},{passive:false});
    this.hud.canvas.addEventListener('contextmenu',event=>event.preventDefault());
    this.world.onError=message=>this.hud.showNotice(message);this.store.onFailure=message=>this.hud.showNotice(message);
    this.player.onLand=distance=>{if(distance>4)this.takeDamage((distance-3)*1.5);};
  }
  private resize(){const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h,false);this.player.camera.aspect=w/h;this.player.camera.updateProjectionMatrix();}
  private setPaused(value:boolean){this.paused=value;this.hud.setPaused(value&&!this.life.dead);this.leftHeld=false;this.miningTime=0;this.miningKey='';this.hud.setProgress(0);if(value){this.player.keys.clear();void this.saveNow();}}
  private keyDown(event:KeyboardEvent){
    if(this.life.dead){if(event.code==='KeyR')this.respawn();return;}
    if(this.inventory.open){if(event.code==='KeyE'||event.code==='Escape')this.inventory.close();return;}
    if(event.code==='Escape'){if(document.pointerLockElement===this.hud.canvas)document.exitPointerLock();return;}
    if(this.paused)return;
    if(event.code==='KeyE'){this.openInventory('personal');return;}
    if(event.code==='KeyF'){this.useSelected();return;}
    if(event.code.startsWith('Digit')){const n=Number(event.code.slice(5));if(n>=1&&n<=9){this.hud.select(n-1);void this.saveNow();}}
    else if(event.code==='KeyQ'){this.hud.cycleTool();void this.saveNow();}
    else this.player.keys.add(event.code);
    if(['Space','ArrowUp','ArrowDown'].includes(event.code))event.preventDefault();
  }
  private mouseDown(event:MouseEvent){if(this.paused||this.inventory.open||this.life.dead)return;if(event.button===0)this.leftHeld=true;if(event.button===2)void this.place();}
  private openInventory(mode:InventoryMode,cell=''){
    this.leftHeld=false;this.inventory.openPanel(mode,cell);this.hud.setPaused(false);
    if(document.pointerLockElement===this.hud.canvas)document.exitPointerLock();
  }
  private snapshot():GameSave{return {version:1,position:this.player.position.toArray() as [number,number,number],yaw:this.player.yaw,pitch:this.player.pitch,items:this.items.snapshot(),life:this.life.snapshot(),cycle:this.cycle.snapshot()};}
  private saveNow():Promise<void>{
    if(!this.loaded||this.saveBlocked)return this.saveQueue;
    const seed=this.world.seed,save=this.snapshot();
    this.saveQueue=this.saveQueue.then(()=>this.store.saveGame(seed,save)).catch(error=>{this.hud.showNotice(`Save failed: ${String(error)}`);});
    return this.saveQueue;
  }
  private async changeSettings(seed:number,distance:number,sensitivity:number):Promise<void>{
    if(!Number.isFinite(seed)||!Number.isFinite(sensitivity))return;
    this.player.sensitivity=Math.max(.03,Math.min(.5,sensitivity));
    try{localStorage.setItem(settingsKey,JSON.stringify({seed,distance,sensitivity:this.player.sensitivity}));}catch{this.hud.showNotice('Settings cannot be saved in this browser');}
    if(this.loaded&&seed===this.world.seed&&distance===this.world.renderDistance){void this.saveNow();return;}
    await this.saveNow();this.loaded=false;this.saveBlocked=false;this.hud.showNotice('Loading world…');
    const saved=await this.store.loadGame(seed);
    const valid=!!saved&&saved.version===1&&Array.isArray(saved.position)&&saved.position.length===3&&saved.position.every(Number.isFinite)&&Number.isFinite(saved.yaw)&&Number.isFinite(saved.pitch)&&!!saved.items&&!!saved.life&&!!saved.cycle;
    if(saved&&!valid){this.saveBlocked=true;this.hud.showNotice('Save data invalid; original preserved, saving disabled');}
    const position=valid?saved!.position:undefined;
    await this.world.configure(seed,distance,position?.[0]??0,position?.[2]??0);
    const spawn=position?new THREE.Vector3(...position):this.world.spawn();
    if(!this.world.isLoaded(Math.round(spawn.x),Math.round(spawn.z)))await this.world.configure(seed,distance,spawn.x,spawn.z);
    try{this.items.load(valid?saved!.items:undefined);this.life.load(valid?saved!.life:undefined);this.cycle.load(valid?saved!.cycle:undefined,seed);}
    catch(error){this.saveBlocked=true;this.items.reset();this.life.load(undefined);this.cycle.configure(seed);this.hud.showNotice(`Save data could not be loaded; original preserved: ${String(error)}`);}
    this.player.position.copy(spawn);this.player.yaw=valid?saved!.yaw||0:0;this.player.pitch=valid?saved!.pitch||0:0;
    this.player.object.rotation.y=this.player.yaw;this.player.camera.rotation.x=this.player.pitch;this.player.setFlight(this.life.mode==='creative');
    this.clearDrops();this.hud.setTarget('');this.outline.visible=false;this.hud.setDeath(this.life.dead);this.hud.setMode(this.life.mode);
    this.hud.setWorld(seed,this.world.generator.biomeAt(Math.round(spawn.x),Math.round(spawn.z)),this.world.loadedCount,this.world.pendingCount);
    this.hud.setSurvival(this.life,this.cycle,this.isSnowing());this.hud.renderHotbar(this.life);this.loaded=true;this.hud.showNotice(`World ${seed} ready`);
  }
  async start(){let settings={seed:12345,distance:2,sensitivity:.18};try{settings={...settings,...JSON.parse(localStorage.getItem(settingsKey)||'{}')};}catch{/* defaults */}
    this.hud.setSettings(settings.seed,settings.distance,settings.sensitivity);await this.changeSettings(settings.seed,settings.distance,settings.sensitivity);this.running=true;this.frame();}
  private setMode(mode:Mode){if(this.life.dead)return;this.life.setMode(mode);this.player.setFlight(mode==='creative');this.hud.setMode(mode);this.hud.setSurvival(this.life,this.cycle,this.isSnowing());this.hud.renderHotbar(this.life);void this.saveNow();}
  private useSelected(){if(this.life.mode==='creative'||this.life.dead)return;const held=this.items.selectedStack();if(isEmpty(held))return;
    const def=item(held.id);if(this.life.eat(def.nutrition||0,def.saturationGain||0,def.healing||0)){this.items.spendSelected();this.hud.renderHotbar(this.life);void this.saveNow();}}
  private sleepAt(x:number,y:number,z:number){if(this.world.get(x,y,z)!==Block.Bed)return;this.life.bed={x,y,z};const slept=this.cycle.sleep();
    if(slept){this.life.heal(6);this.life.eat(4,2);}this.hud.showNotice(slept?'Spawn set · morning has arrived':'Spawn set · sleep at night');void this.saveNow();}
  private takeDamage(amount:number){if(this.life.damage(amount)){if(this.life.dead)this.enterDeath();else void this.saveNow();}}
  private enterDeath(){this.leftHeld=false;this.player.velocity.set(0,0,0);if(this.inventory.open){this.inventory.open=false;this.inventory.overlay.classList.add('hidden');}
    const position=this.player.position.clone().add(new THREE.Vector3(0,1,0));
    const dropGrid=(grid:{snapshot:()=>Stack[];load:(s:Stack[])=>void})=>{for(const value of grid.snapshot())if(!isEmpty(value))this.spawnItem(value,position);grid.load([]);};
    dropGrid(this.items.slots);dropGrid(this.items.equipment);dropGrid(this.items.personal);
    if(!isEmpty(this.items.cursor))this.spawnItem(this.items.cursor,position);this.items.cursor=empty();
    this.hud.renderHotbar(this.life);this.hud.setDeath(true);this.hud.setPaused(false);this.paused=true;
    if(document.pointerLockElement===this.hud.canvas)document.exitPointerLock();void this.saveNow();
  }
  private respawn(){if(!this.life.dead)return;let position:THREE.Vector3|undefined;
    if(this.life.bed){const {x,y,z}=this.life.bed;this.world.ensureLoaded(x,z);if(this.world.get(x,y,z)===Block.Bed)position=new THREE.Vector3(x,y+1,z);else this.life.bed=null;}
    position??=this.world.spawn();this.world.ensureLoaded(Math.round(position.x),Math.round(position.z));
    this.player.position.copy(position);this.player.setFlight(this.life.mode==='creative');this.life.respawn();this.hud.setDeath(false);this.hud.setSurvival(this.life,this.cycle,this.isSnowing());
    void this.saveNow();void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));
  }
  private updateTarget(){const origin=new THREE.Vector3(),direction=new THREE.Vector3();this.player.camera.getWorldPosition(origin);this.player.camera.getWorldDirection(direction);
    this.target=traceBlocks(this.world,origin,direction,6);
    if(!this.target){this.hud.setTarget('');this.outline.visible=false;return;}
    const {x,y,z,state:hitState}=this.target;this.hud.setTarget(`${blockNames[hitState.type]} · ${x}, ${y}, ${z}`);
    this.outline.position.set(x,y,z);this.outline.scale.set(1,1,1);
    if(hitState.type===Block.Slab||hitState.type===Block.Bed){this.outline.scale.y=.52;this.outline.position.y+=hitState.type===Block.Bed?-.25:(hitState.properties&4)?.25:-.25;}
    else if(hitState.type===Block.Door){this.outline.position.y+=(hitState.properties&4)?-.5:.5;this.outline.scale.y=2.025;const facing=((hitState.properties&3)+(hitState.properties&8?1:0))&3;if(facing%2===0)this.outline.scale.x=.205;else this.outline.scale.z=.205;}
    this.outline.visible=true;
  }
  private releaseContainer(type:Block,key:string,position:THREE.Vector3){const grid=type===Block.CraftingStation?this.items.stations.get(key):type===Block.Chest?this.items.chests.get(key):undefined;
    if(grid){for(const s of grid.snapshot())if(!isEmpty(s))this.spawnItem(s,position);if(type===Block.CraftingStation)this.items.stations.delete(key);else this.items.chests.delete(key);}
    const furnace=type===Block.Furnace?this.items.furnaces.get(key):undefined;
    if(furnace){for(const s of furnace.slots.snapshot())if(!isEmpty(s))this.spawnItem(s,position);this.items.furnaces.delete(key);}
  }
  private async mine(){if(!this.target||this.editBusy)return;const {x,y,z,state:hitState}=this.target;this.editBusy=true;
    const low=hitState.type===Block.Door&&(hitState.properties&4)?y-1:y;
    const changes=hitState.type===Block.Door?[{x,y:low,z,state:state(Block.Air)},{x,y:low+1,z,state:state(Block.Air)}]:[{x,y,z,state:state(Block.Air)}];
    const okay=await this.world.apply(changes);
    if(okay){if(this.life.mode==='survival'){this.items.wearTool();this.spawnItem(stack(blockItem(dropType(hitState.type))),new THREE.Vector3(x,y+.4,z));
      this.life.experience+=[Block.Coal,Block.Copper,Block.Iron,Block.Gold].includes(hitState.type)?2:1;}
      this.releaseContainer(hitState.type,cellKey(x,low,z),new THREE.Vector3(x,y+1,z));this.sounds.play(true);this.hud.showNotice(`Mined ${blockNames[hitState.type]}`);this.hud.renderHotbar(this.life);void this.saveNow();}
    this.editBusy=false;this.miningTime=0;this.miningKey='';this.hud.setProgress(0);
  }
  private async place(){if(!this.target||this.editBusy)return;const hit=this.target,{x,y,z}=hit,key=cellKey(x,y,z);
    if(hit.state.type===Block.Bed){this.sleepAt(x,y,z);return;}
    if(hit.state.type===Block.CraftingStation){this.openInventory('station',key);return;}
    if(hit.state.type===Block.Chest){this.openInventory('chest',key);return;}
    if(hit.state.type===Block.Furnace){this.openInventory('furnace',key);return;}
    if(hit.state.type===Block.Door){const low=(hit.state.properties&4)?y-1:y,a=this.world.getState(x,low,z),b=this.world.getState(x,low+1,z);if(a.type!==Block.Door||b.type!==Block.Door)return;
      this.editBusy=true;if(await this.world.apply([{x,y:low,z,state:state(Block.Door,a.properties^8)},{x,y:low+1,z,state:state(Block.Door,b.properties^8)}]))this.sounds.play(false);this.editBusy=false;return;}
    const selected=this.items.selectedStack(),type=this.life.mode==='creative'?this.life.creativeBlock:this.items.selectedBlock();
    if(this.life.mode==='survival'&&(isEmpty(selected)||type===Block.Air)||hit.normal.lengthSq()===0)return;
    const nx=x+hit.normal.x,ny=y+hit.normal.y,nz=z+hit.normal.z;
    if(ny<0||ny>=HEIGHT||!this.world.isLoaded(nx,nz)||!isReplaceable(this.world.get(nx,ny,nz)))return;
    const forward=new THREE.Vector3();this.player.camera.getWorldDirection(forward);
    const facing=Math.abs(forward.x)>Math.abs(forward.z)?(forward.x>0?1:3):(forward.z>0?2:0);
    const properties=facing|(type===Block.Slab&&hit.normal.y<0?4:0);
    if(this.player.overlapsBlock(nx,ny,nz,state(type,properties)))return;
    const changes=[{x:nx,y:ny,z:nz,state:state(type,properties)}];
    if(type===Block.Door){if(ny+1>=HEIGHT||!isReplaceable(this.world.get(nx,ny+1,nz))||this.player.overlapsBlock(nx,ny+1,nz))return;changes.push({x:nx,y:ny+1,z:nz,state:state(type,properties|4)});}
    this.editBusy=true;if(await this.world.apply(changes)){if(this.life.mode==='survival')this.items.spendSelected();this.sounds.play(false);this.hud.renderHotbar(this.life);this.hud.showNotice(`Placed ${blockNames[type]}`);void this.saveNow();}this.editBusy=false;
  }
  private spawnItem(value:Stack,position:THREE.Vector3){if(isEmpty(value))return;const mesh=new THREE.Mesh(new THREE.BoxGeometry(.28,.28,.28),new THREE.MeshLambertMaterial({color:'#e9cc85'}));mesh.position.copy(position);this.scene.add(mesh);this.drops.push({mesh,item:{...value},age:0,velocity:1.5});}
  private removeDrop(index:number){const drop=this.drops[index]!;this.scene.remove(drop.mesh);drop.mesh.geometry.dispose();(drop.mesh.material as THREE.Material).dispose();this.drops.splice(index,1);}
  private clearDrops(){for(let i=this.drops.length-1;i>=0;i--)this.removeDrop(i);}
  private updateDrops(delta:number){for(let i=this.drops.length-1;i>=0;i--){const d=this.drops[i]!;d.age+=delta;d.mesh.rotation.y+=delta*1.3;if(d.age>300){this.removeDrop(i);continue;}
    d.velocity-=16*delta;const next=d.mesh.position.y+d.velocity*delta,b=this.world.get(Math.round(d.mesh.position.x),Math.floor(next+.36),Math.round(d.mesh.position.z));
    if(b===Block.Air||b===Block.Water)d.mesh.position.y=next;else d.velocity=0;
    if(d.age>.4&&d.mesh.position.distanceTo(this.player.position.clone().add(new THREE.Vector3(0,1,0)))<1.7){const left=this.items.slots.add(d.item.id,d.item.count,d.item.damage);if(left<d.item.count){d.item.count=left;this.hud.renderHotbar(this.life);void this.saveNow();if(!left){this.hud.showNotice(`Collected ${item(d.item.id).name}`);this.removeDrop(i);}}}
  }}
  private isSnowing(){const p=this.player.position;return this.world.generator.biomeAt(Math.round(p.x),Math.round(p.z))===Biome.Snow;}
  private outdoors(){const p=this.player.position;return p.y>=this.world.generator.surfaceHeight(Math.round(p.x),Math.round(p.z))+1;}
  private updateSurvival(delta:number){const previous=this.cycle.flash;this.cycle.tick(delta);const snow=this.isSnowing();
    this.weather.update(this.player.position,this.cycle.weather,snow,this.cycle.intensity,delta);
    if(previous<.9&&this.cycle.flash>=.9){this.sounds.thunder();if(this.outdoors()&&!this.life.dead)this.takeDamage(2);}
    if(!this.life.dead){const p=this.player.position,camera=this.player.camera,head=this.world.get(Math.round(p.x),Math.round(p.y+camera.position.y),Math.round(p.z));
      const chest=this.world.get(Math.round(p.x),Math.round(p.y+1),Math.round(p.z));const biome=this.world.generator.biomeAt(Math.round(p.x),Math.round(p.z));
      const cold=snow&&this.cycle.intensity>.4&&this.outdoors();const hot=biome===Biome.Desert&&this.cycle.daylight>.7&&this.life.hunger<=8;
      this.life.tick(delta,this.player.keys.has('ShiftLeft'),head===Block.Water,isSolid(head)&&head!==Block.Bed||isSolid(chest)&&chest!==Block.Bed,cold,hot);
      if(this.life.dead)this.enterDeath();}
    this.hud.setSurvival(this.life,this.cycle,snow);
    this.lightClock+=delta;if(this.lightClock>=.2){this.lightClock=0;this.updateLighting();}
  }
  private updateLighting(){const daylight=this.cycle.daylight,storm=this.cycle.intensity*(this.cycle.weather==='storm'?.35:.13);
    const b=THREE.MathUtils.clamp(daylight*(1-storm)+this.cycle.flash*.5,0,1);
    this.sun.intensity=.02+b*2.3;this.moon.intensity=.06+(1-daylight)*.5;this.ambient.intensity=.4+b*1.8;
    this.sun.position.set(Math.cos(this.cycle.time*Math.PI*2)*85,Math.sin(this.cycle.time*Math.PI*2)*95,35);
    const sky=new THREE.Color('#0d1832').lerp(new THREE.Color('#91bde3'),b);
    (this.scene.background as THREE.Color).copy(sky);(this.scene.fog as THREE.Fog).color.copy(sky);
  }
  private frame=()=>{if(!this.running)return;requestAnimationFrame(this.frame);const delta=Math.min(this.clock.getDelta(),.05);
    if(!this.paused){
      if(!this.inventory.open&&!this.life.dead){this.player.update(delta);this.updateTarget();
        const hit=this.target,k=hit?cellKey(hit.x,hit.y,hit.z):'';
        if(this.leftHeld&&hit&&!this.editBusy){if(k!==this.miningKey){this.miningKey=k;this.miningTime=0;}this.miningTime+=delta;
          const duration=this.life.mode==='creative'?0:this.items.miningTime(hit.state.type);this.hud.setProgress(duration===0?1:Math.min(1,this.miningTime/duration));
          if(this.miningTime>=duration)void this.mine();}
        else if(!this.editBusy){this.miningTime=0;this.miningKey='';this.hud.setProgress(0);}
        this.updateDrops(delta);
      }
      this.world.update(this.player.position.x,this.player.position.z,delta);
      for(const furnace of this.items.furnaces.values())furnace.tick(delta);
      this.updateSurvival(delta);
      this.saveClock+=delta;if(this.saveClock>=5){this.saveClock=0;void this.saveNow();}
      if(this.inventory.open&&this.items.furnaces.size&&Math.floor(performance.now()/250)!==Math.floor((performance.now()-delta*1000)/250))this.inventory.render();
      const p=this.player.position;this.hud.setWorld(this.world.seed,this.world.generator.biomeAt(Math.round(p.x),Math.round(p.z)),this.world.loadedCount,this.world.pendingCount);
    }
    if(this.paused||this.inventory.open){this.idleRenderClock+=delta;if(this.idleRenderClock>=1){this.idleRenderClock=0;this.renderer.render(this.scene,this.player.camera);}}
    else {this.idleRenderClock=1;this.renderer.render(this.scene,this.player.camera);}
  };
}
new Game().start().catch(error=>{console.error(error);document.querySelector('#app')!.textContent=`Could not start Stonewake: ${String(error)}`;});
