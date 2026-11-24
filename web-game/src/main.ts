import * as THREE from 'three';
import './style.css';
import './ui/phase7.css';
import './ui/phase8.css';
import './ui/phase9.css';
import './ui/crafting.css';
import {Block,blockNames,isReplaceable,isSolid,miningRule,state} from './world/blocks';
import {VoxelWorld} from './world/world';
import {IndexedDbEditStore,validGameSave,type GameSave,type WorldInfo} from './persistence/edits';
import {PlayerController} from './player/controller';
import {traceBlocks,type Hit} from './world/raycast';
import {Hud} from './ui/hud';
import {InventoryView,type InventoryMode} from './ui/inventory';
import {HEIGHT} from './world/chunk';
import {BlockSounds} from './render/sounds';
import {WeatherVisual} from './render/weather';
import {SkyDome} from './render/sky';
import {FirstPersonView} from './render/first_person';
import {BurstParticles} from './render/particles';
import {parseQuality,qualityPreset,type Quality} from './render/quality';
import {audioLevel,type AudioSettings} from './render/sounds';
import {GameItems,catalog,isEmpty,item,stack,empty,type Stack} from './items/items';
import {MiningProgress} from './items/mining';
import {SurvivalState,WorldCycle,type Mode,type Difficulty} from './survival/state';
import {Biome} from './world/generator';
import {CreatureSystem,type Creature} from './creatures/system';
import {absorbCreatureDamage,meleeDamage,wearWeapon} from './combat/rules';
import {lootFor} from './exploration/loot';
import {ExplorationState} from './exploration/state';
import {NavigationView} from './ui/navigation';
import {VillageLedger} from './villages/trades';
import {TradeView} from './ui/trade';
import {FluidSystem} from './world/fluids';
import {AutomationSystem} from './world/automation';
import {FarmingSystem} from './world/farming';
import {VehicleSystem} from './gameplay/transport';
import {EffectSystem} from './gameplay/effects';
import {DropVisuals} from './render/drops';
import {WaterEffects} from './render/waterEffects';

