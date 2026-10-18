// Runner visuals (Tejas): the forest road, natural branches, bread slices, the heart and splashes.
// Render-only. Collision uses lanes and distances from the course, never these meshes.
// Cosmetic randomness uses Math.random() on purpose: it must not touch the seeded gameplay RNG.

import * as THREE from 'three';
import { CONFIG } from '../../core/config';
import type { Lane } from '../../course/types';
import { ForestRoad } from '../../render/forest';
import { taperedLimb } from '../../render/shapes';
import { barkTexture, crumbTexture, leafTexture } from '../../render/textures';

const LANES = CONFIG.runner.lanes;
const LANE_WIDTH = 2.5;

/** The world the runners (and the boss arena) take place in. */
export class RunnerWorld {
  private readonly forest = new ForestRoad();
  readonly group = this.forest.group;

  /** Move the world towards the camera by `step` units. */
  scroll(distance: number, step: number): void {
    this.forest.scroll(distance, step);
  }
}

// --- Branches ------------------------------------------------------------------------------

// Shared by every branch: textures and materials are made once.
let shared: { bark: THREE.MeshStandardMaterial; leaf: THREE.MeshStandardMaterial; leafGeo: THREE.PlaneGeometry } | null = null;
function branchMaterials() {
  if (!shared) {
    const bark = barkTexture();
    bark.repeat.set(2, 1);
    shared = {
      bark: new THREE.MeshStandardMaterial({ map: bark, color: 0xe0b48c, roughness: 0.9 }),
      leaf: new THREE.MeshStandardMaterial({
        map: leafTexture(),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.7,
      }),
      leafGeo: new THREE.PlaneGeometry(0.55, 0.55),
    };
  }
  return shared;
}

/** A fallen branch lying across one or more lanes, half in the water, with twigs and leaves. */
export function makeBranch(lanes: Lane[]): THREE.Group {
  const { bark, leaf, leafGeo } = branchMaterials();
  const group = new THREE.Group();
  const sorted = [...lanes].sort();
  const runs: Lane[][] = [];
  for (const lane of sorted) {
    const last = runs[runs.length - 1];
    if (last && lane === last[last.length - 1] + 1) last.push(lane);
    else runs.push([lane]);
  }

  for (const run of runs) {
    const cx = run.reduce<number>((sum, l) => sum + LANES[l], 0) / run.length;
    const half = (run.length * LANE_WIDTH) / 2 - 0.1;
    const dir = Math.random() < 0.5 ? -1 : 1; // which end is the thick base
    const wobble = () => (Math.random() - 0.5) * 0.35;
    const points = [0, 0.33, 0.66, 1].map(
      (t) => new THREE.Vector3(cx + dir * (-half + 2 * half * t), 0.22 + wobble() * 0.4, wobble()),
    );
    const limb = new THREE.Mesh(taperedLimb(points, 0.32, 0.5), bark);
    limb.castShadow = true;
    group.add(limb);

    // Twigs sprouting up and forwards, each ending in a cluster of leaves.
    const twigs = run.length * 2 + 1;
    for (let i = 0; i < twigs; i++) {
      const t = (i + 0.5) / twigs;
      const base = new THREE.Vector3(cx + dir * (-half + 2 * half * t), 0.3, 0);
      const lean = (Math.random() - 0.5) * 0.9;
      const tip = base.clone().add(new THREE.Vector3(lean, 0.8 + Math.random() * 0.5, (Math.random() - 0.3) * 0.6));
      const mid = base.clone().lerp(tip, 0.5).add(new THREE.Vector3(wobble(), 0, wobble()));
      const twig = new THREE.Mesh(taperedLimb([base, mid, tip], 0.09, 0.35, 8), bark);
      twig.castShadow = true;
      group.add(twig);
      for (let k = 0; k < 11; k++) {
        const card = new THREE.Mesh(leafGeo, leaf);
        card.position.copy(base.clone().lerp(tip, 0.55 + Math.random() * 0.5)).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.3) * 0.5, (Math.random() - 0.5) * 0.7));
        card.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        card.castShadow = true;
        group.add(card);
      }
    }
  }
  return group;
}

// --- Bread ---------------------------------------------------------------------------------

let bread: { geometry: THREE.ExtrudeGeometry; materials: THREE.Material[] } | null = null;

