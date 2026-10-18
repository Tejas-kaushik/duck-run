// The dog that chases Bill through Runner 1 (Tejas). Built from smooth primitives, origin at its
// feet, facing -Z (the way Bill runs). Render-only: RunnerPhase decides where it is and when it bites.

import * as THREE from 'three';

const mat = (color: number, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });

export class DogView {
  readonly root = new THREE.Group();
  private readonly legs: THREE.Object3D[] = [];
  private readonly ears: THREE.Object3D[] = [];
  private readonly tail = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly jaw = new THREE.Group();
  private readonly woof: THREE.Sprite;
  private t = 0;
  private woofT = 0;
  private lunge = 0;

  constructor() {
    const fur = mat(0xb5733f);
    const belly = mat(0xf0d2a6);
    const dark = mat(0x5e3a1f);
    const black = mat(0x151515, 0.3);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.75, 8, 20), fur);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.72;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 16), belly);
    chest.position.set(0, 0.68, -0.42);
    chest.scale.set(0.9, 0.9, 0.8);

    // Head: skull, snout, nose, eyes, droopy ears, tongue out.
    this.head.position.set(0, 1.12, -0.62);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), fur);
    const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.22, 6, 16), belly);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.07, -0.3);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), black);
    nose.position.set(0, -0.02, -0.5);
    this.head.add(skull, snout, nose);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), black);
      eye.position.set(side * 0.12, 0.08, -0.24);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.08, 4, 8), dark);
      brow.rotation.z = Math.PI / 2 + side * 0.4; // angry little brows
      brow.position.set(side * 0.12, 0.17, -0.25);
      const ear = new THREE.Group();
      const flap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), dark);
      flap.scale.set(0.45, 1.1, 0.8);
      flap.position.y = -0.14;
      ear.add(flap);
      ear.position.set(side * 0.25, 0.14, 0);
      this.ears.push(ear);
      this.head.add(eye, brow, ear);
    }
    this.jaw.position.set(0, -0.15, -0.25);
    const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.12, 4, 10), mat(0xe86a7a, 0.4));
    tongue.scale.set(1, 0.4, 1);
    tongue.rotation.x = 1.2;
    tongue.position.set(0.02, -0.06, -0.12);
    this.jaw.add(tongue);
    this.head.add(this.jaw);

    // Red collar with a gold tag.
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 10, 24), mat(0xc0392b, 0.4));
    collar.rotation.x = Math.PI / 2.4;
    collar.position.set(0, 0.95, -0.5);
    const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 1, roughness: 0.3 }));
    tag.rotation.x = Math.PI / 2;
    tag.position.set(0, 0.8, -0.66);

    // Legs pivot at the hip so they can swing.
    for (const [x, z] of [[-0.2, -0.38], [0.2, -0.38], [-0.2, 0.38], [0.2, 0.38]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.62, z);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 12), fur);
      leg.position.y = -0.3;
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), belly);
      paw.position.set(0, -0.56, -0.04);
      pivot.add(leg, paw);
      this.legs.push(pivot);
      this.root.add(pivot);
    }

    const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 10), fur);
    tailMesh.position.y = 0.22;
    this.tail.add(tailMesh);
    this.tail.position.set(0, 0.92, 0.72);
    this.tail.rotation.x = -0.6;

    this.root.add(body, chest, this.head, collar, tag, this.tail);
    this.root.traverse((o) => (o.castShadow = true));

    // A "WOOF!" speech pop above its head.
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const g = canvas.getContext('2d')!;
    g.font = 'bold 72px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = '#3b1f0e';
    g.strokeText('WOOF!', 128, 64);
    g.fillStyle = '#ffe14d';
    g.fillText('WOOF!', 128, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.woof = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    this.woof.position.set(0, 2.1, -0.4);
    this.woof.visible = false;
    this.root.add(this.woof);
  }

  bark(): void {
    this.woofT = 0.9;
  }

  /** 0..1: a forward snap of the jaws. */
  setLunge(amount: number): void {
    this.lunge = amount;
  }

  update(dt: number): void {
    this.t += dt;
    const run = this.t * 14;
    this.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(run + (i % 2 === 0 ? 0 : Math.PI) + (i < 2 ? 0 : 0.6)) * 0.75));
    this.root.position.y = Math.abs(Math.sin(run)) * 0.08;
    this.root.rotation.x = Math.sin(run) * 0.04 - this.lunge * 0.25;
    this.ears.forEach((ear, i) => (ear.rotation.x = Math.sin(run + i) * 0.4 - 0.3));
    this.tail.rotation.z = Math.sin(this.t * 20) * 0.6;
    this.jaw.rotation.x = 0.15 + Math.abs(Math.sin(this.t * 9)) * 0.25 + this.lunge * 0.5;
    this.head.position.z = -0.62 - this.lunge * 0.25;

    this.woofT = Math.max(0, this.woofT - dt);
    this.woof.visible = this.woofT > 0;
    const pop = this.woofT > 0.75 ? (0.9 - this.woofT) / 0.15 : 1;
    this.woof.scale.set(1.4 * pop, 0.7 * pop, 1);
  }
}
