import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type * as THREE from 'three';

// Loaded only when the player supplies an authorized GLB/glTF asset.
export async function gltfFactory(url:string):Promise<()=>THREE.Object3D>{
  const source=(await new GLTFLoader().loadAsync(url)).scene;
  return ()=>clone(source);
}
