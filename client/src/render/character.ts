// Bill the duck: the player character, built from Three.js primitives (brief §9, option B).
// Render-only. Nothing here may feed back into gameplay: hitboxes live in sim/constants.ts.
// Origin at the feet, facing +Z, about 1.8 units tall. The character's left is +X.

import * as THREE from 'three';

export type CharacterPose =
  | 'run' | 'laneLeft' | 'laneRight' | 'hit' | 'fly'
  | 'attack' | 'victory' | 'fail' | 'idle';

export interface CharacterView {
  object: THREE.Object3D;
  /**
   * Bill's head, for attaching face props that must follow it exactly (the dollar-sign eyes, the
   * greedy tongue). Head space: eyes at (±0.065, 0.03, 0.145), bill tip near (0, -0.04, 0.32).
   */
  head: THREE.Object3D;
  setPose(pose: CharacterPose): void;
  setGhost(isGhost: boolean): void;   // translucent version for the ghost
  update(dtSeconds: number): void;    // animation only
}

export interface CharacterOptions {
  coatColor?: number;
}

const COLORS = {
  feathers: 0xfdfaf2,
  beak: 0xf39c32,
  coat: 0x7a5c3e,
  lapel: 0x6a4e33,
  shirt: 0xffffff,
  tie: 0xc0392b,
  button: 0xc9a227,
  bootBrown: 0x5a3b22,
  bootBlack: 0x2f2f2f,
  lace: 0xe8e0c8,
  cap: 0x4b4f58,
  capBrim: 0x3c4048,
  shades: 0x1f1f1f,
  eyeWhite: 0xffffff,
  pupil: 0x1a1a1a,
  lid: 0xe7dfcf,
  toothpick: 0xd9b77a,
  latte: 0xc8a27a,
  straw: 0x2e86de,
  banknote: 0x7fb77e,
  coin: 0xe3b505,
  ghostTint: 0x223366,
};

const MODEL_SCALE = 1.1;
const HIP_HEIGHT = 0.45;
const COIN_COUNT = 8;
const GRAVITY = 9.8;

// Transient poses play over the current base pose, then hand back to it.
const TRANSIENT_SECONDS: Partial<Record<CharacterPose, number>> = {
  laneLeft: 0.3,
  laneRight: 0.3,
  hit: 0.6,
  attack: 0.45,
};

type BasePose = 'run' | 'fly' | 'idle' | 'victory' | 'fail';

interface Rig {
  hipsY: number;
  hipsPitch: number;
  hipsRoll: number;
  hipsYaw: number;
  legL: number;
  legR: number;
  wingLX: number;
  wingLZ: number;
  wingRX: number;
  wingRZ: number;
  headPitch: number;
  headYaw: number;
  tieSwing: number;
  tailWiggle: number;
  capLift: number;
  capSpin: number;
  lid: number;
}

interface Coin {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: number;
  life: number;
}

function restRig(): Rig {
  return {
    hipsY: HIP_HEIGHT,
    hipsPitch: 0,
    hipsRoll: 0,
    hipsYaw: 0,
    legL: 0,
    legR: 0,
    wingLX: -0.25,
    wingLZ: -0.15,
    wingRX: -1.1,
    wingRZ: 0.1,
    headPitch: 0,
    headYaw: 0,
    tieSwing: 0,
    tailWiggle: 0,
    capLift: 0,
    capSpin: 0,
    lid: 0.45,
  };
}

