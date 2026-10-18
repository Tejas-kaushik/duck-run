// The sea Bill swims through (Tejas): sand dunes, kelp, coral, rocks, light rays, the surface above,
// fish and bubbles, plus the coins, jellyfish and pufferfish. Render-only; cosmetic randomness uses
// Math.random() on purpose.

import * as THREE from 'three';
import { lumpyRock, taperedLimb } from '../../render/shapes';
import { coinFaceTexture, rippleNormalMap } from '../../render/textures';

export const SEA_COLOR = 0x0e6189;
const SEABED_Y = -3.6;
const SURFACE_Y = 7;
const NEAR = 10;
const SPAN = 120;
const SAND_TILE = 9;

const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

function sandTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#d8c08a';
  g.fillRect(0, 0, 256, 256);
  // Soft ripple bands, drawn wrapped so the texture tiles.
  for (let i = 0; i < 9; i++) {
    const y = i * 28 + 6;
    for (const oy of [-256, 0, 256]) {
      const grad = g.createLinearGradient(0, y + oy - 8, 0, y + oy + 8);
      grad.addColorStop(0, 'rgba(255,240,200,0)');
      grad.addColorStop(0.5, 'rgba(255,240,200,0.45)');
      grad.addColorStop(1, 'rgba(160,120,70,0.25)');
      g.fillStyle = grad;
      g.fillRect(0, y + oy - 8, 256, 16);
    }
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 60},${90 + Math.random() * 40},50,0.25)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const g = canvas.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.5, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Drifter {
  object: THREE.Object3D;
  vx: number;
  vy: number;
  sway: number;
}

export class UnderwaterWorld {
  readonly group = new THREE.Group();
  private readonly sand: THREE.CanvasTexture;
  private readonly surfaceNormals: THREE.Texture;
  private readonly drifters: Drifter[] = [];
  private readonly rays: THREE.Mesh[] = [];
  private time = 0;

