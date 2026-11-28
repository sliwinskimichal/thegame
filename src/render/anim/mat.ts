/**
 * Small allocation-free matrix helpers for the dwarf rig (owner: W2 "Animator ruchu").
 *
 * Layouts (same as three.js):
 *  - 4x4 matrices are column-major: element (row i, col j) = m[o + j * 4 + i].
 *  - 3x3 rotations used by the IK are column-major too: r[o + j * 3 + i]; columns are the X, Y, Z axes.
 * Euler angles follow the contract: order 'ZYX', R = Rz * Ry * Rx (three.js Euler 'ZYX').
 */
export type Mat = Float64Array | Float32Array;

/** out[o..o+15] = T(tx, ty, tz) * Rz(rz) * Ry(ry) * Rx(rx) * S(s). */
export function composeTRS(out: Mat, o: number, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, s: number): void {
  const a = Math.cos(rx);
  const b = Math.sin(rx);
  const c = Math.cos(ry);
  const d = Math.sin(ry);
  const e = Math.cos(rz);
  const f = Math.sin(rz);
  const ae = a * e;
  const af = a * f;
  const be = b * e;
  const bf = b * f;
  out[o] = c * e * s;
  out[o + 1] = c * f * s;
  out[o + 2] = -d * s;
  out[o + 3] = 0;
  out[o + 4] = (be * d - af) * s;
  out[o + 5] = (bf * d + ae) * s;
  out[o + 6] = b * c * s;
  out[o + 7] = 0;
  out[o + 8] = (ae * d + bf) * s;
  out[o + 9] = (af * d - be) * s;
  out[o + 10] = a * c * s;
  out[o + 11] = 0;
  out[o + 12] = tx;
  out[o + 13] = ty;
  out[o + 14] = tz;
  out[o + 15] = 1;
}

/** 3x3 rotation (column-major) from Euler ZYX. */
export function rot3FromEuler(out: Mat, o: number, rx: number, ry: number, rz: number): void {
  const a = Math.cos(rx);
  const b = Math.sin(rx);
  const c = Math.cos(ry);
  const d = Math.sin(ry);
  const e = Math.cos(rz);
  const f = Math.sin(rz);
  out[o] = c * e;
  out[o + 1] = c * f;
  out[o + 2] = -d;
  out[o + 3] = b * e * d - a * f;
  out[o + 4] = b * f * d + a * e;
  out[o + 5] = b * c;
  out[o + 6] = a * e * d + b * f;
  out[o + 7] = a * f * d - b * e;
  out[o + 8] = a * c;
}

/**
 * Euler ZYX of a column-major 3x3 rotation into out[oo..oo+2] (x, y, z) — the same branch logic
 * as three.js Euler.setFromRotationMatrix for order 'ZYX'.
 */
export function eulerFromRot3(r: Mat, o: number, out: Mat, oo: number): void {
  const m11 = r[o]!;
  const m21 = r[o + 1]!;
  const m31 = r[o + 2]!;
  const m12 = r[o + 3]!;
  const m22 = r[o + 4]!;
  const m32 = r[o + 5]!;
  const m33 = r[o + 8]!;
  const s = m31 < -1 ? -1 : m31 > 1 ? 1 : m31;
  out[oo + 1] = Math.asin(-s);
  if (Math.abs(m31) < 0.9999999) {
    out[oo] = Math.atan2(m32, m33);
    out[oo + 2] = Math.atan2(m21, m11);
  } else {
    out[oo] = 0;
    out[oo + 2] = Math.atan2(-m12, m22);
  }
}

