// Small geometry helpers shared by several scenes (Tejas).

import * as THREE from 'three';

/**
 * A tapered, slightly crooked tube along a curve: thick at the start, thin at the tip (branches,
 * twigs, kelp, tentacles). TubeGeometry has a constant radius, so rings are scaled afterwards.
 */
export function taperedLimb(points: THREE.Vector3[], radius: number, tipScale: number, segments = 24, radial = 9): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const pos = geometry.attributes.position;
  const centre = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, centre);
    const k = 1 - (1 - tipScale) * t;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(centre).multiplyScalar(k).add(centre);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A smooth, lumpy rock: a subdivided sphere with its surface pushed in and out a little. */
export function lumpyRock(radius = 1, lumpiness = 0.22, detail = 3): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const a = Math.random() * 10;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 2.1 + a) * Math.sin(v.y * 2.7 + a * 0.7) * Math.sin(v.z * 1.9 + a * 1.3);
    v.multiplyScalar(1 + lumpiness * n);
    pos.setXYZ(i, v.x, v.y * 0.75, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}
