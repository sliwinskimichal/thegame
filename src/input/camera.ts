/**
 * Diorama camera: a narrow-FOV perspective camera looking at the cut plane.
 * Smoothly follows a target with zoom-to-cursor, keyboard/edge panning,
 * a subtle parallax tilt, optional entity follow and screen shake.
 */
import * as THREE from 'three';

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  /** Desired look-at point (world units). */
  target = new THREE.Vector2(0, 0);
  /** Current (smoothed) look-at point. */
  pos = new THREE.Vector2(0, 0);
  distance = 34;
  targetDistance = 34;
  minDist = 9;
  maxDist = 150;
  /** Parallax tilt from the cursor, -1..1. */
  tilt = new THREE.Vector2(0, 0);
  private tiltSmooth = new THREE.Vector2(0, 0);
  private shake = 0;
  private shakeT = 0;
  bounds = new THREE.Box2(new THREE.Vector2(0, -480), new THREE.Vector2(224, 30));
  follow: (() => { x: number; y: number } | null) | null = null;
  readonly velocity = new THREE.Vector2();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(30, aspect, 0.5, 900);
    this.apply(0);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  jumpTo(x: number, y: number, dist?: number): void {
    this.target.set(x, y);
    this.pos.set(x, y);
    if (dist !== undefined) this.distance = this.targetDistance = dist;
    this.apply(0);
  }

  /** Zoom by a factor keeping the world point under the cursor fixed. */
  zoomAt(factor: number, ndcX: number, ndcY: number): void {
    const before = this.screenToPlane(ndcX, ndcY, 0, this.targetDistance, this.target);
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance * factor, this.minDist, this.maxDist);
    const after = this.screenToPlane(ndcX, ndcY, 0, this.targetDistance, this.target);
    this.target.x += before.x - after.x;
    this.target.y += before.y - after.y;
  }

  /** Pan by a screen-space delta in pixels. */
  panPixels(dx: number, dy: number, viewportH: number): void {
    const worldPerPx = (2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / viewportH;
    this.target.x -= dx * worldPerPx;
    this.target.y += dy * worldPerPx;
    this.follow = null;
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.5, this.shake + amount);
  }

  /** World units visible vertically at the cut plane. */
  viewHeight(): number {
    return 2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
  }

  update(dt: number): void {
    if (this.follow) {
      const p = this.follow();
      if (p) this.target.set(p.x, p.y);
      else this.follow = null;
    }
    this.target.x += this.velocity.x * dt * this.distance;
    this.target.y += this.velocity.y * dt * this.distance;
    const b = this.bounds;
    this.target.x = THREE.MathUtils.clamp(this.target.x, b.min.x, b.max.x);
    this.target.y = THREE.MathUtils.clamp(this.target.y, b.min.y, b.max.y);
    const k = 1 - Math.exp(-dt * 10);
    this.pos.lerp(this.target, k);
    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-dt * 9));
    this.tiltSmooth.lerp(this.tilt, 1 - Math.exp(-dt * 3));
    this.shakeT += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.apply(dt);
  }

  private apply(_dt: number): void {
    const c = this.camera;
    const d = this.distance;
    // Look slightly down on the scene so floors read; parallax from cursor.
    const ox = this.tiltSmooth.x * d * 0.05;
    const oy = d * 0.07 + this.tiltSmooth.y * d * 0.035;
    const s = this.shake * this.shake * 0.35;
    const sx = s * (Math.sin(this.shakeT * 53) + Math.sin(this.shakeT * 31.7)) * 0.5;
    const sy = s * (Math.sin(this.shakeT * 47.3) + Math.sin(this.shakeT * 23.1)) * 0.5;
    c.position.set(this.pos.x + ox + sx, this.pos.y + oy + sy, d);
    c.lookAt(this.pos.x + sx * 0.5, this.pos.y + sy * 0.5, -0.5);
    c.updateMatrixWorld();
  }

  /** Intersect the ray through an NDC point with the plane z = planeZ. */
  screenToPlane(
    ndcX: number,
    ndcY: number,
    planeZ: number,
    dist = this.distance,
    at: THREE.Vector2 = this.pos,
  ): THREE.Vector2 {
    // Build a temporary camera transform for (at, dist) to make zoom math exact.
    const c = this.tmpCam;
    c.fov = this.camera.fov;
    c.aspect = this.camera.aspect;
    c.near = this.camera.near;
    c.far = this.camera.far;
    c.updateProjectionMatrix();
    const ox = this.tiltSmooth.x * dist * 0.05;
    const oy = dist * 0.07 + this.tiltSmooth.y * dist * 0.035;
    c.position.set(at.x + ox, at.y + oy, dist);
    c.lookAt(at.x, at.y, -0.5);
    c.updateMatrixWorld();
    this.ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), c);
    const r = this.ray.ray;
    const t = (planeZ - r.origin.z) / r.direction.z;
    return new THREE.Vector2(r.origin.x + r.direction.x * t, r.origin.y + r.direction.y * t);
  }

  private tmpCam = new THREE.PerspectiveCamera();
  private ray = new THREE.Raycaster();
}