type Drop={mesh:THREE.Mesh;item:Stack;age:number;velocity:number;bob:number};
const settingsKey='stonewake-web-settings';
const cellKey=(x:number,y:number,z:number)=>`${x},${y},${z}`;
function createCrackGeometry():THREE.BufferGeometry{
  const positions:number[]=[];
  for(let stage=0;stage<10;stage++){
    const u=-.4+(stage%5)*.2,v=-.36+Math.floor(stage/5)*.34;
    for(const side of [-1,1]){
      positions.push(side*.518,u,v,side*.518,u+.17,v+.14);
      positions.push(u,side*.518,v,u+.17,side*.518,v+.14);
      positions.push(u,v,side*.518,u+.17,v+.14,side*.518);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setDrawRange(0,0);return geometry;
}
class Game{
  readonly items=new GameItems();readonly life=new SurvivalState();readonly cycle=new WorldCycle();
  readonly hud=new Hud(this.items);readonly inventory=new InventoryView(this.hud.root,this.items,this.life);
  readonly exploration=new ExplorationState();readonly navigation=new NavigationView(this.hud.root,this.items,this.exploration);
  readonly villages=new VillageLedger();readonly trade=new TradeView(this.hud.root,this.items,this.villages,()=>this.cycle.day);
  readonly scene=new THREE.Scene();readonly renderer=new THREE.WebGLRenderer({canvas:this.hud.canvas,antialias:true});
  readonly store=new IndexedDbEditStore();readonly world=new VoxelWorld(this.store);readonly player=new PlayerController(this.world);
  readonly creatures=new CreatureSystem(this.world);
  readonly fluids=new FluidSystem(this.world);readonly automation=new AutomationSystem(this.world);
  readonly farming=new FarmingSystem(this.world);readonly vehicles=new VehicleSystem(this.world);readonly effects=new EffectSystem();
  realm:'overworld'|'veil'='overworld';realmPositions:Partial<Record<'overworld'|'veil',[number,number,number]>>={};
  realmVehicles:Partial<Record<'overworld'|'veil',ReturnType<VehicleSystem['snapshot']>>>={};
  readonly advancedInfo=document.createElement('div');
  readonly lampLights=Array.from({length:4},()=>new THREE.PointLight('#ffe5a0',0,9));
  readonly litLamps=new Map<string,[number,number,number]>();
  readonly clock=new THREE.Clock();readonly sounds=new BlockSounds();readonly weather=new WeatherVisual();
  readonly sky=new SkyDome();readonly firstPerson=new FirstPersonView(this.player.camera);readonly particles=new BurstParticles();
  readonly waterEffects=new WaterEffects();private waterBlend=0;
  private readonly airSky=new THREE.Color('#91bde3');private readonly airFog=new THREE.Color('#91bde3');
  private readonly deepBlue=new THREE.Color('#173e68');
  readonly outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025,1.025,1.025)),new THREE.LineBasicMaterial({color:'#f5dc87',depthTest:false}));
  readonly cracks=new THREE.LineSegments(createCrackGeometry(),new THREE.LineBasicMaterial({color:'#24211e',depthTest:false,transparent:true,opacity:.8}));
  readonly sun=new THREE.DirectionalLight('#fff1d4',1.9);readonly moon=new THREE.DirectionalLight('#b6c9ed',0);
  readonly ambient=new THREE.HemisphereLight('#d7e8fa','#657260',1.45);readonly drops:Drop[]=[];
  readonly dropVisuals=new DropVisuals();
  paused=true;private leftHeld=false;private mining=new MiningProgress();private target:Hit|null=null;private creatureTarget:Creature|null=null;private attackClock=0;
  private editBusy=false;private running=false;private loaded=false;private saveBlocked=false;private saveClock=0;
  private saveQueue:Promise<void>=Promise.resolve();private lightClock=0;private hudClock=0;private idleRenderClock=1;private navigationClock=1;private villageClock=1;private lavaClock=0;private stepClock=0;
  quality:Quality='low';private visualConfigured=false;
  worldInfo:WorldInfo={id:12345,name:'World 12345',seed:12345,difficulty:'normal',mode:'survival',updatedAt:0};
  private loadingWorld=false;
  constructor(){
    this.scene.background=new THREE.Color('#91bde3');this.scene.fog=new THREE.Fog('#91bde3',75,145);
    this.sun.position.set(-45,95,55);this.moon.position.set(40,80,-45);
    this.scene.add(this.ambient,this.sun,this.sun.target,this.moon,this.sky.mesh,this.world.group,this.player.object,this.outline,this.cracks,this.weather.group,this.particles.mesh,this.waterEffects.mesh,this.creatures.group,this.vehicles.group,...this.lampLights);this.outline.visible=false;this.cracks.visible=false;
    this.sun.shadow.camera.left=-48;this.sun.shadow.camera.right=48;this.sun.shadow.camera.top=48;this.sun.shadow.camera.bottom=-48;this.sun.shadow.camera.near=.5;this.sun.shadow.camera.far=240;this.sun.shadow.bias=-.00025;
    this.advancedInfo.id='advanced-info';this.hud.root.append(this.advancedInfo);
    this.world.onEdits=edits=>{this.fluids.changed(edits);this.automation.changed(edits);this.farming.changed(edits);this.trackLamps(edits);};
    this.world.onChunkInstalled=(cx,cz)=>this.fluids.chunkInstalled(cx,cz);
    this.creatures.onDeath=creature=>{if(creature.inhabitant){this.villages.deceased.add(creature.inhabitant.key);this.hud.showNotice(`${creature.def.name} has fallen`);void this.saveNow();return;}
      if(creature.dungeonKey)this.exploration.defeated.add(creature.dungeonKey);
      const def=creature.def;this.spawnItem(stack(def.drop,def.dropCount),creature.position.clone().add(new THREE.Vector3(0,.5,0)));
      for(const extra of def.extraDrops||[])this.spawnItem(stack(extra.id,extra.count),creature.position.clone().add(new THREE.Vector3(0,.5,0)));
      const rewarded=this.life.mode==='survival';if(rewarded)this.life.experience+=def.experience;
      this.hud.showNotice(`${def.name} defeated${rewarded?` · +${def.experience} XP`:''}`);void this.saveNow();};
    this.creatures.onPlayerHit=(damage,from)=>{if(this.life.mode!=='survival'||this.life.dead)return;
      const actual=absorbCreatureDamage(this.items,damage),dx=this.player.position.x-from.x,dz=this.player.position.z-from.z,length=Math.hypot(dx,dz)||1;
      this.player.knockback.set(dx/length*4,0,dz/length*4);this.takeDamage(actual);this.hud.renderHotbar(this.life);};
    this.creatures.onExplosion=position=>{this.particles.burst(position,24);this.sounds.creature();this.hud.showNotice('A Fuse Creeper burst nearby');};
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.08;
    this.resize();window.addEventListener('resize',()=>this.resize());
    this.hud.onResume=()=>{this.sounds.unlock();void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.hud.onSettings=(seed,distance,sensitivity)=>void this.changeSettings(seed,distance,sensitivity);
    this.hud.onNewWorld=(name,seed,difficulty,mode)=>void this.newWorld(name,seed,difficulty,mode);
    this.hud.onLoadWorld=id=>void this.selectWorld(id);
    this.hud.onDifficulty=difficulty=>{this.life.setDifficulty(difficulty);this.worldInfo.difficulty=this.life.difficulty;void this.saveNow();};
    this.hud.onVisualSettings=(quality,audio)=>this.applyVisualSettings(quality,audio);
    this.hud.onMode=mode=>this.setMode(mode);this.hud.onRespawn=()=>this.respawn();
    this.inventory.onClose=()=>{void this.saveNow();this.hud.renderHotbar(this.life);void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.inventory.onChange=()=>{this.hud.renderHotbar(this.life);void this.saveNow();};
    this.inventory.onCraft=recipe=>{if(this.life.mode==='survival')this.life.experience+=Math.max(1,recipe.count);};
    this.inventory.onDrop=value=>this.spawnItem(value,this.player.position.clone().add(new THREE.Vector3(0,1,0)));
    this.trade.onClose=()=>{void this.saveNow();void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.trade.onChange=()=>{this.hud.renderHotbar(this.life);void this.saveNow();};
    this.navigation.onClose=()=>{void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.navigation.onTrack=()=>void this.saveNow();
    this.hud.canvas.addEventListener('click',()=>{this.sounds.unlock();if(this.paused&&!this.life.dead)void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));});
    document.addEventListener('pointerlockchange',()=>{
      if(this.inventory.open||this.trade.open||this.navigation.open)return;
      this.setPaused(document.pointerLockElement!==this.hud.canvas);
    });
    document.addEventListener('mousemove',event=>{if(!this.paused&&!this.inventory.open&&!this.trade.open&&!this.navigation.open&&!this.life.dead)this.player.look(event.movementX,event.movementY);});
    document.addEventListener('keydown',event=>this.keyDown(event));
    document.addEventListener('keyup',event=>this.player.keys.delete(event.code));
    window.addEventListener('blur',()=>{this.player.keys.clear();this.leftHeld=false;void this.saveNow();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)void this.saveNow();});
    this.hud.canvas.addEventListener('mousedown',event=>this.mouseDown(event));
    document.addEventListener('mouseup',event=>{if(event.button===0){this.leftHeld=false;this.resetMining();}});
    this.hud.canvas.addEventListener('wheel',event=>{event.preventDefault();if(!this.paused&&!this.inventory.open&&!this.trade.open&&!this.navigation.open){this.hud.select(this.items.selected+(event.deltaY>0?1:-1));void this.saveNow();}},{passive:false});
    this.hud.canvas.addEventListener('contextmenu',event=>event.preventDefault());
    this.world.onError=message=>this.hud.showNotice(message);this.store.onFailure=message=>this.hud.showNotice(message);
    this.player.onLand=distance=>{if(distance>4)this.takeDamage((distance-3)*1.5);};
    this.player.onSplash=surface=>{const p=this.player.position;this.waterEffects.splash(p.x,surface,p.z);};
  }
  private resize(){const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h,false);this.player.camera.aspect=w/h;this.player.camera.updateProjectionMatrix();}
  private persistSettings(seed=this.world.seed,distance=this.world.renderDistance,sensitivity=this.player.sensitivity){
    try{localStorage.setItem(settingsKey,JSON.stringify({seed,distance,sensitivity,worldId:this.worldInfo.id,quality:this.quality,audio:this.sounds.settings}));}
    catch{this.hud.showNotice('Settings cannot be saved in this browser');}}
  private applyVisualSettings(quality:Quality,audio:AudioSettings){
    const selected=parseQuality(quality);
    if(!this.visualConfigured||selected!==this.quality){this.quality=selected;this.visualConfigured=true;const preset=qualityPreset(selected);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,preset.pixelRatio));
      this.renderer.shadowMap.enabled=preset.shadows;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      this.sun.castShadow=preset.shadows;this.sun.shadow.mapSize.set(preset.shadowSize||1,preset.shadowSize||1);
      this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.world.setShadows(preset.shadows);
      this.weather.density=preset.weather;}
    this.sounds.setSettings(audio);this.persistSettings();
  }
  private trackLamps(edits:ReadonlyArray<{x:number;y:number;z:number;state:{type:Block;properties:number}}>){for(const edit of edits){const key=cellKey(edit.x,edit.y,edit.z);
    if(edit.state.type===Block.Lamp&&(edit.state.properties&16))this.litLamps.set(key,[edit.x,edit.y,edit.z]);else this.litLamps.delete(key);}}
  private updateLampLights(){const p=this.player.position,near=[...this.litLamps.values()].filter(([x,y,z])=>(x-p.x)**2+(y-p.y)**2+(z-p.z)**2<24**2)
    .sort((a,b)=>(a[0]-p.x)**2+(a[1]-p.y)**2+(a[2]-p.z)**2-((b[0]-p.x)**2+(b[1]-p.y)**2+(b[2]-p.z)**2));
    for(let i=0;i<this.lampLights.length;i++){const light=this.lampLights[i]!,cell=near[i];light.intensity=cell?1.8:0;if(cell)light.position.set(...cell);}}
  private updateAdvancedInfo(){this.advancedInfo.textContent=`${this.realm==='veil'?'THE VEIL':'OVERWORLD'}${this.vehicles.mounted!==null?' · Riding (V to dismount)':''}${this.effects.swift>0?' · Swift '+Math.ceil(this.effects.swift)+'s':''}${this.effects.guard>0?' · Guard '+Math.ceil(this.effects.guard)+'s':''}`;}
  private resetMining(){this.mining.reset();this.hud.setProgress(0);this.cracks.visible=false;}
  private setPaused(value:boolean){this.paused=value;this.hud.setPaused(value&&!this.life.dead);this.leftHeld=false;this.resetMining();if(value){this.player.keys.clear();void this.saveNow();}}
  private keyDown(event:KeyboardEvent){
    if(this.life.dead){if(event.code==='KeyR')this.respawn();return;}
    if(this.trade.open){if(event.code==='KeyE'||event.code==='Escape')this.trade.close();return;}
    if(this.navigation.open){if(event.code==='KeyM'||event.code==='Escape')this.navigation.close();return;}
    if(this.inventory.open){if(event.code==='KeyE'||event.code==='Escape')this.inventory.close();return;}
    if(event.code==='Escape'){if(document.pointerLockElement===this.hud.canvas)document.exitPointerLock();return;}
    if(this.paused)return;
    if(event.code==='KeyE'){this.openInventory('personal');return;}
    if(event.code==='KeyM'){this.openMap();return;}
    if(event.code==='KeyF'){this.useSelected();return;}
    if(event.code==='KeyV'){this.vehicles.toggleMount(this.player.position);this.updateAdvancedInfo();void this.saveNow();return;}
    if(event.code.startsWith('Digit')){const n=Number(event.code.slice(5));if(n>=1&&n<=9){this.hud.select(n-1);void this.saveNow();}}
    else if(event.code==='KeyQ'){this.hud.cycleTool();void this.saveNow();}
    else this.player.keys.add(event.code);
    if(['Space','ArrowUp','ArrowDown'].includes(event.code))event.preventDefault();
  }
  private mouseDown(event:MouseEvent){if(this.paused||this.inventory.open||this.trade.open||this.navigation.open||this.life.dead)return;if(event.button===0){this.leftHeld=true;this.firstPerson.triggerSwing();}if(event.button===2)void this.place();}
  private seedChestLoot(key:string){if(this.items.chests.has(key)||this.items.generatedLoot.has(key))return;
    const [x,y,z]=key.split(',').map(Number),site=this.world.generator.structures.lootSite(x!,y!,z!);
    if(!site)return;this.items.chest(key).load(lootFor(site,this.world.seed));this.items.generatedLoot.add(key);void this.saveNow();
  }
  private openInventory(mode:InventoryMode,cell=''){
    if(mode==='chest')this.seedChestLoot(cell);
    this.leftHeld=false;this.inventory.openPanel(mode,cell);this.hud.setPaused(false);
    if(document.pointerLockElement===this.hud.canvas)document.exitPointerLock();
  }
  private openMap(){this.leftHeld=false;this.player.keys.clear();this.navigation.update(this.player.position,this.player.yaw,this.world.generator.structures);
    this.navigation.openPanel();if(document.pointerLockElement===this.hud.canvas)document.exitPointerLock();}
  private openTrade(creature:Creature){this.leftHeld=false;this.player.keys.clear();this.trade.openPanel(creature);
    if(document.pointerLockElement===this.hud.canvas)document.exitPointerLock();}
  private snapshot():GameSave{return {version:1,position:this.player.position.toArray() as [number,number,number],yaw:this.player.yaw,pitch:this.player.pitch,items:this.items.snapshot(),life:this.life.snapshot(),cycle:this.cycle.snapshot(),exploration:this.exploration.snapshot(),villages:this.villages.snapshot(),vehicles:this.vehicles.snapshot(),effects:this.effects.snapshot(),realm:this.realm,realmPositions:this.realmPositions,realmVehicles:{...this.realmVehicles,[this.realm]:this.vehicles.snapshot()},drops:this.drops.filter(drop=>!isEmpty(drop.item)).map(drop=>({item:{...drop.item},position:drop.mesh.position.toArray() as [number,number,number],age:drop.age}))};}
  private saveNow():Promise<void>{
    if(!this.loaded||this.saveBlocked)return this.saveQueue;
    const seed=this.worldInfo.id,save=this.snapshot();
    this.saveQueue=this.saveQueue.then(()=>this.store.saveGame(seed,save)).catch(error=>{this.hud.showNotice(`Save failed: ${String(error)}`);});
    return this.saveQueue;
  }
  private async changeSettings(seed:number,distance:number,sensitivity:number):Promise<void>{
    if(!Number.isFinite(seed)||!Number.isFinite(sensitivity))return;
    if(typeof this.worldInfo.id==='string'&&seed!==this.worldInfo.seed){this.hud.showNotice('Create a new world to change its seed');this.hud.setSettings(this.worldInfo.seed,distance,sensitivity);seed=this.worldInfo.seed;}
    const info=seed===this.worldInfo.seed?this.worldInfo:{id:seed,name:`World ${seed}`,seed,difficulty:'normal' as Difficulty,mode:'survival' as Mode,updatedAt:Date.now()};
    await this.store.ensureWorld(info);await this.loadWorld(info,distance,sensitivity);
  }
  private async newWorld(name:string,seed:number,difficulty:Difficulty,mode:Mode):Promise<void>{
    if(this.loadingWorld)return;
    if(!name){this.hud.showNotice('Enter a world name');return;}
    const id=`world:${crypto.randomUUID()}`,info:WorldInfo={id,name:name.slice(0,48),seed:seed|0,difficulty,mode,updatedAt:Date.now()};
    await this.store.ensureWorld(info);await this.loadWorld(info,this.hud.distance,this.hud.sensitivity);
    this.hud.showNotice(`Created ${info.name}`);
  }
  private async selectWorld(id:number|string):Promise<void>{
    const info=(await this.store.listWorlds()).find(world=>world.id===id);
    if(!info){this.hud.showNotice('Saved world unavailable');return;}
    await this.loadWorld(info,this.hud.distance,this.hud.sensitivity);
  }
  private async loadWorld(info:WorldInfo,distance:number,sensitivity:number):Promise<void>{
    if(this.loadingWorld||!Number.isFinite(sensitivity))return;this.loadingWorld=true;
    try{
    const seed=info.seed;
    this.player.sensitivity=Math.max(.03,Math.min(.5,sensitivity));
    if(this.loaded&&info.id===this.worldInfo.id&&distance===this.world.renderDistance){this.persistSettings(seed,distance,this.player.sensitivity);void this.saveNow();return;}
    await this.saveNow();this.loaded=false;this.saveBlocked=false;this.hud.showNotice('Loading world…');
    this.worldInfo=info;this.persistSettings(seed,distance,this.player.sensitivity);
    let saved=await this.store.loadGame(info.id),valid=validGameSave(saved);
    if(saved&&!valid){const backup=await this.store.loadBackup(info.id);
      if(validGameSave(backup)){saved=backup;valid=true;this.hud.showNotice('Recovered player state from backup');}
      else{this.saveBlocked=true;this.hud.showNotice('Save data invalid; original preserved, saving disabled');}}
    const position=valid?saved!.position:undefined;
    this.realm=valid&&saved!.realm==='veil'?'veil':'overworld';this.realmPositions=valid?saved!.realmPositions||{}:{};
    this.realmVehicles=valid?saved!.realmVehicles||{}:{};
    this.fluids.clear();this.automation.clear();this.farming.clear();this.litLamps.clear();
    await this.world.configure(seed,distance,position?.[0]??0,position?.[2]??0,this.realm,info.id);
    const spawn=position?new THREE.Vector3(...position):this.realm==='veil'?new THREE.Vector3(0,this.world.generator.surfaceHeight(0,0)+3,0):this.world.spawn();
    if(!this.world.isLoaded(Math.round(spawn.x),Math.round(spawn.z)))await this.world.configure(seed,distance,spawn.x,spawn.z,this.realm,info.id);
    try{this.items.load(valid?saved!.items:undefined);this.life.load(valid?saved!.life:undefined);this.cycle.load(valid?saved!.cycle:undefined,seed);
      this.exploration.load(valid?saved!.exploration:undefined);this.villages.load(valid?saved!.villages:undefined);
      this.vehicles.load(valid?saved!.realmVehicles?.[this.realm]||saved!.vehicles:undefined);this.effects.load(valid?saved!.effects:undefined);
      if(!valid){this.life.setMode(info.mode);this.life.setDifficulty(info.difficulty);}}
    catch(error){this.saveBlocked=true;this.items.reset();this.life.load(undefined);this.cycle.configure(seed);this.exploration.reset();this.villages.reset();this.hud.showNotice(`Save data could not be loaded; original preserved: ${String(error)}`);}
    this.fluids.changed(this.world.editedCells);this.automation.changed(this.world.editedCells);this.farming.changed(this.world.editedCells);this.trackLamps(this.world.editedCells);
    this.player.position.copy(spawn);this.player.yaw=valid?saved!.yaw||0:0;this.player.pitch=valid?saved!.pitch||0:0;
    this.player.object.rotation.y=this.player.yaw;this.player.camera.rotation.x=this.player.pitch;this.player.setFlight(this.life.mode==='creative');
    this.creatures.configure(seed);this.clearDrops();
    if(valid&&Array.isArray(saved!.drops))for(const drop of saved!.drops){
      if(!drop||!drop.item||!catalog.has(drop.item.id)||!Number.isInteger(drop.item.count)||drop.item.count<1||drop.item.count>item(drop.item.id).stack||
        !Array.isArray(drop.position)||drop.position.length!==3||!drop.position.every(Number.isFinite))continue;
      this.spawnItem(stack(drop.item.id,drop.item.count,Math.max(0,drop.item.damage||0)),new THREE.Vector3(...drop.position));
      this.drops[this.drops.length-1]!.age=Math.max(0,Math.min(300,drop.age||0));
    }
    this.hud.setTarget('');this.outline.visible=false;this.resetMining();this.hud.setDeath(this.life.dead);this.hud.setMode(this.life.mode);this.hud.setDifficulty(this.life.difficulty);
    this.hud.setWorld(seed,this.world.generator.biomeAt(Math.round(spawn.x),Math.round(spawn.z)),this.world.loadedCount,this.world.pendingCount);
    this.hud.setSurvival(this.life,this.cycle,this.isSnowing());this.hud.renderHotbar(this.life);this.updateLighting();this.updateLampLights();
    this.loaded=true;this.hud.setSettings(seed,distance,this.player.sensitivity);this.hud.setWorlds(await this.store.listWorlds(),info.id);this.hud.showNotice(`${info.name} ready`);
    this.updateAdvancedInfo();
    this.navigation.update(this.player.position,this.player.yaw,this.world.generator.structures);
    void this.saveNow();
    }catch(error){this.loaded=false;this.paused=true;this.hud.setPaused(true);this.hud.showNotice(`World could not load: ${String(error)}`);}
    finally{this.loadingWorld=false;}
  }
  async start(){let settings={seed:12345,distance:2,sensitivity:.18,worldId:undefined as number|string|undefined,quality:'low' as Quality,audio:{effects:.7,ambience:.45,music:0}};
    try{settings={...settings,...JSON.parse(localStorage.getItem(settingsKey)||'{}')};}catch{/* defaults */}
    settings.seed=Number.isFinite(settings.seed)?settings.seed|0:12345;
    settings.distance=Number.isFinite(settings.distance)?Math.max(2,Math.min(6,settings.distance|0)):2;
    settings.sensitivity=Number.isFinite(settings.sensitivity)?Math.max(.03,Math.min(.5,settings.sensitivity)):.18;
    if(typeof settings.worldId!=='string'&&!(typeof settings.worldId==='number'&&Number.isFinite(settings.worldId)))settings.worldId=undefined;
    let worlds=await this.store.listWorlds();
    if(!worlds.length){const seed=Number.isFinite(settings.seed)?settings.seed|0:12345;
      await this.store.ensureWorld({id:seed,name:`World ${seed}`,seed,difficulty:'normal',mode:'survival',updatedAt:Date.now()});worlds=await this.store.listWorlds();}
    this.worldInfo=worlds.find(world=>world.id===settings.worldId)||worlds.find(world=>world.id===settings.seed)||worlds[0]!;
    const audio={effects:audioLevel(settings.audio?.effects),ambience:audioLevel(settings.audio?.ambience),music:audioLevel(settings.audio?.music)};
    this.hud.setSettings(this.worldInfo.seed,settings.distance,settings.sensitivity);this.hud.setVisualSettings(parseQuality(settings.quality),audio);
    this.applyVisualSettings(parseQuality(settings.quality),audio);await this.loadWorld(this.worldInfo,settings.distance,settings.sensitivity);this.running=true;this.frame();}
  private setMode(mode:Mode){if(this.life.dead)return;this.life.setMode(mode);this.worldInfo.mode=mode;this.player.setFlight(mode==='creative');this.hud.setMode(mode);this.hud.setSurvival(this.life,this.cycle,this.isSnowing());this.hud.renderHotbar(this.life);void this.saveNow();}
  private useSelected(){if(this.life.mode==='creative'||this.life.dead)return;const held=this.items.selectedStack();if(isEmpty(held))return;
    if(this.effects.use(held.id)||held.id==='mend_tonic'){if(held.id==='mend_tonic')this.life.heal(8);
      this.items.spendSelected();this.hud.renderHotbar(this.life);this.hud.setSurvival(this.life,this.cycle,this.isSnowing());this.updateAdvancedInfo();void this.saveNow();return;}
    const def=item(held.id);if(this.life.eat(def.nutrition||0,def.saturationGain||0,def.healing||0)){this.items.spendSelected();this.hud.renderHotbar(this.life);this.hud.setSurvival(this.life,this.cycle,this.isSnowing());void this.saveNow();}}
  private sleepAt(x:number,y:number,z:number){if(this.world.get(x,y,z)!==Block.Bed)return;this.life.bed={x,y,z};const slept=this.cycle.sleep();
    if(slept){this.life.heal(6);this.life.eat(4,2);}this.hud.showNotice(slept?'Spawn set · morning has arrived':'Spawn set · sleep at night');void this.saveNow();}
  private async crossRealm(){if(this.editBusy)return;this.editBusy=true;
    const oldRealm=this.realm,oldPosition=this.player.position.clone(),seed=this.world.seed,distance=this.world.renderDistance,wasPaused=this.paused;
    await this.saveNow();this.loaded=false;this.paused=true;
    try{
      this.realmPositions[oldRealm]=oldPosition.toArray() as [number,number,number];
      this.realmVehicles[oldRealm]=this.vehicles.snapshot();this.realm=oldRealm==='overworld'?'veil':'overworld';
      const destination=this.realmPositions[this.realm];
      this.fluids.clear();this.automation.clear();this.farming.clear();this.litLamps.clear();this.creatures.clear();this.vehicles.load(this.realmVehicles[this.realm]);
      await this.world.configure(seed,distance,destination?.[0]??0,destination?.[2]??0,this.realm,this.worldInfo.id);
      const landing=destination?new THREE.Vector3(...destination):this.realm==='veil'?new THREE.Vector3(0,this.world.generator.surfaceHeight(0,0)+3,0):this.world.spawn();
      this.world.ensureLoaded(landing.x,landing.z);this.player.position.copy(landing);this.player.velocity.set(0,0,0);this.player.knockback.set(0,0,0);
      for(let offset=2;offset<=5;offset++){const gx=Math.round(landing.x)+offset,gz=Math.round(landing.z),gy=this.world.generator.surfaceHeight(gx,gz)+1;
        this.world.ensureLoaded(gx,gz);if(this.world.get(gx,gy,gz)!==Block.Air)continue;
        await this.world.apply([{x:gx,y:gy,z:gz,state:state(Block.RealmPortal)}]);break;}
      this.fluids.changed(this.world.editedCells);this.automation.changed(this.world.editedCells);this.farming.changed(this.world.editedCells);this.trackLamps(this.world.editedCells);
      this.creatures.configure(seed);this.navigation.update(this.player.position,this.player.yaw,this.world.generator.structures);
      this.hud.setWorld(seed,this.world.generator.biomeAt(Math.round(landing.x),Math.round(landing.z)),this.world.loadedCount,this.world.pendingCount);
      this.hud.setSurvival(this.life,this.cycle,this.isSnowing());this.updateLighting();this.updateLampLights();
      this.updateAdvancedInfo();
      this.hud.showNotice(this.realm==='veil'?'Entered the Veil':'Returned to the Overworld');
    }catch(error){this.realm=oldRealm;this.vehicles.load(this.realmVehicles[oldRealm]);
      await this.world.configure(seed,distance,oldPosition.x,oldPosition.z,oldRealm,this.worldInfo.id);this.player.position.copy(oldPosition);
      this.hud.showNotice(`Realm travel failed: ${String(error)}`);
    }finally{this.loaded=true;this.paused=wasPaused;this.editBusy=false;void this.saveNow();}
  }
  private takeDamage(amount:number){if(this.life.damage(this.effects.reduceDamage(amount)*(this.life.difficulty==='hard'?1.5:1))){this.sounds.hurt();this.firstPerson.triggerHurt();this.hud.setSurvival(this.life,this.cycle,this.isSnowing());if(this.life.dead)this.enterDeath();else void this.saveNow();}}
  private enterDeath(){this.leftHeld=false;this.vehicles.mounted=null;this.player.velocity.set(0,0,0);if(this.inventory.open){this.inventory.open=false;this.inventory.overlay.classList.add('hidden');}
    if(this.trade.open){this.trade.open=false;this.trade.overlay.classList.add('hidden');}
    if(this.navigation.open){this.navigation.open=false;this.navigation.overlay.classList.add('hidden');}
    const position=this.player.position.clone().add(new THREE.Vector3(0,1,0));
    const dropGrid=(grid:{snapshot:()=>Stack[];load:(s:Stack[])=>void})=>{for(const value of grid.snapshot())if(!isEmpty(value))this.spawnItem(value,position);grid.load([]);};
    dropGrid(this.items.slots);dropGrid(this.items.equipment);dropGrid(this.items.personal);
    if(!isEmpty(this.items.cursor))this.spawnItem(this.items.cursor,position);this.items.cursor=empty();
    this.hud.renderHotbar(this.life);this.hud.setDeath(true);this.hud.setPaused(false);this.paused=true;
    if(document.pointerLockElement===this.hud.canvas)document.exitPointerLock();void this.saveNow();
  }
  private respawn(){if(!this.life.dead)return;let position:THREE.Vector3|undefined;
    if(this.life.bed&&this.realm==='overworld'){const {x,y,z}=this.life.bed;this.world.ensureLoaded(x,z);if(this.world.get(x,y,z)===Block.Bed)position=new THREE.Vector3(x,y+1,z);else this.life.bed=null;}
    position??=this.realm==='veil'?new THREE.Vector3(0,this.world.generator.surfaceHeight(0,0)+3,0):this.world.spawn();
    this.world.ensureLoaded(Math.round(position.x),Math.round(position.z));
    this.player.position.copy(position);this.player.setFlight(this.life.mode==='creative');this.life.respawn();this.hud.setDeath(false);this.hud.setSurvival(this.life,this.cycle,this.isSnowing());
    void this.saveNow();void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));
  }
  private updateTarget(){const origin=new THREE.Vector3(),direction=new THREE.Vector3();this.player.camera.getWorldPosition(origin);this.player.camera.getWorldDirection(direction);
    this.target=traceBlocks(this.world,origin,direction,6,this.items.selectedStack().id==='boat');
    this.creatureTarget=this.creatures.target(origin,direction,Math.min(4.5,this.target?.distance??4.5));
    if(this.creatureTarget){const c=this.creatureTarget;this.target=null;this.hud.setTarget(`${c.inhabitant?`${c.inhabitant.occupation} · `:''}${c.def.name} · ${Math.ceil(c.health)}/${c.def.health} HP · ${c.state}${c.inhabitant?' · Right-click to trade':''}`);this.outline.visible=false;return;}
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
  private async mine(){if(!this.target||this.editBusy)return;const {x,y,z,state:hitState}=this.target;
    if(this.life.mode==='survival'&&miningRule(hitState.type).unbreakable)return;
    const drops=this.life.mode==='survival'?this.items.miningDrops(hitState.type,hitState.properties):[];
    const miningTool=this.items.activeMiningTool(),miningSlot=this.items.selected;
    const toolId=miningTool.source==='hotbar'?this.items.slots.get(miningSlot).id:miningTool.source==='equipment'?this.items.equipment.get(0).id:'';
    this.editBusy=true;
    if(hitState.type===Block.Chest)this.seedChestLoot(cellKey(x,y,z));
    const low=hitState.type===Block.Door&&(hitState.properties&4)?y-1:y;
    const changes=hitState.type===Block.Door?[{x,y:low,z,state:state(Block.Air)},{x,y:low+1,z,state:state(Block.Air)}]:[{x,y,z,state:state(Block.Air)}];
    const expected=changes.map(change=>change.y===y?hitState:this.world.getState(change.x,change.y,change.z));
    const okay=await this.world.apply(changes,expected);
    if(okay){if(this.life.mode==='survival'){
      if(miningTool.source==='hotbar'&&this.items.slots.get(miningSlot).id===toolId)this.items.slots.damage(miningSlot,1);
      else if(miningTool.source==='equipment'&&this.items.equipment.get(0).id===toolId)this.items.equipment.damage(0,1);
      for(const drop of drops)this.spawnItem(drop,new THREE.Vector3(x,y+.4,z));
      if(drops.length)this.life.experience+=[Block.Coal,Block.Copper,Block.Iron,Block.Gold].includes(hitState.type)?2:1;}
      this.releaseContainer(hitState.type,cellKey(x,low,z),new THREE.Vector3(x,y+1,z));this.sounds.play(true);this.particles.burst(new THREE.Vector3(x,y,z));this.firstPerson.triggerSwing();this.hud.showNotice(`Mined ${blockNames[hitState.type]}`);this.hud.renderHotbar(this.life);void this.saveNow();}
    this.editBusy=false;this.resetMining();
  }
  private attackCreature(){const c=this.creatureTarget;if(!c||this.attackClock>0)return;this.attackClock=.48;
    if(this.creatures.hit(c,meleeDamage(this.items),this.player.position)){this.sounds.creature();this.particles.burst(c.position,8);this.firstPerson.triggerSwing();wearWeapon(this.items);this.hud.renderHotbar(this.life);
      if(c.alive)this.hud.showNotice(`Hit ${c.def.name} · ${Math.ceil(c.health)} HP`);void this.saveNow();}
  }
  private async place(){if(this.creatureTarget?.inhabitant){this.openTrade(this.creatureTarget);return;}
    if(this.creatureTarget?.def.kind==='peaceful'&&this.items.selectedStack().id==='berries'){
      if(this.creatures.breed(this.creatureTarget)){if(this.life.mode==='survival')this.items.spendSelected();
        this.hud.renderHotbar(this.life);this.hud.showNotice('A young creature joins the herd');void this.saveNow();}return;}
    if(!this.target||this.editBusy)return;const hit=this.target,{x,y,z}=hit,key=cellKey(x,y,z);
    if(hit.state.type===Block.Bed){this.sleepAt(x,y,z);return;}
    if(hit.state.type===Block.RealmPortal){await this.crossRealm();return;}
    if(hit.state.type===Block.Switch||hit.state.type===Block.Button){await this.automation.toggle(x,y,z);return;}
    if(hit.state.type===Block.CraftingStation){this.openInventory('station',key);return;}
    if(hit.state.type===Block.Chest){this.openInventory('chest',key);return;}
    if(hit.state.type===Block.Furnace){this.openInventory('furnace',key);return;}
    if(hit.state.type===Block.Door){const low=(hit.state.properties&4)?y-1:y,a=this.world.getState(x,low,z),b=this.world.getState(x,low+1,z);if(a.type!==Block.Door||b.type!==Block.Door)return;
      this.editBusy=true;if(await this.world.apply([{x,y:low,z,state:state(Block.Door,a.properties^8)},{x,y:low+1,z,state:state(Block.Door,b.properties^8)}]))this.sounds.play(false);this.editBusy=false;return;}
    const selected=this.items.selectedStack(),type=this.life.mode==='creative'?this.life.creativeBlock:this.items.selectedBlock();
    if(selected.id==='minecart'||selected.id==='boat'){
      if(this.vehicles.place(selected.id==='minecart'?'cart':'boat',x,y,z)){if(this.life.mode==='survival')this.items.spendSelected();
        this.hud.renderHotbar(this.life);this.hud.showNotice('Vehicle placed · press V nearby to ride');void this.saveNow();}return;}
    if(this.life.mode==='survival'&&(isEmpty(selected)||type===Block.Air)||hit.normal.lengthSq()===0)return;
    const nx=x+hit.normal.x,ny=y+hit.normal.y,nz=z+hit.normal.z;
    if(ny<0||ny>=HEIGHT||!this.world.isLoaded(nx,nz)||!isReplaceable(this.world.get(nx,ny,nz)))return;
    if((type===Block.WheatCrop||type===Block.BerryCrop)&&this.world.get(nx,ny-1,nz)!==Block.Farmland)return;
    if([Block.Wire,Block.Plate,Block.Repeater,Block.Rail].includes(type)&&!isSolid(this.world.get(nx,ny-1,nz)))return;
    const forward=new THREE.Vector3();this.player.camera.getWorldDirection(forward);
    const facing=Math.abs(forward.x)>Math.abs(forward.z)?(forward.x>0?1:3):(forward.z>0?2:0);
    const properties=facing|(type===Block.Slab&&hit.normal.y<0?4:0);
    if(this.player.overlapsBlock(nx,ny,nz,state(type,properties)))return;
    const changes=[{x:nx,y:ny,z:nz,state:state(type,properties)}];
    if(type===Block.Door){if(ny+1>=HEIGHT||!isReplaceable(this.world.get(nx,ny+1,nz))||this.player.overlapsBlock(nx,ny+1,nz))return;changes.push({x:nx,y:ny+1,z:nz,state:state(type,properties|4)});}
    this.editBusy=true;if(await this.world.apply(changes)){if(this.life.mode==='survival')this.items.spendSelected();this.sounds.play(false);this.hud.renderHotbar(this.life);this.hud.showNotice(`Placed ${blockNames[type]}`);void this.saveNow();}this.editBusy=false;
  }
  private spawnItem(value:Stack,position:THREE.Vector3){if(isEmpty(value))return;const mesh=this.dropVisuals.create(value.id);mesh.position.copy(position);this.scene.add(mesh);this.drops.push({mesh,item:{...value},age:0,velocity:1.5,bob:0});}
  private removeDrop(index:number){const drop=this.drops[index]!;this.scene.remove(drop.mesh);this.drops.splice(index,1);}
  private clearDrops(){for(let i=this.drops.length-1;i>=0;i--)this.removeDrop(i);}
  private updateDrops(delta:number){for(let i=this.drops.length-1;i>=0;i--){const d=this.drops[i]!;d.age+=delta;d.mesh.rotation.y+=delta*1.3;if(d.age>300){this.removeDrop(i);continue;}
    const physicalY=d.mesh.position.y-d.bob;d.velocity-=16*delta;const next=physicalY+d.velocity*delta;
    const b=this.world.get(Math.round(d.mesh.position.x),Math.floor(next+.36),Math.round(d.mesh.position.z));
    const resting=b!==Block.Air&&b!==Block.Water;if(resting)d.velocity=0;
    d.bob=resting?Math.sin(d.age*2.7)*.045:0;d.mesh.position.y=(resting?physicalY:next)+d.bob;
    const p=this.player.position,dx=d.mesh.position.x-p.x,dy=d.mesh.position.y-p.y-1,dz=d.mesh.position.z-p.z;
    if(d.age>.4&&dx*dx+dy*dy+dz*dz<1.7**2){const left=this.items.slots.add(d.item.id,d.item.count,d.item.damage);if(left<d.item.count){d.item.count=left;this.hud.renderHotbar(this.life);void this.saveNow();if(!left){this.hud.showNotice(`Collected ${item(d.item.id).name}`);this.removeDrop(i);}}}
  }}
  private isSnowing(){const p=this.player.position;return this.world.generator.biomeAt(Math.round(p.x),Math.round(p.z))===Biome.Snow;}
  private outdoors(){const p=this.player.position;return p.y>=this.world.generator.surfaceHeight(Math.round(p.x),Math.round(p.z))+1;}
  private updateSurvival(delta:number){const previous=this.cycle.flash;this.cycle.tick(delta);const snow=this.isSnowing();
    this.weather.update(this.player.position,this.cycle.weather,snow,this.cycle.intensity,delta,this.world.generator.biomeAt(Math.round(this.player.position.x),Math.round(this.player.position.z)));
    this.sounds.setWeather(this.cycle.weather==='clear'?0:this.cycle.intensity);
    if(previous<.9&&this.cycle.flash>=.9){this.sounds.thunder();if(this.outdoors()&&!this.life.dead)this.takeDamage(2);}
    if(!this.life.dead){const p=this.player.position,camera=this.player.camera,head=this.world.get(Math.round(p.x),Math.round(p.y+camera.position.y),Math.round(p.z));
      const chest=this.world.get(Math.round(p.x),Math.round(p.y+1),Math.round(p.z));const biome=this.world.generator.biomeAt(Math.round(p.x),Math.round(p.z));
      const cold=snow&&this.cycle.intensity>.4&&this.outdoors();const hot=biome===Biome.Desert&&this.cycle.daylight>.7&&this.life.hunger<=8;
      this.life.tick(delta,this.player.keys.has('ShiftLeft'),this.player.headSubmerged,isSolid(head)&&head!==Block.Bed||isSolid(chest)&&chest!==Block.Bed,cold,hot);
      if([Block.Lava,Block.LavaFlow].includes(head)||[Block.Lava,Block.LavaFlow].includes(chest)){
        this.lavaClock+=delta;if(this.lavaClock>=1){this.lavaClock=0;this.takeDamage(4);}
      }else this.lavaClock=0;
      if(this.life.dead)this.enterDeath();}
    this.hudClock+=delta;if(this.hudClock>=.1){this.hudClock=0;this.hud.setSurvival(this.life,this.cycle,snow);}
    this.lightClock+=delta;if(this.lightClock>=.2){this.lightClock=0;this.updateLighting();}
  }
  private updateLighting(){const daylight=this.cycle.daylight,storm=this.cycle.intensity*(this.cycle.weather==='storm'?.35:.13);
    const b=THREE.MathUtils.clamp(daylight*(1-storm)+this.cycle.flash*.5,0,1);
    this.sun.intensity=.03+b*1.9;this.moon.intensity=.06+(1-daylight)*.45;this.ambient.intensity=.45+b*1.0;
    const sunX=Math.cos(this.cycle.time*Math.PI*2)*85,sunY=Math.sin(this.cycle.time*Math.PI*2)*95;
    this.sun.position.set(this.player.position.x+sunX,this.player.position.y+sunY,this.player.position.z+35);
    this.sun.target.position.copy(this.player.position);this.sun.target.updateMatrixWorld();
    const sky=this.realm==='veil'?new THREE.Color('#322653').lerp(new THREE.Color('#75589a'),b*.6):new THREE.Color('#263e67').lerp(new THREE.Color('#91bde3'),b);
    const biome=this.world.generator.biomeAt(Math.round(this.player.position.x),Math.round(this.player.position.z));
    const horizon=sky.clone().lerp(new THREE.Color(biome===Biome.Desert?'#e6bd92':biome===Biome.Swamp?'#8baf9c':biome===Biome.Snow?'#d2e1ed':'#b6c7bf'),b*.65);
    this.airSky.copy(sky);this.airFog.copy(horizon);
    this.sky.update(this.player.position,sky,horizon,sky.clone().multiplyScalar(.55),new THREE.Vector3(sunX,sunY,35),b);
  }
  private updateWaterView(delta:number){this.waterBlend+=(Number(this.player.headSubmerged)-this.waterBlend)*(1-Math.exp(-5*delta));
    if(this.waterBlend<.001)this.waterBlend=0;
    const fog=this.scene.fog as THREE.Fog;
    fog.near=THREE.MathUtils.lerp(75,1.5,this.waterBlend);fog.far=THREE.MathUtils.lerp(145,18,this.waterBlend);
    fog.color.copy(this.airFog).lerp(this.deepBlue,this.waterBlend);
    (this.scene.background as THREE.Color).copy(this.airSky).lerp(this.deepBlue,this.waterBlend);
    this.waterEffects.update(delta,this.player.position,this.player.headSubmerged);
    this.world.animateWater(delta);
  }
  private frame=()=>{if(!this.running)return;requestAnimationFrame(this.frame);const delta=Math.min(this.clock.getDelta(),.12);
    if(!this.paused){
      this.attackClock=Math.max(0,this.attackClock-delta);
      if(!this.inventory.open&&!this.trade.open&&!this.navigation.open&&!this.life.dead){
        if(!this.vehicles.tick(delta,this.player.keys,this.player.yaw,this.player.position))this.player.update(delta);
        const moving=[...'WASD'].some(key=>this.player.keys.has(`Key${key}`));
        const sprinting=this.player.keys.has('ShiftLeft')||this.player.keys.has('ShiftRight');
        const equipped=this.items.equipment.get(3),held=this.items.selectedStack();
        const activeTool=this.items.activeMiningTool().category;
        const viewTool=activeTool==='hand'&&(!isEmpty(equipped)||!isEmpty(held)&&!!item(held.id).attack)?'weapon':activeTool;
        this.firstPerson.setTool(viewTool);this.firstPerson.update(delta,moving,sprinting,this.leftHeld&&!!this.target);
        if(moving&&this.player.grounded){this.stepClock+=delta;if(this.stepClock>(sprinting?.32:.46)){this.stepClock=0;this.sounds.footstep();}}else this.stepClock=0;
        this.updateTarget();
        const hit=this.target,active=this.items.activeMiningTool();
        const k=hit?`${cellKey(hit.x,hit.y,hit.z)}:${active.source}:${active.source==='hotbar'?this.items.selectedStack().id:active.source==='equipment'?this.items.equipment.get(0).id:''}`:'';
        if(this.leftHeld&&this.creatureTarget){this.attackCreature();this.resetMining();}
        else if(this.leftHeld&&hit&&!this.editBusy){
          const duration=this.life.mode==='creative'?0:this.items.miningTime(hit.state.type),progress=this.mining.advance(k,delta,duration);
          this.hud.setProgress(progress);this.cracks.visible=progress>0&&progress<1;this.cracks.geometry.setDrawRange(0,Math.min(10,Math.ceil(progress*10))*12);
          this.cracks.position.copy(this.outline.position);this.cracks.scale.copy(this.outline.scale);
          if(progress>=1)void this.mine();}
        else if(!this.editBusy)this.resetMining();
        this.updateDrops(delta);
      }
      this.world.update(this.player.position.x,this.player.position.z,delta);
      this.fluids.tick(delta);this.automation.tick(delta,this.player.position);this.farming.tick(delta);
      this.effects.tick(delta);this.player.speedMultiplier=this.effects.swift>0?1.45:1;
      for(const furnace of this.items.furnaces.values())furnace.tick(delta);
      this.updateSurvival(delta);
      this.sky.mesh.position.copy(this.player.position);this.particles.update(delta);this.updateWaterView(delta);
      this.villageClock+=delta;if(this.villageClock>=1.5){this.villageClock=0;
        for(const site of this.world.generator.structures.nearby(this.player.position.x,this.player.position.z,42)){
          this.creatures.ensureVillage(site,this.villages.deceased);
          if(this.life.difficulty!=='peaceful')this.creatures.ensureDungeon(site,this.exploration.defeated);
        }}
      this.creatures.update(delta,this.player.position,this.cycle.daylight,!this.life.dead&&this.life.mode==='survival',this.cycle.hour,this.life.difficulty);
      this.navigationClock+=delta;if(this.navigationClock>=1){this.navigationClock=0;
        const p=this.player.position;this.hud.setWorld(this.world.seed,this.world.generator.biomeAt(Math.round(p.x),Math.round(p.z)),this.world.loadedCount,this.world.pendingCount);
        this.updateLampLights();
        this.updateAdvancedInfo();
        const fresh=this.exploration.visit(this.world.generator.structures,this.player.position.x,this.player.position.z);
        for(const site of fresh){if(this.life.mode==='survival')this.life.experience+=site.kind==='vault'?8:3;
          this.hud.showNotice(`Discovered ${site.kind} · ${site.x}, ${site.z}`);void this.saveNow();}
        this.navigation.update(this.player.position,this.player.yaw,this.world.generator.structures);}
      if(this.trade.open&&(!this.trade.creature?.alive||!this.creatures.creatures.includes(this.trade.creature)))this.trade.close();
      this.saveClock+=delta;if(this.saveClock>=5){this.saveClock=0;void this.saveNow();}
      if(this.inventory.open&&this.inventory.mode==='furnace'&&Math.floor(performance.now()/250)!==Math.floor((performance.now()-delta*1000)/250))this.inventory.refreshFurnace();
    }
    if(this.paused||this.inventory.open||this.trade.open||this.navigation.open){this.idleRenderClock+=delta;if(this.idleRenderClock>=1){this.idleRenderClock=0;this.renderer.render(this.scene,this.player.camera);}}
    else {this.idleRenderClock=1;this.renderer.render(this.scene,this.player.camera);}
  };
}
const game=new Game();
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('test'))
  (window as Window&{__stonewakeGame?:Game}).__stonewakeGame=game;
game.start().catch(error=>{console.error(error);document.querySelector('#app')!.textContent=`Could not start Stonewake: ${String(error)}`;});
