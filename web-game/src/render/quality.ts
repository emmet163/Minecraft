export type Quality='low'|'medium'|'high';
export const qualityPreset=(quality:Quality)=>quality==='high'?{pixelRatio:2,shadows:true,shadowSize:2048,weather:1}:
  quality==='medium'?{pixelRatio:1.5,shadows:true,shadowSize:1024,weather:.75}:
  {pixelRatio:1,shadows:false,shadowSize:0,weather:.5};
export const parseQuality=(value:unknown):Quality=>value==='medium'||value==='high'?value:'low';
