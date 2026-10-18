// The mafia pigeon boss (Tejas renders; Zubair's sim/boss.ts decides). Dodge three aimed shots with
// A/D, then react to Ready → Aim → green FIRE with either button for the laser (GAME_BRIEF §6, ZUBAIR_BASE.md).
// Swim power-ups apply here: a 5 s shield at the start, or the laser hitting 50% harder.
// It opens with an intro: Bill skids to a stop, Don Crumbs swoops down onto his crate, and his
// name card and taunt play in letterbox before the fight starts.

import * as THREE from 'three';
import { CONFIG } from '../../core/config';
import { LaneMover } from '../../core/LaneMover';
import { powerUpFor } from '../../core/RunState';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import { disposeObject } from '../../render/dispose';
import { FloatingText, LaserBeam, LaserEyes, Shockwave, ShieldView } from '../../render/effects';
import { showToast } from '../../ui/toast';
import {
  advanceBossReload,
  beginBossReload,
  beginNextBossVolley,
  createBoss,
  fireBossShot,
  getBossPrompt,
  pressBossAttack,
  resolveBossProjectile,
  type BossAttackResult,
} from '../../sim/boss';
import { CameraRig } from '../runner/cameraRig';
import { Particles, RunnerWorld } from '../runner/runnerView';
import { PigeonView, makeBullet } from './pigeonView';

const PIGEON_Z = -17;
const RESULT_SEC = 0.75;
/** A reaction this fast counts as PERFECT: bigger beam, bigger boom. */
const PERFECT_MS = 220;

/** The intro's beats, in seconds. */
const INTRO = {
  stopBy: 0.9, // Bill has skidded to a halt
  flyFrom: 0.3,
  landAt: 1.75,
  cardAt: 1.95,
  tauntAt: 2.35,
  outAt: 3.75,
  end: 4.25,
};
const TAUNT = "You're going down, birdie!";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** The swoop: a curve from high in the sky, down past the camera's side, onto the crate. */
const SWOOP = new THREE.CubicBezierCurve3(
  new THREE.Vector3(-16, 20, -14),
  new THREE.Vector3(-9, 12, -2),
  new THREE.Vector3(4, 5, 2),
  new THREE.Vector3(0, 0, 0),
);
const R = CONFIG.boss.reaction;

/**
 * The damage curve: linear from maxDamage at 0 ms to minDamage at the end of Fire.
 * The 100-coin power-up multiplies it, inside the sim's rule, so sim and shared HP stay in step.
 */
const reactionCurve = (multiplier: number) => (reactionMs: number) => {
  const k = Math.min(1, Math.max(0, reactionMs / (R.fireWindowSec * 1000)));
  return Math.round((R.maxDamage + (R.minDamage - R.maxDamage) * k) * multiplier);
};

interface Bullet {
  id: number;
  mesh: THREE.Object3D;
  lane: number;
  /** Bounced off the shield: flies off sideways and can't hurt anyone. */
  deflected: boolean;
  from: THREE.Vector3;
  t: number;
  duration: number;
}

