// Power-up and combat effects (Tejas): the hex shield, the boost aura, laser-mode eyes, the laser
// beam, impact shockwaves and floating damage numbers. Render-only.

import * as THREE from 'three';

/** A soft round glow (white centre fading to nothing), for additive sprites. */
let glow: THREE.CanvasTexture | null = null;
export function glowTexture(): THREE.CanvasTexture {
  if (glow) return glow;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(canvas);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}

export function glowSprite(color: number, size: number, opacity = 1): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

// --- Shield ----------------------------------------------------------------------------------

/** A force-field bubble: glowing rim, a drifting hexagon grid, and a ripple when something hits it. */
export class ShieldView {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    time: { value: 0 },
    hit: { value: 0 },
    fade: { value: 1 },
    color: { value: new THREE.Color(0x5fd8ff) },
  };

  constructor(radius = 1.3) {
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform float time;
        uniform float hit;
        uniform float fade;
        uniform vec3 color;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec2 vUv;
        // Distance to the nearest hexagon edge in a hex grid.
        float hexEdge(vec2 p) {
          p.x *= 1.1547;
          p.y += mod(floor(p.x), 2.0) * 0.5;
          p = abs(fract(p) - 0.5);
          return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0);
        }
        void main() {
          float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
          vec2 p = vec2(vUv.x * 14.0, vUv.y * 7.0 + time * 0.25);
          float edge = 1.0 - smoothstep(0.0, 0.08, hexEdge(p));
          float pulse = 0.55 + 0.45 * sin(time * 3.0 + vUv.y * 12.0);
          float a = rim * 0.9 + edge * 0.35 * pulse + hit * (0.5 + edge);
          gl_FragColor = vec4(color * (1.0 + hit * 1.5), a * fade);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material);
  }

  /** Something bounced off: a bright ripple. */
  flash(): void {
    this.uniforms.hit.value = 1;
  }

  /** remaining: seconds left; it flickers in the last second. */
  update(dt: number, remaining: number): void {
    this.uniforms.time.value += dt;
    this.uniforms.hit.value = Math.max(0, this.uniforms.hit.value - dt * 3);
    const flicker = remaining < 1 ? (Math.floor(remaining * 14) % 2 === 0 ? 0.25 : 1) : 1;
    this.uniforms.fade.value = flicker;
    this.mesh.scale.setScalar(1 + Math.sin(this.uniforms.time.value * 5) * 0.025);
  }
}

// --- Boost -------------------------------------------------------------------------------------

/** A golden aura and a flaring streak behind Bill while the speed boost lasts. */
export class BoostAura {
  readonly group = new THREE.Group();
  private readonly core: THREE.Sprite;
  private readonly streaks: THREE.Sprite[] = [];
  private t = 0;

  constructor() {
    this.core = glowSprite(0xffc83d, 2.6, 0.55);
    this.core.position.y = 0.9;
    this.group.add(this.core);
    for (let i = 0; i < 5; i++) {
      const s = glowSprite(0xffa020, 1.2, 0.5);
      this.streaks.push(s);
      this.group.add(s);
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.core.material.opacity = 0.45 + Math.sin(this.t * 18) * 0.12;
    this.streaks.forEach((s, i) => {
      // Trailing glows behind Bill (towards the camera), shrinking with distance.
      const k = (i + ((this.t * 4) % 1)) / this.streaks.length;
      s.position.set(Math.sin(this.t * 9 + i) * 0.15, 0.8, 0.4 + k * 2.6);
      s.scale.setScalar(1.3 * (1 - k * 0.8));
      s.material.opacity = 0.5 * (1 - k);
    });
  }
}

// --- Laser mode eyes ----------------------------------------------------------------------------

/** Two glowing red eyes for Bill while the laser power-up is active. Parent to Bill's HEAD. */
export class LaserEyes {
  readonly group = new THREE.Group();
  private readonly glows: THREE.Sprite[] = [];
  private t = 0;

  constructor() {
    for (const side of [-1, 1]) {
      // Bill's eye centre in head space (render/character.ts): (±0.065, 0.03, 0.145).
      const eye = new THREE.Vector3(side * 0.065, 0.03, 0.145);
      const pos = eye.clone().addScaledVector(eye.clone().normalize(), 0.05);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      dot.position.copy(pos);
      dot.lookAt(pos.clone().add(eye.clone().normalize()));
      const halo = glowSprite(0xff3030, 0.22, 0.9);
      halo.position.copy(pos);
      this.glows.push(halo);
      this.group.add(dot, halo);
    }
  }

  update(dt: number): void {
    this.t += dt;
    for (const g of this.glows) g.scale.setScalar(0.2 + Math.sin(this.t * 7) * 0.04);
  }
}

// --- Laser -------------------------------------------------------------------------------------

/**
 * Bill's laser: a bright flash at his beak, then a beam with a white-hot core, a coloured glow and
 * energy rings racing along it. `power` makes it fatter and red-gold (the 100-coin power-up).
 */
export class LaserBeam {
  readonly group = new THREE.Group();
  private readonly core: THREE.Mesh;
  private readonly glowMesh: THREE.Mesh;
  private readonly haze: THREE.Mesh;
  private readonly rings: THREE.Mesh[] = [];
  private readonly charge: THREE.Sprite;
  private life = 0;
  private length = 1;
  private width = 1;

