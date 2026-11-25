/**
 * Tournament lab: renders the arena with one style from one fixed scenario.
 * URL: lab.html?style=<id>&scenario=<id>[&hud=0]
 * Automation API on window.__lab (see scripts/tournament.mjs).
 */
import * as THREE from 'three';
import { daylightAt } from '../render/daylight';
import { WorldTex } from '../render/worldTex';
import { LightField } from '../world/lightfield';
import { SOLID } from '../world/materials';
import { CAV, FLUID, PROP, PROP_GLOW, TF } from '../world/world';
import { buildArena } from './arena';
import { buildGallery } from './gallery';
import { applyMaterialVariant } from './materialVariants';
import { GALLERY_SCENARIOS, SCENARIOS, type Scenario } from './scenarios';
import type { StyleContext, StyleInstance } from './style';
import { STYLES } from './styles';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;
if (params.get('hud') === '0') hud.style.display = 'none';

applyMaterialVariant(params.get('mat'));
if (params.has('torch')) {
  const [r, g, b] = params.get('torch')!.split(',').map(Number);
  PROP_GLOW[PROP.TORCH] = [r!, g!, b!];
}
const worldKind = params.get('world') === 'gallery' ? 'gallery' : 'arena';
const arena = worldKind === 'gallery' ? buildGallery() : buildArena();
const SCEN = worldKind === 'gallery' ? GALLERY_SCENARIOS : SCENARIOS;
const world = arena.world;
const light = new LightField(world.w, world.h);
light.compute(world);
if (params.get('flood') === '1') {
  // neutral work light everywhere: judges the palette itself, not the lighting
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
const W = () => canvas.clientWidth || innerWidth;
const H = () => canvas.clientHeight || innerHeight;
renderer.setSize(W(), H(), false);
const camera = new THREE.PerspectiveCamera(30, W() / H(), 0.5, 1200);

let scenario: Scenario = SCEN.find((s) => s.id === params.get('scenario')) ?? SCEN[0]!;
function placeCamera(s: Scenario): void {
  camera.position.set(s.x, s.y + s.d * 0.07, s.d);
  camera.lookAt(s.x, s.y, -0.5);
  camera.updateMatrixWorld();
}
placeCamera(scenario);

const styleDef = STYLES.find((s) => s.id === params.get('style')) ?? STYLES[0]!;
const ctx: StyleContext = { renderer, camera, world, light, tex, arena, width: W(), height: H() };
const style: StyleInstance = styleDef.create(ctx);

let frames = 0;
let frameMs = 0;
const t0 = performance.now();
function frame(): void {
  const t = performance.now();
  const time = (t - t0) / 1000;
  style.render({ time, tod: scenario.t, day: daylightAt(scenario.t) });
  const ms = performance.now() - t;
  frameMs = frames === 0 ? ms : frameMs * 0.9 + ms * 0.1;
  frames++;
  hud.textContent = `${styleDef.namePl} · ${scenario.namePl} · ${frameMs.toFixed(1)} ms`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/** Screen-space samples of tile categories for automated readability metrics. */
function probes(): { x: number; y: number; tx: number; ty: number; cat: string; mat: number }[] {
  const out: { x: number; y: number; tx: number; ty: number; cat: string; mat: number }[] = [];
  const v = new THREE.Vector3();
  const w = W();
  const h = H();
  for (let y = 0; y < world.h; y++)
    for (let x = 0; x < world.w; x++) {
      const i = world.idx(x, y);
      const solid = SOLID[world.mat[i]!] === 1;
      const explored = (world.flags[i]! & TF.EXPLORED) !== 0;
      let cat: string;
      if (!explored) cat = 'unexplored';
      else if (world.cav[i] === CAV.SKY) cat = 'sky';
      else if (world.fluidKind[i] === FLUID.WATER) cat = 'water';
      else if (world.fluidKind[i] === FLUID.LAVA) cat = 'lava';
      else if (solid) cat = 'solid';
      else cat = world.cav[i] === CAV.DUG ? 'dug' : 'cave';
      v.set(x + 0.5, -y - 0.5, solid || !explored ? 0 : -(world.depth[i]! / 32) * 0.5).project(camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (1 - (v.y * 0.5 + 0.5)) * h;
      if (sx < 2 || sy < 2 || sx > w - 2 || sy > h - 2) continue;
      out.push({ x: Math.round(sx), y: Math.round(sy), tx: x, ty: y, cat, mat: world.mat[i]! });
    }
  return out;
}

(window as unknown as { __lab: unknown }).__lab = {
  styles: STYLES.map((s) => s.id),
  scenarios: SCEN.map((s) => s.id),
  style: styleDef.id,
  mat: params.get('mat') ?? 'm13-designed',
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
  probes,
  layout: 'swatches' in arena ? arena.swatches : null,
};