/** out = a * b for affine 4x4 matrices (bottom row 0 0 0 1). out must not alias a or b. */
export function mulAffine(out: Mat, o: number, a: Mat, ao: number, b: Mat, bo: number): void {
  const a00 = a[ao]!, a10 = a[ao + 1]!, a20 = a[ao + 2]!;
  const a01 = a[ao + 4]!, a11 = a[ao + 5]!, a21 = a[ao + 6]!;
  const a02 = a[ao + 8]!, a12 = a[ao + 9]!, a22 = a[ao + 10]!;
  const a03 = a[ao + 12]!, a13 = a[ao + 13]!, a23 = a[ao + 14]!;
  for (let j = 0; j < 3; j++) {
    const b0 = b[bo + j * 4]!;
    const b1 = b[bo + j * 4 + 1]!;
    const b2 = b[bo + j * 4 + 2]!;
    out[o + j * 4] = a00 * b0 + a01 * b1 + a02 * b2;
    out[o + j * 4 + 1] = a10 * b0 + a11 * b1 + a12 * b2;
    out[o + j * 4 + 2] = a20 * b0 + a21 * b1 + a22 * b2;
    out[o + j * 4 + 3] = 0;
  }
  const b0 = b[bo + 12]!;
  const b1 = b[bo + 13]!;
  const b2 = b[bo + 14]!;
  out[o + 12] = a00 * b0 + a01 * b1 + a02 * b2 + a03;
  out[o + 13] = a10 * b0 + a11 * b1 + a12 * b2 + a13;
  out[o + 14] = a20 * b0 + a21 * b1 + a22 * b2 + a23;
  out[o + 15] = 1;
}

/** out[oo..oo+2] = m * (x, y, z, 1). */
export function xformPoint(m: Mat, o: number, x: number, y: number, z: number, out: Mat, oo: number): void {
  const px = m[o]! * x + m[o + 4]! * y + m[o + 8]! * z + m[o + 12]!;
  const py = m[o + 1]! * x + m[o + 5]! * y + m[o + 9]! * z + m[o + 13]!;
  const pz = m[o + 2]! * x + m[o + 6]! * y + m[o + 10]! * z + m[o + 14]!;
  out[oo] = px;
  out[oo + 1] = py;
  out[oo + 2] = pz;
}

/** Unit-length rotation (3x3, column-major) of an affine 4x4 with uniform scale. Returns the scale. */
export function rot3OfMat4(m: Mat, o: number, out: Mat, oo: number): number {
  const s = Math.hypot(m[o]!, m[o + 1]!, m[o + 2]!) || 1;
  const k = 1 / s;
  out[oo] = m[o]! * k;
  out[oo + 1] = m[o + 1]! * k;
  out[oo + 2] = m[o + 2]! * k;
  out[oo + 3] = m[o + 4]! * k;
  out[oo + 4] = m[o + 5]! * k;
  out[oo + 5] = m[o + 6]! * k;
  out[oo + 6] = m[o + 8]! * k;
  out[oo + 7] = m[o + 9]! * k;
  out[oo + 8] = m[o + 10]! * k;
  return s;
}

/** out = aᵀ * b for 3x3 rotations (column-major). out must not alias. */
export function mulT3(out: Mat, o: number, a: Mat, ao: number, b: Mat, bo: number): void {
  for (let j = 0; j < 3; j++) {
    const b0 = b[bo + j * 3]!;
    const b1 = b[bo + j * 3 + 1]!;
    const b2 = b[bo + j * 3 + 2]!;
    for (let i = 0; i < 3; i++) out[o + j * 3 + i] = a[ao + i * 3]! * b0 + a[ao + i * 3 + 1]! * b1 + a[ao + i * 3 + 2]! * b2;
  }
}

/** out = a * b for 3x3 rotations (column-major). out must not alias. */
export function mul3(out: Mat, o: number, a: Mat, ao: number, b: Mat, bo: number): void {
  for (let j = 0; j < 3; j++) {
    const b0 = b[bo + j * 3]!;
    const b1 = b[bo + j * 3 + 1]!;
    const b2 = b[bo + j * 3 + 2]!;
    for (let i = 0; i < 3; i++) out[o + j * 3 + i] = a[ao + i]! * b0 + a[ao + 3 + i]! * b1 + a[ao + 6 + i]! * b2;
  }
}

/** Writes m = T(x,y,z) * S(sx,1,1) * Ry(yaw): the placement form used by the animator. */
export function placementMatrix(out: Mat, x: number, y: number, z: number, sx: number, yaw: number): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // Ry = [[c,0,s],[0,1,0],[-s,0,c]]; row 0 scaled by sx
  out[0] = sx * c;
  out[1] = 0;
  out[2] = -s;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = sx * s;
  out[9] = 0;
  out[10] = c;
  out[11] = 0;
  out[12] = x;
  out[13] = y;
  out[14] = z;
  out[15] = 1;
}

/** Shortest-path angle unwrapping: returns a + 2πk closest to ref. */
export function unwrapNear(a: number, ref: number): number {
  const TAU = Math.PI * 2;
  return a + Math.round((ref - a) / TAU) * TAU;
}
