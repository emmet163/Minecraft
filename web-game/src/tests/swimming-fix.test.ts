import {expect,it} from 'vitest';
import {Block,state} from '../world/blocks';
import {PlayerController,type CollisionWorld} from '../player/controller';

function shoreline(ledge=4,wall=false,roof=false):CollisionWorld{
  const get=(x:number,y:number,z:number):Block=>y<=0?Block.Stone:
    x>=5&&y<=ledge||wall&&x===5&&y<=8||roof&&x>=5&&y===6?Block.Stone:
    x>=0&&x<5&&Math.abs(z)<=4&&y>=1&&y<=4?Block.Water:Block.Air;
  return {get,getState:(x,y,z)=>state(get(x,y,z)),isLoaded:(x,z)=>x>=-16&&x<32&&z>=-16&&z<16};
}
function player(world:CollisionWorld,x=2,y=2.5){const p=new PlayerController(world);p.position.set(x,y,0);return p;}
function advance(p:PlayerController,seconds:number,fps=60){let highest=p.position.y;
  for(let i=0;i<Math.round(seconds*fps);i++){p.update(1/fps);highest=Math.max(highest,p.position.y);}return highest;}

it('enters from land, absorbs a fall, and sinks to the pool floor without input',()=>{
  const walker=player(shoreline(),-1,.5);walker.keys.add('KeyD');advance(walker,1);
  expect(walker.position.x).toBeGreaterThan(0);expect(walker.submersion).toBeGreaterThan(0);
  const falling=player(shoreline(),2,7);falling.velocity.y=-15;advance(falling,5);
  expect(falling.position.y).toBeGreaterThan(.49);expect(falling.position.y).toBeLessThan(.8);
  expect(falling.headSubmerged).toBe(true);expect(falling.waterMode).toBe('swimming');
});
it('rises only with Space, sinks on release, and dives faster with Shift',()=>{
  const p=player(shoreline(),2,1);p.keys.add('Space');const high=advance(p,1.7);
  expect(high).toBeGreaterThan(3);p.keys.delete('Space');const after=p.position.y;
  advance(p,1);expect(p.position.y).toBeLessThan(after-.4);
  const idle=player(shoreline()),diving=player(shoreline());diving.keys.add('ShiftLeft');
  advance(idle,.5);advance(diving,.5);
  expect(diving.position.y).toBeLessThan(idle.position.y-.2);
  const surface=player(shoreline(),2,3.9);surface.keys.add('Space');
  expect(advance(surface,.8)).toBeGreaterThan(4.5);
});
it('moves horizontally underwater, respects a solid wall, and crosses chunk boundaries',()=>{
  const blocked=player(shoreline(8,true),3,2);blocked.keys.add('KeyD');advance(blocked,2);
  expect(blocked.position.x).toBeLessThan(4.2);
  const open:CollisionWorld={get:(x,y)=>y<=0?Block.Stone:y<=4?Block.Water:Block.Air,
    isLoaded:(x,z)=>x>=-16&&x<32&&z>=-16&&z<16};
  const crossing=player(open,15,2);crossing.keys.add('KeyD');advance(crossing,1.5);
  expect(crossing.position.x).toBeGreaterThan(16);expect(crossing.submersion).toBeGreaterThan(0);
});
it('swims through the surface and climbs a reachable one-block ledge once',()=>{
  const p=player(shoreline(),4,3.45);p.keys.add('Space');p.keys.add('KeyD');
  const high=advance(p,2.5);expect(p.position.x).toBeGreaterThan(5);
  expect(p.position.y).toBeGreaterThan(4.4);expect(p.grounded).toBe(true);
  expect(high).toBeLessThan(7.5);
  advance(p,2);expect(p.position.y).toBeLessThan(5.1);
  p.keys.clear();advance(p,.2);expect(p.waterMode).toBe('land');
});
it('exits onto a flat shore but cannot climb a tall wall or pass an overhang',()=>{
  const flat=player(shoreline(1),4,.55);flat.keys.add('Space');flat.keys.add('KeyD');
  advance(flat,2);expect(flat.position.x).toBeGreaterThan(5);
  const wall=player(shoreline(8,true),4,3.45);wall.keys.add('Space');wall.keys.add('KeyD');
  const high=advance(wall,2);expect(wall.position.x).toBeLessThan(4.2);expect(high).toBeLessThan(7);
  const roof=player(shoreline(4,false,true),4,3.45);roof.keys.add('Space');roof.keys.add('KeyD');
  advance(roof,2);expect(roof.position.x).toBeLessThan(4.2);
});
it('keeps sinking and water-exit positions similar at 30, 60, and 120 FPS',()=>{
  const sinks=[30,60,120].map(fps=>{const p=player(shoreline());advance(p,1,fps);return p.position.y;});
  expect(Math.max(...sinks)-Math.min(...sinks)).toBeLessThan(.08);
  const exits=[30,60,120].map(fps=>{const p=player(shoreline(),4,3.45);p.keys.add('Space');p.keys.add('KeyD');advance(p,1.5,fps);return p.position.x;});
  expect(Math.min(...exits)).toBeGreaterThan(4.5);expect(Math.max(...exits)-Math.min(...exits)).toBeLessThan(.25);
});
it('preserves land walking, sprinting, crouching, and jumping',()=>{
  const walking=player(shoreline(),-4,.5),sprinting=player(shoreline(),-4,.5),crouching=player(shoreline(),-4,.5);
  walking.keys.add('KeyW');sprinting.keys.add('KeyW');sprinting.keys.add('ShiftLeft');
  crouching.keys.add('KeyW');crouching.keys.add('ControlLeft');
  advance(walking,.5);advance(sprinting,.5);advance(crouching,.5);
  expect(sprinting.position.z).toBeLessThan(walking.position.z);
  expect(walking.position.z).toBeLessThan(crouching.position.z);
  walking.keys.clear();walking.keys.add('Space');const high=advance(walking,.5);
  expect(high).toBeGreaterThan(1);walking.keys.clear();advance(walking,1);
  expect(walking.grounded).toBe(true);expect(walking.waterMode).toBe('land');
});
