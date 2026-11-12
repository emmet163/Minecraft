import { Block, type BlockState, air } from './blocks';
export const SIZE = 16, HEIGHT = 96, PAD = SIZE + 2;
export class ChunkData {
  readonly blocks = new Uint8Array(PAD * HEIGHT * PAD);
  readonly properties = new Uint8Array(PAD * HEIGHT * PAD);
  constructor(readonly cx: number, readonly cz: number) {}
  private index(x: number, y: number, z: number): number {
    return ((z + 1) * PAD + x + 1) * HEIGHT + y;
  }
  private valid(x: number, y: number, z: number): boolean {
    return x >= -1 && x <= SIZE && z >= -1 && z <= SIZE && y >= 0 && y < HEIGHT;
  }
  get(x: number, y: number, z: number): Block {
    return this.valid(x,y,z) ? this.blocks[this.index(x,y,z)]! as Block : Block.Air;
  }
  getState(x: number, y: number, z: number): BlockState {
    if (!this.valid(x,y,z)) return air;
    const i = this.index(x,y,z);
    return { type: this.blocks[i]! as Block, properties: this.properties[i]! };
  }
  set(x: number, y: number, z: number, b: Block, properties = 0): void {
    if (!this.valid(x,y,z)) return;
    const i = this.index(x,y,z); this.blocks[i] = b; this.properties[i] = properties;
  }
  world(x: number, y: number, z: number): Block { return this.get(x-this.cx*SIZE,y,z-this.cz*SIZE); }
}
