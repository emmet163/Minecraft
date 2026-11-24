import * as THREE from 'three';

// Camera-local voxel hand and tool. Geometry is shared and animation is frame-rate independent.
export class FirstPersonView{
  readonly group=new THREE.Group();
  private readonly hand=new THREE.Group();
  private readonly tool=new THREE.Group();
  private readonly cube=new THREE.BoxGeometry(1,1,1);
  private readonly skin=new THREE.MeshLambertMaterial({color:'#ba8d71',depthTest:false});
  private readonly skinShade=new THREE.MeshLambertMaterial({color:'#9c715d',depthTest:false});
  private readonly sleeve=new THREE.MeshLambertMaterial({color:'#537383',depthTest:false});
  private readonly cuff=new THREE.MeshLambertMaterial({color:'#344f5e',depthTest:false});
  private readonly wood=new THREE.MeshLambertMaterial({color:'#8a603d',depthTest:false});
  private readonly metal=new THREE.MeshLambertMaterial({color:'#bac8c8',depthTest:false});
  private readonly toolHead:THREE.Mesh;
  private currentTool='hand';
  private phase=0;private swing=0;private recoil=0;
  constructor(camera:THREE.Camera){
    camera.add(this.group);this.group.position.set(.57,-.65,-.9);this.group.scale.setScalar(.66);
    this.group.add(this.hand,this.tool);
    const box=(parent:THREE.Group,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
      const mesh=new THREE.Mesh(this.cube,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.renderOrder=100;parent.add(mesh);};
    box(this.hand,this.sleeve,0,-.13,0,.26,.44,.28);
    box(this.hand,this.cuff,0,.055,0,.28,.1,.3);
    box(this.hand,this.skin,0,.2,-.02,.24,.23,.26);
    box(this.hand,this.skinShade,0,.25,-.16,.2,.09,.035);
    for(const x of [-.075,-.025,.025,.075])box(this.hand,this.skin,x,.3,-.08,.043,.08,.1);
    box(this.tool,this.wood,0,.41,-.03,.09,.67,.09);
    box(this.tool,this.cuff,0,.24,-.03,.11,.12,.11);
    this.toolHead=new THREE.Mesh(this.cube,this.metal);this.toolHead.position.set(0,.72,-.03);
    this.toolHead.scale.set(.38,.12,.15);this.toolHead.renderOrder=100;this.tool.add(this.toolHead);
    this.tool.visible=false;
  }
  setTool(tool:string){if(tool===this.currentTool)return;this.currentTool=tool;
    this.tool.visible=tool!=='hand';this.hand.visible=true;
    if(tool==='weapon')this.toolHead.scale.set(.12,.55,.12);
    else if(tool==='shovel')this.toolHead.scale.set(.25,.22,.1);
    else this.toolHead.scale.set(.38,.12,.15);}
  triggerSwing(){this.swing=1;}
  triggerHurt(){this.recoil=1;}
  update(delta:number,moving:boolean,sprinting:boolean,mining:boolean){
    this.phase+=delta*(sprinting?13:8);this.swing=Math.max(0,this.swing-delta*4);this.recoil=Math.max(0,this.recoil-delta*3);
    const motion=moving?1:0,bob=Math.sin(this.phase)*.025*motion;
    const strike=Math.sin((1-this.swing)*Math.PI)*this.swing;
    const miningBob=mining?Math.sin(this.phase*1.8)*.12:0;
    this.group.position.set(.57+Math.cos(this.phase)*.014*motion,-.65+bob-this.recoil*.08,-.9+this.recoil*.12);
    this.group.rotation.set(-strike*.75-miningBob,-strike*.32,Math.sin(this.phase)*.025*motion-strike*.24);
  }
  dispose(){this.cube.dispose();for(const material of [this.skin,this.skinShade,this.sleeve,this.cuff,this.wood,this.metal])material.dispose();}
}
