import * as THREE from 'three';

// Original atlas-driven voxel water. UV motion stays inside the current atlas
// tile so neighboring blocks never sample another block's texture.
export class WaterSurface{
  readonly material:THREE.MeshPhongMaterial;
  private clock={value:0};
  constructor(texture:THREE.Texture){
    this.material=new THREE.MeshPhongMaterial({map:texture,vertexColors:true,transparent:true,opacity:.72,
      depthWrite:false,shininess:56,specular:'#5e8fa9',side:THREE.DoubleSide});
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.waterTime=this.clock;
      shader.fragmentShader=`uniform float waterTime;\n${shader.fragmentShader}`.replace('#include <map_fragment>',`
        #ifdef USE_MAP
          vec2 tile=floor(vMapUv*8.0);
          vec2 local=fract(vMapUv*8.0);
          local+=vec2(sin(waterTime*.85+local.y*6.283),cos(waterTime*.63+local.x*6.283))*.006;
          local=clamp(local,.003,.997);
          diffuseColor*=texture2D(map,(tile+local)/8.0);
        #endif`);
    };
  }
  update(delta:number){this.clock.value=(this.clock.value+delta)%10000;}
  dispose(){this.material.dispose();}
}
