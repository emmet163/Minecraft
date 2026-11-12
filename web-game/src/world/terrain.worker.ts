/// <reference lib="webworker" />
import { WorldGenerator } from './generator';

interface Request { epoch: number; seed: number; cx: number; cz: number }
const workerScope=self as DedicatedWorkerGlobalScope;
workerScope.onmessage=(event: MessageEvent<Request>)=>{
  const {epoch,seed,cx,cz}=event.data;
  const data=new WorldGenerator(seed).generate(cx,cz);
  workerScope.postMessage({epoch,cx,cz,blocks:data.blocks,properties:data.properties},[data.blocks.buffer,data.properties.buffer]);
};
