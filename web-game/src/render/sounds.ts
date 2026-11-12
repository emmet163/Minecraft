// Short original procedural effects, generated locally after the first user interaction.
export class BlockSounds {
  private context?: AudioContext;
  private buffers=new Map<boolean,AudioBuffer>();
  play(breaking:boolean):void {
    try {
      this.context ??= new AudioContext();
      if(this.context.state==='suspended')void this.context.resume();
      let buffer=this.buffers.get(breaking);
      if(!buffer){buffer=this.make(breaking);this.buffers.set(breaking,buffer);}
      const source=this.context.createBufferSource();source.buffer=buffer;
      const gain=this.context.createGain();gain.gain.value=breaking?.28:.22;
      source.connect(gain).connect(this.context.destination);source.start();
      source.onended=()=>{source.disconnect();gain.disconnect();};
    } catch { /* Audio is optional when the browser blocks playback. */ }
  }
  thunder():void{
    try{
      this.context??=new AudioContext();if(this.context.state==='suspended')void this.context.resume();
      const rate=22050,count=rate*2,buffer=this.context.createBuffer(1,count,rate),samples=buffer.getChannelData(0);
      let random=5521,low=0;
      for(let i=0;i<count;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;low=low*.94+(random/0xffffffff*2-1)*.06;
        samples[i]=low*Math.pow(1-i/count,1.6);}
      const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=.5;
      source.connect(gain).connect(this.context.destination);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};
    }catch{/* Audio remains optional if blocked by the browser. */}
  }
  private make(breaking:boolean):AudioBuffer {
    const rate=22050,count=breaking?3300:2200;
    const buffer=this.context!.createBuffer(1,count,rate),samples=buffer.getChannelData(0);
    let random=breaking?1703:2909;
    for(let i=0;i<count;i++){
      random=(Math.imul(random,1664525)+1013904223)>>>0;
      const noise=random/0xffffffff*2-1,t=i/rate;
      const envelope=Math.pow(1-i/count,breaking?1.3:2);
      const tone=Math.sin(2*Math.PI*(breaking?125-t*300:320-t*750)*t);
      samples[i]=(tone*.28+noise*.5)*envelope;
    }
    return buffer;
  }
}
