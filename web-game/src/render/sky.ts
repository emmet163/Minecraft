import * as THREE from 'three';

export class SkyDome{
  readonly mesh:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
  constructor(){
    const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{top:{value:new THREE.Color('#438fca')},horizon:{value:new THREE.Color('#c2d9d3')},bottom:{value:new THREE.Color('#425b72')},sunDirection:{value:new THREE.Vector3(0,1,0)},glow:{value:1}},
      vertexShader:'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`varying vec3 vDirection; uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDirection; uniform float glow;
        void main(){vec3 d=normalize(vDirection); float h=clamp(d.y*2.0+0.5,0.0,1.0); vec3 col=mix(bottom,horizon,smoothstep(0.0,0.48,h)); col=mix(col,top,smoothstep(0.32,1.0,h));
        float halo=pow(max(dot(d,normalize(sunDirection)),0.0),48.0)*glow; col+=vec3(1.0,0.65,0.32)*halo;
        float starHash=fract(sin(dot(floor(d*190.0),vec3(12.9898,78.233,45.164)))*43758.5453);
        float stars=step(0.997,starHash)*smoothstep(0.0,0.2,d.y)*(1.0-smoothstep(0.08,0.45,glow)); col+=vec3(0.7,0.82,1.0)*stars;
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`
    });
    this.mesh=new THREE.Mesh(new THREE.SphereGeometry(300,24,16),material);this.mesh.renderOrder=-100;this.mesh.frustumCulled=false;
  }
  update(position:THREE.Vector3,top:THREE.Color,horizon:THREE.Color,bottom:THREE.Color,sunDirection:THREE.Vector3,glow:number){
    this.mesh.position.copy(position);const uniforms=this.mesh.material.uniforms;
    (uniforms.top!.value as THREE.Color).copy(top);(uniforms.horizon!.value as THREE.Color).copy(horizon);
    (uniforms.bottom!.value as THREE.Color).copy(bottom);(uniforms.sunDirection!.value as THREE.Vector3).copy(sunDirection);uniforms.glow!.value=glow;
  }
  dispose(){this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