  constructor() {
    // Seabed: gentle dunes across (depends only on x, so the sand texture can scroll).
    this.sand = sandTexture();
    this.sand.repeat.set(70 / SAND_TILE, (SPAN + NEAR) / SAND_TILE);
    const bedGeo = new THREE.PlaneGeometry(70, SPAN + NEAR, 70, 1);
    const p = bedGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, Math.sin(x * 0.45) * 0.35 + Math.max(0, Math.abs(x) - 6) * 0.18);
    }
    bedGeo.computeVertexNormals();
    const seabed = new THREE.Mesh(bedGeo, std(0xffffff, { map: this.sand, roughness: 1 }));
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.set(0, SEABED_Y, NEAR - (SPAN + NEAR) / 2);
    seabed.receiveShadow = true;
    this.group.add(seabed);

    // The surface far above, rippling and bright.
    this.surfaceNormals = rippleNormalMap(256, 12, 7);
    this.surfaceNormals.repeat.set(8, 12);
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(90, SPAN + NEAR),
      new THREE.MeshStandardMaterial({
        color: 0x7fd3f0,
        emissive: 0x4fb8e0,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        normalMap: this.surfaceNormals,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(0, SURFACE_Y, NEAR - (SPAN + NEAR) / 2);
    this.group.add(surface);

    // God rays slanting down from the surface. They stay with the camera and breathe.
    const rayMat = new THREE.MeshBasicMaterial({
      map: rayTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0.35,
      fog: false,
    });
    for (let i = 0; i < 7; i++) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(2.5 + Math.random() * 2, 16), rayMat.clone());
      ray.position.set(-12 + i * 4 + Math.random() * 2, 0, -12 - Math.random() * 30);
      ray.rotation.set(0, Math.random() * 0.6 - 0.3, 0.35);
      this.rays.push(ray);
      this.group.add(ray);
    }

    const kelpMat = std(0x3d9a52, { roughness: 0.6 });
    const kelpDark = std(0x2c7a40, { roughness: 0.6 });
    const rockMat = std(0x6f7f8c, { roughness: 0.9 });
    const coralColors = [0xff7f6e, 0xff9fc6, 0xffb347, 0xb48cff];
    const fishColors = [0xff9f1c, 0xffd23f, 0xff5d73, 0x4fc3f7, 0x9be15d];
    const bubbleMat = new THREE.MeshPhysicalMaterial({ color: 0xe6fbff, roughness: 0, transparent: true, opacity: 0.45, clearcoat: 1 });

    const randomX = (edge: boolean) =>
      edge ? (Math.random() < 0.5 ? -1 : 1) * (4.6 + Math.random() * 14) : (Math.random() - 0.5) * 22;
    const place = (o: THREE.Object3D, edge: boolean) => {
      o.position.set(randomX(edge), o.position.y, NEAR - Math.random() * (SPAN + NEAR));
    };

    for (let i = 0; i < 46; i++) {
      const h = 3 + Math.random() * 5;
      const sway = (Math.random() - 0.5) * 0.8;
      const kelp = new THREE.Mesh(
        taperedLimb(
          [new THREE.Vector3(0, 0, 0), new THREE.Vector3(sway, h * 0.35, 0), new THREE.Vector3(-sway, h * 0.7, 0.2), new THREE.Vector3(sway * 0.5, h, 0)],
          0.12,
          0.25,
          16,
          6,
        ),
        i % 3 === 0 ? kelpDark : kelpMat,
      );
      kelp.scale.set(1.8, 1, 0.5); // flattened into a ribbon
      kelp.position.y = SEABED_Y;
      place(kelp, true);
      this.group.add(kelp);
      this.drifters.push({ object: kelp, vx: 0, vy: 0, sway: Math.random() * 6 });
    }
    for (let i = 0; i < 20; i++) {
      const rock = new THREE.Mesh(lumpyRock(0.7 + Math.random() * 1.2), rockMat);
      rock.position.y = SEABED_Y + 0.2;
      rock.rotation.y = Math.random() * 6;
      place(rock, true);
      this.group.add(rock);
      this.drifters.push({ object: rock, vx: 0, vy: 0, sway: 0 });
    }
    for (let i = 0; i < 24; i++) {
      const coral = new THREE.Group();
      const m = std(coralColors[i % coralColors.length], { roughness: 0.55 });
      if (i % 2 === 0) {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          const tip = new THREE.Vector3(Math.cos(a) * 0.5, 0.8 + Math.random() * 0.6, Math.sin(a) * 0.5);
          coral.add(new THREE.Mesh(taperedLimb([new THREE.Vector3(0, 0, 0), tip.clone().multiplyScalar(0.5).setY(0.5), tip], 0.11, 0.6, 10, 8), m));
        }
      } else {
        const brain = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), m);
        brain.scale.y = 0.6;
        coral.add(brain);
      }
      coral.position.y = SEABED_Y;
      place(coral, true);
      this.group.add(coral);
      this.drifters.push({ object: coral, vx: 0, vy: 0, sway: 0 });
    }
    for (let i = 0; i < 18; i++) {
      const fish = new THREE.Group();
      const m = std(fishColors[i % fishColors.length], { roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), m);
      body.scale.set(1.7, 1, 0.65);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 12), m);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.45;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std(0x111111));
      eye.position.set(0.24, 0.05, 0.1);
      fish.add(body, tail, eye);
      fish.position.y = SEABED_Y + 1.5 + Math.random() * 7;
      const vx = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2);
      fish.rotation.y = vx > 0 ? 0 : Math.PI;
      place(fish, false);
      this.group.add(fish);
      this.drifters.push({ object: fish, vx, vy: 0, sway: Math.random() * 6 });
    }
    const bubbleGeo = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 60; i++) {
      const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
      bubble.scale.setScalar(0.04 + Math.random() * 0.1);
      bubble.position.y = SEABED_Y + Math.random() * 10;
      place(bubble, false);
      this.group.add(bubble);
      this.drifters.push({ object: bubble, vx: 0, vy: 0.6 + Math.random() * 0.9, sway: Math.random() * 6 });
    }
  }

  /** Move everything towards the camera by `step` units. */
  update(dt: number, distance: number, step: number): void {
    this.time += dt;
    this.sand.offset.y = distance / SAND_TILE;
    this.surfaceNormals.offset.set(Math.sin(this.time * 0.2) * 0.1, this.time * 0.03);
    this.rays.forEach((r, i) => {
      (r.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.14 * Math.sin(this.time * 0.8 + i * 1.7);
    });
    for (const d of this.drifters) {
      const o = d.object;
      o.position.z += step;
      o.position.x += d.vx * dt;
      if (d.vy) {
        o.position.y += d.vy * dt;
        o.position.x += Math.sin(this.time * 3 + d.sway) * 0.004;
        if (o.position.y > SURFACE_Y) o.position.y = SEABED_Y;
      } else if (d.sway && !d.vx) {
        o.rotation.z = Math.sin(this.time * 1.2 + d.sway) * 0.1; // kelp sways
      } else if (d.vx) {
        o.rotation.z = Math.sin(this.time * 8 + d.sway) * 0.08; // fish wiggle
      }
      if (o.position.z > NEAR) o.position.z -= SPAN + NEAR;
      if (Math.abs(o.position.x) > 22) o.position.x = -Math.sign(o.position.x) * 21;
    }
  }
}