export function createBossPhase(): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const power = powerUpFor(ctx.run.coins);
    const reactionRandom = ctx.rng('boss');
    const sim = createBoss({
      readyMs: R.readySec * 1000,
      aimMs: R.aimSec * 1000,
      fireMs: R.fireWindowSec * 1000,
      damageForReaction: reactionCurve(power === 'laser' ? CONFIG.powerUps.laserDamageMultiplier : 1),
      noPressDamage: R.noPressDamage,
    });
    const root = new THREE.Group();
    const world = new RunnerWorld();
    const pigeon = new PigeonView();
    const laser = new LaserBeam();
    const shockwave = new Shockwave();
    const damageText = new FloatingText();
    const laserEyes = power === 'laser' ? new LaserEyes() : null;
    let hitStop = 0;
    const particles = new Particles(70);
    const rig = new CameraRig(ctx.defaultCamera);
    const lanes = new LaneMover();
    const bullets: Bullet[] = [];
    const prompt = document.createElement('div');
    prompt.className = 'reaction';
    const shield = new ShieldView();
    let shieldT = power === 'shield' ? CONFIG.powerUps.shieldSec : 0;

    // The intro's on-screen pieces: letterbox bars, the name card and the speech bubble.
    const letterbox = document.createElement('div');
    letterbox.className = 'letterbox';
    const card = document.createElement('div');
    card.className = 'boss-card';
    card.innerHTML = '<small>THE MAFIA PIGEON</small><strong>DON CRUMBS</strong>';
    const speech = document.createElement('div');
    speech.className = 'speech';
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    let introT = 0;
    let intro = true;
    let landed = false;
    let carded = false;
    const gameplayCam = { pos: new THREE.Vector3(0, 3.4, 6.5), look: new THREE.Vector3(0, 1, -8) };
    const dramaticCam = { pos: new THREE.Vector3(0.8, 1.9, 3.2), look: new THREE.Vector3(0, 4.4, PIGEON_Z) };

    let volleyT = 0; // seconds since this volley started
    let resultT = -1; // seconds the last attack result has been on screen
    let wonT = -1;
    let drift = 0;
    let lastPrompt: string | null = null; // so each prompt's cue fires once

    const say = (text: string, kind: '' | 'fire' | 'good' | 'bad' = '') => {
      prompt.textContent = text;
      prompt.className = `reaction ${kind}`.trim();
      if (!prompt.isConnected) document.getElementById('ui')?.appendChild(prompt);
    };

    const showResult = (result: BossAttackResult) => {
      resultT = 0;
      ctx.requestInputMode('none');
      if (result.damage > 0) ctx.damageBoss(result.damage); // mirror the sim's HP once, never subtract twice
      if (result.reason === 'reaction') {
        const perfect = (result.reactionMs ?? 999) <= PERFECT_MS;
        const boosted = power === 'laser';
        // From Bill's beak to the Don's face.
        const from = ctx.bill.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.05, -0.3));
        const to = pigeon.faceWorld(new THREE.Vector3());
        laser.fire(from, to, boosted);
        shockwave.play(to.clone().add(new THREE.Vector3(0, 0, 1.2)), boosted ? 0xffb347 : 0xff7ad1, perfect || boosted);
        damageText.show(perfect ? `PERFECT! -${result.damage.toLocaleString()}` : `-${result.damage.toLocaleString()}`, to.clone().add(new THREE.Vector3(0, 1.6, 2)), perfect ? '#ffe14d' : '#ffffff');
        hitStop = perfect ? 0.12 : 0.07;
        pigeon.hit();
        pigeon.setHealth(sim.hp / CONFIG.boss.health);
        rig.addTrauma(perfect ? 0.7 : 0.45);
        ctx.bill.setPose('attack');
        ctx.emit({ type: 'cue', name: perfect ? 'laserPerfect' : 'laser' });
        particles.burst(to.x, to.y, to.z + 1, perfect ? 34 : 22, { color: boosted ? 0xffb347 : 0xff9ad8, speed: 8, up: 5, life: 0.7, size: 1.1, grow: 0.3 });
        particles.burst(to.x, to.y, to.z + 1, 14, { color: 0xb8bcc8, speed: 6, up: 4, life: 0.9, size: 1.3, grow: 0.2 });
        say(`${Math.round(result.reactionMs ?? 0)} ms · ${result.damage.toLocaleString()} damage`, 'good');
      } else {
        ctx.emit({ type: 'cue', name: 'miss' });
        const text =
          result.reason === 'early'
            ? 'Too early! 1 damage'
            : result.reason === 'held'
              ? 'Held too early! 1 damage'
              : `Too slow!${result.damage ? ` ${result.damage} damage` : ''}`;
        say(text, 'bad');
      }
    };

    const startVolley = () => {
      volleyT = 0;
      resultT = -1;
      lastPrompt = null;
      prompt.remove();
      ctx.requestInputMode('lanes');
      ctx.bill.setPose('run');
    };

    const spawnBullet = (id: number) => {
      // Targeting: aim at the duck's lane when fired, then fly straight, so a lane change dodges it.
      const lane = lanes.lane;
      const mesh = makeBullet();
      const from = pigeon.muzzleWorld(new THREE.Vector3());
      mesh.position.copy(from);
      mesh.lookAt(CONFIG.runner.lanes[lane], 1, 0); // nose first, towards the duck's lane
      root.add(mesh);
      bullets.push({ id, mesh, lane, from, t: 0, duration: -from.z / CONFIG.boss.bulletSpeed, deflected: false });
      pigeon.fire();
      rig.addTrauma(0.12);
      ctx.emit({ type: 'cue', name: 'shot' });
    };

    return {
      enter() {
        pigeon.root.position.set(0, 0, PIGEON_Z);
        root.add(world.group, pigeon.root, laser.group, shockwave.group, damageText.sprite, particles.group);
        if (laserEyes) ctx.bill.head.add(laserEyes.group);
        ctx.scene.add(root);
        pigeon.setHealth(1);
        // Dev only: preview his moods from the console, e.g. __pigeon.setHealth(0.3).
        if (import.meta.env.DEV) (window as unknown as { __pigeon: PigeonView }).__pigeon = pigeon;
        // Intro: no input until the fight starts; the Don starts high in the sky.
        ctx.requestInputMode('none');
        ctx.bill.setPose('run');
        pigeon.setFlight(SWOOP.getPoint(0), -0.6);
        pigeon.setFlap(1);
        shadow.position.set(0, 0.27, PIGEON_Z); // on the crate's lid (crate top is y 0.2, scaled 1.3)
        root.add(shadow);
        const ui = document.getElementById('ui');
        ui?.append(letterbox);
        requestAnimationFrame(() => letterbox.classList.add('on'));
        ctx.emit({ type: 'cue', name: 'bossIncoming' });
      },

      update(dt) {
        // Hit-stop: the world freezes for a beat when a laser lands. Effects keep playing.
        const worldDt = hitStop > 0 ? dt * 0.08 : dt;
        hitStop = Math.max(0, hitStop - dt);
        drift += worldDt * 2;
        world.scroll(drift, worldDt * 2); // the arena drifts gently
        pigeon.update(worldDt);
        laser.update(dt);
        shockwave.update(dt);
        damageText.update(dt);
        laserEyes?.update(dt);
        particles.update(dt, 0);

        if (intro) {
          introT += dt;
          const t = introT;

          // Bill skids to a stop as the music cuts.
          const slow = 1 - span(t, 0, INTRO.stopBy);
          drift += dt * 18 * slow * slow;
          world.scroll(drift, dt * 18 * slow * slow);
          if (t >= INTRO.stopBy && t - dt < INTRO.stopBy) ctx.bill.setPose('idle');

          // The swoop: eased so he slows and flares just before touchdown.
          const p = span(t, INTRO.flyFrom, INTRO.landAt);
          const u = 1 - Math.pow(1 - easeInOut(p), 1.6);
          if (!landed) {
            pigeon.setFlight(SWOOP.getPoint(u), -0.6 * (1 - u) + Math.sin(t * 3) * 0.05 * (1 - u));
            pigeon.setFlap(p < 0.85 ? 0.6 : 1); // big flaps to brake at the end
            const near = span(t, INTRO.flyFrom, INTRO.landAt);
            shadow.scale.setScalar(0.4 + near * 1.4);
            (shadow.material as THREE.MeshBasicMaterial).opacity = near * 0.45;
          }
          if (!landed && t >= INTRO.landAt) {
            landed = true;
            pigeon.setFlight(new THREE.Vector3(), 0);
            pigeon.setFlap(0);
            pigeon.land();
            shadow.removeFromParent();
            ctx.emit({ type: 'cue', name: 'bossLand' });
            const at = new THREE.Vector3(0, 1.3, PIGEON_Z + 1.2);
            shockwave.play(at, 0xd8c0a0, true);
            particles.burst(0, 1.2, PIGEON_Z + 1.6, 30, { color: 0xb8956a, speed: 9, up: 3, life: 0.9, size: 1.6, grow: 1.4 });
            particles.burst(0, 1.2, PIGEON_Z + 1.6, 12, { color: 0x8a8f9c, speed: 6, up: 5, life: 0.8, size: 0.7, grow: 0 });
          }

          // Name card, then the taunt typed out in a speech bubble.
          if (!carded && t >= INTRO.cardAt) {
            carded = true;
            document.getElementById('ui')?.append(card, speech);
            requestAnimationFrame(() => card.classList.add('on'));
            ctx.emit({ type: 'cue', name: 'bossName' });
          }
          if (t >= INTRO.tauntAt) {
            const chars = Math.min(TAUNT.length, Math.floor((t - INTRO.tauntAt) / 0.035));
            if (chars > 0 && !speech.classList.contains('on')) {
              speech.classList.add('on');
              ctx.emit({ type: 'cue', name: 'bossTaunt' });
            }
            speech.textContent = TAUNT.slice(0, chars);
          }
          if (t >= INTRO.outAt && letterbox.classList.contains('on')) {
            letterbox.classList.remove('on');
            card.classList.remove('on');
            speech.classList.remove('on');
          }

          // Camera: down to a low, dramatic angle looking up at him, then back for the fight.
          const k = easeInOut(span(t, 0.2, INTRO.landAt)) * (1 - easeInOut(span(t, INTRO.outAt, INTRO.end)));
          const cam = ctx.defaultCamera;
          cam.position.lerpVectors(gameplayCam.pos, dramaticCam.pos, k);
          const look = gameplayCam.look.clone().lerp(dramaticCam.look, k);
          cam.lookAt(look);
          // A short, smooth thump when he lands (the gameplay camera rig isn't running yet).
          const thump = landed ? Math.max(0, 1 - (t - INTRO.landAt) * 3) : 0;
          cam.position.y += Math.sin(t * 55) * 0.18 * thump * thump;
          cam.position.x += Math.sin(t * 41) * 0.12 * thump * thump;

          if (t >= INTRO.end) {
            intro = false;
            letterbox.remove();
            card.remove();
            speech.remove();
            startVolley();
            ctx.emit({ type: 'cue', name: 'fight' });
            if (shieldT > 0) {
              shield.mesh.position.set(lanes.x, 1, 0);
              root.add(shield.mesh);
              showToast('🛡️ SHIELD UP: 5 seconds!', 'good', 1800);
              ctx.emit({ type: 'cue', name: 'shield' });
            } else if (power === 'laser') {
              showToast('💥 FIGHT! Laser +50%!', 'good', 1600);
            } else {
              showToast('🥊 FIGHT!', 'bad', 1200);
            }
          }
          ctx.bill.object.position.x = lanes.x;
          return;
        }

        if (wonT >= 0) {
          wonT += dt;
          if (wonT > 2) ctx.completePhase();
          rig.update(dt, lanes.x, 0);
          return;
        }

        if (sim.phase === 'volley') {
          volleyT += dt;
          const dir = lanes.handle(ctx.input);
          if (dir !== 0) ctx.bill.setPose(dir < 0 ? 'laneLeft' : 'laneRight');
          lanes.update(dt);
          pigeon.aimAt(lanes.x, dt);

          // Three shots, each after a visible wind-up (the muzzle glows, then fires).
          const nextShotAt = (sim.shotsFired + 1) * CONFIG.boss.shotIntervalSec;
          const windUp = sim.shotsFired < 3 ? 1 - (nextShotAt - volleyT) / CONFIG.boss.windUpSec : 0;
          pigeon.setWindUp(Math.max(0, Math.min(1, windUp)));
          if (sim.shotsFired < 3 && volleyT >= nextShotAt) {
            const id = fireBossShot(sim);
            if (id !== null) spawnBullet(id);
          }

          for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.t += dt;
            const k = b.t / b.duration; // 1 = level with the duck
            b.mesh.position.set(
              b.from.x + (CONFIG.runner.lanes[b.lane] - b.from.x) * k,
              b.from.y + (1 - b.from.y) * k,
              b.from.z * (1 - k),
            );
            if (b.deflected) {
              // Ricochet away and fade out.
              b.mesh.position.x += dt * 12 * (b.lane === 0 ? -1 : 1);
              b.mesh.position.y += dt * 6;
              b.mesh.rotation.z += dt * 20;
              if (b.t > b.duration + 0.5) {
                b.mesh.removeFromParent();
                resolveBossProjectile(sim, b.id);
                bullets.splice(i, 1);
              }
              continue;
            }
            const reached = k >= 1;
            const hits = reached && b.lane === lanes.lane;
            if (hits && shieldT > 0) {
              b.deflected = true;
              shield.flash();
              ctx.emit({ type: 'cue', name: 'ricochet' });
              particles.burst(lanes.x, 1.2, 0.8, 10, { color: 0x9fe8ff, speed: 5, up: 3, life: 0.4 });
              continue;
            }
            if (hits && ctx.damagePlayer('boss')) {
              ctx.bill.setPose('hit');
              rig.addTrauma(0.5);
              particles.burst(lanes.x, 1, 0, 12, { color: 0xffa040, speed: 4, up: 3, life: 0.5 });
            }
            // Only resolve once the bullet can no longer hurt the duck (ZUBAIR_BASE.md step 3).
            if (hits || k > 1.15) {
              b.mesh.removeFromParent();
              resolveBossProjectile(sim, b.id);
              bullets.splice(i, 1);
            }
          }

          // Sample once per cleared volley, so frame rate cannot change the random wait.
          const volleyCleared = sim.shotsFired === CONFIG.boss.shotsPerVolley
            && sim.activeProjectiles.length === 0;
          if (volleyCleared && beginBossReload(sim, 1000 * (
            R.fireDelayMinSec + reactionRandom.next() * (R.fireDelayMaxSec - R.fireDelayMinSec)
          ))) {
            ctx.requestInputMode('timing'); // either button fires; the duck can't move now
            ctx.bill.setPose('idle');
            pigeon.setWindUp(0);
          }
        } else if (sim.phase === 'reload' && resultT < 0) {
          // Advance with the held state from BEFORE this frame's press, then apply the press.
          const heldBefore = ctx.input.fireHeld && !ctx.input.firePressed;
          let result = advanceBossReload(sim, dt * 1000, heldBefore);
          if (!result && ctx.input.firePressed) result = pressBossAttack(sim);
          if (result) showResult(result);
          else {
            const p = getBossPrompt(sim);
            if (p && p !== lastPrompt) ctx.emit({ type: 'cue', name: p }); // 'ready' | 'aim' | 'fire', for sound
            lastPrompt = p;
            if (p === 'ready') say('Ready');
            else if (p === 'aim') say('Aim');
            else if (p === 'fire') say('FIRE!', 'fire');
          }
        } else if (resultT >= 0) {
          resultT += dt;
          if (resultT >= RESULT_SEC) {
            if (beginNextBossVolley(sim)) startVolley();
            else if (sim.phase === 'defeated') {
              wonT = 0;
              prompt.remove();
              pigeon.defeat();
              ctx.bill.setPose('victory');
              ctx.emit({ type: 'cue', name: 'bossDefeated' });
              particles.burst(0, 3, PIGEON_Z + 1, 30, { color: 0xc8ccd6, speed: 7, up: 6, life: 1.2, size: 1.4, grow: 0.1 });
            }
          }
        }

        // The shield follows Bill, shimmers, and flickers out in its last second.
        if (shieldT > 0) {
          shieldT = Math.max(0, shieldT - dt);
          shield.mesh.position.x = lanes.x;
          shield.update(dt, shieldT);
          if (shieldT === 0) {
            shield.mesh.removeFromParent();
            ctx.emit({ type: 'cue', name: 'shieldDown' });
          }
        }
        ctx.bill.object.position.x = lanes.x;
        const invulnerable = performance.now() < ctx.run.invulnerableUntilMs;
        ctx.bill.object.visible = !invulnerable || Math.floor(performance.now() / 70) % 2 === 0;
        rig.update(dt, lanes.x, 0);
        ctx.setPhaseProgress(CONFIG.boss.health - sim.hp, CONFIG.boss.health);
      },

      exit() {
        prompt.remove();
        letterbox.remove();
        card.remove();
        speech.remove();
        if (laserEyes) ctx.bill.head.remove(laserEyes.group);
        disposeObject(root);
      },

      dispose() {},
    };
  };
}
