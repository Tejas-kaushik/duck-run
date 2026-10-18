// The forest road (Tejas): a muddy track with ruts and puddles, grassy verges that rise into the
// woods, and instanced trees, bushes, rocks, flowers, mushrooms and grass tufts that scroll past and
// recycle. Instancing keeps hundreds of props to a handful of draw calls. Render-only; cosmetic
// randomness uses Math.random() on purpose.

import * as THREE from 'three';
import { grassTexture, mudTextures } from './textures';

export const ROAD_HALF_WIDTH = 4.7;
const STRIP_LENGTH = 340;
const NEAR = 24; // props recycle once they're this far behind Bill
const SPAN = 260; // ...back to this far ahead
const MUD_TILE = 9;
const GRASS_TILE = 10;

/** Height of the ground beside the road (only depends on x, so it scrolls). The road itself is y = 0. */
export function bankHeight(x: number): number {
  const d = Math.abs(x) - ROAD_HALF_WIDTH + 0.4;
  if (d <= 0) return -0.02;
  const rise = Math.min(1, d / 4);
  return -0.02 + 0.9 * (rise * rise * (3 - 2 * rise)) + 0.3 * Math.sin(Math.abs(x) * 0.35) * rise;
}

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  local: THREE.Matrix4;
}

interface Prop {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
}

const m4 = (x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

/** One kind of prop (e.g. pine tree), drawn as one InstancedMesh per part. */
class PropKind {
  readonly meshes: THREE.InstancedMesh[];
  private readonly matrix = new THREE.Matrix4();
  private readonly base = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly parts: Part[],
    readonly props: Prop[],
    castShadow: boolean,
  ) {
    this.meshes = parts.map((p) => {
      const mesh = new THREE.InstancedMesh(p.geometry, p.material, props.length);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // instances are spread along the whole river
      return mesh;
    });
    this.write();
  }

  scroll(step: number): void {
    for (const p of this.props) {
      p.z += step;
      if (p.z > NEAR) p.z -= SPAN + NEAR;
    }
    this.write();
  }

  private write(): void {
    this.props.forEach((p, i) => {
      this.q.setFromAxisAngle(this.up, p.rotY);
      this.base.compose(new THREE.Vector3(p.x, p.y, p.z), this.q, new THREE.Vector3(p.scale, p.scale, p.scale));
      this.parts.forEach((part, k) => {
        this.matrix.multiplyMatrices(this.base, part.local);
        this.meshes[k].setMatrixAt(i, this.matrix);
      });
    });
    this.meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }
}

function scatter(count: number, minX: number, maxX: number, onBank: boolean, scale: [number, number]): Prop[] {
  return Array.from({ length: count }, () => {
    const x = (Math.random() < 0.5 ? -1 : 1) * (minX + Math.random() * (maxX - minX));
    return {
      x,
      y: onBank ? bankHeight(x) : 0,
      z: NEAR - Math.random() * (SPAN + NEAR),
      scale: scale[0] + Math.random() * (scale[1] - scale[0]),
      rotY: Math.random() * Math.PI * 2,
    };
  });
}

export class ForestRoad {
  readonly group = new THREE.Group();
  private readonly kinds: PropKind[] = [];
  private readonly mud: THREE.Texture[];
  private readonly grass: THREE.Texture[] = [];

  constructor() {
    // The road: muddy, rutted, with glossy puddles. The texture spans the road's width exactly once,
    // so the wheel ruts line up with the three lanes.
    const mud = mudTextures();
    this.mud = [mud.map, mud.normalMap, mud.roughnessMap];
    for (const t of this.mud) t.repeat.set(1, STRIP_LENGTH / MUD_TILE);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, STRIP_LENGTH),
      new THREE.MeshStandardMaterial({
        map: mud.map,
        normalMap: mud.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughnessMap: mud.roughnessMap,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.9,
      }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = NEAR - STRIP_LENGTH / 2;
    road.receiveShadow = true;
    this.group.add(road);

    // Verges: a smooth slope up from the road, then gently rolling forest floor.
    for (const side of [-1, 1]) {
      const width = 60;
      const geometry = new THREE.PlaneGeometry(width, STRIP_LENGTH, 60, 1);
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = side * (ROAD_HALF_WIDTH - 0.6 + (pos.getX(i) + width / 2));
        pos.setX(i, x);
        pos.setZ(i, bankHeight(x)); // plane is rotated below, so local z becomes height
      }
      if (side < 0) {
        // Mirroring x flips the triangles inside out; swap two corners of each to face up again.
        const index = geometry.index!;
        for (let i = 0; i < index.count; i += 3) {
          const b = index.getX(i + 1);
          index.setX(i + 1, index.getX(i + 2));
          index.setX(i + 2, b);
        }
      }
      geometry.computeVertexNormals();
      const texture = grassTexture();
      texture.repeat.set(width / GRASS_TILE, STRIP_LENGTH / GRASS_TILE);
      this.grass.push(texture);
      const bank = new THREE.Mesh(geometry, mat(0xffffff, { map: texture, roughness: 0.95 }));
      bank.rotation.x = -Math.PI / 2;
      bank.position.z = NEAR - STRIP_LENGTH / 2;
      bank.receiveShadow = true;
      this.group.add(bank);
    }

    const bark = mat(0x6b4a2f);
    const pineGreen = mat(0x2f6b3a);
    const leafGreen = mat(0x4f9a3c);
    const bushGreen = mat(0x3f8a3a);
    const stone = mat(0x8a8f95, { roughness: 0.75 });

    const cone = (r: number, h: number) => new THREE.ConeGeometry(r, h, 18, 1);
    const blob = (r: number) => new THREE.IcosahedronGeometry(r, 3);

