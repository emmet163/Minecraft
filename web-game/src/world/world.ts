import * as THREE from 'three';
import { Block, type BlockState, air, floorDiv, isReplaceable, state } from './blocks';
import { ChunkData, HEIGHT, PAD, SIZE } from './chunk';
import { WorldGenerator, Biome } from './generator';
import { buildChunkMesh, disposeChunk, terrainTexture } from '../render/terrain';
import { type Edit, type EditStore } from '../persistence/edits';

const key=(cx: number,cz: number)=>`${cx},${cz}`;
const editKey=(x: number,y: number,z: number)=>`${x},${y},${z}`;
const distance=(a: number,b: number,c: number,d: number)=>Math.max(Math.abs(a-c),Math.abs(b-d));
type Chunk = { data: ChunkData; group: THREE.Group };
type WorkerResult = {epoch:number;cx:number;cz:number;blocks:Uint8Array;properties:Uint8Array};
export class VoxelWorld {
  readonly group=new THREE.Group();
  private readonly texture=terrainTexture();
  private readonly opaque=new THREE.MeshLambertMaterial({map:this.texture,side:THREE.DoubleSide});
  private readonly transparent=new THREE.MeshLambertMaterial({map:this.texture,transparent:true,opacity:.64,depthWrite:false,side:THREE.DoubleSide});
  private chunks=new Map<string,Chunk>();
  private pending=new Set<string>();
  private edits=new Map<string,Edit>();
  private workers: Worker[]=[];
  private busy=new Map<Worker,{epoch:number;k:string}>();
  private epoch=0;
  private queue: Promise<void>=Promise.resolve();
  private fallClock=0;
  private fallCandidates=new Set<string>();
  private centerX=0; private centerZ=0;
  generator=new WorldGenerator(12345);
  renderDistance=2;
  onError: (message: string)=>void=console.error;
  onEdits:(changes:Edit[])=>void=()=>{};
  onChunkInstalled:(cx:number,cz:number)=>void=()=>{};
  get editedCells():ReadonlyArray<Edit>{return [...this.edits.values()];}
  constructor(readonly store: EditStore, workers=true) {
    if(workers && typeof Worker!=='undefined') for(let i=0;i<2;i++) {
      const worker=new Worker(new URL('./terrain.worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event: MessageEvent<WorkerResult>)=>this.receive(worker,event.data);
      worker.onerror=event=>{
        const job=this.busy.get(worker); this.busy.delete(worker);
        if(job?.epoch===this.epoch) this.pending.delete(job.k);
        this.onError(`Terrain worker: ${event.message}`);
        worker.terminate();this.workers=this.workers.filter(item=>item!==worker);
      };
      this.workers.push(worker);
    }
  }
  get loadedCount(): number { return this.chunks.size; }
  get pendingCount(): number { return this.pending.size; }
  get seed(): number { return this.generator.seed; }
  get storageSeed():number|string{return this.generator.realm==='veil'?`veil:${this.seed}`:this.seed;}
  private clear(): void {
    this.epoch++;
    for(const chunk of this.chunks.values()) { this.group.remove(chunk.group); disposeChunk(chunk.group); }
    this.chunks.clear(); this.pending.clear(); this.edits.clear(); this.fallCandidates.clear();
  }
  async configure(seed: number,renderDistance: number,px=0,pz=0,realm:'overworld'|'veil'='overworld'): Promise<void> {
    this.clear(); const epoch=this.epoch;
    this.generator=new WorldGenerator(seed|0,realm);
    this.renderDistance=Math.max(2,Math.min(6,renderDistance|0));
    this.centerX=floorDiv(px,SIZE); this.centerZ=floorDiv(pz,SIZE);
    const edits=await this.store.load(this.storageSeed);
    if(epoch!==this.epoch) return;
    for(const edit of edits) if(edit.y>=0 && edit.y<HEIGHT) this.edits.set(editKey(edit.x,edit.y,edit.z),edit);
    this.install(this.generator.generate(this.centerX,this.centerZ));
  }
  spawn(): THREE.Vector3 {
    let fallback: THREE.Vector3|undefined;
    for(let radius=0;radius<=256;radius+=8) for(let dz=-radius;dz<=radius;dz+=8) for(let dx=-radius;dx<=radius;dx+=8) {
      if(radius && Math.abs(dx)!==radius && Math.abs(dz)!==radius) continue;
      const h=this.generator.surfaceHeight(dx,dz);
      if(h<=44) continue;
      const candidate=new THREE.Vector3(dx,h+3,dz);
      fallback ??= candidate;
      const biome=this.generator.biomeAt(dx,dz);
      if(biome===Biome.Plains || biome===Biome.Forest) {
        const data=this.generator.generate(floorDiv(dx,SIZE),floorDiv(dz,SIZE));
        let clear=true;
        for(let z=dz-1;z<=dz+1&&clear;z++) for(let x=dx-1;x<=dx+1&&clear;x++)
          for(let y=h+1;y<=h+3;y++) if(data.world(x,y,z)===Block.Wood||data.world(x,y,z)===Block.Leaves){clear=false;break;}
        if(clear)return candidate;
      }
    }
    return fallback ?? new THREE.Vector3(0,this.generator.surfaceHeight(0,0)+3,0);
  }
  private applyEdits(data: ChunkData): void {
    const minX=data.cx*SIZE-1,maxX=(data.cx+1)*SIZE,minZ=data.cz*SIZE-1,maxZ=(data.cz+1)*SIZE;
    for(const edit of this.edits.values()) if(edit.x>=minX&&edit.x<=maxX&&edit.z>=minZ&&edit.z<=maxZ)
      data.set(edit.x-data.cx*SIZE,edit.y,edit.z-data.cz*SIZE,edit.state.type,edit.state.properties);
  }
  private install(data: ChunkData): void {
    const k=key(data.cx,data.cz); if(this.chunks.has(k)) return;
    this.applyEdits(data);
    const group=buildChunkMesh(data,this.opaque,this.transparent);
    this.group.add(group); this.chunks.set(k,{data,group});
    this.onChunkInstalled(data.cx,data.cz);
  }
  private receive(worker: Worker,result: WorkerResult): void {
    const job=this.busy.get(worker); this.busy.delete(worker);
    const k=key(result.cx,result.cz);
    if(job?.epoch===this.epoch && job.k===k) this.pending.delete(k);
    if(result.epoch!==this.epoch || distance(result.cx,result.cz,this.centerX,this.centerZ)>this.renderDistance) return;
    const data=new ChunkData(result.cx,result.cz);
    if(result.blocks.length!==PAD*HEIGHT*PAD || result.properties.length!==data.properties.length) {
      this.onError(`Invalid terrain result for ${k}`); return;
    }
    data.blocks.set(result.blocks); data.properties.set(result.properties);
    this.install(data);
  }
  update(px: number,pz: number,delta: number): void {
    this.centerX=floorDiv(px,SIZE); this.centerZ=floorDiv(pz,SIZE);
    for(const [k,chunk] of this.chunks) if(distance(chunk.data.cx,chunk.data.cz,this.centerX,this.centerZ)>this.renderDistance+1) {
      this.group.remove(chunk.group); disposeChunk(chunk.group); this.chunks.delete(k);
    }
    const candidates: [number,number][]=[];
    for(let cz=this.centerZ-this.renderDistance;cz<=this.centerZ+this.renderDistance;cz++)
      for(let cx=this.centerX-this.renderDistance;cx<=this.centerX+this.renderDistance;cx++)
        if(distance(cx,cz,this.centerX,this.centerZ)<=this.renderDistance && !this.chunks.has(key(cx,cz)) && !this.pending.has(key(cx,cz))) candidates.push([cx,cz]);
    candidates.sort((a,b)=>distance(a[0],a[1],this.centerX,this.centerZ)-distance(b[0],b[1],this.centerX,this.centerZ));
    for(const worker of this.workers) {
      if(this.busy.has(worker)) continue;
      const next=candidates.shift(); if(!next) break;
      const [cx,cz]=next; this.busy.set(worker,{epoch:this.epoch,k:key(cx,cz)}); this.pending.add(key(cx,cz));
      worker.postMessage({epoch:this.epoch,seed:this.seed,realm:this.generator.realm,cx,cz});
    }
    // Test environments without Worker still load incrementally.
    if(!this.workers.length && candidates.length) {
      const [cx,cz]=candidates[0]!; this.install(this.generator.generate(cx,cz));
    }
    this.fallClock+=delta;
    if(this.fallClock>=.14) { this.fallClock=0; this.stepGravity(); }
  }
  isLoaded(x: number,z: number): boolean { return this.chunks.has(key(floorDiv(x,SIZE),floorDiv(z,SIZE))); }
  ensureLoaded(x:number,z:number):void{const cx=floorDiv(x,SIZE),cz=floorDiv(z,SIZE);if(!this.chunks.has(key(cx,cz)))this.install(this.generator.generate(cx,cz));}
  getState(x: number,y: number,z: number): BlockState {
    const chunk=this.chunks.get(key(floorDiv(x,SIZE),floorDiv(z,SIZE)));
    return chunk?.data.getState(x-chunk.data.cx*SIZE,y,z-chunk.data.cz*SIZE) ?? air;
  }
  get(x: number,y: number,z: number): Block { return this.getState(x,y,z).type; }
  private rebuild(cx: number,cz: number): void {
    const chunk=this.chunks.get(key(cx,cz)); if(!chunk) return;
    this.group.remove(chunk.group); disposeChunk(chunk.group);
    chunk.group=buildChunkMesh(chunk.data,this.opaque,this.transparent);
    this.group.add(chunk.group);
  }
  private commit(changes: Edit[]): void {
    const rebuild=new Set<string>();
    for(const edit of changes) {
      this.edits.set(editKey(edit.x,edit.y,edit.z),edit);
      const cx=floorDiv(edit.x,SIZE),cz=floorDiv(edit.z,SIZE);
      for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++) {
        const chunk=this.chunks.get(key(cx+dx,cz+dz)); if(!chunk) continue;
        const localX=edit.x-chunk.data.cx*SIZE,localZ=edit.z-chunk.data.cz*SIZE;
        if(localX< -1||localX>SIZE||localZ< -1||localZ>SIZE)continue;
        chunk.data.set(localX,edit.y,localZ,edit.state.type,edit.state.properties);
        rebuild.add(key(chunk.data.cx,chunk.data.cz));
      }
      if(edit.state.type===Block.Sand || edit.state.type===Block.Gravel) this.fallCandidates.add(editKey(edit.x,edit.y,edit.z));
      this.fallCandidates.add(editKey(edit.x,edit.y+1,edit.z));
    }
    for(const k of rebuild) { const [cx,cz]=k.split(',').map(Number); this.rebuild(cx!,cz!); }
    this.onEdits(changes);
  }
  async apply(changes: Edit[],expected?:BlockState[]): Promise<boolean> {
    if(!changes.length || changes.some(e=>e.y<0||e.y>=HEIGHT||!this.isLoaded(e.x,e.z))) return false;
    const epoch=this.epoch,seed=this.storageSeed;
    const action=this.queue.then(async()=>{
      if(epoch!==this.epoch||expected?.some((prior,i)=>{const now=this.getState(changes[i]!.x,changes[i]!.y,changes[i]!.z);
        return prior.type!==now.type||prior.properties!==now.properties;}))return false;
      await this.store.putMany(seed,changes);
      if(epoch!==this.epoch) return false;
      this.commit(changes); return true;
    });
    this.queue=action.then(()=>{},()=>{});
    try { return await action; } catch(error) { this.onError(`Could not save world edit: ${String(error)}`); return false; }
  }
  private stepGravity(): void {
    for(const k of this.fallCandidates) {
      this.fallCandidates.delete(k);
      const [x,y,z]=k.split(',').map(Number) as [number,number,number];
      const b=this.get(x,y,z);
      if((b!==Block.Sand && b!==Block.Gravel)||y<=0||!isReplaceable(this.get(x,y-1,z))) continue;
      void this.apply([{x,y,z,state:air},{x,y:y-1,z,state:state(b)}]);
      break;
    }
  }
  dispose(): void {
    this.clear(); for(const worker of this.workers) worker.terminate(); this.workers=[]; this.busy.clear();
    this.texture.dispose(); this.opaque.dispose(); this.transparent.dispose();
  }
}
