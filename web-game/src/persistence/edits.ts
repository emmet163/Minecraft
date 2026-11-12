import { type BlockState } from '../world/blocks';

export interface Edit { x: number; y: number; z: number; state: BlockState }
export interface EditStore {
  load(seed: number): Promise<Edit[]>;
  putMany(seed: number, edits: Edit[]): Promise<void>;
}
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
  private open(): Promise<IDBDatabase> {
    return this.db ??= new Promise((resolve,reject)=>{
      const request=indexedDB.open('stonewake-web-edits',1);
      request.onupgradeneeded=()=>{
        const store=request.result.createObjectStore('edits',{keyPath:['seed','x','y','z']});
        store.createIndex('seed','seed');
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async load(seed: number): Promise<Edit[]> {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('edits','readonly');
      const request=transaction.objectStore('edits').index('seed').getAll(IDBKeyRange.only(seed));
      request.onsuccess=()=>resolve((request.result as Array<Edit & {seed: number}>).map(({x,y,z,state})=>({x,y,z,state})));
      request.onerror=()=>reject(request.error);
    });
  }
  async putMany(seed: number, edits: Edit[]): Promise<void> {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('edits','readwrite');
      for(const edit of edits) transaction.objectStore('edits').put({seed,...edit});
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error);
    });
  }
}
