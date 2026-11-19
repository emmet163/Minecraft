import { type BlockState } from '../world/blocks';
import type {ItemsSave} from '../items/items';
import type {LifeSave,CycleSave} from '../survival/state';
import type {ExplorationSave} from '../exploration/state';
import type {VillageSave} from '../villages/trades';
import type {VehicleSave} from '../gameplay/transport';
import type {EffectSave} from '../gameplay/effects';
import type {Difficulty,Mode} from '../survival/state';

export interface Edit { x: number; y: number; z: number; state: BlockState }
export interface EditStore {
  load(seed: number|string): Promise<Edit[]>;
  putMany(seed: number|string, edits: Edit[]): Promise<void>;
}
export interface GameSave {version:1;position:[number,number,number];yaw:number;pitch:number;items:ItemsSave;life:LifeSave;cycle:CycleSave;
  drops?:{item:{id:string;count:number;damage:number};position:[number,number,number];age:number}[];
  exploration?:ExplorationSave;villages?:VillageSave;vehicles?:VehicleSave;effects?:EffectSave;
  realm?:'overworld'|'veil';realmPositions?:Partial<Record<'overworld'|'veil',[number,number,number]>>;
  realmVehicles?:Partial<Record<'overworld'|'veil',VehicleSave>>}
export interface WorldInfo{id:number|string;name:string;seed:number;difficulty:Difficulty;mode:Mode;updatedAt:number}
export function validGameSave(value:unknown):value is GameSave{
  if(!value||typeof value!=='object')return false;
  const save=value as Partial<GameSave>,items=save.items,life=save.life,cycle=save.cycle;
  return save.version===1&&Array.isArray(save.position)&&save.position.length===3&&save.position.every(Number.isFinite)&&
    Number.isFinite(save.yaw)&&Number.isFinite(save.pitch)&&!!items&&Array.isArray(items.slots)&&Array.isArray(items.equipment)&&
    Array.isArray(items.personal)&&Array.isArray(items.stations)&&Array.isArray(items.chests)&&Array.isArray(items.furnaces)&&
    [items.stations,items.chests,items.furnaces].every(collection=>collection.every(entry=>Array.isArray(entry)&&typeof entry[0]==='string'&&entry.length===2))&&
    !!life&&[life.health,life.hunger,life.saturation,life.oxygen,life.experience].every(Number.isFinite)&&
    !!cycle&&[cycle.day,cycle.time,cycle.step,cycle.clock,cycle.intensity].every(Number.isFinite)&&
    (!save.exploration||Array.isArray(save.exploration.discovered)&&(!save.exploration.defeated||Array.isArray(save.exploration.defeated)))&&
    (!save.villages||Array.isArray(save.villages.trades)&&Array.isArray(save.villages.deceased))&&
    (!save.vehicles||Array.isArray(save.vehicles.vehicles));
}
type WorldRecord={seed:number|string;world?:WorldInfo;save?:GameSave;backup?:GameSave};
const legacyWorld=(id:number|string,save?:GameSave):WorldInfo=>({id,name:`World ${id}`,seed:Number(id)|0,
  difficulty:save?.life?.difficulty||'normal',mode:save?.life?.mode||'survival',updatedAt:0});
