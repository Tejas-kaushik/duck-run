// The swim (Tejas, DESIGN_CHANGES.md): Bill swims through the sea in three lanes with A/D, collects
// coins and dodges jellyfish and pufferfish. A hit costs coins (never lives) and slows him down.
// The coins buy the best power-up he can afford: 20 shield, 50 boost, 100 laser.

import * as THREE from 'three';
import { CONFIG } from '../../core/config';
import { LaneMover } from '../../core/LaneMover';
import { powerUpFor } from '../../core/RunState';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import { disposeObject } from '../../render/dispose';
import { showToast } from '../../ui/toast';
import { Particles } from '../runner/runnerView';
import { buildSwimCourse, type SwimItem } from './swimCourse';
import { SEA_COLOR, UnderwaterWorld, makeCoin, makeJelly, makePuffer } from './underwaterView';

const COIN_HALF = 0.9;
const CREATURE_HALF = 0.6;
const VIEW_AHEAD = 70;
const INVULNERABLE_SEC = 1;

interface Placed {
  item: SwimItem;
  object: THREE.Object3D;
  done: boolean;
  collected: boolean;
  phase: number;
}

const POWER_TOAST = {
  none: 'No power-up this time…',
  shield: '🛡️ 20+ coins: SHIELD for the boss!',
  boost: '⚡ 50+ coins: SPEED BOOST!',
  laser: '💥 100+ coins: LASER +50%!',
} as const;

