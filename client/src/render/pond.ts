// A natural forest pond sitting in the road at the end of Runner 1 (Tejas): an irregular glossy
// water surface, a wet muddy rim, stones, reeds and lily pads. Its shape is fixed (no randomness),
// so the pond Runner 1 approaches and the one Bill jumps into in the dive look identical.

import * as THREE from 'three';
import { rippleNormalMap } from './textures';

export const POND_RADIUS = 3.7;
/** How far past the end of Runner 1 the pond's centre sits. The dive picks it up from here. */
export const POND_AHEAD = 14;

/** The pond's outline: a circle with gentle, fixed wobbles so it doesn't look machine-made. */
function outline(radius: number, points = 64): THREE.Vector2[] {
  return Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const r = radius * (1 + 0.07 * Math.sin(a * 3 + 0.6) + 0.05 * Math.sin(a * 5 + 2.1) + 0.03 * Math.sin(a * 9));
    // Stretched a little along the road (z) so it reads as a pond, not a hole.
    return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r * 1.25);
  });
}

const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

export class Pond {
  readonly group = new THREE.Group();
  private readonly normals: THREE.Texture;
  private readonly ripples: { mesh: THREE.Mesh; t: number; speed: number }[] = [];
  private time = 0;

  constructor() {
    const flat = (shape: THREE.Shape, material: THREE.Material, y: number) => {
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = y;
      mesh.receiveShadow = true;
      return mesh;
    };

    // Wet, darker mud around the edge so the pond blends into the road.
    const rim = flat(new THREE.Shape(outline(POND_RADIUS * 1.18)), std(0x4a3524, { roughness: 0.35 }), 0.012);
    // The water: glossy, slightly green, with moving ripples, reflecting the sky.
    this.normals = rippleNormalMap(256, 10, 21);
    this.normals.repeat.set(1.2, 1.2);
    const water = flat(
      new THREE.Shape(outline(POND_RADIUS)),
      new THREE.MeshPhysicalMaterial({
        color: 0x2a6f7a,
        roughness: 0.05,
        metalness: 0.1,
        normalMap: this.normals,
        normalScale: new THREE.Vector2(0.25, 0.25),
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.4,
      }),
      0.03,
    );
    // ShapeGeometry UVs are in world units; scale them down so the ripples are pond-sized.
    const uv = water.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
    this.group.add(rim, water);

    // Stones around the rim (fixed angles, so both ponds match).
    const stone = std(0x8a8f95, { roughness: 0.7 });
    const stoneGeo = new THREE.DodecahedronGeometry(0.32, 1);
    [0.2, 0.9, 1.5, 2.2, 2.6, 3.4, 4.1, 4.6, 5.3, 5.9].forEach((a, i) => {
      const s = new THREE.Mesh(stoneGeo, stone);
      const r = POND_RADIUS * (1.08 + (i % 3) * 0.05);
      // The outline's shape-space y becomes world -z once laid flat, so mirror it here to sit on the rim.
      s.position.set(Math.cos(a) * r, 0.08, -Math.sin(a) * r * 1.25);
      s.scale.set(1 + (i % 2) * 0.5, 0.55, 1 + ((i + 1) % 2) * 0.4);
      s.rotation.y = a;
      s.castShadow = true;
      this.group.add(s);
    });

    // Reeds and cattails on the far side and edges (never on the near side, where Bill jumps in).
    const reed = std(0x5f8f3c);
    const cattail = std(0x6b4226);
    [-2.8, -2.4, -2.0, -1.5, -1.1, -0.6, -0.2, 3.3].forEach((a, i) => {
      const clump = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const h = 1.1 + ((i + k) % 3) * 0.3;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, h, 6), reed);
        stalk.position.set((k - 1.5) * 0.12, h / 2, (k % 2) * 0.1);
        stalk.rotation.z = (k - 1.5) * 0.08;
        clump.add(stalk);
        if (k % 2 === 0) {
          const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), cattail);
          tip.position.set((k - 1.5) * 0.12, h + 0.08, (k % 2) * 0.1);
          clump.add(tip);
        }
      }
      // Negative z is the far side of the pond (away from Bill).
      clump.position.set(Math.cos(a) * POND_RADIUS * 1.05, 0, Math.sin(a) * POND_RADIUS * 1.3);
      this.group.add(clump);
    });

    // Lily pads, two with flowers.
    const pad = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 24, 1, false, 0.35, Math.PI * 1.85);
    const padMat = std(0x3f9a4a, { roughness: 0.5 });
    [
      [-2.0, -1.8, true],
      [2.2, -0.6, false],
      [1.6, -3.2, true],
      [-2.5, 1.0, false],
    ].forEach(([x, z, flower]) => {
      const lily = new THREE.Mesh(pad, padMat);
      lily.position.set(x as number, 0.05, z as number);
      lily.rotation.y = (x as number) * 1.7;
      this.group.add(lily);
      if (flower) {
        const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 8), std(0xff8fc0, { roughness: 0.5 }));
        bloom.position.set((x as number) + 0.08, 0.16, z as number);
        this.group.add(bloom);
      }
    });
  }

  /** Expanding rings on the water: a big burst for a splash, small ones while idle. */
  ripple(x: number, z: number, big: boolean): void {
    for (let i = 0; i < (big ? 3 : 1); i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1, 48),
        new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.8, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.045, z);
      this.group.add(mesh);
      this.ripples.push({ mesh, t: -i * 0.15, speed: big ? 2.6 : 1.2 });
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.normals.offset.set(Math.sin(this.time * 0.3) * 0.05, this.time * 0.02);
    if (Math.random() < dt * 0.8) this.ripple((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, false);
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.t += dt;
      if (r.t < 0) {
        r.mesh.visible = false;
        continue;
      }
      r.mesh.visible = true;
      const s = 0.2 + r.t * r.speed;
      r.mesh.scale.set(s, s, 1);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - r.t * 0.7);
      if (r.t > 1.2) {
        r.mesh.removeFromParent();
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        this.ripples.splice(i, 1);
      }
    }
  }
}
