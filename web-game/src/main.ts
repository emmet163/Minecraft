import * as THREE from 'three';
import './style.css';
import './ui/phase7.css';
import './ui/phase8.css';
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

type Drop={mesh:THREE.Mesh;item:Stack;age:number;velocity:number};
const settingsKey='stonewake-web-settings';
const cellKey=(x:number,y:number,z:number)=>`${x},${y},${z}`;
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
  readonly outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025,1.025,1.025)),new THREE.LineBasicMaterial({color:'#f5dc87',depthTest:false}));
  readonly sun=new THREE.DirectionalLight('#fff3d7',2.3);readonly moon=new THREE.DirectionalLight('#a8b8ff',0);
  readonly ambient=new THREE.HemisphereLight('#d8e8ff','#5b624f',2.2);readonly drops:Drop[]=[];
  paused=true;private leftHeld=false;private miningKey='';private miningTime=0;private target:Hit|null=null;private creatureTarget:Creature|null=null;private attackClock=0;
  private editBusy=false;private running=false;private loaded=false;private saveBlocked=false;private saveClock=0;
  private saveQueue:Promise<void>=Promise.resolve();private lightClock=0;private idleRenderClock=1;private navigationClock=1;private villageClock=1;private lavaClock=0;
  constructor(){
    this.scene.background=new THREE.Color('#91bde3');this.scene.fog=new THREE.Fog('#91bde3',75,145);
    this.sun.position.set(-45,95,55);this.moon.position.set(40,80,-45);
    this.scene.add(this.ambient,this.sun,this.moon,this.world.group,this.player.object,this.outline,this.weather.group,this.creatures.group,this.vehicles.group,...this.lampLights);this.outline.visible=false;
    this.advancedInfo.id='advanced-info';this.hud.root.append(this.advancedInfo);
    this.world.onEdits=edits=>{this.fluids.changed(edits);this.automation.changed(edits);this.farming.changed(edits);this.trackLamps(edits);};
    this.world.onChunkInstalled=(cx,cz)=>this.fluids.chunkInstalled(cx,cz);
    this.creatures.onDeath=creature=>{if(creature.inhabitant){this.villages.deceased.add(creature.inhabitant.key);this.hud.showNotice(`${creature.def.name} has fallen`);void this.saveNow();return;}
      if(creature.dungeonKey)this.exploration.defeated.add(creature.dungeonKey);
      const def=creature.def;this.spawnItem(stack(def.drop,def.dropCount),creature.position.clone().add(new THREE.Vector3(0,.5,0)));
      const rewarded=this.life.mode==='survival';if(rewarded)this.life.experience+=def.experience;
      this.hud.showNotice(`${def.name} defeated${rewarded?` · +${def.experience} XP`:''}`);void this.saveNow();};
    this.creatures.onPlayerHit=(damage,from)=>{if(this.life.mode!=='survival'||this.life.dead)return;
      const actual=absorbCreatureDamage(this.items,damage),dx=this.player.position.x-from.x,dz=this.player.position.z-from.z,length=Math.hypot(dx,dz)||1;
      this.player.knockback.set(dx/length*4,0,dz/length*4);this.takeDamage(actual);this.hud.renderHotbar(this.life);};
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.resize();window.addEventListener('resize',()=>this.resize());
    this.hud.onResume=()=>{void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.hud.onSettings=(seed,distance,sensitivity)=>void this.changeSettings(seed,distance,sensitivity);
    this.hud.onMode=mode=>this.setMode(mode);this.hud.onRespawn=()=>this.respawn();
    this.inventory.onClose=()=>{void this.saveNow();this.hud.renderHotbar(this.life);void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.inventory.onChange=()=>{this.hud.renderHotbar(this.life);void this.saveNow();};
    this.inventory.onCraft=recipe=>{if(this.life.mode==='survival')this.life.experience+=Math.max(1,recipe.count);};
    this.inventory.onDrop=value=>this.spawnItem(value,this.player.position.clone().add(new THREE.Vector3(0,1,0)));
    this.trade.onClose=()=>{void this.saveNow();void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.trade.onChange=()=>{this.hud.renderHotbar(this.life);void this.saveNow();};
    this.navigation.onClose=()=>{void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));};
    this.navigation.onTrack=()=>void this.saveNow();
    this.hud.canvas.addEventListener('click',()=>{if(this.paused&&!this.life.dead)void this.hud.canvas.requestPointerLock().then(()=>this.setPaused(false)).catch(()=>this.setPaused(true));});
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
    document.addEventListener('mouseup',event=>{if(event.button===0)this.leftHeld=false;});
    this.hud.canvas.addEventListener('wheel',event=>{event.preventDefault();if(!this.paused&&!this.inventory.open&&!this.trade.open&&!this.navigation.open){this.hud.select(this.items.selected+(event.deltaY>0?1:-1));void this.saveNow();}},{passive:false});
    this.hud.canvas.addEventListener('contextmenu',event=>event.preventDefault());
    this.world.onError=message=>this.hud.showNotice(message);this.store.onFailure=message=>this.hud.showNotice(message);
    this.player.onLand=distance=>{if(distance>4)this.takeDamage((distance-3)*1.5);};
  }
  private resize(){const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h,false);this.player.camera.aspect=w/h;this.player.camera.updateProjectionMatrix();}
  private trackLamps(edits:ReadonlyArray<{x:number;y:number;z:number;state:{type:Block;properties:number}}>){for(const edit of edits){const key=cellKey(edit.x,edit.y,edit.z);
    if(edit.state.type===Block.Lamp&&(edit.state.properties&16))this.litLamps.set(key,[edit.x,edit.y,edit.z]);else this.litLamps.delete(key);}}
  private updateLampLights(){const p=this.player.position,near=[...this.litLamps.values()].filter(([x,y,z])=>(x-p.x)**2+(y-p.y)**2+(z-p.z)**2<24**2)
    .sort((a,b)=>(a[0]-p.x)**2+(a[1]-p.y)**2+(a[2]-p.z)**2-((b[0]-p.x)**2+(b[1]-p.y)**2+(b[2]-p.z)**2));
    for(let i=0;i<this.lampLights.length;i++){const light=this.lampLights[i]!,cell=near[i];light.intensity=cell?1.8:0;if(cell)light.position.set(...cell);}}
  private updateAdvancedInfo(){this.advancedInfo.textContent=`${this.realm==='veil'?'THE VEIL':'OVERWORLD'}${this.vehicles.mounted!==null?' · Riding (V to dismount)':''}${this.effects.swift>0?' · Swift '+Math.ceil(this.effects.swift)+'s':''}${this.effects.guard>0?' · Guard '+Math.ceil(this.effects.guard)+'s':''}`;}
  private setPaused(value:boolean){this.paused=value;this.hud.setPaused(value&&!this.life.dead);this.leftHeld=false;this.miningTime=0;this.miningKey='';this.hud.setProgress(0);if(value){this.player.keys.clear();void this.saveNow();}}
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
  private mouseDown(event:MouseEvent){if(this.paused||this.inventory.open||this.trade.open||this.navigation.open||this.life.dead)return;if(event.button===0)this.leftHeld=true;if(event.button===2)void this.place();}
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
  private snapshot():GameSave{return {version:1,position:this.player.position.toArray() as [number,number,number],yaw:this.player.yaw,pitch:this.player.pitch,items:this.items.snapshot(),life:this.life.snapshot(),cycle:this.cycle.snapshot(),exploration:this.exploration.snapshot(),villages:this.villages.snapshot(),vehicles:this.vehicles.snapshot(),effects:this.effects.snapshot(),realm:this.realm,realmPositions:this.realmPositions,realmVehicles:{...this.realmVehicles,[this.realm]:this.vehicles.snapshot()}};}
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
    this.realm=valid&&saved!.realm==='veil'?'veil':'overworld';this.realmPositions=valid?saved!.realmPositions||{}:{};
    this.realmVehicles=valid?saved!.realmVehicles||{}:{};
    this.fluids.clear();this.automation.clear();this.farming.clear();this.litLamps.clear();
    await this.world.configure(seed,distance,position?.[0]??0,position?.[2]??0,this.realm);
    const spawn=position?new THREE.Vector3(...position):this.realm==='veil'?new THREE.Vector3(0,this.world.generator.surfaceHeight(0,0)+3,0):this.world.spawn();
    if(!this.world.isLoaded(Math.round(spawn.x),Math.round(spawn.z)))await this.world.configure(seed,distance,spawn.x,spawn.z,this.realm);
    try{this.items.load(valid?saved!.items:undefined);this.life.load(valid?saved!.life:undefined);this.cycle.load(valid?saved!.cycle:undefined,seed);
      this.exploration.load(valid?saved!.exploration:undefined);this.villages.load(valid?saved!.villages:undefined);
      this.vehicles.load(valid?saved!.realmVehicles?.[this.realm]||saved!.vehicles:undefined);this.effects.load(valid?saved!.effects:undefined);}
    catch(error){this.saveBlocked=true;this.items.reset();this.life.load(undefined);this.cycle.configure(seed);this.exploration.reset();this.villages.reset();this.hud.showNotice(`Save data could not be loaded; original preserved: ${String(error)}`);}
    this.fluids.changed(this.world.editedCells);this.automation.changed(this.world.editedCells);this.farming.changed(this.world.editedCells);this.trackLamps(this.world.editedCells);
    this.player.position.copy(spawn);this.player.yaw=valid?saved!.yaw||0:0;this.player.pitch=valid?saved!.pitch||0:0;
    this.player.object.rotation.y=this.player.yaw;this.player.camera.rotation.x=this.player.pitch;this.player.setFlight(this.life.mode==='creative');
    this.creatures.configure(seed);this.clearDrops();this.hud.setTarget('');this.outline.visible=false;this.hud.setDeath(this.life.dead);this.hud.setMode(this.life.mode);
    this.hud.setWorld(seed,this.world.generator.biomeAt(Math.round(spawn.x),Math.round(spawn.z)),this.world.loadedCount,this.world.pendingCount);
    this.hud.setSurvival(this.life,this.cycle,this.isSnowing());this.hud.renderHotbar(this.life);this.updateLighting();this.updateLampLights();
    this.loaded=true;this.hud.showNotice(`World ${seed} ready`);
    this.updateAdvancedInfo();
    this.navigation.update(this.player.position,this.player.yaw,this.world.generator.structures);
  }
  async start(){let settings={seed:12345,distance:2,sensitivity:.18};try{settings={...settings,...JSON.parse(localStorage.getItem(settingsKey)||'{}')};}catch{/* defaults */}
    this.hud.setSettings(settings.seed,settings.distance,settings.sensitivity);await this.changeSettings(settings.seed,settings.distance,settings.sensitivity);this.running=true;this.frame();}
  private setMode(mode:Mode){if(this.life.dead)return;this.life.setMode(mode);this.player.setFlight(mode==='creative');this.hud.setMode(mode);this.hud.setSurvival(this.life,this.cycle,this.isSnowing());this.hud.renderHotbar(this.life);void this.saveNow();}
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
      await this.world.configure(seed,distance,destination?.[0]??0,destination?.[2]??0,this.realm);
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
      await this.world.configure(seed,distance,oldPosition.x,oldPosition.z,oldRealm);this.player.position.copy(oldPosition);
      this.hud.showNotice(`Realm travel failed: ${String(error)}`);
    }finally{this.loaded=true;this.paused=wasPaused;this.editBusy=false;void this.saveNow();}
  }
  private takeDamage(amount:number){if(this.life.damage(this.effects.reduceDamage(amount))){this.hud.setSurvival(this.life,this.cycle,this.isSnowing());if(this.life.dead)this.enterDeath();else void this.saveNow();}}
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
  private async mine(){if(!this.target||this.editBusy)return;const {x,y,z,state:hitState}=this.target;this.editBusy=true;
    if(hitState.type===Block.Chest)this.seedChestLoot(cellKey(x,y,z));
    const low=hitState.type===Block.Door&&(hitState.properties&4)?y-1:y;
    const changes=hitState.type===Block.Door?[{x,y:low,z,state:state(Block.Air)},{x,y:low+1,z,state:state(Block.Air)}]:[{x,y,z,state:state(Block.Air)}];
    const okay=await this.world.apply(changes);
    if(okay){if(this.life.mode==='survival'){this.items.wearTool();
      const harvested=hitState.type===Block.WheatCrop||hitState.type===Block.BerryCrop;
      const mature=harvested&&(hitState.properties&3)===3;
      this.spawnItem(stack(blockItem(dropType(hitState.type)),mature?2:1),new THREE.Vector3(x,y+.4,z));
      if(mature)this.spawnItem(stack(hitState.type===Block.WheatCrop?'sungrain':'berries',2),new THREE.Vector3(x,y+.4,z));
      this.life.experience+=[Block.Coal,Block.Copper,Block.Iron,Block.Gold].includes(hitState.type)?2:1;}
      this.releaseContainer(hitState.type,cellKey(x,low,z),new THREE.Vector3(x,y+1,z));this.sounds.play(true);this.hud.showNotice(`Mined ${blockNames[hitState.type]}`);this.hud.renderHotbar(this.life);void this.saveNow();}
    this.editBusy=false;this.miningTime=0;this.miningKey='';this.hud.setProgress(0);
  }
  private attackCreature(){const c=this.creatureTarget;if(!c||this.attackClock>0)return;this.attackClock=.48;
    if(this.creatures.hit(c,meleeDamage(this.items),this.player.position)){wearWeapon(this.items);this.hud.renderHotbar(this.life);
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
      this.life.tick(delta,this.player.keys.has('ShiftLeft'),head===Block.Water||head===Block.WaterFlow,isSolid(head)&&head!==Block.Bed||isSolid(chest)&&chest!==Block.Bed,cold,hot);
      if([Block.Lava,Block.LavaFlow].includes(head)||[Block.Lava,Block.LavaFlow].includes(chest)){
        this.lavaClock+=delta;if(this.lavaClock>=1){this.lavaClock=0;this.takeDamage(4);}
      }else this.lavaClock=0;
      if(this.life.dead)this.enterDeath();}
    this.hud.setSurvival(this.life,this.cycle,snow);
    this.lightClock+=delta;if(this.lightClock>=.2){this.lightClock=0;this.updateLighting();}
  }
  private updateLighting(){const daylight=this.cycle.daylight,storm=this.cycle.intensity*(this.cycle.weather==='storm'?.35:.13);
    const b=THREE.MathUtils.clamp(daylight*(1-storm)+this.cycle.flash*.5,0,1);
    this.sun.intensity=.02+b*2.3;this.moon.intensity=.06+(1-daylight)*.5;this.ambient.intensity=.4+b*1.8;
    this.sun.position.set(Math.cos(this.cycle.time*Math.PI*2)*85,Math.sin(this.cycle.time*Math.PI*2)*95,35);
    const sky=this.realm==='veil'?new THREE.Color('#1c1035').lerp(new THREE.Color('#75589a'),b*.6):new THREE.Color('#0d1832').lerp(new THREE.Color('#91bde3'),b);
    (this.scene.background as THREE.Color).copy(sky);(this.scene.fog as THREE.Fog).color.copy(sky);
  }
  private frame=()=>{if(!this.running)return;requestAnimationFrame(this.frame);const delta=Math.min(this.clock.getDelta(),.05);
    if(!this.paused){
      this.attackClock=Math.max(0,this.attackClock-delta);
      if(!this.inventory.open&&!this.trade.open&&!this.navigation.open&&!this.life.dead){
        if(!this.vehicles.tick(delta,this.player.keys,this.player.yaw,this.player.position))this.player.update(delta);
        this.updateTarget();
        const hit=this.target,k=hit?cellKey(hit.x,hit.y,hit.z):'';
        if(this.leftHeld&&this.creatureTarget){this.attackCreature();this.miningTime=0;this.miningKey='';this.hud.setProgress(0);}
        else if(this.leftHeld&&hit&&!this.editBusy){if(k!==this.miningKey){this.miningKey=k;this.miningTime=0;}this.miningTime+=delta;
          const duration=this.life.mode==='creative'?0:this.items.miningTime(hit.state.type);this.hud.setProgress(duration===0?1:Math.min(1,this.miningTime/duration));
          if(this.miningTime>=duration)void this.mine();}
        else if(!this.editBusy){this.miningTime=0;this.miningKey='';this.hud.setProgress(0);}
        this.updateDrops(delta);
      }
      this.world.update(this.player.position.x,this.player.position.z,delta);
      this.fluids.tick(delta);this.automation.tick(delta,this.player.position);this.farming.tick(delta);
      this.effects.tick(delta);this.player.speedMultiplier=this.effects.swift>0?1.45:1;
      for(const furnace of this.items.furnaces.values())furnace.tick(delta);
      this.updateSurvival(delta);
      this.villageClock+=delta;if(this.villageClock>=1.5){this.villageClock=0;
        for(const site of this.world.generator.structures.nearby(this.player.position.x,this.player.position.z,42)){
          this.creatures.ensureVillage(site,this.villages.deceased);
          this.creatures.ensureDungeon(site,this.exploration.defeated);
        }}
      this.creatures.update(delta,this.player.position,this.cycle.daylight,!this.life.dead&&this.life.mode==='survival',this.cycle.hour);
      this.navigationClock+=delta;if(this.navigationClock>=1){this.navigationClock=0;
        this.updateLampLights();
        this.updateAdvancedInfo();
        const fresh=this.exploration.visit(this.world.generator.structures,this.player.position.x,this.player.position.z);
        for(const site of fresh){if(this.life.mode==='survival')this.life.experience+=site.kind==='vault'?8:3;
          this.hud.showNotice(`Discovered ${site.kind} · ${site.x}, ${site.z}`);void this.saveNow();}
        this.navigation.update(this.player.position,this.player.yaw,this.world.generator.structures);}
      if(this.trade.open&&(!this.trade.creature?.alive||!this.creatures.creatures.includes(this.trade.creature)))this.trade.close();
      this.saveClock+=delta;if(this.saveClock>=5){this.saveClock=0;void this.saveNow();}
      if(this.inventory.open&&this.items.furnaces.size&&Math.floor(performance.now()/250)!==Math.floor((performance.now()-delta*1000)/250))this.inventory.render();
      const p=this.player.position;this.hud.setWorld(this.world.seed,this.world.generator.biomeAt(Math.round(p.x),Math.round(p.z)),this.world.loadedCount,this.world.pendingCount);
    }
    if(this.paused||this.inventory.open||this.trade.open||this.navigation.open){this.idleRenderClock+=delta;if(this.idleRenderClock>=1){this.idleRenderClock=0;this.renderer.render(this.scene,this.player.camera);}}
    else {this.idleRenderClock=1;this.renderer.render(this.scene,this.player.camera);}
  };
}
const game=new Game();
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('test'))
  (window as Window&{__stonewakeGame?:Game}).__stonewakeGame=game;
game.start().catch(error=>{console.error(error);document.querySelector('#app')!.textContent=`Could not start Stonewake: ${String(error)}`;});
