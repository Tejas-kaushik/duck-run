// The one renderer and its post-processing (Tejas): filmic tone mapping, soft shadows, image-based
// lighting for nicer materials, multisampled anti-aliasing and a gentle bloom so bright things
// (coins, the laser, muzzle flashes) glow. Phases never touch this; they just add objects.
//
// Quality adapts to the PC (Vansh): it starts at the best level the device should manage, and if
// frames stay slow it steps down (sharper-but-cheaper resolution, no MSAA, smaller or no shadows,
// no bloom) so the game stays smooth anywhere. ?quality=high|medium|low pins a level for testing.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Quality {
  name: 'high' | 'medium' | 'low';
  /** Upper limit on devicePixelRatio. */
  maxPixelRatio: number;
  /** MSAA samples on the main render target (0 = off). */
  samples: number;
  /** Bloom, rendered at this fraction of the screen resolution (0 = off). Half looks the same. */
  bloomScale: number;
  /** Shadow map size for the sun (0 = no shadows). */
  shadowSize: number;
  softShadows: boolean;
}

export const QUALITY: readonly Quality[] = [
  { name: 'high', maxPixelRatio: 1.5, samples: 4, bloomScale: 0.5, shadowSize: 2048, softShadows: true },
  { name: 'medium', maxPixelRatio: 1.25, samples: 2, bloomScale: 0.5, shadowSize: 1024, softShadows: false },
  { name: 'low', maxPixelRatio: 1, samples: 0, bloomScale: 0, shadowSize: 0, softShadows: false },
];

/** Frames slower than this (ms) for a sustained stretch mean the PC can't keep up: ~45 fps. */
const SLOW_FRAME_MS = 1000 / 45;
/** How many frames to average before judging; long enough to ignore one-off hitches. */
const WINDOW_FRAMES = 90;

/** Pure: given the recent frame times, should we step down a level? Unit-tested. */
export function shouldStepDown(frameMs: readonly number[]): boolean {
  if (frameMs.length < WINDOW_FRAMES) return false;
  const sorted = [...frameMs].sort((a, b) => a - b);
  // The median ignores the odd GC pause or shader compile that would otherwise trip it.
  return sorted[sorted.length >> 1] > SLOW_FRAME_MS;
}

/** Where to start: phones and very big screens begin a level down; ?quality= wins over both. */
export function startingQuality(search: string, coarsePointer: boolean, screenPixels: number): number {
  const pinned = new URLSearchParams(search).get('quality');
  const pinnedIndex = QUALITY.findIndex((q) => q.name === pinned);
  if (pinnedIndex >= 0) return pinnedIndex;
  if (coarsePointer) return 1;
  return screenPixels > 2560 * 1440 ? 1 : 0;
}

export class RenderPipeline {
  readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private readonly scene: THREE.Scene;
  private level: number;
  /** Set by ?quality=: never step down on our own. */
  private readonly pinned: boolean;
  private width = 1;
  private height = 1;
  private lastFrameAt = 0;
  private frameMs: number[] = [];
  /** The sun is added to the scene after the pipeline exists, so shadow sizes are applied on render. */
  private shadowsDirty = true;

  /** `environment`: a scene to capture for reflections (e.g. the sky). Defaults to a soft studio. */
  constructor(container: HTMLElement, scene: THREE.Scene, camera: THREE.Camera, environment?: THREE.Scene) {
    this.scene = scene;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const screenPixels = window.screen.width * window.screen.height * window.devicePixelRatio ** 2;
    this.level = startingQuality(window.location.search, coarse, screenPixels);
    this.pinned = new URLSearchParams(window.location.search).has('quality');
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    // Image-based lighting: every standard material reflects the sky (and the water picks up its
    // blue), without loading any image files. The far plane must reach the sky dome.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromScene(environment ?? new RoomEnvironment(), 0.02, 0.1, 1000).texture;
    scene.environmentIntensity = 0.7;
    pmrem.dispose();

    const q = QUALITY[this.level];
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: q.samples });
    this.composer = new EffectComposer(this.renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.45, 0.9);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass()); // tone mapping + sRGB happen here
    this.applyQuality();
  }

  get quality(): Quality {
    return QUALITY[this.level];
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const pr = Math.min(window.devicePixelRatio, this.quality.maxPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(width, height);
    // Bloom is a blur, so a lower resolution looks the same and costs a fraction.
    const scale = this.quality.bloomScale || 0.5;
    this.bloom.setSize(Math.max(1, Math.round(width * pr * scale)), Math.max(1, Math.round(height * pr * scale)));
  }

  render(camera: THREE.Camera): void {
    // A cutscene or ending covers the whole screen: don't draw a world nobody can see.
    if (document.body.classList.contains('film-open')) {
      this.lastFrameAt = 0;
      return;
    }
    if (this.shadowsDirty) this.applyShadowSize();
    this.renderPass.camera = camera;
    this.composer.render();
    this.watchFrameRate();
  }

  dispose(): void {
    this.composer.dispose();
    this.renderer.dispose();
  }

  /** Track how long frames really take (rAF waits for the GPU) and step down if they stay slow. */
  private watchFrameRate(): void {
    const now = performance.now();
    const dt = this.lastFrameAt ? now - this.lastFrameAt : 0;
    this.lastFrameAt = now;
    // Skip pauses: a background tab, a breakpoint, or the first frame after a cutscene.
    if (dt <= 0 || dt > 250 || document.hidden) return;
    this.frameMs.push(dt);
    if (this.frameMs.length > WINDOW_FRAMES) this.frameMs.shift();
    if (this.pinned || this.level >= QUALITY.length - 1 || !shouldStepDown(this.frameMs)) return;
    this.level++;
    this.frameMs = [];
    this.applyQuality();
    console.info(`[render] frames were slow, quality now ${this.quality.name}`);
  }

  private applyQuality(): void {
    const q = this.quality;
    this.bloom.enabled = q.bloomScale > 0;

    for (const t of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (t.samples !== q.samples) {
        t.samples = q.samples;
        t.dispose(); // rebuilt with the new sample count on the next render
      }
    }

    this.renderer.shadowMap.enabled = q.shadowSize > 0;
    this.renderer.shadowMap.type = q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.shadowsDirty = true;
    this.setSize(this.width, this.height);
  }

  private applyShadowSize(): void {
    this.shadowsDirty = false;
    const size = this.quality.shadowSize;
    if (size === 0) return;
    this.scene.traverse((o) => {
      const light = o as THREE.DirectionalLight;
      if (!light.isDirectionalLight || !light.castShadow || light.shadow.mapSize.x === size) return;
      light.shadow.mapSize.set(size, size);
      light.shadow.map?.dispose();
      light.shadow.map = null; // recreated at the new size
    });
  }
}
