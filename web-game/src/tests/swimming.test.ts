import {expect,it} from 'vitest';
import {Block,state} from '../world/blocks';
import {PlayerController,type CollisionWorld,waterHeight} from '../player/controller';
import {SurvivalState} from '../survival/state';

function pool(top=4,edge=0,wall=Number.POSITIVE_INFINITY):CollisionWorld{
  const get=(x:number,y:number,z:number)=>y<=0?Block.Stone:
    x===wall&&y<=top+1?Block.Stone:x>=edge&&x<32&&Math.abs(z)<=5&&y>=1&&y<=top?Block.Water:Block.Air;
  return {get,getState:(x,y,z)=>state(get(x,y,z)),isLoaded:(x,z)=>x>=-16&&x<32&&z>=-16&&z<16};
}
function player(world:CollisionWorld,x=2,y=1.5){const p=new PlayerController(world);p.position.set(x,y,0);return p;}
function advance(p:PlayerController,seconds:number,fps=60){for(let i=0;i<Math.round(seconds*fps);i++)p.update(1/fps);}

it('detects shallow and deep water and uses the existing head oxygen path',()=>{
  const shallow=player(pool(1));advance(shallow,.2);
  expect(shallow.submersion).toBeGreaterThan(.15);expect(shallow.submersion).toBeLessThan(.7);
  expect(shallow.waterMode).toBe('wading');expect(shallow.headSubmerged).toBe(false);
  const deep=player(pool(),2,2.5);advance(deep,.2);
  expect(deep.submersion).toBeGreaterThan(.8);expect(deep.headSubmerged).toBe(true);
  expect(waterHeight(state(Block.WaterFlow,7))).toBeLessThan(waterHeight(state(Block.Water)));
  const life=new SurvivalState();for(let i=0;i<12;i++)life.tick(1,false,deep.headSubmerged,false,false,false);
  expect(life.oxygen).toBe(0);expect(life.health).toBeLessThan(20);
  life.tick(2,false,false,false,false,false);expect(life.oxygen).toBeGreaterThan(0);
});
it('floats at the surface without sinking, jitter, or an upward launch',()=>{
  const p=player(pool(),2,2.5),heights:number[]=[];
  for(let i=0;i<600;i++){p.update(1/60);if(i>=480)heights.push(p.position.y);}
  expect(p.position.y).toBeGreaterThan(2.7);expect(p.position.y).toBeLessThan(3.7);
  expect(Math.max(...heights)-Math.min(...heights)).toBeLessThan(.3);
  expect(Math.abs(p.velocity.y)).toBeLessThan(1);
  p.keys.add('Space');advance(p,1);expect(p.velocity.y).toBeLessThanOrEqual(3.2);
});
it('swims upward, dives with Shift or crouch, and exits smoothly',()=>{
  const p=player(pool(),2,2.5);advance(p,.5);const start=p.position.y;
  p.keys.add('Space');advance(p,.7);expect(p.position.y).toBeGreaterThan(start+.2);
  p.keys.delete('Space');p.keys.add('ShiftLeft');const high=p.position.y;advance(p,1);
  expect(p.position.y).toBeLessThan(high-.2);expect(p.waterMode).toBe('diving');
  p.keys.delete('ShiftLeft');p.keys.add('ControlLeft');advance(p,.2);expect(p.waterMode).toBe('diving');
  p.keys.clear();p.keys.add('KeyA');advance(p,1.5);expect(p.position.x).toBeLessThan(0);
  expect(['exiting','land']).toContain(p.waterMode);expect(p.velocity.y).toBeGreaterThan(-35);
});
it('enters shallow water from land and deep water from a fall without a launch',()=>{
  const walker=player(pool(1),-1,.5);let splashes=0;walker.onSplash=()=>splashes++;
  walker.keys.add('KeyD');advance(walker,1.3);
  expect(walker.position.x).toBeGreaterThan(.1);expect(walker.submersion).toBeGreaterThan(.1);
  expect(splashes).toBe(1);
  const falling=player(pool(),2,6);falling.velocity.y=-18;
  advance(falling,.8);expect(falling.submersion).toBeGreaterThan(.1);
  expect(falling.velocity.y).toBeGreaterThanOrEqual(-3.6);
  expect(falling.waterMode).not.toBe('land');
});
it('resists horizontal motion, respects underwater walls, and crosses loaded chunk borders',()=>{
  const blocked=player(pool(4,0,5),3,2.5);blocked.keys.add('KeyD');advance(blocked,3);
  expect(blocked.position.x).toBeLessThan(4.2);
  const crossing=player(pool(4,0),15.2,2.5);crossing.keys.add('KeyD');advance(crossing,1.4);
  expect(crossing.position.x).toBeGreaterThan(16);expect(crossing.submersion).toBeGreaterThan(.3);
  crossing.keys.clear();const speed=Math.abs(crossing.velocity.x);advance(crossing,.5);
  expect(Math.abs(crossing.velocity.x)).toBeLessThan(speed*.15);
});
it('produces similar float positions at 30, 60, and 120 FPS',()=>{
  const heights=[30,60,120].map(fps=>{const p=player(pool(),2,2.5);advance(p,6,fps);return p.position.y;});
  expect(Math.max(...heights)-Math.min(...heights)).toBeLessThan(.08);
});