  constructor() {
    const additive = (color: number, opacity: number) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const tube = (r: number) => new THREE.CylinderGeometry(r, r, 1, 20, 1, true).translate(0, 0.5, 0);
    this.core = new THREE.Mesh(tube(0.06), additive(0xffffff, 1));
    this.glowMesh = new THREE.Mesh(tube(0.2), additive(0xff3ea5, 0.7));
    this.haze = new THREE.Mesh(tube(0.45), additive(0xff3ea5, 0.18));
    this.group.add(this.core, this.glowMesh, this.haze);
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 24), additive(0xffd1ec, 0.8));
      ring.rotation.x = Math.PI / 2;
      this.rings.push(ring);
      this.group.add(ring);
    }
    this.charge = glowSprite(0xff8ad1, 1.4, 1);
    this.group.visible = false;
    // The beam is built along +Y from the origin; the group points it from Bill to the target.
  }

  fire(from: THREE.Vector3, to: THREE.Vector3, power: boolean): void {
    this.length = from.distanceTo(to);
    this.width = power ? 1.7 : 1;
    const color = power ? 0xff3b1f : 0xff3ea5;
    (this.glowMesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    (this.haze.material as THREE.MeshBasicMaterial).color.setHex(power ? 0xffb020 : color);
    this.charge.material.color.setHex(power ? 0xffb347 : 0xff8ad1);
    this.group.position.copy(from);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    this.charge.position.set(0, 0, 0);
    if (!this.charge.parent) this.group.add(this.charge);
    this.group.visible = true;
    this.life = 0.5;
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.life -= dt;
    const k = Math.max(0, this.life / 0.5); // 1 → 0
    const grow = Math.min(1, (0.5 - this.life) / 0.06); // the beam shoots out over 60 ms
    const w = this.width * (0.5 + k * 0.9) * (1 + Math.sin(this.life * 80) * 0.08);
    for (const m of [this.core, this.glowMesh, this.haze]) m.scale.set(w, this.length * grow, w);
    (this.core.material as THREE.MeshBasicMaterial).opacity = k;
    (this.glowMesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * k;
    (this.haze.material as THREE.MeshBasicMaterial).opacity = 0.2 * k;
    this.rings.forEach((r, i) => {
      const along = ((i / this.rings.length + (0.5 - this.life) * 3) % 1) * this.length * grow;
      r.position.set(0, along, 0);
      r.scale.setScalar(this.width * (0.8 + 0.4 * Math.sin(i + this.life * 30)));
      (r.material as THREE.MeshBasicMaterial).opacity = 0.8 * k;
    });
    this.charge.scale.setScalar(this.width * (0.8 + (1 - k) * 1.6));
    this.charge.material.opacity = k;
    if (this.life <= 0) this.group.visible = false;
  }
}

// --- Impacts and damage numbers ----------------------------------------------------------------------

/** An expanding shockwave ring plus a light flash where something big lands. */
export class Shockwave {
  readonly group = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private readonly flash: THREE.Sprite;
  private readonly light = new THREE.PointLight(0xff7ad1, 0, 14);
  private t = 1;

  constructor() {
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.08, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd1ec, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.flash = glowSprite(0xffffff, 4, 1);
    this.group.add(this.ring, this.flash, this.light);
    this.group.visible = false;
  }

  play(at: THREE.Vector3, color: number, big: boolean): void {
    this.group.position.copy(at);
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.light.color.setHex(color);
    this.ring.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.6, 0, Math.random());
    this.t = 0;
    this.group.visible = true;
    this.group.scale.setScalar(big ? 1.5 : 1);
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;
    const k = Math.min(1, this.t / 0.45);
    this.ring.scale.setScalar(0.3 + k * 3);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    this.flash.material.opacity = Math.max(0, 1 - k * 2.5);
    this.flash.scale.setScalar(2 + k * 4);
    this.light.intensity = 60 * Math.max(0, 1 - k * 2);
    if (k >= 1) this.group.visible = false;
  }
}

/** A big number that pops up, rises and fades (e.g. "-8,017" or "PERFECT!"). */
export class FloatingText {
  readonly sprite: THREE.Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: THREE.CanvasTexture;
  private t = 1;

  constructor() {
    this.canvas.width = 512;
    this.canvas.height = 128;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false }));
    this.sprite.renderOrder = 20;
    this.sprite.visible = false;
  }

  show(text: string, at: THREE.Vector3, fill: string): void {
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, 512, 128);
    g.font = 'bold 92px Trebuchet MS, Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 14;
    g.strokeStyle = 'rgba(30,10,20,0.9)';
    g.strokeText(text, 256, 66);
    g.fillStyle = fill;
    g.fillText(text, 256, 66);
    this.texture.needsUpdate = true;
    this.sprite.position.copy(at);
    this.sprite.visible = true;
    this.t = 0;
  }

  update(dt: number): void {
    if (!this.sprite.visible) return;
    this.t += dt;
    const pop = this.t < 0.15 ? 0.6 + (this.t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (this.t - 0.15) * 0.5);
    this.sprite.scale.set(4 * pop, 1 * pop, 1);
    this.sprite.position.y += dt * 1.2;
    this.sprite.material.opacity = Math.max(0, 1 - Math.max(0, this.t - 0.7) * 2.5);
    if (this.t > 1.1) this.sprite.visible = false;
  }
}
