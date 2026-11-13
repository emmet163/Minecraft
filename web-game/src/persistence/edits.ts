import { type BlockState } from '../world/blocks';
import type {ItemsSave} from '../items/items';
import type {LifeSave,CycleSave} from '../survival/state';
import type {ExplorationSave} from '../exploration/state';
import type {VillageSave} from '../villages/trades';

export interface Edit { x: number; y: number; z: number; state: BlockState }
export interface EditStore {
  load(seed: number): Promise<Edit[]>;
  putMany(seed: number, edits: Edit[]): Promise<void>;
}
export interface GameSave {version:1;position:[number,number,number];yaw:number;pitch:number;items:ItemsSave;life:LifeSave;cycle:CycleSave;
  exploration?:ExplorationSave;villages?:VillageSave}
export class MemoryEditStore implements EditStore {
  private data=new Map<string,Edit>();
  async load(seed: number): Promise<Edit[]> {
    return [...this.data].filter(([key])=>key.startsWith(`${seed}:`)).map(([,edit])=>({...edit,state:{...edit.state}}));
  }
  async putMany(seed: number, edits: Edit[]): Promise<void> {
    for(const edit of edits) this.data.set(`${seed}:${edit.x}:${edit.y}:${edit.z}`,{...edit,state:{...edit.state}});
  }
}
export class IndexedDbEditStore implements EditStore {
  private db?: Promise<IDBDatabase>;
  private fallback=new MemoryEditStore();
  private memoryGames=new Map<number,GameSave>();
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
  async load(seed: number): Promise<Edit[]> {
    if(!this.durable)return this.fallback.load(seed);
    try {const db=await this.open();
    return await new Promise<Edit[]>((resolve,reject)=>{
      const transaction=db.transaction('edits','readonly');
      const request=transaction.objectStore('edits').index('seed').getAll(IDBKeyRange.only(seed));
      request.onsuccess=()=>resolve((request.result as Array<Edit & {seed: number}>).map(({x,y,z,state})=>({x,y,z,state})));
      request.onerror=()=>reject(request.error);
    });}catch(error){this.fail(error);return this.fallback.load(seed);}
  }
  async putMany(seed: number, edits: Edit[]): Promise<void> {
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
  async loadGame(seed:number):Promise<GameSave|undefined>{
    if(!this.durable)return this.memoryGames.get(seed);
    try{const db=await this.open();return await new Promise<GameSave|undefined>((resolve,reject)=>{
      const request=db.transaction('players','readonly').objectStore('players').get(seed);
      request.onsuccess=()=>resolve(request.result?.save as GameSave|undefined);
      request.onerror=()=>reject(request.error);
    });}catch(error){this.fail(error);return this.memoryGames.get(seed);}
  }
  async saveGame(seed:number,save:GameSave):Promise<void>{
    if(!this.durable){this.memoryGames.set(seed,structuredClone(save));return;}
    try{const db=await this.open();await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('players','readwrite');tx.objectStore('players').put({seed,save});
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}catch(error){this.fail(error);this.memoryGames.set(seed,structuredClone(save));}
  }
}
