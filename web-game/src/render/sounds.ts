// Procedural original audio; the browser context starts only after user input.
export type AudioSettings={effects:number;ambience:number;music:number};
export const audioLevel=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
type Effect='mine'|'place'|'step'|'hurt'|'creature'|'thunder';
export class BlockSounds {
  private context?:AudioContext;
  private buffers=new Map<Effect,AudioBuffer>();
  private ambience?:{source:AudioBufferSourceNode;gain:GainNode};
  private melody?:{source:AudioBufferSourceNode;gain:GainNode};
  settings:AudioSettings={effects:.7,ambience:.45,music:0};
  private weatherLevel=0;
  private appliedWeather=-1;
  private getContext(){this.context??=new AudioContext();if(this.context.state==='suspended')void this.context.resume();return this.context;}
  unlock():void{try{this.getContext();this.startLoops();}catch{/* Browser audio is optional. */}}
  setSettings(next:AudioSettings):void{this.settings={effects:audioLevel(next.effects),ambience:audioLevel(next.ambience),music:audioLevel(next.music)};
    this.appliedWeather=-1;if(this.context){this.startLoops();this.setWeather(this.weatherLevel);}}
  setWeather(intensity:number):void{this.weatherLevel=audioLevel(intensity);
    if(Math.abs(this.weatherLevel-this.appliedWeather)<.025)return;this.appliedWeather=this.weatherLevel;
    if(this.ambience)this.ambience.gain.gain.setTargetAtTime(this.settings.ambience*(.025+this.weatherLevel*.14),this.context!.currentTime,.4);
    if(this.melody)this.melody.gain.gain.setTargetAtTime(this.settings.music*.065,this.context!.currentTime,.4);}
  play(breaking:boolean):void{this.effect(breaking?'mine':'place');}
  thunder():void{this.effect('thunder');}
  footstep():void{this.effect('step');}
  hurt():void{this.effect('hurt');}
  creature():void{this.effect('creature');}
  private effect(kind:Effect):void{
    if(this.settings.effects<=0)return;
    try{const context=this.getContext();this.startLoops();let buffer=this.buffers.get(kind);
      if(!buffer){buffer=this.make(kind);this.buffers.set(kind,buffer);}
      const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
      gain.gain.value=this.settings.effects*(kind==='thunder'?.55:kind==='step'?.15:.3);
      source.connect(gain).connect(context.destination);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};
    }catch{/* Browser may deny playback. */}}
  private make(kind:Effect):AudioBuffer{
    const rate=22050,duration=kind==='thunder'?1.8:kind==='creature'?.38:kind==='hurt'?.25:kind==='step'?.11:kind==='mine'?.17:.12;
    const count=Math.ceil(rate*duration),buffer=this.context!.createBuffer(1,count,rate),samples=buffer.getChannelData(0);
    let seed=kind.length*1703,low=0;
    for(let i=0;i<count;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const t=i/rate,noise=seed/0xffffffff*2-1,envelope=Math.pow(1-i/count,kind==='thunder'?1.4:2);
      low=low*.9+noise*.1;
      const frequency=kind==='place'?310-t*720:kind==='step'?86:kind==='creature'?145+Math.sin(t*14)*35:kind==='hurt'?210-t*460:130-t*240;
      const wave=Math.sin(2*Math.PI*frequency*t);
      samples[i]=(kind==='thunder'?low*.8:kind==='step'?noise*.35+low*.35:wave*.32+noise*.42)*envelope;}
    return buffer;}
  private startLoops(){const context=this.context!;
    if(!this.ambience){const rate=11025,count=rate*4,buffer=context.createBuffer(1,count,rate),data=buffer.getChannelData(0);
      let seed=8713,low=0;for(let i=0;i<count;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;low=low*.985+(seed/0xffffffff*2-1)*.015;data[i]=low;}
      const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;
      source.connect(gain).connect(context.destination);source.start();this.ambience={source,gain};}
    if(!this.melody){const rate=11025,count=rate*8,buffer=context.createBuffer(1,count,rate),data=buffer.getChannelData(0);
      const notes=[220,261.63,329.63,293.66,196,246.94,329.63,261.63];
      for(let i=0;i<count;i++){const t=i/rate,n=Math.floor(t)%notes.length,phase=t%1,env=Math.sin(Math.PI*phase)**2;
        data[i]=(Math.sin(2*Math.PI*notes[n]!*t)+Math.sin(2*Math.PI*notes[n]!*.5*t)*.3)*env*.33;}
      const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;
      source.connect(gain).connect(context.destination);source.start();this.melody={source,gain};}
    this.appliedWeather=-1;this.setWeather(this.weatherLevel);}
  dispose(){for(const loop of [this.ambience,this.melody]){loop?.source.stop();loop?.source.disconnect();loop?.gain.disconnect();}void this.context?.close();}
}
