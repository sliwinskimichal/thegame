/**
 * Time-of-day model shared by every renderer: sun direction, sky colours,
 * the colour of sky light entering the mountain, and a daylight factor.
 * t in [0, 1): 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset.
 */
import * as THREE from 'three';

export interface DaylightState {
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  zenith: THREE.Color;
  horizon: THREE.Color;
  skyLight: THREE.Color;
  ambient: THREE.Color;
  daylight: number;
  night: number;
  sunset: number;
}

export function daylightAt(t: number): DaylightState {
  const a = (t - 0.25) * Math.PI * 2;
  const el = Math.sin(a);
  const sunDir = new THREE.Vector3(Math.cos(a) * 0.75, el, 0.45).normalize();
  const day = THREE.MathUtils.smoothstep(el, -0.12, 0.28);
  const sunset = Math.exp(-Math.pow(el / 0.2, 2));
  const zenith = new THREE.Color(0.004, 0.007, 0.022).lerp(new THREE.Color(0.08, 0.24, 0.68), day);
  zenith.lerp(new THREE.Color(0.12, 0.1, 0.3), sunset * 0.35);
  const horizon = new THREE.Color(0.015, 0.022, 0.05).lerp(new THREE.Color(0.5, 0.66, 0.9), day);
  horizon.lerp(new THREE.Color(1.0, 0.38, 0.12), sunset * 0.75);
  const sunColor = new THREE.Color(1.0, 0.92, 0.8).lerp(new THREE.Color(1.0, 0.45, 0.15), sunset * 0.8);
  sunColor.multiplyScalar(Math.max(0, THREE.MathUtils.smoothstep(el, -0.08, 0.15)) * 1.6);
  const skyLight = new THREE.Color(0.06, 0.08, 0.16).lerp(new THREE.Color(1.05, 1.0, 0.92), day);
  skyLight.lerp(new THREE.Color(1.0, 0.55, 0.3), sunset * 0.4 * day);
  const ambient = new THREE.Color(0.03, 0.04, 0.09).lerp(new THREE.Color(0.32, 0.38, 0.5), day);
  return {
    sunDir,
    sunColor,
    zenith,
    horizon,
    skyLight,
    ambient,
    daylight: day,
    night: 1 - THREE.MathUtils.smoothstep(el, -0.25, 0.05),
    sunset,
  };
}
