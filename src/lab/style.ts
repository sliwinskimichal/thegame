/**
 * Render-style contract for the visual tournament. A style receives the
 * shared world, light field and GPU mirrors, and renders the arena through
 * the shared camera. Everything else (geometry, shading, post) is its own.
 */
import type * as THREE from 'three';
import type { DaylightState } from '../render/daylight';
import type { WorldTex } from '../render/worldTex';
import type { LightField } from '../world/lightfield';
import type { World } from '../world/world';
import type { ArenaInfo } from './arena';

export interface StyleContext {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  world: World;
  light: LightField;
  tex: WorldTex;
  arena: ArenaInfo;
  width: number;
  height: number;
}

export interface FrameState {
  time: number;
  tod: number;
  day: DaylightState;
}

export interface StyleInstance {
  render(f: FrameState): void;
  resize(w: number, h: number): void;
}

export interface RenderStyle {
  id: string;
  namePl: string;
  descPl: string;
  create(ctx: StyleContext): StyleInstance;
}
