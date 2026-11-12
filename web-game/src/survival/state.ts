import { Block } from '../world/blocks';
export type Mode='survival'|'creative';
export interface BedCell{x:number;y:number;z:number}
export interface LifeSave{health:number;hunger:number;saturation:number;oxygen:number;experience:number;mode:Mode;bed:BedCell|null;creativeBlock:Block}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export class SurvivalState {
  health=20;hunger=20;saturation=5;oxygen=10;experience=0;mode:Mode='survival';bed:BedCell|null=null;creativeBlock=Block.Stone;
  private hungerClock=0;private healClock=0;private damageClock=0;private oxygenClock=0;private exposureClock=0;private healDelay=0;
  get dead(){return this.health<=0;}
  get level(){let points=this.experience,level=0;while(points>=10+level*5){points-=10+level*5;level++;}return level;}
  get experienceFraction(){let points=this.experience,level=0;while(points>=10+level*5){points-=10+level*5;level++;}return points/(10+level*5);}
  setMode(mode:Mode){this.mode=mode;if(mode==='creative'){this.health=20;this.oxygen=10;}}
  damage(amount:number):boolean{if(this.mode==='creative'||this.dead||amount<=0)return false;this.health=Math.max(0,this.health-amount);this.healClock=0;this.healDelay=8;return true;}
  heal(amount:number){if(!this.dead&&amount>0)this.health=Math.min(20,this.health+amount);}
  eat(nutrition:number,saturation:number,healing=0):boolean{
    if(this.mode==='creative'||this.dead||nutrition<=0&&healing<=0||this.hunger>=20&&this.health>=20)return false;
    this.hunger=Math.min(20,this.hunger+nutrition);this.saturation=Math.min(this.hunger,this.saturation+saturation);this.heal(healing);return true;
  }
  tick(seconds:number,sprinting:boolean,underwater:boolean,suffocating:boolean,cold:boolean,hot:boolean):void{
    if(seconds<=0||this.dead||this.mode==='creative')return;
    this.healDelay=Math.max(0,this.healDelay-seconds);
    this.hungerClock+=seconds*(sprinting?2:1);
    while(this.hungerClock>=45){this.hungerClock-=45;if(this.saturation>0)this.saturation=Math.max(0,this.saturation-1);else this.hunger=Math.max(0,this.hunger-1);}
    if(underwater){this.oxygen=Math.max(0,this.oxygen-seconds);this.oxygenClock+=seconds;if(this.oxygen<=0&&this.oxygenClock>=1){this.oxygenClock=0;this.damage(1);}}
    else {this.oxygen=Math.min(10,this.oxygen+seconds*3);this.oxygenClock=0;}
    if(suffocating||this.hunger<=0){this.damageClock+=seconds;if(this.damageClock>=(suffocating?1:4)){this.damageClock=0;this.damage(suffocating?1.5:1);}}
    else this.damageClock=0;
    if(cold||hot){this.exposureClock+=seconds;if(this.exposureClock>=15){this.exposureClock=0;this.damage(1);}}else this.exposureClock=0;
    if(this.healDelay<=0&&this.hunger>=18&&this.health<20&&!underwater&&!suffocating){this.healClock+=seconds;if(this.healClock>=6){this.healClock=0;this.heal(1);this.saturation=Math.max(0,this.saturation-.5);}}
    else this.healClock=0;
  }
  respawn(){this.health=20;this.hunger=18;this.saturation=5;this.oxygen=10;this.experience=Math.floor(this.experience/2);this.hungerClock=this.healClock=this.damageClock=this.oxygenClock=this.exposureClock=this.healDelay=0;}
  snapshot():LifeSave{return {health:this.health,hunger:this.hunger,saturation:this.saturation,oxygen:this.oxygen,experience:this.experience,mode:this.mode,bed:this.bed?{...this.bed}:null,creativeBlock:this.creativeBlock};}
  load(save:LifeSave|undefined){if(!save){this.health=20;this.hunger=20;this.saturation=5;this.oxygen=10;this.experience=0;this.mode='survival';this.bed=null;this.creativeBlock=Block.Stone;return;}
    this.health=clamp(save.health,0,20);this.hunger=clamp(save.hunger,0,20);this.saturation=clamp(save.saturation,0,this.hunger);this.oxygen=clamp(save.oxygen,0,10);this.experience=Math.max(0,save.experience|0);this.mode=save.mode==='creative'?'creative':'survival';this.bed=save.bed??null;this.creativeBlock=save.creativeBlock||Block.Stone;
    this.hungerClock=this.healClock=this.damageClock=this.oxygenClock=this.exposureClock=this.healDelay=0;
  }
}
export type Weather='clear'|'rain'|'storm';
export interface CycleSave{day:number;time:number;step:number;clock:number;intensity:number;weather:Weather}
function hash(seed:number,step:number){let v=(seed^Math.imul(step,0x9e3779b9))>>>0;v=Math.imul(v^(v>>>16),0x7feb352d)>>>0;v=Math.imul(v^(v>>>15),0x846ca68b)>>>0;return (v^(v>>>16))&0x7fffffff;}
export class WorldCycle{
  day=1;time=.12;weather:Weather='clear';intensity=0;flash=0;private seed=12345;private step=0;private clock=0;private lightningClock=0;
  configure(seed:number){this.seed=seed;this.day=1;this.time=.12;this.weather='clear';this.intensity=this.flash=this.step=this.clock=this.lightningClock=0;}
  get daylight(){return clamp(Math.sin(this.time*Math.PI*2),0,1);}
  get night(){return this.daylight<.18;}
  get hour(){return Math.floor(6+this.time*24)%24;}
  tick(seconds:number){if(seconds<=0)return;this.time+=seconds/1200;while(this.time>=1){this.time--;this.day++;}this.clock+=seconds;
    while(this.clock>=180){this.clock-=180;this.step++;const roll=hash(this.seed,this.step)%10;this.weather=roll<5?'clear':roll<8?'rain':'storm';}
    const goal=this.weather==='clear'?0:this.weather==='storm'?1:.65;
    this.intensity+=Math.sign(goal-this.intensity)*Math.min(Math.abs(goal-this.intensity),seconds/18);
    this.flash=Math.max(0,this.flash-seconds*3);
    if(this.weather==='storm'&&this.intensity>.7){this.lightningClock+=seconds;if(this.lightningClock>=35+hash(this.seed,this.step)%25){this.lightningClock=0;this.flash=1;}}
    else this.lightningClock=0;
  }
  sleep(){if(!this.night)return false;this.day++;this.time=.04;this.weather='clear';this.intensity=0;this.clock=0;this.step++;return true;}
  snapshot():CycleSave{return {day:this.day,time:this.time,step:this.step,clock:this.clock,intensity:this.intensity,weather:this.weather};}
  load(save:CycleSave|undefined,seed:number){this.configure(seed);if(!save)return;this.day=Math.max(1,save.day|0);this.time=((save.time%1)+1)%1;this.step=Math.max(0,save.step|0);this.clock=clamp(save.clock,0,180);this.intensity=clamp(save.intensity,0,1);this.weather=['clear','rain','storm'].includes(save.weather)?save.weather:'clear';}
}
