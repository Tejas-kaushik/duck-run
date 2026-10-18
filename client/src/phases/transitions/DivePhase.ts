// Transition 1 (Tejas, DESIGN_CHANGES.md): the end of Runner 1. The pond Bill has been running
// towards sits in the road; he runs up to it, leaps and dives head-first in with a big splash, and
// the camera follows him under. The dog skids to a stop at the edge, barking. No gameplay input.

import * as THREE from 'three';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import { disposeObject } from '../../render/dispose';
import { POND_AHEAD, Pond } from '../../render/pond';
import { DogView } from '../runner/dogView';
import { Particles, RunnerWorld } from '../runner/runnerView';
import { SEA_COLOR } from '../underwater/underwaterView';
import { Fade, easeInOut, easeOut, span } from './transitionKit';

const DURATION = 2.7;
/** Where the pond's centre ends up as Bill reaches it. */
const POND_STOP_Z = -6.2;

export function createDive(): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const root = new THREE.Group();
    const world = new RunnerWorld();
    const pond = new Pond();
    const particles = new Particles(90);
    const dog = new DogView();
    const fade = new Fade(`#${SEA_COLOR.toString(16).padStart(6, '0')}`);
    const camera = ctx.defaultCamera;
    const startX = ctx.bill.object.position.x;

    let t = 0;
    let lastPondZ = -POND_AHEAD;
    let jumped = false;
    let splashed = false;

    return {
      enter() {
        // Exactly where Runner 1 left it, so there's no jump in the picture.
        pond.group.position.set(0, 0, -POND_AHEAD);
        dog.root.scale.setScalar(0.8);
        dog.root.position.set(startX + 1.3, 0, 7);
        root.add(world.group, pond.group, dog.root, particles.group);
        ctx.scene.add(root);
        fade.mount();
        ctx.bill.setPose('run');
      },

      update(dt) {
        t += dt;
        const bill = ctx.bill.object;

        // 0–1.1 s: Bill keeps running and the pond slides up to him as he slows at the edge.
        const approach = easeOut(span(t, 0, 1.1));
        const pondZ = -POND_AHEAD + (POND_STOP_Z + POND_AHEAD) * approach;
        world.scroll(pondZ, pondZ - lastPondZ);
        lastPondZ = pondZ;
        pond.group.position.z = pondZ;
        pond.update(dt);

        // The dog chases in and skids to a stop just short of the water, barking.
        dog.root.position.z += (1.4 - dog.root.position.z) * Math.min(1, dt * 2.5);
        dog.root.position.x += (startX * 0.4 + 1.2 - dog.root.position.x) * Math.min(1, dt * 2);
        if (t > 1.3 && t < 1.34) {
          dog.bark();
          ctx.emit({ type: 'cue', name: 'bark' });
        }
        dog.update(t > 1.1 ? dt * 0.3 : dt);

        // Bill lines up with the middle of the pond, then leaps (1.1–1.65 s) and dives in head-first.
        const jump = span(t, 1.1, 1.65);
        const plunge = span(t, 1.65, 1.9);
        if (jump === 0) {
          bill.position.x = startX * (1 - easeOut(span(t, 0, 1)));
        } else {
          if (!jumped) {
            jumped = true;
            ctx.bill.setPose('fly');
            ctx.emit({ type: 'cue', name: 'jump' });
          }
          bill.position.x = 0;
          bill.position.z = POND_STOP_Z * easeInOut(jump);
          bill.position.y = Math.sin(Math.PI * Math.min(1, jump)) * 2.2 - 2 * plunge;
          bill.rotation.x = -easeInOut(jump) * 1.45; // nose-down dive
          bill.visible = plunge < 1;
          if (!splashed && plunge > 0) {
            splashed = true;
            ctx.emit({ type: 'cue', name: 'splash' });
            pond.ripple(0, 0, true);
            particles.burst(0, 0.3, POND_STOP_Z, 36, { color: 0xffffff, speed: 6, up: 7, life: 0.9, size: 1.3, grow: 0.3 });
            particles.burst(0, 0.3, POND_STOP_Z, 18, { color: 0x7fc7d4, speed: 4, up: 5, life: 0.8, size: 1.1, grow: 0.2 });
          }
        }
        particles.update(dt, 0);

        // Camera follows Bill to the edge, then dips down into the pond after him.
        const dive = easeInOut(span(t, 1.85, DURATION));
        const follow = Math.min(0, bill.position.z);
        camera.position.set(bill.position.x * 0.4, 3.4 + jump * 0.5 - dive * 3.6, 6.5 + follow * 0.6 - dive * 6);
        camera.lookAt(0, 1 - dive * 2.8, follow - 8 + dive * 2);
        fade.set(span(t, 2.15, DURATION));

        ctx.setPhaseProgress(Math.min(t, DURATION), DURATION);
        if (t >= DURATION) ctx.completePhase();
      },

      exit() {
        fade.remove();
        ctx.bill.object.rotation.set(0, Math.PI, 0);
        disposeObject(root);
      },

      dispose() {},
    };
  };
}
