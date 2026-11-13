import {describe,it,expect} from 'vitest';
import {IndexedDbEditStore,MemoryEditStore,validGameSave,type GameSave,type WorldInfo} from '../persistence/edits';
import {GameItems} from '../items/items';
import {SurvivalState,WorldCycle} from '../survival/state';
import {VoxelWorld} from '../world/world';
import {Block,state} from '../world/blocks';

const sample=():GameSave=>({version:1,position:[0,60,0],yaw:0,pitch:0,items:new GameItems().snapshot(),
  life:new SurvivalState().snapshot(),cycle:new WorldCycle().snapshot()});

describe('final world management and recovery',()=>{
  it('keeps named worlds with the same generation seed independent and recovers a player snapshot',async()=>{
    const store=new IndexedDbEditStore();store.onFailure=()=>{};
    const a:WorldInfo={id:'world:a',name:'A',seed:741852,difficulty:'hard',mode:'survival',updatedAt:1};
    const b:WorldInfo={...a,id:'world:b',name:'B',difficulty:'peaceful',updatedAt:2};
    await store.ensureWorld(a);await store.ensureWorld(b);
    expect((await store.listWorlds()).map(world=>world.id)).toEqual(['world:b','world:a']);
    const first=sample();first.position=[1,60,2];await store.saveGame(a.id,first);
    const second=sample();second.position=[3,60,4];await store.saveGame(a.id,second);
    expect((await store.loadGame(a.id))?.position).toEqual([3,60,4]);
    expect((await store.loadBackup(a.id))?.position).toEqual([1,60,2]);
    expect(await store.loadGame(b.id)).toBeUndefined();expect(validGameSave(second)).toBe(true);
    expect(validGameSave({...second,items:{slots:null}})).toBe(false);
  });
  it('restores edits at a chunk border without leaking them into another world slot',async()=>{
    const world=new VoxelWorld(new MemoryEditStore(),false);
    await world.configure(331,2,15,0,'overworld','world:first');world.ensureLoaded(16,0);
    expect(await world.apply([{x:15,y:60,z:0,state:state(Block.Glass)}])).toBe(true);
    await world.configure(331,2,15,0,'overworld','world:second');world.ensureLoaded(16,0);
    expect(world.get(15,60,0)).not.toBe(Block.Glass);
    await world.configure(331,2,15,0,'overworld','world:first');world.ensureLoaded(16,0);
    expect(world.get(15,60,0)).toBe(Block.Glass);
    const neighbour=world.group.children.find(group=>group.position.x===16);
    expect(neighbour).toBeDefined();
    await world.configure(331,2,15,0,'veil','world:first');
    expect(await world.apply([{x:15,y:60,z:0,state:state(Block.Glass)}])).toBe(true);
    await world.configure(331,2,15,0,'veil','world:second');
    expect(world.get(15,60,0)).not.toBe(Block.Glass);
    world.dispose();
  });
  it('persists difficulty and adjusts peaceful and hard survival pressure',()=>{
    const hard=new SurvivalState();hard.setDifficulty('hard');hard.tick(30,false,false,false,false,false);
    expect(hard.saturation).toBe(4);
    const peaceful=new SurvivalState();peaceful.setDifficulty('peaceful');peaceful.damage(2);
    peaceful.tick(60,false,false,false,false,false);expect(peaceful.hunger).toBe(20);expect(peaceful.health).toBeGreaterThan(18);
    const restored=new SurvivalState();restored.load(hard.snapshot());expect(restored.difficulty).toBe('hard');
  });
});
