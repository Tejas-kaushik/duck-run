// Transition 2 (Tejas): the end of the underwater section. A fishing hook with a dollar drops in,
// Bill's eyes turn into dollar signs and his tongue flops out (greedy duck!), he grabs it and gets
// yanked up to the surface (brief §2).
// No gameplay input (brief §3).

import * as THREE from 'three';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import { disposeObject } from '../../render/dispose';
import { Particles } from '../runner/runnerView';
import { SEA_COLOR, UnderwaterWorld } from '../underwater/underwaterView';
import { DollarEyes, DollarHook, Fade, GreedyTongue, easeOut, easeOutBack, span } from './transitionKit';

const DURATION = 3.8;
const BILL_Y = 0.6;
const HOOK_REST_Y = BILL_Y + 1.85; // just above Bill's head

export function createSurfaceReturn(): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const root = new THREE.Group();
    const world = new UnderwaterWorld();
    const hook = new DollarHook();
    const eyes = new DollarEyes();
    const tongue = new GreedyTongue();
    const particles = new Particles(50);
    const fadeIn = new Fade(`#${SEA_COLOR.toString(16).padStart(6, '0')}`);
    const flash = new Fade('#eaf8ff');
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    const oldBackground = ctx.scene.background;
    const oldFog = ctx.scene.fog;
    let t = 0;
    let popped = false;
    let grabbed = false;

    return {
      enter() {
        ctx.scene.background = new THREE.Color(SEA_COLOR);
        ctx.scene.fog = new THREE.Fog(SEA_COLOR, 5, 45);
        world.group.position.y = 1; // a bit more seabed in shot
        hook.root.position.set(0.15, 12, 0.35);
        root.add(world.group, hook.root, particles.group);
        ctx.scene.add(root);

        // Bill floats outside the sub, facing us, so we can see his eyes change.
        const bill = ctx.bill.object;
        bill.position.set(0, BILL_Y, 0);
        bill.rotation.set(0, 0, 0);
        // Locked to his head, so they line up with his eyes and bill exactly.
        ctx.bill.head.add(eyes.group, tongue.group);
        ctx.bill.setPose('idle');

        camera.position.set(0, 1.9, 4.6);
        camera.lookAt(0, 1.7, 0);
        ctx.setCamera(camera);
        fadeIn.mount();
        flash.mount();
        fadeIn.set(1);
      },

      update(dt) {
        t += dt;
        const bill = ctx.bill.object;
        world.update(dt, t * 2, dt * 2);
        particles.update(dt, 0);
        fadeIn.set(1 - span(t, 0, 0.5));

        // 0.3–1.3 s: the hook drops into view with a little swing.
        const drop = easeOut(span(t, 0.3, 1.3));
        let hookY = 12 + (HOOK_REST_Y - 12) * drop;
        hook.root.rotation.z = Math.sin(t * 3) * 0.12 * (1 - span(t, 1.3, 2));

        // 1.4 s: Bill spots the money. Dollar-sign eyes pop.
        const pop = span(t, 1.4, 1.75);
        eyes.pop(pop > 0 ? easeOutBack(pop) : 0);
        // ...and the tongue lolls out, greedy, until he's yanked away.
        tongue.out(easeOutBack(span(t, 1.5, 1.85)), dt);
        if (!popped && pop > 0) {
          popped = true;
          ctx.emit({ type: 'cue', name: 'cash' });
        }

        // 1.9 s: he lunges and grabs it. 2.1 s on: the line yanks him up and out of shot.
        const lunge = span(t, 1.85, 2.05);
        if (!grabbed && lunge > 0) {
          grabbed = true;
          ctx.bill.setPose('attack');
          ctx.emit({ type: 'cue', name: 'grab' });
        }
        const yank = span(t, 2.1, 3.4);
        hookY += 16 * yank * yank;
        hook.root.position.y = hookY;

        const bob = Math.sin(t * 2.2) * 0.08 * (1 - lunge);
        bill.position.y = grabbed ? Math.max(BILL_Y + 0.25 * lunge, hookY - 1.85) : BILL_Y + bob;
        bill.rotation.z = Math.sin(t * 1.6) * 0.05 * (1 - lunge);
        if (yank > 0 && Math.random() < 0.7) {
          particles.burst((Math.random() - 0.5) * 0.6, bill.position.y + 0.4, 0, 1, {
            color: 0xcfefff, speed: 0.8, up: -1, life: 0.45, size: 0.45, grow: 0.3,
          });
        }

        // The camera tips up to follow him, then everything flashes bright as he breaks the surface.
        camera.lookAt(0, 1.7 + Math.min(4, (bill.position.y - BILL_Y) * 0.6), 0);
        flash.set(span(t, 3.1, DURATION));

        ctx.setPhaseProgress(Math.min(t, DURATION), DURATION);
        if (t >= DURATION) ctx.completePhase();
      },

      exit() {
        ctx.bill.head.remove(eyes.group, tongue.group);
        fadeIn.remove();
        flash.remove();
        ctx.scene.background = oldBackground;
        ctx.scene.fog = oldFog;
        disposeObject(root);
      },

      dispose() {},
    };
  };
}
