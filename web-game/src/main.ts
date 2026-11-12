import * as THREE from 'three';
import './style.css';
import { Block, blockNames, dropType, isReplaceable, miningSeconds, state } from './world/blocks';
import { VoxelWorld } from './world/world';
import { IndexedDbEditStore } from './persistence/edits';
import { PlayerController } from './player/controller';
import { traceBlocks, type Hit } from './world/raycast';
import { Hud } from './ui/hud';
import { HEIGHT } from './world/chunk';
import { BlockSounds } from './render/sounds';

type Drop={mesh:THREE.Mesh;block:Block;age:number;velocity:number};
const settingsKey='stonewake-web-settings';
class Game {
  readonly hud=new Hud();
  readonly scene=new THREE.Scene();
  readonly renderer=new THREE.WebGLRenderer({canvas:this.hud.canvas,antialias:true});
  readonly world=new VoxelWorld(new IndexedDbEditStore());
  readonly player=new PlayerController(this.world);
  readonly clock=new THREE.Clock();
  readonly outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025,1.025,1.025)),
    new THREE.LineBasicMaterial({color:'#f5dc87',depthTest:false}));
  readonly drops:Drop[]=[];
  readonly sounds=new BlockSounds();
  paused=true; private leftHeld=false; private miningKey=''; private miningTime=0;
  private target:Hit|null=null; private editBusy=false; private running=false;
  constructor() {
    this.scene.background=new THREE.Color('#91bde3');
    this.scene.fog=new THREE.Fog('#91bde3',75,145);
    this.scene.add(new THREE.HemisphereLight('#d8e8ff','#5b624f',2.2));
    const sun=new THREE.DirectionalLight('#fff3d7',2.3);
    sun.position.set(-45,95,55); this.scene.add(sun);
    this.scene.add(this.world.group,this.player.object,this.outline); this.outline.visible=false;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.resize(); window.addEventListener('resize',()=>this.resize());
    this.hud.onResume=()=>this.hud.canvas.requestPointerLock();
    this.hud.onSettings=(seed,distance,sensitivity)=>void this.changeSettings(seed,distance,sensitivity);
    this.hud.canvas.addEventListener('click',()=>{ if(this.paused) void this.hud.canvas.requestPointerLock(); });
    document.addEventListener('pointerlockchange',()=>this.setPaused(document.pointerLockElement!==this.hud.canvas));
    document.addEventListener('mousemove',event=>{if(!this.paused)this.player.look(event.movementX,event.movementY);});
    document.addEventListener('keydown',event=>this.keyDown(event));
    document.addEventListener('keyup',event=>this.player.keys.delete(event.code));
    window.addEventListener('blur',()=>{this.player.keys.clear();this.leftHeld=false;});
    this.hud.canvas.addEventListener('mousedown',event=>this.mouseDown(event));
    document.addEventListener('mouseup',event=>{if(event.button===0)this.leftHeld=false;});
    this.hud.canvas.addEventListener('wheel',event=>{event.preventDefault();if(!this.paused)this.hud.select(this.hud.selected+(event.deltaY>0?1:-1));},{passive:false});
    this.hud.canvas.addEventListener('contextmenu',event=>event.preventDefault());
    this.world.onError=message=>this.hud.showNotice(message);
  }
  private resize():void {
    const w=window.innerWidth,h=window.innerHeight;
    this.renderer.setSize(w,h,false);this.player.camera.aspect=w/h;this.player.camera.updateProjectionMatrix();
  }
  private setPaused(value:boolean):void {
    this.paused=value;this.hud.setPaused(value);this.leftHeld=false;this.miningTime=0;this.miningKey='';this.hud.setProgress(0);
    if(value)this.player.keys.clear();
  }
  private keyDown(event:KeyboardEvent):void {
    if(event.code==='Escape') { if(document.pointerLockElement===this.hud.canvas) document.exitPointerLock(); return; }
    if(this.paused)return;
    if(event.code.startsWith('Digit')) {const n=Number(event.code.slice(5));if(n>=1&&n<=9)this.hud.select(n-1);}
    else if(event.code==='KeyQ')this.hud.cycleTool();
    else this.player.keys.add(event.code);
    if(['Space','ArrowUp','ArrowDown'].includes(event.code))event.preventDefault();
  }
  private mouseDown(event:MouseEvent):void {
    if(this.paused)return;
    if(event.button===0)this.leftHeld=true;
    if(event.button===2)void this.place();
  }
  private async changeSettings(seed:number,distance:number,sensitivity:number):Promise<void> {
    if(!Number.isFinite(seed)||!Number.isFinite(sensitivity))return;
    this.player.sensitivity=Math.max(.03,Math.min(.5,sensitivity));
    localStorage.setItem(settingsKey,JSON.stringify({seed,distance,sensitivity:this.player.sensitivity}));
    this.hud.showNotice('Loading world…');
    await this.world.configure(seed,distance);
    this.hud.showNotice('Choosing spawn…');
    const spawn=this.world.spawn();
    this.hud.showNotice('Preparing spawn…');
    if(!this.world.isLoaded(Math.round(spawn.x),Math.round(spawn.z))) await this.world.configure(seed,distance,spawn.x,spawn.z);
    this.player.position.copy(spawn);this.player.velocity.set(0,0,0);
    this.clearDrops();this.hud.setTarget('');this.outline.visible=false;
    this.hud.setWorld(this.world.seed,this.world.generator.biomeAt(Math.round(spawn.x),Math.round(spawn.z)),this.world.loadedCount,this.world.pendingCount);
    this.hud.showNotice(`World ${seed} ready`);
  }
  async start():Promise<void> {
    let settings={seed:12345,distance:2,sensitivity:.18};
    try { settings={...settings,...JSON.parse(localStorage.getItem(settingsKey)||'{}')}; } catch { /* default settings */ }
    this.hud.setSettings(settings.seed,settings.distance,settings.sensitivity);
    await this.changeSettings(settings.seed,settings.distance,settings.sensitivity);
    this.running=true; this.frame();
  }
  private updateTarget():void {
    const origin=new THREE.Vector3();this.player.camera.getWorldPosition(origin);
    const direction=new THREE.Vector3();this.player.camera.getWorldDirection(direction);
    this.target=traceBlocks(this.world,origin,direction,6);
    if(this.target) {
      const {x,y,z,state:hitState}=this.target;
      this.hud.setTarget(`${blockNames[hitState.type]} · ${x}, ${y}, ${z}`);
      this.outline.position.set(x,y,z);this.outline.scale.set(1,1,1);
      if(hitState.type===Block.Slab || hitState.type===Block.Bed) {
        this.outline.scale.y=.52;this.outline.position.y+=hitState.type===Block.Bed?-.25:(hitState.properties&4)? .25:-.25;
      } else if(hitState.type===Block.Door) {
        this.outline.position.y+=(hitState.properties&4)?-.5:.5;
        this.outline.scale.y=2.025;
        const facing=((hitState.properties&3)+(hitState.properties&8?1:0))&3;
        if(facing%2===0)this.outline.scale.x=.205;else this.outline.scale.z=.205;
      }
      this.outline.visible=true;
    } else {this.hud.setTarget('');this.outline.visible=false;}
  }
  private async mine():Promise<void> {
    if(!this.target || this.editBusy)return;
    const {x,y,z,state:hitState}=this.target;
    this.editBusy=true;
    const changes=[{x,y,z,state:state(Block.Air)}];
    if(hitState.type===Block.Door) {
      const lower=(hitState.properties&4)?y-1:y;
      changes.length=0;changes.push({x,y:lower,z,state:state(Block.Air)},{x,y:lower+1,z,state:state(Block.Air)});
    }
    const okay=await this.world.apply(changes);
    if(okay) {
      this.spawnDrop(dropType(hitState.type),new THREE.Vector3(x,y+.4,z));
      this.sounds.play(true);
      this.hud.showNotice(`Mined ${blockNames[hitState.type]}`);
    }
    this.editBusy=false;this.miningTime=0;this.miningKey='';this.hud.setProgress(0);
  }
  private async place():Promise<void> {
    if(!this.target||this.editBusy)return;
    const hit=this.target,{x,y,z}=hit;
    if(hit.state.type===Block.Door) {
      const low=(hit.state.properties&4)?y-1:y;
      const a=this.world.getState(x,low,z),b=this.world.getState(x,low+1,z);
      if(a.type!==Block.Door||b.type!==Block.Door)return;
      this.editBusy=true;
      if(await this.world.apply([{x,y:low,z,state:state(Block.Door,a.properties^8)},
        {x,y:low+1,z,state:state(Block.Door,b.properties^8)}]))this.sounds.play(false);
      this.editBusy=false;return;
    }
    const slot=this.hud.slots[this.hud.selected]!;
    if(!slot.count || hit.normal.lengthSq()===0)return;
    const nx=x+hit.normal.x,ny=y+hit.normal.y,nz=z+hit.normal.z;
    if(ny<0||ny>=HEIGHT||!this.world.isLoaded(nx,nz)||!isReplaceable(this.world.get(nx,ny,nz)))return;
    const type=slot.block;
    const forward=new THREE.Vector3();this.player.camera.getWorldDirection(forward);
    const facing=Math.abs(forward.x)>Math.abs(forward.z)?(forward.x>0?1:3):(forward.z>0?2:0);
    const properties=facing|(type===Block.Slab&&hit.normal.y<0?4:0);
    if(this.player.overlapsBlock(nx,ny,nz,state(type,properties)))return;
    const changes=[{x:nx,y:ny,z:nz,state:state(type,properties)}];
    if(type===Block.Door) {
      if(ny+1>=HEIGHT||!isReplaceable(this.world.get(nx,ny+1,nz))||this.player.overlapsBlock(nx,ny+1,nz))return;
      changes.push({x:nx,y:ny+1,z:nz,state:state(type,properties|4)});
    }
    this.editBusy=true;
    if(await this.world.apply(changes)) {this.hud.spendSelected();this.sounds.play(false);this.hud.showNotice(`Placed ${blockNames[type]}`);}
    this.editBusy=false;
  }
  private spawnDrop(block:Block,position:THREE.Vector3):void {
    if(block===Block.Air)return;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.28,.28,.28),new THREE.MeshLambertMaterial({color:'#e9cc85'}));
    mesh.position.copy(position);this.scene.add(mesh);this.drops.push({mesh,block,age:0,velocity:1.5});
  }
  private clearDrops():void {for(const drop of this.drops){this.scene.remove(drop.mesh);drop.mesh.geometry.dispose();(drop.mesh.material as THREE.Material).dispose();}this.drops.length=0;}
  private updateDrops(delta:number):void {
    for(let i=this.drops.length-1;i>=0;i--){
      const drop=this.drops[i]!;drop.age+=delta;drop.mesh.rotation.y+=delta*1.3;
      if(drop.age>300){this.scene.remove(drop.mesh);drop.mesh.geometry.dispose();(drop.mesh.material as THREE.Material).dispose();this.drops.splice(i,1);continue;}
      drop.velocity-=16*delta;
      const next=drop.mesh.position.y+drop.velocity*delta;
      const floor=this.world.get(Math.round(drop.mesh.position.x),Math.floor(next-.14+.5),Math.round(drop.mesh.position.z));
      if(floor===Block.Air||floor===Block.Water)drop.mesh.position.y=next;else drop.velocity=0;
      if(drop.age>.4&&drop.mesh.position.distanceTo(this.player.position.clone().add(new THREE.Vector3(0,1,0)))<1.7){
        if(this.hud.add(drop.block,1)===0){this.hud.showNotice(`Collected ${blockNames[drop.block]}`);this.scene.remove(drop.mesh);drop.mesh.geometry.dispose();(drop.mesh.material as THREE.Material).dispose();this.drops.splice(i,1);}
      }
    }
  }
  private frame=():void=>{
    if(!this.running)return;
    requestAnimationFrame(this.frame);
    const delta=Math.min(this.clock.getDelta(),.05);
    if(!this.paused){
      this.player.update(delta);this.world.update(this.player.position.x,this.player.position.z,delta);
      this.updateTarget();this.updateDrops(delta);
      const hit=this.target,k=hit?`${hit.x},${hit.y},${hit.z}`:'';
      if(this.leftHeld&&hit&&!this.editBusy){
        if(k!==this.miningKey){this.miningKey=k;this.miningTime=0;}
        this.miningTime+=delta;
        const duration=miningSeconds(hit.state.type,this.hud.tool);
        this.hud.setProgress(Math.min(1,this.miningTime/duration));
        if(this.miningTime>=duration)void this.mine();
      } else if(!this.editBusy){this.miningKey='';this.miningTime=0;this.hud.setProgress(0);}
      const p=this.player.position;
      this.hud.setWorld(this.world.seed,this.world.generator.biomeAt(Math.round(p.x),Math.round(p.z)),this.world.loadedCount,this.world.pendingCount);
    }
    this.renderer.render(this.scene,this.player.camera);
  };
}
new Game().start().catch(error=>{console.error(error);document.querySelector('#app')!.textContent=`Could not start Stonewake: ${String(error)}`;});
