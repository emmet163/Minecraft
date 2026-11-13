/// <reference lib="webworker" />
import { WorldGenerator } from './generator';

interface Request { epoch: number; seed: number; cx: number; cz: number; realm:'overworld'|'veil' }
const workerScope=self as DedicatedWorkerGlobalScope;
workerScope.onmessage=(event: MessageEvent<Request>)=>{
  const {epoch,seed,cx,cz,realm}=event.data;
  const data=new WorldGenerator(seed,realm).generate(cx,cz);
  workerScope.postMessage({epoch,cx,cz,blocks:data.blocks,properties:data.properties},[data.blocks.buffer,data.properties.buffer]);
};
