// The boss: a grumpy mafia pigeon (Tejas). Fedora, pinstripe suit, gold chain, cigar, scar and a
// tommy gun. His face shows the fight: smug, then furious, then battered, then wrecked.
// Render-only: Zubair's sim/boss.ts decides shots, prompts and damage.

import * as THREE from 'three';

const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

function pinstripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#23252e';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(200,205,220,0.35)';
  g.lineWidth = 1.2;
  for (let x = 4; x < 128; x += 11) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 128);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.translate(32, 32);
  g.fillStyle = '#ffe14d';
  g.strokeStyle = '#a06a00';
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 28 : 12;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.stroke();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type Mood = 'smug' | 'angry' | 'hurt' | 'wrecked';

export function moodFor(healthFraction: number): Mood {
  if (healthFraction > 0.7) return 'smug';
  if (healthFraction > 0.4) return 'angry';
  if (healthFraction > 0.15) return 'hurt';
  return 'wrecked';
}

export class PigeonView {
  readonly root = new THREE.Group();
  /** Turns to aim; everything but the crate hangs off it. */
  private readonly body = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  /** Shoulder pivots, so the wings can flap when he swoops in. */
  private readonly wings: THREE.Group[] = [];
  private flap = 0;
  /** Landing squash: 1 on touchdown, springing back to 0. */
  private squash = 0;
  private sinceLanding = 0;
  /** Where the body is relative to its spot on the crate while it flies in (0 once landed). */
  private readonly flight = new THREE.Vector3();
  private bank = 0;
  private readonly gun = new THREE.Group();
  private readonly muzzle: THREE.Mesh;
  private readonly flashLight = new THREE.PointLight(0xffb347, 0, 8);
  private readonly hat = new THREE.Group();
  private readonly hatCrown: THREE.Mesh;
  private readonly cigar = new THREE.Group();
  private readonly brows: THREE.Mesh[] = [];
  private readonly lids: THREE.Mesh[] = [];
  private readonly headMat: THREE.MeshStandardMaterial;
  private readonly flashMats: THREE.MeshStandardMaterial[] = [];
  private readonly blackEye: THREE.Mesh;
  private readonly bandage: THREE.Group;
  private readonly sweat: THREE.Mesh;
  private readonly stars = new THREE.Group();
  private readonly feathers = new THREE.Group();
  private readonly puffs: { mesh: THREE.Mesh; life: number }[] = [];
  private mood: Mood = 'smug';
  private flinch = 0;
  private flash = 0;
  private rage = 0;
  private fallT = -1;
  private time = 0;
  private puffTimer = 0;

