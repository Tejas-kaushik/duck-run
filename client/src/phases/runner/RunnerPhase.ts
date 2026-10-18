// Runner 1 and Runner 2 (Tejas): auto-run on the forest river in three lanes, dodge branches with A/D.
// Runner 1 has a dog on Bill's tail; Runner 2 adds breadcrumbs (score only), the heart before the
// boss (brief §4), and the speed boost if the swim's coins bought it (DESIGN_CHANGES.md).

import * as THREE from 'three';
import { CONFIG } from '../../core/config';
import { LaneMover } from '../../core/LaneMover';
import { powerUpFor } from '../../core/RunState';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import type { Course, CourseItem } from '../../course/types';
import { disposeObject } from '../../render/dispose';
import { BoostAura } from '../../render/effects';
import { POND_AHEAD, Pond } from '../../render/pond';
import { showToast } from '../../ui/toast';
import { CameraRig } from './cameraRig';
import { DogView } from './dogView';
import { Particles, RunnerWorld, makeBranch, makeCrumb, makeHeart } from './runnerView';
import { buildStarterCourse } from '../../course/generateCourse';

export interface RunnerOptions {
  section: 'runner1' | 'runner2';
  length: number;
  crumbs: boolean;
  heart: boolean;
  /** A dog chases Bill (Runner 1). */
  dog?: boolean;
  /** Apply the swim's speed boost at the start, if it was bought (Runner 2). */
  boost?: boolean;
  /** Top speed for this stage: the duck gets faster each stage. */
  maxSpeed: number;
  /** A pond in the road just past the finish (Runner 1): the dive happens into it. */
  pond?: boolean;
}

/** Half the depth of Bill's hitbox along the track. Items are caught with a swept check. */
const HIT_HALF_DEPTH = 0.45;
const PICKUP_HALF_DEPTH = 0.8;
/** Items are drawn this far ahead; beyond that the fog hides them anyway. */
const VIEW_AHEAD = 130;
const HIT_STOP_SEC = 0.07;

/** The dog: how far behind Bill it runs (world units), and how long it stays close after a hit. */
const DOG = {
  closeGap: 3.4,
  awayGap: 10, // behind the camera, out of sight
  introSec: 2.6,
  closeSec: 5,
  /** A second hit while the dog is close: it bites once Bill's 1 s invulnerability has passed. */
  biteDelaySec: 1.05,
};

interface Placed {
  item: CourseItem;
  object: THREE.Object3D;
  /** Collision already decided (hit, collected or passed). It still scrolls past while visible. */
  done: boolean;
  collected: boolean;
  /** Set once hit: the branch tumbles away for a moment. */
  flyT: number;
  phase: number;
}