function wrapAngle(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createCharacter(options: CharacterOptions = {}): CharacterView {
  const materials: THREE.MeshToonMaterial[] = [];
  const mat = (color: number): THREE.MeshToonMaterial => {
    const m = new THREE.MeshToonMaterial({ color });
    materials.push(m);
    return m;
  };

  const m = {
    feathers: mat(COLORS.feathers),
    beak: mat(COLORS.beak),
    coat: mat(options.coatColor ?? COLORS.coat),
    lapel: mat(COLORS.lapel),
    shirt: mat(COLORS.shirt),
    tie: mat(COLORS.tie),
    button: mat(COLORS.button),
    bootBrown: mat(COLORS.bootBrown),
    bootBlack: mat(COLORS.bootBlack),
    lace: mat(COLORS.lace),
    cap: mat(COLORS.cap),
    capBrim: mat(COLORS.capBrim),
    shades: mat(COLORS.shades),
    eyeWhite: mat(COLORS.eyeWhite),
    pupil: mat(COLORS.pupil),
    lid: mat(COLORS.lid),
    toothpick: mat(COLORS.toothpick),
    latte: mat(COLORS.latte),
    straw: mat(COLORS.straw),
    banknote: mat(COLORS.banknote),
    coin: mat(COLORS.coin),
  };

  const add = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0, y = 0, z = 0,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const group = (parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  const root = new THREE.Group();
  root.name = 'Bill';
  const model = group(root);
  model.scale.setScalar(MODEL_SCALE);

  // Everything above the ground hangs off the hips, so whole-body poses pivot there.
  // Positions below are world heights minus HIP_HEIGHT.
  const hips = group(model, 0, HIP_HEIGHT, 0);

  // Legs and the untied, mismatched boots
  const makeLeg = (side: 1 | -1, bootMat: THREE.Material): THREE.Group => {
    const leg = group(hips, 0.12 * side, 0, 0);
    add(leg, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), m.beak, 0, -0.15, 0);
    add(leg, new THREE.CylinderGeometry(0.07, 0.075, 0.12, 12), bootMat, 0, -0.33, 0);
    add(leg, new THREE.BoxGeometry(0.15, 0.08, 0.26), bootMat, 0, -0.41, 0.05);
    return leg;
  };
  const legL = makeLeg(1, m.bootBrown);
  const legR = makeLeg(-1, m.bootBlack);
  const lace = add(legL, new THREE.BoxGeometry(0.012, 0.012, 0.16), m.lace, 0.06, -0.43, 0.2);
  lace.rotation.y = 0.5;
  add(legR, new THREE.SphereGeometry(0.03, 8, 8), m.beak, -0.03, -0.41, 0.18); // toe through the hole

  // Body and the crumpled coat
  const torso = add(hips, new THREE.SphereGeometry(0.3, 20, 16), m.feathers, 0, 0.3, 0);
  torso.scale.set(0.88, 1.1, 0.85); // kept inside the coat so only the chest shows above it
  add(hips, new THREE.CylinderGeometry(0.27, 0.38, 0.62, 18), m.coat, 0, 0.27, 0);
  add(hips, new THREE.BoxGeometry(0.14, 0.22, 0.02), m.shirt, 0, 0.47, 0.295);
  const lapelL = add(hips, new THREE.BoxGeometry(0.06, 0.2, 0.02), m.lapel, 0.08, 0.47, 0.3);
  lapelL.rotation.z = 0.35;
  const lapelR = add(hips, new THREE.BoxGeometry(0.06, 0.2, 0.02), m.lapel, -0.08, 0.47, 0.3);
  lapelR.rotation.z = -0.5; // flipped up, never fixed

  // Buttoned wrong: three buttons that don't line up
  const buttonGeo = new THREE.SphereGeometry(0.018, 8, 8);
  add(hips, buttonGeo, m.button, 0.03, 0.33, 0.318);
  add(hips, buttonGeo, m.button, -0.02, 0.25, 0.332);
  add(hips, buttonGeo, m.button, 0.035, 0.17, 0.345);

  // Pockets, with cash poking out of the left one
  const pocketGeo = new THREE.BoxGeometry(0.14, 0.035, 0.03);
  const pocketL = add(hips, pocketGeo, m.lapel, 0.2, 0.17, 0.27);
  pocketL.rotation.y = 0.62;
  const pocketR = add(hips, pocketGeo, m.lapel, -0.2, 0.17, 0.27);
  pocketR.rotation.y = -0.62;
  const noteGeo = new THREE.BoxGeometry(0.1, 0.07, 0.005);
  const note1 = add(hips, noteGeo, m.banknote, 0.18, 0.21, 0.27);
  note1.rotation.set(0, 0.62, 0.3);
  const note2 = add(hips, noteGeo, m.banknote, 0.22, 0.22, 0.26);
  note2.rotation.set(0, 0.62, -0.25);

  // Loose tie, pivoting at the knot so it can flap
  const tie = group(hips, 0, 0.53, 0.31);
  add(tie, new THREE.BoxGeometry(0.06, 0.05, 0.03), m.tie);
  const tieBlade = add(tie, new THREE.BoxGeometry(0.065, 0.26, 0.02), m.tie, 0.02, -0.15, 0.02);
  tieBlade.rotation.z = 0.15;

  // Tail feathers
  const tail = group(hips, 0, 0.17, -0.3);
  const tailCone = add(tail, new THREE.ConeGeometry(0.12, 0.25, 10), m.feathers, 0, 0.05, -0.1);
  tailCone.rotation.x = -Math.PI / 2 + 0.5;

  // Wings in coat sleeves. Left one is jammed in a pocket, right one holds the £7 latte.
  const makeWing = (side: 1 | -1): THREE.Group => {
    const wing = group(hips, 0.27 * side, 0.53, 0);
    add(wing, new THREE.CylinderGeometry(0.065, 0.08, 0.36, 10), m.coat, 0, -0.18, 0);
    const tip = add(wing, new THREE.ConeGeometry(0.07, 0.14, 8), m.feathers, 0, -0.42, 0);
    tip.rotation.x = Math.PI;
    return wing;
  };
  const wingL = makeWing(1);
  const wingR = makeWing(-1);
  const latte = group(wingR, 0, -0.44, 0.02);
  latte.rotation.x = 1.1; // keeps the cup upright while the wing points forward
  add(latte, new THREE.CylinderGeometry(0.055, 0.045, 0.14, 12), m.latte, 0, 0.07, 0);
  add(latte, new THREE.SphereGeometry(0.056, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m.shirt, 0, 0.14, 0);
  const straw = add(latte, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), m.straw, 0.015, 0.22, 0);
  straw.rotation.z = -0.25;

  // Neck and head
  const neck = add(hips, new THREE.CylinderGeometry(0.075, 0.085, 0.4, 12), m.feathers, 0, 0.77, 0.02);
  neck.rotation.x = 0.1;
  const head = group(hips, 0, 1.0, 0.06);
  add(head, new THREE.SphereGeometry(0.17, 20, 16), m.feathers);
  const bill = add(head, new THREE.SphereGeometry(1, 16, 10), m.beak, 0, -0.04, 0.17);
  bill.scale.set(0.11, 0.035, 0.15);
  const pick = add(head, new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), m.toothpick, 0.08, -0.05, 0.2);
  pick.rotation.set(0.2, 0, 1.2);

  // Half-asleep eyes: whites, pupils looking slightly down, and heavy lids
  const lids: THREE.Mesh[] = [];
  for (const side of [1, -1]) {
    add(head, new THREE.SphereGeometry(0.045, 12, 10), m.eyeWhite, 0.065 * side, 0.03, 0.145);
    add(head, new THREE.SphereGeometry(0.02, 8, 8), m.pupil, 0.065 * side, 0.02, 0.188);
    const lid = add(
      head,
      new THREE.SphereGeometry(0.048, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      m.lid,
      0.065 * side, 0.03, 0.145,
    );
    lids.push(lid);
  }

  // Flat cap, worn wonky, with sunglasses parked on it
  const cap = group(head, 0, 0.13, 0);
  const capTilt = group(cap);
  capTilt.rotation.set(-0.1, 0, 0.25);
  const crown = add(capTilt, new THREE.CylinderGeometry(0.17, 0.19, 0.06, 18), m.cap);
  crown.scale.z = 1.1;
  add(capTilt, new THREE.CylinderGeometry(0.12, 0.12, 0.015, 16, 1, false, -Math.PI / 2, Math.PI), m.capBrim, 0, -0.02, 0.12);
  add(capTilt, new THREE.SphereGeometry(0.015, 8, 8), m.cap, 0, 0.035, 0);
  for (const side of [1, -1]) {
    const lens = add(capTilt, new THREE.CylinderGeometry(0.035, 0.035, 0.01, 12), m.shades, 0.045 * side, 0.035, 0.11);
    lens.rotation.x = -0.6;
  }
  add(capTilt, new THREE.BoxGeometry(0.02, 0.008, 0.008), m.shades, 0, 0.04, 0.11);

  // Coins that burst out of his pockets on a hit. Cosmetic only.
  const coinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.012, 14);
  const coins: Coin[] = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    const mesh = add(model, coinGeo, m.coin);
    mesh.visible = false;
    coins.push({ mesh, velocity: new THREE.Vector3(), spin: 0, life: 0 });
  }

  // Animation state
  const current = restRig();
  const target = restRig();
  let pose: CharacterPose = 'idle';
  let basePose: BasePose = 'idle';
  let poseTime = 0;
  let time = 0;
  let isGhost = false;
  let nextBlink = randomBetween(2, 5);
  let blinkLeft = 0;

  const spawnCoins = (): void => {
    if (isGhost) return;
    coins.forEach((coin, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      coin.mesh.position.set(0.2 * side, HIP_HEIGHT + 0.17, 0.27);
      coin.velocity.set(randomBetween(0.3, 1.4) * side, randomBetween(1.6, 2.8), randomBetween(-0.8, 0.8));
      coin.spin = randomBetween(8, 16);
      coin.life = 1.2;
      coin.mesh.visible = true;
    });
  };

  const updateCoins = (dt: number): void => {
    for (const coin of coins) {
      if (coin.life <= 0) continue;
      coin.life -= dt;
      coin.velocity.y -= GRAVITY * dt;
      coin.mesh.position.addScaledVector(coin.velocity, dt);
      if (coin.mesh.position.y < 0.02) {
        coin.mesh.position.y = 0.02;
        coin.velocity.y *= -0.35;
        coin.velocity.x *= 0.6;
        coin.velocity.z *= 0.6;
      }
      coin.mesh.rotation.x += coin.spin * dt;
      coin.mesh.visible = coin.life > 0;
    }
  };

  const setBaseTargets = (p: BasePose, t: number): void => {
    Object.assign(target, restRig());
    switch (p) {
      case 'idle':
        target.hipsY += 0.01 * Math.sin(t * 2);
        target.headYaw = 0.25 * Math.sin(t * 0.5);
        target.tailWiggle = 0.2 * Math.sin(t * 3);
        break;
      case 'run': {
        const w = t * 11;
        const s = Math.sin(w);
        target.legL = 0.7 * s;
        target.legR = -0.7 * s;
        target.hipsRoll = 0.12 * s; // the waddle
        target.hipsY = HIP_HEIGHT + 0.04 * Math.abs(Math.cos(w));
        target.hipsPitch = 0.12;
        target.wingLZ = -0.15 + 0.08 * s;
        target.headPitch = 0.05 * Math.sin(w * 2);
        target.tieSwing = 0.35 * Math.sin(w + 1);
        target.tailWiggle = 0.4 * Math.sin(w);
        break;
      }
      case 'fly': {
        const flap = Math.sin(t * 14);
        target.hipsY = HIP_HEIGHT + 0.15;
        target.hipsPitch = 1.0;
        target.legL = 0.5;
        target.legR = 0.5;
        target.wingLX = 0;
        target.wingRX = 0;
        target.wingLZ = 1.4 + 0.5 * flap;
        target.wingRZ = -(1.4 + 0.5 * flap);
        target.headPitch = -0.8;
        target.tieSwing = 0.6 * Math.sin(t * 20);
        target.tailWiggle = 0.3 * Math.sin(t * 7);
        break;
      }
      case 'victory':
        target.hipsY = HIP_HEIGHT + 0.25 * Math.abs(Math.sin(t * 5));
        target.wingLZ = 2.4 + 0.2 * Math.sin(t * 10);
        target.wingRZ = -2.4 - 0.2 * Math.sin(t * 10);
        target.wingRX = 0;
        target.wingLX = 0;
        target.capLift = 0.08 + 0.05 * Math.sin(t * 6);
        target.capSpin = t * 3;
        target.headPitch = -0.3;
        target.lid = 0;
        break;
      case 'fail':
        target.hipsPitch = -1.45;
        target.hipsY = 0.18;
        target.legL = 0.6 + 0.3 * Math.sin(t * 9);
        target.legR = 0.6 - 0.3 * Math.sin(t * 9);
        target.wingLZ = 1.2;
        target.wingRZ = -1.2;
        target.capLift = 0.35;
        target.lid = 0.9;
        break;
    }
  };

  const applyOverlay = (p: CharacterPose, t: number): void => {
    const duration = TRANSIENT_SECONDS[p];
    if (duration === undefined) return;
    const progress = Math.min(t / duration, 1);
    const bump = Math.sin(Math.PI * progress);
    switch (p) {
      case 'laneLeft':
        target.hipsRoll -= 0.35 * bump; // lean toward +X, the character's left
        break;
      case 'laneRight':
        target.hipsRoll += 0.35 * bump;
        break;
      case 'hit':
        target.hipsPitch += 0.6 * bump;
        target.hipsYaw = Math.PI * 2 * (1 - (1 - progress) * (1 - progress));
        target.wingLZ = 0.9;
        target.wingRZ = -0.9;
        target.capLift = 0.25 * bump;
        target.capSpin = 4 * progress;
        target.lid = 0;
        break;
      case 'attack':
        target.hipsPitch += 0.5 * bump;
        target.headPitch += 0.6 * bump; // the peck
        target.wingRX = -1.1 - 1.3 * bump;
        target.lid = 0.1;
        break;
    }
  };

  const applyRig = (): void => {
    hips.position.y = current.hipsY;
    hips.rotation.set(current.hipsPitch, current.hipsYaw, current.hipsRoll, 'YXZ');
    legL.rotation.x = current.legL;
    legR.rotation.x = current.legR;
    wingL.rotation.set(current.wingLX, 0, current.wingLZ);
    wingR.rotation.set(current.wingRX, 0, current.wingRZ);
    head.rotation.set(current.headPitch, current.headYaw, 0);
    tie.rotation.z = current.tieSwing;
    tail.rotation.y = current.tailWiggle;
    cap.position.y = 0.13 + current.capLift;
    cap.position.x = Math.max(0, current.capLift - 0.25) * 1.2; // knocked sideways when he flops
    cap.rotation.y = current.capSpin;
    const lid = blinkLeft > 0 ? 1 : current.lid;
    for (const l of lids) l.rotation.x = -0.7 + 1.6 * lid;
  };

  const setPose = (next: CharacterPose): void => {
    const transient = TRANSIENT_SECONDS[next] !== undefined;
    if (next === pose && !transient) return;
    current.hipsYaw = wrapAngle(current.hipsYaw);
    current.capSpin = wrapAngle(current.capSpin);
    pose = next;
    poseTime = 0;
    if (!transient) basePose = next as BasePose;
    if (next === 'hit') spawnCoins();
  };

  const setGhost = (ghost: boolean): void => {
    isGhost = ghost;
    for (const material of materials) {
      material.transparent = ghost;
      material.opacity = ghost ? 0.35 : 1;
      material.depthWrite = !ghost;
      material.emissive.setHex(ghost ? COLORS.ghostTint : 0x000000);
      material.needsUpdate = true;
    }
    root.traverse((obj) => {
      obj.castShadow = !ghost;
    });
    if (ghost) for (const coin of coins) { coin.life = 0; coin.mesh.visible = false; }
  };

  const update = (dtSeconds: number): void => {
    const dt = Math.min(Math.max(dtSeconds, 0), 0.1);
    time += dt;
    poseTime += dt;

    const duration = TRANSIENT_SECONDS[pose];
    if (duration !== undefined && poseTime >= duration) {
      current.hipsYaw = wrapAngle(current.hipsYaw);
      current.capSpin = wrapAngle(current.capSpin);
      pose = basePose;
      poseTime = 0;
    }

    setBaseTargets(basePose, time);
    applyOverlay(pose, poseTime);

    const blend = 1 - Math.exp(-14 * dt);
    for (const key of Object.keys(current) as (keyof Rig)[]) {
      current[key] += (target[key] - current[key]) * blend;
    }

    nextBlink -= dt;
    if (nextBlink <= 0) {
      blinkLeft = 0.12;
      nextBlink = randomBetween(2.5, 5);
    }
    blinkLeft = Math.max(0, blinkLeft - dt);

    applyRig();
    updateCoins(dt);
  };

  applyRig();

  return { object: root, head, setPose, setGhost, update };
}
