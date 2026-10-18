// Shared bits for the two transitions (Tejas): a screen fade, easing, and the models they need
// (the submarine, the fishing hook with its dollar, Bill's dollar-sign eyes). Render-only.

import * as THREE from 'three';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0..1 progress of `t` through the window [from, to]. */
export const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

/** A full-screen colour fade on top of the game. */
export class Fade {
  readonly element = document.createElement('div');

  constructor(color: string) {
    this.element.className = 'fade';
    this.element.style.background = color;
    this.element.style.opacity = '0';
  }

  mount(): void {
    document.getElementById('ui')?.appendChild(this.element);
  }

  set(opacity: number): void {
    this.element.style.opacity = clamp01(opacity).toFixed(3);
  }

  remove(): void {
    this.element.remove();
  }
}

const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

function dollarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#6fbf73';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#2e7d32';
  g.lineWidth = 8;
  g.strokeRect(8, 8, 240, 112);
  g.fillStyle = '#e8f5e9';
  g.beginPath();
  g.ellipse(128, 64, 34, 40, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b5e20';
  g.font = 'bold 56px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', 128, 66);
  g.font = 'bold 26px Arial';
  g.fillText('100', 44, 34);
  g.fillText('100', 212, 96);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A fishing hook with a dollar bill on it, hanging from a line. Origin = the bottom of the hook. */
export class DollarHook {
  readonly root = new THREE.Group();

  constructor() {
    const metal = new THREE.MeshStandardMaterial({ color: 0xc8cdd3, metalness: 0.85, roughness: 0.25 });
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 30, 4),
      new THREE.MeshBasicMaterial({ color: 0xf5f5f5, transparent: true, opacity: 0.7 }),
    );
    line.position.y = 15.6;
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), metal);
    shank.position.y = 0.4;
    const bend = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 20, Math.PI * 1.3), metal);
    bend.rotation.z = Math.PI;
    bend.position.set(0.16, 0.1, 0);
    const bill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.45),
      new THREE.MeshStandardMaterial({ map: dollarTexture(), side: THREE.DoubleSide, roughness: 0.8 }),
    );
    bill.position.set(0.3, -0.12, 0.02);
    bill.rotation.z = -0.35;
    this.root.add(line, shank, bend, bill);
  }
}

function dollarEyeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.font = 'bold 56px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = '#0b3d17';
  g.strokeText('$', 32, 34);
  g.fillStyle = '#39d353';
  g.fillText('$', 32, 34);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Two "$" signs that sit exactly on Bill's eyes. They're parented to his HEAD (CharacterView.head),
 * at the eyes' own positions in head space and turned to match the curve of his face, so they stay
 * locked on however the head moves. `pop` 0..1 scales them in.
 */
export class DollarEyes {
  readonly group = new THREE.Group();
  private readonly planes: THREE.Mesh[] = [];

  constructor() {
    const material = new THREE.MeshBasicMaterial({ map: dollarEyeTexture(), transparent: true, depthTest: false });
    const geometry = new THREE.PlaneGeometry(0.11, 0.11);
    for (const side of [-1, 1]) {
      // Eye centre in head space (render/character.ts): (±0.065, 0.03, 0.145), radius 0.045.
      const eye = new THREE.Vector3(side * 0.065, 0.03, 0.145);
      const normal = eye.clone().normalize();
      const plane = new THREE.Mesh(geometry, material);
      plane.position.copy(eye).addScaledVector(normal, 0.055); // just in front of the eye and lid
      plane.lookAt(eye.clone().addScaledVector(normal, 1));
      plane.renderOrder = 10;
      this.planes.push(plane);
      this.group.add(plane);
    }
    this.pop(0);
  }

  pop(amount: number): void {
    const s = Math.max(0.0001, amount);
    for (const p of this.planes) p.scale.set(s, s, s);
    this.group.visible = amount > 0.01;
  }
}

/** A long pink tongue that flops out of Bill's bill when he sees money. Parent it to his head. */
export class GreedyTongue {
  readonly group = new THREE.Group();
  private readonly tongue: THREE.Mesh;
  private t = 0;

  constructor() {
    const geometry = new THREE.CapsuleGeometry(0.045, 0.2, 6, 14);
    geometry.translate(0, -0.13, 0); // hinge at the top end
    this.tongue = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xff6f91, roughness: 0.35 }));
    this.tongue.scale.set(1.35, 1, 0.5); // wide and flat
    // Out of the lower front of the bill (head space), lolling down and forward.
    this.group.position.set(0.03, -0.075, 0.29);
    this.group.add(this.tongue);
    this.out(0);
  }

  /** 0 = tucked in, 1 = fully out. Wiggles while out. */
  out(amount: number, dt = 0): void {
    this.t += dt;
    const a = Math.max(0, Math.min(1, amount));
    this.group.visible = a > 0.01;
    this.group.scale.set(1, a, 1);
    // Negative x swings the tip forward, out of the bill (positive would tuck it into his chin).
    this.group.rotation.set(-0.55 + Math.sin(this.t * 14) * 0.15 * a, 0, Math.sin(this.t * 9) * 0.25 * a);
  }
}
