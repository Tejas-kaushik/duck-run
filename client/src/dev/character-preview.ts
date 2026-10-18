// Dev-only page for looking at Bill in every pose. Open with `npm run character`.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCharacter, type CharacterPose } from '../render/character';

const POSES: CharacterPose[] = ['idle', 'run', 'laneLeft', 'laneRight', 'hit', 'fly', 'attack', 'victory', 'fail'];

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9eef5);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(1.6, 1.6, 4.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.65, 0.9, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(3, 6, 4);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0xc9d3df }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const bill = createCharacter();
scene.add(bill.object);

const ghost = createCharacter();
ghost.setGhost(true);
ghost.object.position.x = 1.3;
scene.add(ghost.object);

const ui = document.getElementById('ui')!;
const buttons = new Map<CharacterPose, HTMLButtonElement>();

function choose(pose: CharacterPose): void {
  bill.setPose(pose);
  ghost.setPose(pose);
  buttons.forEach((button, p) => button.classList.toggle('on', p === pose));
}

for (const pose of POSES) {
  const button = document.createElement('button');
  button.textContent = pose;
  button.addEventListener('click', () => choose(pose));
  ui.appendChild(button);
  buttons.set(pose, button);
}

const requested = new URLSearchParams(window.location.search).get('pose') as CharacterPose | null;
choose(requested && POSES.includes(requested) ? requested : 'run');

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  bill.update(dt);
  ghost.update(dt);
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