// --- Coins and creatures -----------------------------------------------------------------------

let coinParts: { geometry: THREE.CylinderGeometry; materials: THREE.Material[] } | null = null;

/** A spinning gold coin with a "$" face. Spin the returned group around Y. */
export function makeCoin(): THREE.Group {
  if (!coinParts) {
    const face = new THREE.MeshStandardMaterial({
      map: coinFaceTexture(),
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0xffb000,
      emissiveIntensity: 0.25,
    });
    const edge = new THREE.MeshStandardMaterial({ color: 0xe0a21a, metalness: 1, roughness: 0.3, emissive: 0x7a4a00, emissiveIntensity: 0.3 });
    coinParts = { geometry: new THREE.CylinderGeometry(0.36, 0.36, 0.08, 40), materials: [edge, face, face] };
  }
  const coin = new THREE.Mesh(coinParts.geometry, coinParts.materials);
  coin.rotation.x = Math.PI / 2; // faces towards the camera; the group spins it
  const group = new THREE.Group();
  group.add(coin);
  return group;
}

/** A glowing pink jellyfish: a pulsing bell with trailing tentacles. */
export function makeJelly(): THREE.Group {
  const group = new THREE.Group();
  const bellMat = new THREE.MeshPhysicalMaterial({
    color: 0xff8fd0,
    emissive: 0xff3fa8,
    emissiveIntensity: 0.55,
    roughness: 0.15,
    clearcoat: 1,
    transparent: true,
    opacity: 0.8,
  });
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), bellMat);
  bell.scale.y = 0.85;
  bell.name = 'bell';
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd1ec }));
  core.position.y = 0.18;
  group.add(bell, core);
  const tentacleMat = bellMat.clone();
  tentacleMat.opacity = 0.65;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const x = Math.cos(a) * 0.38;
    const z = Math.sin(a) * 0.38;
    const tentacle = new THREE.Mesh(
      taperedLimb([new THREE.Vector3(x, 0, z), new THREE.Vector3(x * 1.2, -0.5, z * 1.2), new THREE.Vector3(x * 0.8, -1, z), new THREE.Vector3(x, -1.5, z * 0.7)], 0.04, 0.3, 12, 6),
      tentacleMat,
    );
    tentacle.name = 'tentacle';
    group.add(tentacle);
  }
  return group;
}

/**
 * A spiky pufferfish that puffs up and down. Coral orange with dark red spikes, so it can't be
 * mistaken for a gold coin when the two sit side by side.
 */
export function makePuffer(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  const skin = std(0xff6a3d, { roughness: 0.45, emissive: 0x7a2210, emissiveIntensity: 0.35 });
  const belly = std(0xffe3d6, { roughness: 0.5 });
  body.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), skin));
  const under = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), belly);
  under.position.y = -0.06;
  body.add(under);
  const spikeGeo = new THREE.ConeGeometry(0.05, 0.22, 8);
  const spikeMat = std(0xa62a17, { roughness: 0.5 });
  const n = 36;
  for (let i = 0; i < n; i++) {
    // Fibonacci sphere: even spacing over the body.
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963;
    const dir = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.copy(dir).multiplyScalar(0.55);
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    body.add(spike);
  }
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), std(0xffffff, { roughness: 0.2 }));
    eye.position.set(side * 0.22, 0.14, 0.4);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), std(0x111111, { roughness: 0.2 }));
    pupil.position.set(side * 0.22, 0.14, 0.51);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), std(0xff8a5c));
    fin.scale.set(0.3, 1, 0.8);
    fin.position.set(side * 0.5, -0.05, 0);
    body.add(eye, pupil, fin);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16), std(0x5a1a10));
  mouth.position.set(0, -0.06, 0.5);
  body.add(mouth);
  group.add(body);
  return group;
}