/** A slice of bread: soft crumb faces, golden crust round the edge. Origin = slice centre. */
export function makeCrumb(): THREE.Mesh {
  if (!bread) {
    // The classic toast outline: square bottom, two puffed lobes on top.
    const s = new THREE.Shape();
    s.moveTo(-0.38, -0.42);
    s.lineTo(0.38, -0.42);
    s.quadraticCurveTo(0.44, -0.42, 0.44, -0.34);
    s.lineTo(0.42, 0.12);
    s.bezierCurveTo(0.62, 0.2, 0.6, 0.52, 0.3, 0.56);
    s.bezierCurveTo(0.12, 0.62, -0.12, 0.62, -0.3, 0.56);
    s.bezierCurveTo(-0.6, 0.52, -0.62, 0.2, -0.42, 0.12);
    s.lineTo(-0.44, -0.34);
    s.quadraticCurveTo(-0.44, -0.42, -0.38, -0.42);
    const geometry = new THREE.ExtrudeGeometry(s, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      bevelSegments: 4,
      curveSegments: 18,
    });
    geometry.center();
    // ExtrudeGeometry's UVs are in shape units; remap the faces to 0..1 for the crumb texture.
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 0.5) / 1.1, (uv.getY(i) + 0.45) / 1.1);
    bread = {
      geometry,
      materials: [
        new THREE.MeshStandardMaterial({ map: crumbTexture(), roughness: 0.9, emissive: 0x3a2a10, emissiveIntensity: 0.25 }),
        new THREE.MeshStandardMaterial({ color: 0xb8702e, roughness: 0.6 }),
      ],
    };
  }
  const slice = new THREE.Mesh(bread.geometry, bread.materials);
  slice.scale.setScalar(0.85);
  slice.position.y = 0.75;
  slice.castShadow = true;
  return slice;
}

/** A tiny bitmap font keeps the pickup label sharp without a downloaded font. */
function makeExtraLifeLabel(): THREE.Sprite {
  const glyphs: Record<string, number[]> = {
    E: [31, 16, 16, 30, 16, 16, 31],
    X: [17, 17, 10, 4, 10, 17, 17],
    T: [31, 4, 4, 4, 4, 4, 4],
    R: [30, 17, 17, 30, 20, 18, 17],
    A: [14, 17, 17, 31, 17, 17, 17],
    L: [16, 16, 16, 16, 16, 16, 31],
    I: [31, 4, 4, 4, 4, 4, 31],
    F: [31, 16, 16, 30, 16, 16, 16],
  };
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 12;
  const g = canvas.getContext('2d')!;
  const draw = (color: string, offsetX: number, offsetY: number) => {
    g.fillStyle = color;
    let x = 2;
    for (const character of 'EXTRA LIFE') {
      if (character === ' ') { x += 4; continue; }
      glyphs[character].forEach((row, y) => {
        for (let col = 0; col < 5; col++) {
          if (row & (1 << (4 - col))) g.fillRect(x + col + offsetX, y + 2 + offsetY, 1, 1);
        }
      });
      x += 6;
    }
  };
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) draw('#510b29', x, y);
  }
  draw('#ff5a91', 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false, toneMapped: false });
  material.addEventListener('dispose', () => texture.dispose());
  const label = new THREE.Sprite(material);
  label.name = 'extra-life-label';
  label.position.y = 1.15;
  label.scale.set(3.6, 3.6 * canvas.height / canvas.width, 1);
  return label;
}

export function makeHeart(): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(5, 5);
  shape.bezierCurveTo(5, 5, 4, 0, 0, 0);
  shape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  shape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  shape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  shape.bezierCurveTo(16, 7, 16, 0, 10, 0);
  shape.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 4,
    bevelEnabled: true,
    bevelSize: 1.4,
    bevelThickness: 1.4,
    bevelSegments: 6,
    curveSegments: 24,
  });
  geometry.center();
  geometry.rotateZ(Math.PI); // the shape is drawn point-up
  geometry.scale(0.05, 0.05, 0.05);
  const heart = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color: 0xff3d7f,
      emissive: 0xc0124f,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      clearcoat: 1,
    }),
  );
  heart.position.y = 1.1;
  heart.castShadow = true;
  heart.add(makeExtraLifeLabel());
  return heart;
}

// --- Particles -------------------------------------------------------------------------------

interface Particle {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  grow: number;
}

/** A small pool of blobs for splashes, wood chips and pops. They drift with the world. */
export class Particles {
  readonly group = new THREE.Group();
  private readonly pool: Particle[] = [];
  private cursor = 0;

  constructor(size = 60) {
    const geometry = new THREE.SphereGeometry(0.1, 10, 8);
    for (let i = 0; i < size; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, material, velocity: new THREE.Vector3(), age: 0, life: 0, grow: 0 });
    }
  }

  burst(
    x: number,
    y: number,
    z: number,
    count: number,
    options: { color: number; speed: number; up: number; life: number; size?: number; grow?: number },
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      p.mesh.visible = true;
      p.mesh.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
      p.mesh.scale.setScalar(options.size ?? 1);
      p.material.color.setHex(options.color);
      p.material.opacity = 1;
      p.velocity.set(
        (Math.random() - 0.5) * options.speed,
        options.up * (0.6 + Math.random() * 0.6),
        (Math.random() - 0.3) * options.speed,
      );
      p.age = 0;
      p.life = options.life * (0.7 + Math.random() * 0.6);
      p.grow = options.grow ?? 1.5;
    }
  }

  update(dt: number, worldStep: number): void {
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.mesh.visible = false;
        continue;
      }
      p.velocity.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.position.z += worldStep;
      if (p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02;
        p.velocity.set(0, 0, 0);
      }
      const k = p.age / p.life;
      p.material.opacity = 1 - k * k;
      p.mesh.scale.multiplyScalar(1 + p.grow * dt);
    }
  }
}