export function createSwimPhase(length: number): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const root = new THREE.Group();
    const world = new UnderwaterWorld();
    const particles = new Particles(90);
    const lanes = new LaneMover();
    const course = buildSwimCourse(ctx.rng('underwater'), length);
    const placed: Placed[] = [];
    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    const oldFog = ctx.scene.fog;
    let distance = 0;
    let speed = CONFIG.swim.speed;
    let invulnerable = 0;
    let time = 0;
    let camX = 0;
    let trail = 0;
    let finished = false;

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };

    const hitCreature = (p: Placed) => {
      if (invulnerable > 0) return;
      invulnerable = INVULNERABLE_SEC;
      speed = CONFIG.swim.speed * CONFIG.swim.hitSlowdown;
      ctx.addCoins(-CONFIG.swim.coinsLostOnHit);
      ctx.bill.setPose('hit');
      ctx.emit({ type: 'cue', name: p.item.kind === 'jelly' ? 'zap' : 'ouch' });
      flash.className = 'screen-flash';
      void flash.offsetWidth;
      flash.className = 'screen-flash hit';
      // Lost coins spill out of his pockets.
      particles.burst(lanes.x, 0.3, 0, 14, { color: 0xffc83d, speed: 4, up: 2, life: 0.8, size: 1.3, grow: 0 });
    };

    const collect = (p: Placed) => {
      p.collected = true;
      p.object.visible = false;
      ctx.addCoins(1);
      ctx.emit({ type: 'cue', name: 'coin' });
      particles.burst(lanes.x, 0.4, p.object.position.z, 5, { color: 0xffe680, speed: 2, up: 1.5, life: 0.35, size: 0.7 });
    };

    return {
      enter() {
        ctx.sky.visible = false;
        ctx.scene.background = new THREE.Color(SEA_COLOR);
        ctx.scene.fog = new THREE.Fog(SEA_COLOR, 6, 62);
        for (const item of course.items) {
          const object = item.kind === 'coin' ? makeCoin() : item.kind === 'jelly' ? makeJelly() : makePuffer();
          object.position.set(CONFIG.runner.lanes[item.lane], item.kind === 'coin' ? 0.45 : 0.4, -item.distance);
          object.visible = false;
          root.add(object);
          placed.push({ item, object, done: false, collected: false, phase: Math.random() * Math.PI * 2 });
        }
        root.add(world.group, particles.group);
        ctx.scene.add(root);
        ctx.setCamera(camera);
        document.getElementById('ui')?.appendChild(flash);
        window.addEventListener('resize', onResize);
        ctx.bill.setPose('fly'); // body flat, wings paddling: swimming
        showToast('🪙 Grab coins for a power-up!', 'info', 1800);
      },

      update(dt) {
        time += dt;
        const dir = lanes.handle(ctx.input);
        if (dir !== 0) {
          ctx.bill.setPose(dir < 0 ? 'laneLeft' : 'laneRight');
          ctx.emit({ type: 'cue', name: 'swish' });
        }
        lanes.update(dt);

        invulnerable = Math.max(0, invulnerable - dt);
        // Picks up pace through the swim (harder near the end), and recovers after a hit.
        const target = CONFIG.swim.speed * (1 + 0.18 * (distance / course.length));
        speed += (target - speed) * Math.min(1, dt * 1.2);
        const previous = distance;
        const step = speed * dt;
        distance = Math.min(course.length, distance + step);
        world.update(dt, distance, step);

        for (const p of placed) {
          if (p.collected) continue;
          if (!p.done) {
            const half = p.item.kind === 'coin' ? COIN_HALF : CREATURE_HALF;
            const crossed = previous <= p.item.distance + half && distance >= p.item.distance - half;
            if (crossed && p.item.lane === lanes.lane) {
              p.done = true;
              if (p.item.kind === 'coin') collect(p);
              else hitCreature(p);
            } else if (distance > p.item.distance + half) {
              p.done = true;
            }
          }
          if (p.collected) continue;
          const ahead = p.item.distance - distance;
          p.object.visible = ahead < VIEW_AHEAD && ahead > -8;
          if (!p.object.visible) continue;
          p.object.position.z = -ahead;
          const t = time + p.phase;
          if (p.item.kind === 'coin') {
            p.object.rotation.y = t * 3;
            p.object.position.y = 0.45 + Math.sin(t * 2.5) * 0.12;
          } else if (p.item.kind === 'jelly') {
            const bell = p.object.getObjectByName('bell')!;
            bell.scale.set(1 + Math.sin(t * 4) * 0.08, 0.85 - Math.sin(t * 4) * 0.12, 1 + Math.sin(t * 4) * 0.08);
            p.object.position.y = 0.6 + Math.sin(t * 1.5) * 0.3;
          } else {
            const body = p.object.getObjectByName('body')!;
            body.scale.setScalar(1 + Math.sin(t * 2.2) * 0.12);
            p.object.rotation.y = Math.sin(t) * 0.3;
          }
        }

        // Bill: swims in his lane with a gentle bob, a trail of bubbles, and blinks after a hit.
        const bill = ctx.bill.object;
        bill.position.set(lanes.x, Math.sin(time * 3) * 0.08, 0);
        bill.rotation.set(-0.15, Math.PI, -lanes.direction * 0.25);
        bill.visible = invulnerable <= 0 || Math.floor(time * 14) % 2 === 0;
        trail -= dt;
        if (trail <= 0) {
          trail = 0.08;
          particles.burst(lanes.x + (Math.random() - 0.5) * 0.3, 0.3, 0.6, 1, { color: 0xe6fbff, speed: 0.4, up: -0.5, life: 0.7, size: 0.5, grow: 0.4 });
        }
        particles.update(dt, step);

        camX += (lanes.x * 0.55 - camX) * Math.min(1, dt * 6);
        // A little high and back, looking well ahead, so the coming coins and creatures are in view.
        camera.position.set(camX, 3 + Math.sin(time * 0.8) * 0.06, 6.4);
        camera.lookAt(camX * 0.5, -0.6, -12);

        ctx.setPhaseProgress(distance, course.length);
        if (!finished && distance >= course.length) {
          finished = true;
          const power = powerUpFor(ctx.run.coins);
          showToast(POWER_TOAST[power], power === 'none' ? 'info' : 'good', 2400);
          ctx.emit({ type: 'cue', name: power === 'none' ? 'nopower' : 'powerup' });
          ctx.completePhase();
        }
      },

      exit() {
        window.removeEventListener('resize', onResize);
        flash.remove();
        ctx.scene.fog = oldFog;
        ctx.bill.object.rotation.set(0, Math.PI, 0);
        disposeObject(root);
      },

      dispose() {},
    };
  };
}