export class MemoryEditStore implements EditStore {
  private data=new Map<string,Edit>();
  async load(seed: number|string): Promise<Edit[]> {
    return [...this.data].filter(([key])=>key.startsWith(`${seed}:`)).map(([,edit])=>({...edit,state:{...edit.state}}));
  }
  async putMany(seed: number|string, edits: Edit[]): Promise<void> {
    for(const edit of edits) this.data.set(`${seed}:${edit.x}:${edit.y}:${edit.z}`,{...edit,state:{...edit.state}});
  }
}
export class IndexedDbEditStore implements EditStore {
  private db?: Promise<IDBDatabase>;
  private fallback=new MemoryEditStore();
  private memoryGames=new Map<number|string,WorldRecord>();
  durable=true;
  onFailure:(message:string)=>void=console.warn;
  private fail(error:unknown){if(this.durable){this.durable=false;this.onFailure(`Browser storage unavailable; progress is temporary: ${String(error)}`);}}
  private open(): Promise<IDBDatabase> {
    return this.db ??= new Promise((resolve,reject)=>{
      const request=indexedDB.open('stonewake-web-edits',2);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains('edits')){
          const store=request.result.createObjectStore('edits',{keyPath:['seed','x','y','z']});
          store.createIndex('seed','seed');
        }
        if(!request.result.objectStoreNames.contains('players'))request.result.createObjectStore('players',{keyPath:'seed'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async load(seed: number|string): Promise<Edit[]> {
    if(!this.durable)return this.fallback.load(seed);
    try {const db=await this.open();
    return await new Promise<Edit[]>((resolve,reject)=>{
      const transaction=db.transaction('edits','readonly');
      const request=transaction.objectStore('edits').index('seed').getAll(IDBKeyRange.only(seed));
      request.onsuccess=()=>resolve((request.result as Array<Edit & {seed: number}>).map(({x,y,z,state})=>({x,y,z,state})));
      request.onerror=()=>reject(request.error);
    });}catch(error){this.fail(error);return this.fallback.load(seed);}
  }
  async putMany(seed: number|string, edits: Edit[]): Promise<void> {
    if(!this.durable)return this.fallback.putMany(seed,edits);
    try {const db=await this.open();
    await new Promise<void>((resolve,reject)=>{
      const transaction=db.transaction('edits','readwrite');
      for(const edit of edits) transaction.objectStore('edits').put({seed,...edit});
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error);
    });}catch(error){this.fail(error);await this.fallback.putMany(seed,edits);}
  }
  async listWorlds():Promise<WorldInfo[]>{
    const records:WorldRecord[]=this.durable?await this.readAllWorlds():[...this.memoryGames.values()];
    return records.map(record=>{const base=record.world||legacyWorld(record.seed,record.save);
      const mode:Mode=record.save?.life?.mode==='creative'||!record.save&&base.mode==='creative'?'creative':'survival';
      const savedDifficulty=record.save?.life?.difficulty;
      const difficulty:Difficulty=savedDifficulty==='peaceful'||savedDifficulty==='hard'||savedDifficulty==='normal'?savedDifficulty:
        base.difficulty==='peaceful'||base.difficulty==='hard'?base.difficulty:'normal';
      return {...base,id:record.seed,name:typeof base.name==='string'&&base.name.trim()?base.name.slice(0,48):`World ${record.seed}`,
        seed:Number.isFinite(base.seed)?base.seed|0:Number(record.seed)|0,updatedAt:Number.isFinite(base.updatedAt)?base.updatedAt:0,
        mode,difficulty};})
      .sort((a,b)=>b.updatedAt-a.updatedAt);
  }
  private async readAllWorlds():Promise<WorldRecord[]>{
    try{const db=await this.open();return await new Promise<WorldRecord[]>((resolve,reject)=>{
      const request=db.transaction('players','readonly').objectStore('players').getAll();
      request.onsuccess=()=>resolve(request.result as WorldRecord[]);request.onerror=()=>reject(request.error);
    });}catch(error){this.fail(error);return [...this.memoryGames.values()];}
  }
  async ensureWorld(world:WorldInfo):Promise<void>{
    if(!this.durable){if(!this.memoryGames.has(world.id))this.memoryGames.set(world.id,{seed:world.id,world});return;}
    try{const db=await this.open();await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('players','readwrite'),store=tx.objectStore('players'),request=store.get(world.id);
      request.onsuccess=()=>{if(!request.result)store.put({seed:world.id,world});};
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}catch(error){this.fail(error);this.memoryGames.set(world.id,{seed:world.id,world});}
  }
  async loadGame(seed:number|string):Promise<GameSave|undefined>{
    if(!this.durable)return this.memoryGames.get(seed)?.save;
    try{const db=await this.open();return await new Promise<GameSave|undefined>((resolve,reject)=>{
      const request=db.transaction('players','readonly').objectStore('players').get(seed);
      request.onsuccess=()=>resolve(request.result?.save as GameSave|undefined);
      request.onerror=()=>reject(request.error);
    });}catch(error){this.fail(error);return this.memoryGames.get(seed)?.save;}
  }
  async loadBackup(seed:number|string):Promise<GameSave|undefined>{
    if(!this.durable)return this.memoryGames.get(seed)?.backup;
    try{const db=await this.open();return await new Promise<GameSave|undefined>((resolve,reject)=>{
      const request=db.transaction('players','readonly').objectStore('players').get(seed);
      request.onsuccess=()=>resolve(request.result?.backup as GameSave|undefined);request.onerror=()=>reject(request.error);
    });}catch(error){this.fail(error);return this.memoryGames.get(seed)?.backup;}
  }
  async saveGame(seed:number|string,save:GameSave):Promise<void>{
    if(!this.durable){const previous=this.memoryGames.get(seed);this.memoryGames.set(seed,{seed,world:previous?.world||legacyWorld(seed,save),save:structuredClone(save),backup:validGameSave(previous?.save)?previous.save:previous?.backup});return;}
    try{const db=await this.open();await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('players','readwrite'),store=tx.objectStore('players'),request=store.get(seed);
      request.onsuccess=()=>{const previous=request.result as WorldRecord|undefined;
        store.put({seed,world:{...(previous?.world||legacyWorld(seed,save)),updatedAt:Date.now()},save,
          backup:validGameSave(previous?.save)?previous.save:previous?.backup});};
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}catch(error){this.fail(error);const previous=this.memoryGames.get(seed);
      this.memoryGames.set(seed,{seed,world:previous?.world||legacyWorld(seed,save),save:structuredClone(save),backup:validGameSave(previous?.save)?previous.save:previous?.backup});}
  }
}