  constructor() {
    const grey = std(0x8f95a3);
    this.headMat = std(0x8f95a3);
    const neckSheen = std(0x5f8f78, { metalness: 0.35, roughness: 0.35 });
    const suit = std(0xffffff, { map: pinstripeTexture(), roughness: 0.65 });
    const shirt = std(0xf4f1ea, { roughness: 0.6 });
    const tieMat = std(0xb3202a, { roughness: 0.45 });
    const gold = std(0xffc83d, { metalness: 1, roughness: 0.25 });
    const black = std(0x15151a, { roughness: 0.4 });
    const felt = std(0x2b2d33, { roughness: 0.85 });
    this.flashMats.push(grey, this.headMat, suit);

    // Body in a pinstripe jacket, open at the front over a shirt and red tie.
    const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), grey);
    torso.scale.set(1.25, 1.45, 1.1);
    torso.position.y = 1.9;
    const jacket = new THREE.Mesh(new THREE.SphereGeometry(1.06, 40, 28, Math.PI * 0.62, Math.PI * 1.76), suit);
    jacket.scale.set(1.25, 1.42, 1.12);
    jacket.position.y = 1.85;
    const shirtFront = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24, -Math.PI * 0.2, Math.PI * 0.4, 0.5, 1.6), shirt);
    shirtFront.scale.set(1.18, 1.38, 1.1);
    shirtFront.position.y = 1.86;
    shirtFront.rotation.y = Math.PI / 2;
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.05, 1.1, 4), tieMat);
    tie.rotation.y = Math.PI / 4;
    tie.scale.z = 0.35;
    tie.position.set(0, 2.15, 1.12);
    tie.rotation.x = -0.25;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), tieMat);
    knot.position.set(0, 2.72, 1.0);
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.06), suit);
      lapel.position.set(side * 0.33, 2.35, 1.0);
      lapel.rotation.set(-0.35, side * 0.35, side * 0.35);
      this.body.add(lapel);
    }
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 10, 48, Math.PI), gold);
    chain.rotation.set(Math.PI * 0.6, 0, Math.PI);
    chain.position.set(0, 2.7, 0.55);
    const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 24), gold);
    medallion.rotation.x = Math.PI / 2;
    medallion.position.set(0, 2.22, 1.13);

    // Head: grey, shiny green neck, dark beak.
    const neck = new THREE.Mesh(new THREE.SphereGeometry(0.75, 28, 20), neckSheen);
    neck.scale.set(1, 0.8, 0.9);
    neck.position.set(0, 2.95, 0.15);
    this.headGroup.position.set(0, 3.55, 0.25);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.64, 32, 24), this.headMat);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 20), std(0x2e2e33, { roughness: 0.4 }));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.12, 0.72);
    const cere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), std(0xf0ece0));
    cere.position.set(0, 0.02, 0.58);
    this.headGroup.add(head, beak, cere);

    // Eyes: orange iris, black pupil, heavy lids and thick brows that move with his mood.
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), std(0xffffff, { roughness: 0.3 }));
      eye.position.set(side * 0.27, 0.12, 0.47);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), std(0xff8c1a, { roughness: 0.3 }));
      iris.position.set(side * 0.27, 0.11, 0.58);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), black);
      pupil.position.set(side * 0.27, 0.11, 0.66);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.185, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.headMat);
      lid.position.set(side * 0.27, 0.12, 0.47);
      lid.rotation.x = 0.9; // half shut: menacing
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 6, 12), black);
      brow.rotation.z = Math.PI / 2;
      brow.position.set(side * 0.27, 0.36, 0.55);
      this.lids.push(lid);
      this.brows.push(brow);
      this.headGroup.add(eye, iris, pupil, lid, brow);
    }
    // A scar across his right eye.
    const scar = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.38, 4, 8), std(0xd98a8a));
    scar.position.set(-0.27, 0.15, 0.66);
    scar.rotation.z = 0.5;
    this.headGroup.add(scar);

    // Battle damage, hidden until his health drops.
    this.blackEye = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 10, 24), std(0x3b2a4a, { roughness: 0.9 }));
    this.blackEye.position.set(0.27, 0.12, 0.55);
    this.blackEye.visible = false;
    this.bandage = new THREE.Group();
    const tape = std(0xf7f2e8, { roughness: 0.9 });
    for (const a of [0.7, -0.7]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.04), tape);
      strip.rotation.z = a;
      this.bandage.add(strip);
    }
    this.bandage.position.set(-0.32, 0.42, 0.5);
    this.bandage.rotation.y = -0.4;
    this.bandage.visible = false;
    this.sweat = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), std(0x8fd3ff, { roughness: 0.1, metalness: 0.2 }));
    this.sweat.scale.y = 1.4;
    this.sweat.position.set(0.55, 0.25, 0.3);
    this.sweat.visible = false;
    this.headGroup.add(this.blackEye, this.bandage, this.sweat);

    // Fedora with a band.
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.02, 0.06, 40), felt);
    this.hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.62, 40), felt);
    this.hatCrown.position.y = 0.32;
    const dent = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), felt);
    dent.scale.set(1.5, 0.3, 0.6);
    dent.position.y = 0.6;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.12, 40), black);
    band.position.y = 0.1;
    this.hat.add(brim, this.hatCrown, dent, band);
    this.hat.position.set(0, 0.5, -0.05);
    this.hat.rotation.set(-0.12, 0, 0.12);
    this.headGroup.add(this.hat);

    // Cigar in the corner of the beak, glowing at the tip.
    const cigarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.5, 14), std(0x6b3f1f, { roughness: 0.8 }));
    cigarBody.rotation.x = Math.PI / 2;
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 3 }));
    ember.position.z = 0.26;
    this.cigar.add(cigarBody, ember);
    this.cigar.position.set(0.22, -0.2, 0.75);
    this.cigar.rotation.y = 0.45;
    this.headGroup.add(this.cigar);

    // Dizzy stars that circle his head when he's wrecked.
    const starMat = new THREE.SpriteMaterial({ map: starTexture(), depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const star = new THREE.Sprite(starMat);
      star.scale.setScalar(0.32);
      this.stars.add(star);
    }
    this.stars.position.y = 0.95;
    this.stars.visible = false;
    this.headGroup.add(this.stars);

    // Ruffled feathers sticking out when he's hurt.
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 8), grey);
      const a = Math.random() * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.15, 1.6 + Math.random() * 0.9, Math.sin(a) * 1.0);
      f.rotation.set(Math.random() - 0.5, 0, Math.cos(a) * -1.2);
      this.feathers.add(f);
    }
    this.feathers.visible = false;

    // Wings (on shoulder pivots so they can flap) and pink legs.
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 1.0, 2.55, -0.05);
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.8, 28, 20), suit);
      wing.scale.set(0.38, 1, 0.9);
      wing.position.set(side * 0.25, -0.65, 0);
      wing.rotation.z = side * 0.25;
      pivot.add(wing);
      this.wings.push(pivot);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 10), std(0xd98a8a));
      leg.position.set(side * 0.45, 0.4, 0.1);
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 10), std(0xd98a8a));
      foot.rotation.x = Math.PI / 2;
      foot.position.set(side * 0.45, 0.06, 0.28);
      this.body.add(pivot, leg, foot);
    }

    // Tommy gun: finned barrel, drum magazine, wooden grip and stock. Points at the duck (+Z).
    const steel = std(0x2a2d33, { metalness: 0.8, roughness: 0.3 });
    const wood = std(0x7a4a24, { roughness: 0.6 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 16), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.75;
    for (let i = 0; i < 6; i++) {
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), steel);
      fin.rotation.x = Math.PI / 2;
      fin.position.z = 0.35 + i * 0.12;
      this.gun.add(fin);
    }
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.7), steel);
    receiver.position.z = 0.05;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 28), steel);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, -0.3, 0.2);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.16), wood);
    grip.position.set(0, -0.25, -0.15);
    grip.rotation.x = 0.3;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.6), wood);
    stock.position.set(0, -0.08, -0.55);
    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.muzzle.position.z = 1.45;
    this.flashLight.position.z = 1.5;
    this.gun.add(barrel, receiver, drum, grip, stock, this.muzzle, this.flashLight);
    this.gun.position.set(0.35, 2.15, 1.25);

    this.body.add(torso, jacket, shirtFront, tie, knot, chain, medallion, neck, this.headGroup, this.gun, this.feathers);

    // A floating crate to stand on.
    const crate = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 2.6), std(0x9a6b3c, { roughness: 0.8 }));
    crate.position.y = -0.4;
    for (const z of [-1.31, 1.31]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.12, 0.04), std(0x7a5230));
      slat.position.set(0, -0.4, z);
      this.root.add(slat);
    }
    this.root.add(crate, this.body);
    this.root.scale.setScalar(1.3);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  /** World position of his face: where Bill's laser lands. */
  faceWorld(target: THREE.Vector3): THREE.Vector3 {
    return this.headGroup.getWorldPosition(target);
  }

  /** World position of the gun's muzzle, where bullets start. */
  muzzleWorld(target: THREE.Vector3): THREE.Vector3 {
    return this.muzzle.getWorldPosition(target);
  }

  /** Turn towards an x position on the water (where the duck is). */
  aimAt(x: number, dt: number): void {
    const angle = Math.atan2(x - this.root.position.x, -this.root.position.z) * 0.9;
    this.body.rotation.y += (angle - this.body.rotation.y) * Math.min(1, dt * 6);
  }

  /** 0..1 while winding up a shot: the muzzle glows brighter. */
  setWindUp(amount: number): void {
    const m = this.muzzle.material as THREE.MeshBasicMaterial;
    m.opacity = Math.max(this.flash, amount * 0.5);
    this.muzzle.scale.setScalar(0.4 + amount * 0.6 + this.flash * 1.4);
  }

  fire(): void {
    this.flash = 1;
    this.flinch = Math.max(this.flinch, 0.3); // recoil
  }

  /** Called on every laser hit: flinch, flash white, and a spike of rage. */
  hit(): void {
    this.flinch = 1;
    this.rage = 1;
  }

  /** His face and outfit follow his health. */
  setHealth(fraction: number): void {
    this.mood = moodFor(fraction);
    const battered = this.mood === 'hurt' || this.mood === 'wrecked';
    this.blackEye.visible = battered;
    this.bandage.visible = battered;
    this.sweat.visible = battered;
    this.feathers.visible = battered;
    this.stars.visible = this.mood === 'wrecked';
    this.hat.visible = this.mood !== 'wrecked'; // knocked clean off
    this.hatCrown.scale.y = battered ? 0.75 : 1; // dented
  }

  /** 0..1: how hard the wings flap (swooping in). */
  setFlap(amount: number): void {
    this.flap = amount;
  }

  /** Offset from the crate while flying in, and how much he banks into the turn. */
  setFlight(offset: THREE.Vector3, bank: number): void {
    this.flight.copy(offset);
    this.bank = bank;
  }

  /** Touchdown: a squash that springs back. */
  land(): void {
    this.squash = 1;
    this.sinceLanding = 0;
  }

  defeat(): void {
    if (this.fallT < 0) this.fallT = 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    this.flinch = Math.max(0, this.flinch - dt * 3);
    this.rage = Math.max(0, this.rage - dt * 1.2);
    this.flashLight.intensity = this.flash * 40;

    const angry = this.mood === 'angry' ? 1 : 0;
    const hurt = this.mood === 'hurt' || this.mood === 'wrecked' ? 1 : 0;
    const fury = Math.min(1, angry * 0.6 + this.rage);

    // Brows: a scowl when smug, steeper when furious, raised and worried when hurt.
    this.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1;
      const tilt = hurt ? -0.35 : 0.3 + fury * 0.35;
      b.rotation.z = Math.PI / 2 + side * tilt;
      b.position.y = 0.36 - fury * 0.06 + hurt * 0.04;
    });
    // Lids: half shut (menacing), wide open when furious, one swollen shut when wrecked.
    this.lids.forEach((l, i) => {
      const shut = this.mood === 'wrecked' && i === 1 ? 2.6 : 0.9 - fury * 0.6 + hurt * 0.3;
      l.rotation.x = shut;
    });
    // Red in the face when angry.
    this.headMat.color.setRGB(0.56 + fury * 0.35, 0.58 - fury * 0.3, 0.64 - fury * 0.32);
    this.flashMats.forEach((m) => m.emissive.setScalar(this.flinch > 0.6 ? (this.flinch - 0.6) * 1.6 : 0));

    // Cigar droops when he's beaten; smoke puffs (steam from the hat when he's furious).
    this.cigar.rotation.x = hurt ? 0.5 : Math.sin(this.time * 1.5) * 0.05;
    this.puffTimer -= dt;
    if (this.puffTimer <= 0 && this.fallT < 0) {
      this.puffTimer = fury > 0.5 ? 0.12 : 0.5;
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        new THREE.MeshBasicMaterial({ color: fury > 0.5 ? 0xffffff : 0xb8bcc4, transparent: true, opacity: 0.6, depthWrite: false }),
      );
      const from = fury > 0.5 ? new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.1, 0) : new THREE.Vector3(0.32, -0.2, 1.0);
      puff.position.copy(from);
      this.headGroup.add(puff);
      this.puffs.push({ mesh: puff, life: 1 });
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt;
      p.mesh.position.y += dt * 0.9;
      p.mesh.scale.multiplyScalar(1 + dt * 1.2);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life * 0.6);
      if (p.life <= 0) {
        p.mesh.removeFromParent();
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.puffs.splice(i, 1);
      }
    }

    // Stars circle his head; sweat drips; idle bob; knock-back on hits; head shakes with rage.
    this.stars.children.forEach((s, i) => {
      const a = this.time * 3 + (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.7, Math.sin(this.time * 6 + i) * 0.08, Math.sin(a) * 0.7);
    });
    this.sweat.position.y = 0.25 - ((this.time * 0.6) % 1) * 0.5;
    // Wings: flap while flying, then settle at his sides.
    this.wings.forEach((w, i) => {
      const side = i === 0 ? -1 : 1;
      w.rotation.z = side * this.flap * (0.7 + 0.8 * Math.sin(this.time * 22));
    });
    // Landing squash and spring (wide and short, then a little bounce).
    this.sinceLanding += dt;
    this.squash *= Math.exp(-5 * dt);
    const sq = this.squash * Math.cos(this.sinceLanding * 16);
    this.body.scale.set(1 + 0.16 * sq, 1 - 0.22 * sq, 1 + 0.16 * sq);
    this.body.position.set(this.flight.x, Math.sin(this.time * 2.2) * 0.06 + this.flight.y, -this.flinch * 0.6 + this.flight.z);
    this.body.rotation.x = -this.flinch * 0.35 - Math.min(0.5, this.flight.length() * 0.04); // leans into the dive
    this.body.rotation.z = this.bank;
    this.headGroup.rotation.z = Math.sin(this.time * 30) * 0.06 * this.rage + (this.mood === 'wrecked' ? Math.sin(this.time * 2) * 0.15 : 0);

    if (this.fallT >= 0) {
      this.fallT += dt;
      this.body.rotation.x = -Math.min(1, this.fallT * 1.4) * (Math.PI / 2);
      this.root.position.y = -Math.max(0, this.fallT - 0.8) * 1.5; // sinks
    }
  }
}

// --- Bullets -------------------------------------------------------------------------------------

/** A brass bullet with a glowing tracer behind it. It flies along its local +Z. */
export function makeBullet(): THREE.Group {
  const group = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.25, emissive: 0x6b4a10, emissiveIntensity: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 20), brass);
  body.rotation.x = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass);
  tip.rotation.x = Math.PI / 2;
  tip.scale.y = 2;
  tip.position.z = 0.21;
  const tracer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.1, 2.4, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  tracer.rotation.x = -Math.PI / 2;
  tracer.position.z = -1.35;
  group.add(body, tip, tracer);
  group.scale.setScalar(1.5);
  return group;
}
