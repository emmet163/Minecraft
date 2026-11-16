import {Block,blockNames} from '../world/blocks';
import {biomeNames,type Biome} from '../world/generator';
import {GameItems,isEmpty,item} from '../items/items';
import {SurvivalState,WorldCycle,type Mode,type Difficulty} from '../survival/state';
import type {WorldInfo} from '../persistence/edits';
import {itemIconUrl} from '../render/drops';
import {parseQuality,type Quality} from '../render/quality';
import type {AudioSettings} from '../render/sounds';
export class Hud{
  readonly root=document.querySelector<HTMLElement>('#app')!;
  readonly canvas:HTMLCanvasElement;
  private progress:HTMLElement;private notice:HTMLElement;private overlay:HTMLElement;private death:HTMLElement;
  private seedInput:HTMLInputElement;private distanceInput:HTMLInputElement;private sensitivityInput:HTMLInputElement;
  onResume:()=>void=()=>{};onSettings:(seed:number,distance:number,sensitivity:number)=>void=()=>{};
  onMode:(mode:Mode)=>void=()=>{};onRespawn:()=>void=()=>{};
  onDifficulty:(difficulty:Difficulty)=>void=()=>{};
  onNewWorld:(name:string,seed:number,difficulty:Difficulty,mode:Mode)=>void=()=>{};
  onLoadWorld:(id:number|string)=>void=()=>{};
  onVisualSettings:(quality:Quality,audio:AudioSettings)=>void=()=>{};
  constructor(readonly items:GameItems){
    this.root.innerHTML=`<canvas id="game" aria-label="Stonewake 3D game"></canvas>
    <div class="topline"><strong>STONEWAKE</strong><span id="world-info"></span></div><div id="cycle-info"></div>
    <div id="target"></div><div id="crosshair">+</div><div id="mining"><div></div></div><div id="notice"></div>
    <div class="bottom"><div id="survival-bars"><div id="health-bar"></div><div id="hunger-bar"></div><div id="air-bar"></div><div id="xp-bar"></div></div>
      <div id="tool"></div><div id="hotbar"></div><small>WASD move · Space jump · Shift sprint · Ctrl crouch · Q tool · E inventory · M map · F use · V ride · Esc pause</small></div>
    <div id="overlay" class="overlay"><section class="panel"><h1>Stonewake</h1><p>Explore, gather, craft, and survive.</p>
      <button id="resume">Enter world</button>
      <div id="world-tools"><label>Saved worlds<select id="world-list" aria-label="Saved worlds"></select></label>
        <button id="load-world" type="button">Load selected world</button>
        <label>New world name<input id="new-world-name" type="text" maxlength="48" placeholder="My world"></label>
        <button id="new-world" type="button">Create new world</button></div>
      <label>World seed<input id="seed" type="number" step="1"></label>
      <label>Difficulty<select id="difficulty"><option value="peaceful">Peaceful · no hostile spawns</option><option value="normal" selected>Normal</option><option value="hard">Hard · stronger hits</option></select></label>
      <label>Game mode<select id="mode"><option value="survival">Survival</option><option value="creative">Creative · flight and unlimited blocks</option></select></label>
      <label>Render distance <output id="distance-value">2</output><input id="distance" type="range" min="2" max="6" value="2"></label>
      <label>Mouse sensitivity <output id="sensitivity-value">0.18</output><input id="sensitivity" type="range" min="0.03" max="0.5" step="0.01" value="0.18"></label>
      <label>Graphics quality<select id="quality"><option value="low">Low · faster</option><option value="medium">Medium · soft shadows</option><option value="high">High · detailed shadows</option></select></label>
      <label>Effects volume <output id="effects-value">70%</output><input id="effects-volume" type="range" min="0" max="100" value="70"></label>
      <label>Ambience volume <output id="ambience-value">45%</output><input id="ambience-volume" type="range" min="0" max="100" value="45"></label>
      <label>Music volume <output id="music-value">0%</output><input id="music-volume" type="range" min="0" max="100" value="0"></label>
      <button id="apply">Apply world settings</button><p class="help">Click to capture the mouse. Hold left click to mine; right click to place or use. E opens inventory; 1–9 select hotbar slots.</p></section></div>
    <div id="death" class="overlay hidden"><section class="panel death-panel"><h1>YOU FELL</h1><p>Your carried items remain where you died.</p><button id="respawn">Respawn (R)</button></section></div>`;
    this.canvas=this.root.querySelector('#game')!;this.progress=this.root.querySelector('#mining > div')!;this.notice=this.root.querySelector('#notice')!;
    this.overlay=this.root.querySelector('#overlay')!;this.death=this.root.querySelector('#death')!;
    this.seedInput=this.root.querySelector('#seed')!;this.distanceInput=this.root.querySelector('#distance')!;this.sensitivityInput=this.root.querySelector('#sensitivity')!;
    this.root.querySelector('#resume')!.addEventListener('click',()=>this.onResume());
    this.root.querySelector('#new-world')!.addEventListener('click',()=>this.onNewWorld(this.worldName,this.seed,this.difficulty,this.mode));
    this.root.querySelector('#load-world')!.addEventListener('click',()=>{const selected=this.root.querySelector<HTMLSelectElement>('#world-list')!.selectedOptions[0];
      if(selected)this.onLoadWorld(selected.dataset.idType==='number'?Number(selected.value):selected.value);});
    this.root.querySelector('#apply')!.addEventListener('click',()=>this.onSettings(this.seed,this.distance,this.sensitivity));
    this.root.querySelector('#respawn')!.addEventListener('click',()=>this.onRespawn());
    this.root.querySelector<HTMLSelectElement>('#mode')!.addEventListener('change',event=>this.onMode((event.target as HTMLSelectElement).value as Mode));
    this.root.querySelector<HTMLSelectElement>('#difficulty')!.addEventListener('change',event=>this.onDifficulty((event.target as HTMLSelectElement).value as Difficulty));
    this.distanceInput.addEventListener('input',()=>{this.root.querySelector('#distance-value')!.textContent=this.distanceInput.value;});
    this.sensitivityInput.addEventListener('input',()=>{this.root.querySelector('#sensitivity-value')!.textContent=this.sensitivityInput.value;});
    this.root.querySelector('#quality')!.addEventListener('change',()=>this.onVisualSettings(this.quality,this.audio));
    for(const kind of ['effects','ambience','music'] as const){const input=this.root.querySelector<HTMLInputElement>(`#${kind}-volume`)!;
      input.addEventListener('input',()=>{this.root.querySelector(`#${kind}-value`)!.textContent=`${input.value}%`;this.onVisualSettings(this.quality,this.audio);});}
    this.renderHotbar();
  }
  get seed(){return Number(this.seedInput.value)|0;}get distance(){return Number(this.distanceInput.value)|0;}get sensitivity(){return Number(this.sensitivityInput.value);}
  get worldName(){return this.root.querySelector<HTMLInputElement>('#new-world-name')!.value.trim();}
  get mode(){return this.root.querySelector<HTMLSelectElement>('#mode')!.value as Mode;}
  get difficulty(){return this.root.querySelector<HTMLSelectElement>('#difficulty')!.value as Difficulty;}
  setDifficulty(value:Difficulty){this.root.querySelector<HTMLSelectElement>('#difficulty')!.value=value;}
  setWorlds(worlds:WorldInfo[],active:number|string){const select=this.root.querySelector<HTMLSelectElement>('#world-list')!;
    select.replaceChildren(...worlds.map(world=>{const option=document.createElement('option');option.value=String(world.id);
      option.dataset.idType=typeof world.id;option.textContent=`${world.name} · seed ${world.seed}`;return option;}));select.value=String(active);}
  get quality(){return parseQuality(this.root.querySelector<HTMLSelectElement>('#quality')!.value);}
  get audio():AudioSettings{return {effects:Number(this.root.querySelector<HTMLInputElement>('#effects-volume')!.value)/100,
    ambience:Number(this.root.querySelector<HTMLInputElement>('#ambience-volume')!.value)/100,music:Number(this.root.querySelector<HTMLInputElement>('#music-volume')!.value)/100};}
  setVisualSettings(quality:Quality,audio:AudioSettings){this.root.querySelector<HTMLSelectElement>('#quality')!.value=quality;
    for(const kind of ['effects','ambience','music'] as const){const value=Math.round(audio[kind]*100);
      this.root.querySelector<HTMLInputElement>(`#${kind}-volume`)!.value=String(value);this.root.querySelector(`#${kind}-value`)!.textContent=`${value}%`;}}
  setSettings(seed:number,distance:number,sensitivity:number){this.seedInput.value=String(seed);this.distanceInput.value=String(distance);this.sensitivityInput.value=String(sensitivity);this.root.querySelector('#distance-value')!.textContent=String(distance);this.root.querySelector('#sensitivity-value')!.textContent=sensitivity.toFixed(2);}
  setMode(mode:Mode){this.root.querySelector<HTMLSelectElement>('#mode')!.value=mode;this.renderHotbar();}
  setPaused(value:boolean){this.overlay.classList.toggle('hidden',!value);}
  setDeath(value:boolean){this.death.classList.toggle('hidden',!value);}
  setTarget(value:string){this.root.querySelector('#target')!.textContent=value;}
  setProgress(value:number){this.progress.style.width=`${Math.round(value*100)}%`;this.progress.parentElement!.classList.toggle('active',value>0);}
  setWorld(seed:number,biome:Biome,loaded:number,pending:number){this.root.querySelector('#world-info')!.textContent=`Seed ${seed} · ${biomeNames[biome]} · ${loaded} chunks · ${pending} loading`;}
  showNotice(value:string){this.notice.textContent=value;this.notice.classList.add('show');setTimeout(()=>this.notice.classList.remove('show'),2200);}
  select(index:number){this.items.select(index);this.renderHotbar();}
  cycleTool(){this.items.cycleTool();this.renderHotbar();}
  renderHotbar(life?:SurvivalState){
    const creative=life?.mode==='creative';
    this.root.querySelector('#hotbar')!.innerHTML=Array.from({length:9},(_,i)=>{
      const s=this.items.slots.get(i);return `<div class="slot ${i===this.items.selected?'selected':''}" title="${isEmpty(s)?'Empty':item(s.id).description}"><kbd>${i+1}</kbd>${isEmpty(s)?'':`<img class="item-icon" src="${itemIconUrl(s.id)}" alt="">`}<b>${isEmpty(s)?'Empty':item(s.id).name}</b><em>${s.count||''}</em></div>`;
    }).join('');
    const selected=this.items.selectedStack(),weapon=this.items.equipment.get(3);
    this.root.querySelector('#tool')!.textContent=creative?`CREATIVE · ${blockNames[life!.creativeBlock]} · Space/Ctrl fly`:
      `${this.items.tool.toUpperCase()} · ${isEmpty(selected)?'Empty':item(selected.id).name}${isEmpty(weapon)?'':` · ${item(weapon.id).name} ${item(weapon.id).attack??''} attack`}`;
  }
  setSurvival(life:SurvivalState,cycle:WorldCycle,snowing:boolean){
    const visible=life.mode==='survival';this.root.querySelector<HTMLElement>('#survival-bars')!.style.display=visible?'flex':'none';
    this.root.querySelector('#health-bar')!.textContent=`HEALTH ${life.health.toFixed(0)}/20`;
    this.root.querySelector('#hunger-bar')!.textContent=`HUNGER ${life.hunger.toFixed(0)}/20`;
    const air=this.root.querySelector<HTMLElement>('#air-bar')!;air.textContent=`AIR ${life.oxygen.toFixed(1)}/10`;air.style.display=life.oxygen<10?'block':'none';
    this.root.querySelector('#xp-bar')!.textContent=`LEVEL ${life.level} · XP ${life.experience}`;
    const weather=cycle.weather==='clear'?'Clear':snowing?'Snow':cycle.weather==='storm'?'Thunderstorm':'Rain';
    this.root.querySelector('#cycle-info')!.textContent=`Day ${cycle.day} · ${String(cycle.hour).padStart(2,'0')}:00 · ${weather}`;
  }
}