    this.addKind(
      [
        { geometry: new THREE.CylinderGeometry(0.16, 0.24, 1.6, 10), material: bark, local: m4(0, 0.8, 0) },
        { geometry: cone(1.7, 2.4), material: pineGreen, local: m4(0, 2.2, 0) },
        { geometry: cone(1.35, 2.1), material: pineGreen, local: m4(0, 3.3, 0) },
        { geometry: cone(0.9, 1.8), material: pineGreen, local: m4(0, 4.35, 0) },
      ],
      scatter(80, 7, 48, true, [0.9, 1.8]),
    );
    this.addKind(
      [
        { geometry: new THREE.CylinderGeometry(0.18, 0.28, 2.4, 10), material: bark, local: m4(0, 1.2, 0) },
        { geometry: blob(1.3), material: leafGreen, local: m4(0, 3.1, 0, 1.25, 1, 1.25) },
        { geometry: blob(1), material: leafGreen, local: m4(0.85, 2.7, 0.3) },
        { geometry: blob(1), material: leafGreen, local: m4(-0.75, 2.8, -0.25, 0.9) },
        { geometry: blob(0.9), material: leafGreen, local: m4(0.1, 3.9, 0.1) },
      ],
      scatter(60, 7.5, 48, true, [0.8, 1.5]),
    );
    this.addKind(
      [
        { geometry: blob(0.7), material: bushGreen, local: m4(0, 0.45, 0) },
        { geometry: blob(0.55), material: bushGreen, local: m4(0.6, 0.35, 0.2) },
        { geometry: blob(0.5), material: bushGreen, local: m4(-0.55, 0.3, -0.1) },
      ],
      scatter(50, 6, 16, true, [0.7, 1.3]),
    );
    this.addKind(
      [{ geometry: new THREE.DodecahedronGeometry(0.8, 1), material: stone, local: m4(0, 0.2, 0, 1.3, 0.7, 1) }],
      scatter(36, 5.8, 22, true, [0.5, 1.4]),
    );

    // Grass tufts softening the road's edge.
    const tuftMat = mat(0x5aa64a, { roughness: 0.9 });
    const tuftParts: Part[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      tuftParts.push({
        geometry: new THREE.ConeGeometry(0.05, 0.5 + (i % 3) * 0.12, 5),
        material: tuftMat,
        local: new THREE.Matrix4().compose(
          new THREE.Vector3(Math.cos(a) * 0.12, 0.22, Math.sin(a) * 0.12),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35)),
          new THREE.Vector3(1, 1, 1),
        ),
      });
    }
    this.addKind(tuftParts, scatter(90, ROAD_HALF_WIDTH - 0.3, ROAD_HALF_WIDTH + 1.6, true, [0.8, 1.4]), false);

    // Wildflowers on the verges.
    const stem = mat(0x4f8f3a);
    for (const petal of [0xff7aa8, 0xffe14d, 0xffffff, 0xb48cff]) {
      this.addKind(
        [
          { geometry: new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), material: stem, local: m4(0, 0.2, 0) },
          { geometry: new THREE.SphereGeometry(0.11, 10, 8), material: mat(petal, { roughness: 0.5 }), local: m4(0, 0.42, 0, 1, 0.5, 1) },
          { geometry: new THREE.SphereGeometry(0.045, 8, 6), material: mat(0xffb020), local: m4(0, 0.46, 0) },
        ],
        scatter(18, ROAD_HALF_WIDTH + 0.2, ROAD_HALF_WIDTH + 5, true, [0.8, 1.3]),
        false,
      );
    }

    // Red-capped mushrooms with white spots.
    const capGeo = new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    this.addKind(
      [
        { geometry: new THREE.CylinderGeometry(0.06, 0.08, 0.25, 10), material: mat(0xf3ead6), local: m4(0, 0.12, 0) },
        { geometry: capGeo, material: mat(0xd6402f, { roughness: 0.5 }), local: m4(0, 0.22, 0, 1, 0.8, 1) },
        { geometry: new THREE.SphereGeometry(0.035, 8, 6), material: mat(0xffffff), local: m4(0.09, 0.36, 0.05) },
        { geometry: new THREE.SphereGeometry(0.03, 8, 6), material: mat(0xffffff), local: m4(-0.07, 0.38, -0.06) },
      ],
      scatter(26, ROAD_HALF_WIDTH + 0.4, ROAD_HALF_WIDTH + 7, true, [0.8, 1.6]),
    );

    // Pebbles at the edge of the track.
    this.addKind(
      [{ geometry: new THREE.DodecahedronGeometry(0.18, 1), material: stone, local: m4(0, 0.05, 0, 1.3, 0.6, 1) }],
      scatter(50, ROAD_HALF_WIDTH - 0.6, ROAD_HALF_WIDTH + 0.6, false, [0.6, 1.4]),
      false,
    );

    // Far hills: big, hazy, static shapes so the horizon isn't empty.
    const hillMat = mat(0x3d7a45, { roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
      const side = i % 2 === 0 ? -1 : 1;
      hill.position.set(side * (25 + Math.random() * 70), -1, -150 - Math.random() * 30);
      hill.scale.set(30 + Math.random() * 30, 10 + Math.random() * 12, 20);
      this.group.add(hill);
    }
  }

  private addKind(parts: Part[], props: Prop[], castShadow = true): void {
    const kind = new PropKind(parts, props, castShadow);
    this.kinds.push(kind);
    this.group.add(...kind.meshes);
  }

  /** Move the world towards the camera by `step`; `distance` scrolls the ground textures. */
  scroll(distance: number, step: number): void {
    for (const t of this.mud) t.offset.y = distance / MUD_TILE;
    for (const g of this.grass) g.offset.y = distance / GRASS_TILE;
    if (step !== 0) for (const k of this.kinds) k.scroll(step);
  }
}
