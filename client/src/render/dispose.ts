import * as THREE from 'three';

/** Removes an object from its parent and frees its geometry and materials. Use it in Phase.exit(). */
export function disposeObject(root: THREE.Object3D): void {
  root.removeFromParent();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}
