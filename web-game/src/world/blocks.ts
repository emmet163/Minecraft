export const enum Block {
  Air, Grass, Dirt, Stone, Sand, Snow, Mud, Water, Wood, Leaves, Flower, Plant,
  Coal, Copper, Iron, Gold, GrassSide, SnowSide, Gravel, Glass, Slab, Stairs,
  Door, Fence, CraftingStation, Furnace, Chest, Bed,
  WaterFlow, Lava, LavaFlow, Wire, Switch, Button, Plate, Repeater, Lamp, Piston,
  Farmland, WheatCrop, BerryCrop, Rail, RealmPortal, GlowOre, Crystal,
}
export const blockNames = [
  'Air','Grass','Dirt','Stone','Sand','Snow','Mud','Water','Wood','Leaves','Flower','Plant',
  'Coal','Copper','Iron','Gold','Grass Side','Snow Side','Gravel','Glass','Slab','Stairs',
  'Door','Fence','Crafting Station','Furnace','Chest','Bed',
  'Flowing Water','Lava','Flowing Lava','Signal Wire','Signal Switch','Signal Button','Pressure Plate','Repeater','Signal Lamp','Piston',
  'Farmland','Wheat Crop','Berry Crop','Rail','Realm Portal','Glow Ore','Crystal',
] as const;
export interface BlockState { type: Block; properties: number }
export const air: BlockState = { type: Block.Air, properties: 0 };
export const state = (type: Block, properties = 0): BlockState => ({ type, properties });
export const isFluid=(b:Block)=>b===Block.Water||b===Block.WaterFlow||b===Block.Lava||b===Block.LavaFlow;
export const isDecorative = (b: Block) => b === Block.Plant || b === Block.Flower || b===Block.Wire || b===Block.Plate || b===Block.Rail || b===Block.WheatCrop || b===Block.BerryCrop;
export const isSolid = (b: Block) => b !== Block.Air && !isFluid(b) && !isDecorative(b) && b!==Block.RealmPortal;
export const isReplaceable = (b: Block) => b === Block.Air || isFluid(b) || isDecorative(b);
export const isTransparent = (b: Block) => isFluid(b) || b === Block.Glass || b === Block.Leaves || b===Block.RealmPortal;
export const isShaped = (b: Block) => b >= Block.Slab && b <= Block.Fence || b === Block.Bed || [Block.Wire,Block.Switch,Block.Button,Block.Plate,Block.Repeater,Block.Lamp,Block.Piston,Block.Farmland,Block.WheatCrop,Block.BerryCrop,Block.Rail,Block.RealmPortal].includes(b);
export function hardness(b: Block): number {
  if (b === Block.Air || isFluid(b) || isDecorative(b)) return .12;
  if (b === Block.Leaves) return .2;
  if (b === Block.Glass) return .35;
  if ([Block.Dirt,Block.Grass,Block.Sand,Block.Gravel,Block.Mud,Block.Snow].includes(b)) return .65;
  if ([Block.Wood,Block.Door,Block.Fence,Block.Stairs,Block.Bed].includes(b)) return 1.1;
  if ([Block.Iron,Block.Gold].includes(b)) return 2.4;
  return 1.8;
}
export type Tool = 'hand' | 'pickaxe' | 'shovel';
export function miningSeconds(b: Block, tool: Tool): number {
  const pick = [Block.Stone,Block.Slab,Block.Coal,Block.Copper,Block.Iron,Block.Gold,Block.Gravel].includes(b);
  const shovel = [Block.Dirt,Block.Grass,Block.Sand,Block.Gravel,Block.Mud,Block.Snow].includes(b);
  return Math.max(.08, hardness(b) / (tool === 'pickaxe' && pick ? 3.5 : tool === 'shovel' && shovel ? 3 : 1));
}
export function dropType(b: Block): Block { return b === Block.Grass ? Block.Dirt : b; }
export const selectableBlocks: Block[] = [Block.Grass,Block.Dirt,Block.Stone,Block.Sand,Block.Wood,Block.Leaves,Block.Glass,Block.Slab,Block.Stairs,Block.Water,Block.Lava,Block.Wire,Block.Switch,Block.Button,Block.Plate,Block.Repeater,Block.Lamp,Block.Piston,Block.Farmland,Block.WheatCrop,Block.BerryCrop,Block.Rail,Block.RealmPortal];
export interface Box { minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number }
export function collisionBoxes(s: BlockState): Box[] {
  const box=(minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number):Box=>({minX,maxX,minY,maxY,minZ,maxZ});
  if(!isSolid(s.type))return [];
  if(s.type===Block.Farmland)return [box(-.5,.5,-.5,.35,-.5,.5)];
  if(s.type===Block.Switch||s.type===Block.Button)return [box(-.25,.25,-.25,.25,-.25,.25)];
  if(s.type===Block.Slab)return [s.properties&4?box(-.5,.5,0,.5,-.5,.5):box(-.5,.5,-.5,0,-.5,.5)];
  if(s.type===Block.Bed)return [box(-.5,.5,-.5,0,-.5,.5)];
  if(s.type===Block.Door){
    const facing=((s.properties&3)+(s.properties&8?1:0))&3;
    return [facing%2===0?box(-.09,.09,-.5,.5,-.5,.5):box(-.5,.5,-.5,.5,-.09,.09)];
  }
  if(s.type===Block.Stairs){
    const facing=s.properties&3;
    const lower=box(-.5,.5,-.5,0,-.5,.5);
    const upper=facing===1?box(0,.5,0,.5,-.5,.5):facing===2?box(-.5,.5,0,.5,0,.5):
      facing===3?box(-.5,0,0,.5,-.5,.5):box(-.5,.5,0,.5,-.5,0);
    return [lower,upper];
  }
  return [box(-.5,.5,-.5,.5,-.5,.5)];
}
export function floorDiv(n: number, d: number): number { return Math.floor(n / d); }
export function cellOf(n: number): number { return Math.floor(n + .5); }
