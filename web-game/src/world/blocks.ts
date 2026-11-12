export const enum Block {
  Air, Grass, Dirt, Stone, Sand, Snow, Mud, Water, Wood, Leaves, Flower, Plant,
  Coal, Copper, Iron, Gold, GrassSide, SnowSide, Gravel, Glass, Slab, Stairs,
  Door, Fence, CraftingStation, Furnace, Chest, Bed,
}
export const blockNames = [
  'Air','Grass','Dirt','Stone','Sand','Snow','Mud','Water','Wood','Leaves','Flower','Plant',
  'Coal','Copper','Iron','Gold','Grass Side','Snow Side','Gravel','Glass','Slab','Stairs',
  'Door','Fence','Crafting Station','Furnace','Chest','Bed',
] as const;
export interface BlockState { type: Block; properties: number }
export const air: BlockState = { type: Block.Air, properties: 0 };
export const state = (type: Block, properties = 0): BlockState => ({ type, properties });
export const isDecorative = (b: Block) => b === Block.Plant || b === Block.Flower;
export const isSolid = (b: Block) => b !== Block.Air && b !== Block.Water && !isDecorative(b);
export const isReplaceable = (b: Block) => b === Block.Air || b === Block.Water || isDecorative(b);
export const isTransparent = (b: Block) => b === Block.Water || b === Block.Glass || b === Block.Leaves;
export const isShaped = (b: Block) => b >= Block.Slab && b <= Block.Fence || b === Block.Bed;
export function hardness(b: Block): number {
  if (b === Block.Air || b === Block.Water || isDecorative(b)) return .12;
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
export const selectableBlocks: Block[] = [Block.Grass,Block.Dirt,Block.Stone,Block.Sand,Block.Wood,Block.Leaves,Block.Glass,Block.Slab,Block.Stairs];
export interface Box { minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number }
export function collisionBoxes(s: BlockState): Box[] {
  const box=(minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number):Box=>({minX,maxX,minY,maxY,minZ,maxZ});
  if(!isSolid(s.type))return [];
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
