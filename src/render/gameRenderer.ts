/**
 * Owns the WebGL renderer, scene graph and all world views. Reads world /
 * simulation state each frame; never mutates it.
 */
import * as THREE from 'three';
import { CameraController } from '../input/camera';
import type { LightField } from '../world/lighting';
import type { World } from '../world/world';
import { PostFX } from './post';
import { SkyView } from './sky';
import { TerrainView } from './terrain';
import { WorldTextures, type DynLight } from './worldTextures';

export interface QualitySettings {
  pixelRatio: number;
  bloom: boolean;
  msaa: boolean;
}

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly cam: CameraController;
  readonly post: PostFX;
  readonly textures: WorldTextures;
  readonly terrain: TerrainView;
  readonly sky: SkyView;
  /** Containers for other views (entities, decor, fx) added by the game. */
  readonly layers = {
    decor: new THREE.Group(),
    fluids: new THREE.Group(),
    buildings: new THREE.Group(),
    entities: new THREE.Group(),
    items: new THREE.Group(),
    fx: new THREE.Group(),
    overlay: new THREE.Group(),
  };
  private width = 1;
  private height = 1;
  frameMs = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly world: World,
    lightField: LightField,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 1);

    this.cam = new CameraController(1);
    this.cam.bounds.set(new THREE.Vector2(4, -world.h + 6), new THREE.Vector2(world.w - 4, 20));
    this.textures = new WorldTextures(world, lightField);
    this.terrain = new TerrainView(world, this.textures);
    this.sky = new SkyView(world);
    this.scene.add(this.sky.group, this.terrain.group);
    for (const g of Object.values(this.layers)) this.scene.add(g);

    this.resize();
    this.post = new PostFX(this.renderer, this.scene, this.cam.camera, this.width, this.height);
    this.post.setSize(this.width, this.height);
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.cam.setAspect(w / h);
    this.post?.setSize(w, h);
  }

  get viewport(): { w: number; h: number } {
    return { w: this.width, h: this.height };
  }

  setDynamicLights(lights: readonly DynLight[]): void {
    this.textures.setDynamicLights(lights);
  }

  /** Per-frame update + draw. */
  frame(dt: number, time: number, timeOfDay: number): void {
    const t0 = performance.now();
    this.resize();
    this.cam.update(dt);
    const camPos = this.cam.camera.position;
    this.sky.update(timeOfDay, time, camPos);
    const u = this.textures.uniforms;
    u.uTime.value = time;
    u.uCamPos.value.copy(camPos);
    u.uSkyLight.value.copy(this.sky.skyLight);
    u.uSunDir.value.copy(this.sky.sunDir);
    u.uDaylight.value = this.sky.daylight;
    this.terrain.update(this.cam.pos.x, this.cam.pos.y, 8);
    this.post.render(time);
    this.frameMs = performance.now() - t0;
  }
}