export function createRunner(options: RunnerOptions): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const root = new THREE.Group();
    const world = new RunnerWorld();
    const particles = new Particles(80);
    const rig = new CameraRig(ctx.defaultCamera);
    const lanes = new LaneMover();
    const course: Course = buildStarterCourse(ctx.rng(options.section), options);
    const placed: Placed[] = [];
    const flash = document.createElement('div');
    flash.className = 'screen-flash';

    let distance = 0;
    let speed = ctx.run.runnerSpeed;
    let hitStop = 0;
    let splashTimer = 0;
    let squashT = 1;
    let squashDir = 0;
    let time = 0;

    const dog = options.dog ? new DogView() : null;
    let dogGap = DOG.closeGap;
    let dogX = 0;
    let dogMode: 'close' | 'away' | 'bite' = 'close';
    let dogTimer = DOG.introSec; // how long it stays close
    let biteIn = 0;

    const boosted = options.boost === true && powerUpFor(ctx.run.coins) === 'boost';
    let boostT = boosted ? CONFIG.powerUps.boostSec : 0;
    const speedLines = document.createElement('div');
    speedLines.className = 'speed-lines';
    const aura = boosted ? new BoostAura() : null;
    const pond = options.pond ? new Pond() : null;

    const flashScreen = (kind: 'hit' | 'heal') => {
      flash.className = 'screen-flash';
      void flash.offsetWidth; // restart the CSS animation
      flash.className = `screen-flash ${kind}`;
    };

    const onHit = (p: Placed) => {
      if (boostT > 0) {
        // Boosted: Bill smashes straight through, no damage and no slowdown.
        p.flyT = 0.0001;
        hitStop = 0.04;
        rig.addTrauma(0.3);
        ctx.emit({ type: 'cue', name: 'smash' });
        particles.burst(lanes.x, 0.5, -0.3, 18, { color: 0x8a5a2b, speed: 7, up: 6, life: 0.6, size: 1.2, grow: 0.2 });
        particles.burst(lanes.x, 0.8, -0.3, 10, { color: 0xffd23f, speed: 6, up: 4, life: 0.4, size: 0.8 });
        return;
      }
      if (!ctx.damagePlayer('log')) return; // still invulnerable: no life lost, no slowdown
      if (dog) {
        // Stumble once and the dog catches up; stumble again while it's on you and it bites.
        if (dogMode === 'close') {
          dogMode = 'bite';
          biteIn = DOG.biteDelaySec;
        } else if (dogMode === 'away') {
          dogMode = 'close';
          dogTimer = DOG.closeSec;
          showToast('🐕 The dog is on your tail!', 'bad', 1400);
        }
        dog.bark();
        ctx.emit({ type: 'cue', name: 'bark' });
      }
      speed *= CONFIG.runner.hitSpeedMultiplier; // confirmed: -30%, even mid-acceleration
      hitStop = HIT_STOP_SEC;
      rig.addTrauma(0.55);
      flashScreen('hit');
      ctx.bill.setPose('hit');
      ctx.emit({ type: 'cue', name: 'hit' });
      p.flyT = 0.0001;
      particles.burst(lanes.x, 0.4, -0.3, 14, { color: 0x8a5a2b, speed: 5, up: 5, life: 0.6, size: 1.2, grow: 0.2 });
      particles.burst(lanes.x, 0.1, -0.3, 10, { color: 0x9a7650, speed: 3, up: 3, life: 0.6, size: 1.4, grow: 0.8 });
    };

    const onPickup = (p: Placed) => {
      p.collected = true;
      p.object.visible = false;
      const z = p.object.position.z;
      if (p.item.kind === 'crumb') {
        ctx.addScore(CONFIG.score.perBreadcrumb);
        ctx.emit({ type: 'cue', name: 'crumb' });
        particles.burst(lanes.x, 0.8, z, 6, { color: 0xffd98a, speed: 2, up: 3, life: 0.35, size: 0.8 });
      } else if (ctx.gainLife()) {
        ctx.emit({ type: 'cue', name: 'heart' });
        flashScreen('heal');
        particles.burst(lanes.x, 1.1, z, 16, { color: 0xff7aa8, speed: 4, up: 4, life: 0.6 });
      }
    };

    return {
      enter() {
        for (const item of course.items) {
          const object = item.kind === 'branch' ? makeBranch(item.lanes) : item.kind === 'crumb' ? makeCrumb() : makeHeart();
          if (item.kind !== 'branch') object.position.x = CONFIG.runner.lanes[item.lanes[0]];
          object.visible = false;
          root.add(object);
          placed.push({ item, object, done: false, collected: false, flyT: 0, phase: Math.random() * Math.PI * 2 });
        }
        root.add(world.group, particles.group);
        if (pond) root.add(pond.group);
        if (dog) {
          dog.root.scale.setScalar(0.8);
          root.add(dog.root);
          dog.bark();
          showToast('🐕 Run! A dog is chasing you!', 'bad', 2000);
        }
        if (boosted) {
          speed = options.maxSpeed * CONFIG.powerUps.boostSpeedMultiplier;
          document.getElementById('ui')?.appendChild(speedLines);
          root.add(aura!.group);
          showToast('⚡ SPEED BOOST!', 'good', 1600);
          ctx.emit({ type: 'cue', name: 'boost' });
        }
        ctx.scene.add(root);
        document.getElementById('ui')?.appendChild(flash);
        ctx.bill.setPose('run');
      },

      update(dt) {
        time += dt;

        // Steering works even during hit-stop, so the freeze never eats an input.
        const dir = lanes.handle(ctx.input);
        if (dir !== 0) {
          ctx.bill.setPose(dir < 0 ? 'laneLeft' : 'laneRight');
          ctx.emit({ type: 'cue', name: 'laneChange' });
          squashT = 0;
          squashDir = dir;
        }
        lanes.update(dt);

        // Hit-stop: the world freezes for a beat on impact. Bill and the camera keep moving.
        const worldDt = hitStop > 0 ? 0 : dt;
        hitStop = Math.max(0, hitStop - dt);

        // The boost lifts the speed cap for a few seconds, then normal speed takes over again.
        boostT = Math.max(0, boostT - dt);
        const cap = boostT > 0 ? options.maxSpeed * CONFIG.powerUps.boostSpeedMultiplier : options.maxSpeed;
        speed = speed > cap ? Math.max(cap, speed - 6 * worldDt) : Math.min(cap, speed + CONFIG.runner.acceleration * worldDt);
        if (boosted && boostT === 0 && speedLines.isConnected) {
          speedLines.remove();
          aura?.group.removeFromParent();
          ctx.emit({ type: 'cue', name: 'boostEnd' });
        }
        if (aura && boostT > 0) {
          aura.group.position.set(lanes.x, 0, 0);
          aura.update(dt);
          if (Math.random() < 0.6) particles.burst(lanes.x + (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 1.2, 0.3, 1, { color: 0xffd23f, speed: 1, up: 0.5, life: 0.4, size: 0.5, grow: 0 });
        }
        const previous = distance;
        const step = speed * worldDt;
        distance = Math.min(course.length, distance + step);

        world.scroll(distance, step);
        if (pond) {
          // Seen from far off as the run nears its end; the dive starts with it exactly here.
          const ahead = course.length + POND_AHEAD - distance;
          pond.group.position.z = -ahead;
          pond.group.visible = ahead < VIEW_AHEAD;
          pond.update(dt);
        }

        for (const p of placed) {
          const z = -(p.item.distance - distance);
          if (p.flyT > 0) {
            // The branch Bill smashed tumbles up and away.
            p.flyT += dt;
            p.object.position.set(p.object.position.x, 0.3 + p.flyT * 6 - p.flyT * p.flyT * 14, z - p.flyT * 4);
            p.object.rotation.x += dt * 9;
            if (p.flyT > 0.6) p.object.visible = false;
            continue;
          }
          if (!p.done) {
            // Swept check: did Bill's hitbox pass over this item since last frame? (No tunnelling.)
            const half = p.item.kind === 'branch' ? HIT_HALF_DEPTH : PICKUP_HALF_DEPTH;
            const crossed = previous <= p.item.distance + half && distance >= p.item.distance - half;
            if (crossed && p.item.lanes.includes(lanes.lane)) {
              p.done = true;
              if (p.item.kind === 'branch') onHit(p);
              else onPickup(p);
            } else if (distance > p.item.distance + half) {
              p.done = true; // passed safely
            }
          }
          // Collected pickups and smashed branches are handled above; everything else keeps
          // scrolling past Bill until it's behind the camera (it must never freeze beside him).
          if (p.collected || p.flyT > 0) continue;

          const ahead = p.item.distance - distance;
          p.object.visible = ahead < VIEW_AHEAD && ahead > -12;
          if (!p.object.visible) continue;
          p.object.position.z = z;
          if (p.item.kind === 'branch') {
            p.object.position.y = Math.sin(time * 2 + p.phase) * 0.05; // bobbing on the water
            p.object.rotation.z = Math.sin(time * 1.5 + p.phase) * 0.03;
          } else {
            p.object.rotation.y += dt * 2.5;
            p.object.position.y = (p.item.kind === 'heart' ? 1.1 : 0.7) + Math.sin(time * 3 + p.phase) * 0.12;
          }
        }

        // Bill: lane position, a squash-and-stretch pop on lane changes, dust puffs at his feet.
        const bill = ctx.bill.object;
        bill.position.x = lanes.x;
        squashT = Math.min(1, squashT + dt / 0.2);
        const back = 1 + 2.2 * Math.pow(squashT - 1, 3) + 1.2 * Math.pow(squashT - 1, 2); // ease-out-back
        // Stretch along the dash (wider, shorter), then spring back past 1 and settle.
        bill.scale.set(1 + 0.15 * (1 - back), 1 - 0.12 * (1 - back), 1);
        bill.rotation.z = -squashDir * 0.12 * (1 - squashT);

        // Blink while invulnerable after a hit.
        const invulnerable = performance.now() < ctx.run.invulnerableUntilMs;
        bill.visible = !invulnerable || Math.floor(performance.now() / 70) % 2 === 0;

        splashTimer -= worldDt;
        if (splashTimer <= 0 && worldDt > 0) {
          splashTimer = 0.09;
          particles.burst(lanes.x, 0.03, 0.2, 2, { color: 0xb8956a, speed: 1.2, up: 1.4, life: 0.4, size: 0.6, grow: 1.6 });
        }
        particles.update(dt, step);

        if (dog) {
          dogTimer -= dt;
          if (dogMode === 'close' && dogTimer <= 0) dogMode = 'away';
          if (dogMode === 'bite') {
            biteIn -= dt;
            dog.setLunge(Math.max(0, 1 - biteIn / DOG.biteDelaySec));
            if (biteIn <= 0) {
              if (ctx.damagePlayer('dog')) {
                ctx.emit({ type: 'cue', name: 'bite' });
                ctx.bill.setPose('hit');
                rig.addTrauma(0.6);
                flashScreen('hit');
                showToast('🐕 CHOMP!', 'bad', 1000);
              }
              dog.setLunge(0);
              dogMode = 'away';
            }
          }
          const target = dogMode === 'away' ? DOG.awayGap : dogMode === 'bite' ? 1.4 : DOG.closeGap;
          dogGap += (target - dogGap) * Math.min(1, dt * (dogMode === 'away' ? 0.8 : 3));
          // Half a lane to the side (towards the middle) so it never hides Bill; straight behind to bite.
          const side = dogMode === 'bite' ? 0 : lanes.x > 0 ? -1.3 : 1.3;
          dogX += (lanes.x + side - dogX) * Math.min(1, dt * 4);
          dog.root.position.set(dogX, 0, dogGap);
          dog.root.visible = dogGap < 7;
          dog.update(dt);
        }

        // Above 1 while boosted: the camera widens a little more.
        const speed01 = (speed - CONFIG.runner.startSpeed) / (CONFIG.runner.maxSpeed - CONFIG.runner.startSpeed);
        rig.update(dt, lanes.x, Math.max(0, speed01));

        ctx.setRunnerSpeed(speed);
        ctx.setPhaseProgress(distance, course.length);
        if (distance >= course.length) ctx.completePhase();
      },

      exit() {
        flash.remove();
        speedLines.remove();
        ctx.bill.object.scale.set(1, 1, 1);
        ctx.bill.object.rotation.z = 0;
        disposeObject(root);
      },

      dispose() {},
    };
  };
}
