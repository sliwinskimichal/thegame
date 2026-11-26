/**
 * QA harness: the lab page (src/lab/main.ts) with the illustrated styles of tournament #3
 * (src/lab/styles/illustrated.ts), which are not in the lab registry yet. Same world, light
 * field, camera and window.__lab automation API, so tests/qa/lab-audit.mjs can drive it:
 *   PAGE=tests/qa/harness/ill-lab.html node tests/qa/lab-audit.mjs ...
 * Read-only use of production modules; delete once the styles are registered in the lab.
 */
import * as THREE from 'three';
import { buildArena } from '../../../src/lab/arena';
import { buildGallery } from '../../../src/lab/gallery';
import { GALLERY_SCENARIOS, SCENARIOS, type Scenario } from '../../../src/lab/scenarios';
import type { StyleContext } from '../../../src/lab/style';
import { STYLES } from '../../../src/lab/styles';
import { ILLUSTRATED } from '../../../src/lab/styles/illustrated';
import { daylightAt } from '../../../src/render/daylight';
import { WorldTex } from '../../../src/render/worldTex';
import { LightField } from '../../../src/world/lightfield';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;
if (params.get('hud') === '0') hud.style.display = 'none';

const ALL = [...ILLUSTRATED, ...STYLES];
const gallery = params.get('world') === 'gallery';
const arena = gallery ? buildGallery() : buildArena();
const SCEN = gallery ? GALLERY_SCENARIOS : SCENARIOS;
const world = arena.world;
const light = new LightField(world.w, world.h);
light.compute(world);
if (params.get('flood') === '1') {
  light.r.fill(0.9);
  light.g.fill(0.9);
  light.b.fill(0.9);
  light.pack();
}
const tex = new WorldTex(world, light);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const W = canvas.clientWidth || innerWidth;
const H = canvas.clientHeight || innerHeight;
renderer.setSize(W, H, false);
const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 1200);

let scenario: Scenario = SCEN.find((s) => s.id === params.get('scenario')) ?? SCEN[0]!;
function placeCamera(s: Scenario): void {
  camera.position.set(s.x, s.y + s.d * 0.07, s.d);
  camera.lookAt(s.x, s.y, -0.5);
  camera.updateMatrixWorld();
}
placeCamera(scenario);

const styleDef = ALL.find((s) => s.id === params.get('style')) ?? ILLUSTRATED[0]!;
const ctx: StyleContext = { renderer, camera, world, light, tex, arena, width: W, height: H };
const style = styleDef.create(ctx);

let frames = 0;
let frameMs = 0;
// time can be frozen (?freeze=<seconds>) to compare two frames of a scene at rest
const freeze = params.has('freeze') ? Number(params.get('freeze')) : null;
const t0 = performance.now();
function frame(): void {
  const t = performance.now();
  const time = freeze ?? (t - t0) / 1000;
  style.render({ time, tod: scenario.t, day: daylightAt(scenario.t) });
  const ms = performance.now() - t;
  frameMs = frames === 0 ? ms : frameMs * 0.9 + ms * 0.1;
  frames++;
  hud.textContent = `${styleDef.namePl} · ${scenario.namePl} · ${frameMs.toFixed(1)} ms`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { __lab: unknown }).__lab = {
  styles: ILLUSTRATED.map((s) => s.id),
  scenarios: SCEN.map((s) => s.id),
  style: styleDef.id,
  get frameMs() {
    return frameMs;
  },
  async setScenario(id: string, settleFrames = 4): Promise<void> {
    scenario = SCEN.find((s) => s.id === id) ?? scenario;
    placeCamera(scenario);
    const start = frames;
    await new Promise<void>((res) => {
      const check = () => (frames - start >= settleFrames ? res() : requestAnimationFrame(check));
      check();
    });
  },
  probes: () => [],
  layout: null,
};
