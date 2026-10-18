// A smooth gradient sky with a soft sun glow, plus the outdoor lights (Tejas). Shared by every
// above-water stage; underwater stages hide the sky and set their own background.

import * as THREE from 'three';

export const SKY = {
  top: 0x3f8fe0,
  horizon: 0xbfe3ff,
  /** Matches the horizon so distant trees fade into the sky instead of popping. */
  fog: 0xb4dcfa,
  sunDirection: new THREE.Vector3(0.35, 0.55, -0.75).normalize(),
};

export function createSky(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(SKY.top) },
      horizon: { value: new THREE.Color(SKY.horizon) },
      sun: { value: SKY.sunDirection },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // always at the far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 sun;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        float s = max(dot(normalize(vDir), sun), 0.0);
        col += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 2.5 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), material);
  sky.name = 'sky';
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

/** What the world reflects: the sky above, green ground below. Captured once at start-up. */
export function createEnvironmentScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(createSky());
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(400, 32),
    new THREE.MeshBasicMaterial({ color: 0x4a7f3f }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -8;
  scene.add(ground);
  return scene;
}

/** Warm sun with soft shadows around the play area, and a sky/ground fill light. */
export function createOutdoorLights(): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xdff1ff, 0x5f7f4a, 1.1));

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.copy(SKY.sunDirection).multiplyScalar(40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = -18;
  s.right = 18;
  s.top = 18;
  s.bottom = -18;
  s.near = 1;
  s.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(0, 0, -8); // shadows sharpest where the action is
  group.add(sun, sun.target);
  return group;
}
