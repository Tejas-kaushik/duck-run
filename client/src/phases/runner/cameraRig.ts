// Third-person follow camera with trauma-based shake (game-feel skill, pattern 1).
// Shake moves the camera only, never Bill or anything used for collision.

import * as THREE from 'three';

const BASE = new THREE.Vector3(0, 3.4, 6.5);
const LOOK_Y = 1;
const LOOK_Z = -8;
const BASE_FOV = 60;

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export class CameraRig {
  private trauma = 0;
  private t = 0;
  private followX = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /** Hits ADD trauma (0..1); it decays on its own. Small hits barely move, big ones punch. */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * (reducedMotion ? 0.3 : 1));
  }

  /** speed01: 0 at start speed, 1 at max speed (widens the view a little for a sense of speed). */
  update(dt: number, targetX: number, speed01: number): void {
    this.followX += (targetX * 0.55 - this.followX) * (1 - Math.exp(-8 * dt));

    this.trauma = Math.max(0, this.trauma - 1.6 * dt);
    const shake = this.trauma * this.trauma;
    this.t += dt * 32;
    // Smooth sin-based wobble, not a fresh random each frame (that buzzes like static).
    const ox = 0.45 * shake * Math.sin(this.t * 1.7);
    const oy = 0.3 * shake * Math.sin(this.t * 2.3 + 1);
    const roll = 0.05 * shake * Math.sin(this.t * 1.1 + 2);

    this.camera.position.set(BASE.x + this.followX + ox, BASE.y + oy, BASE.z);
    this.camera.lookAt(this.followX * 0.5, LOOK_Y, LOOK_Z);
    this.camera.rotateZ(roll);

    const fov = BASE_FOV + 7 * speed01;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
