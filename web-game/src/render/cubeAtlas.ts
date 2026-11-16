import * as THREE from 'three';

export const FACE_SIZE=16,FACE_COLUMNS=3,FACE_ROWS=2;
export function cubeAtlasGeometry(size:number):THREE.BoxGeometry{
  const geometry=new THREE.BoxGeometry(size,size,size),uv=geometry.getAttribute('uv');
  for(let side=0;side<6;side++)for(let corner=0;corner<4;corner++){
    const index=side*4+corner;
    uv.setXY(index,(side%FACE_COLUMNS+uv.getX(index))/FACE_COLUMNS,
      (Math.floor(side/FACE_COLUMNS)+uv.getY(index))/FACE_ROWS);
  }
  uv.needsUpdate=true;geometry.clearGroups();return geometry;
}
