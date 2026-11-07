/** Only the procedural primitives needed by SUAR, adapted from reference/kit.ts. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type V3 = [number, number, number];
export type Mats = ReturnType<typeof makeMats>;

/** Materials belong to one scene; no module-level texture or material cache. */
export function makeMats(accent = 0x1f8a8a) {
  const std = (parameters: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(parameters);
  return {
    paint: std({ color: accent, metalness: 0.05, roughness: 0.42 }),
    paintDark: std({ color: 0x14365e, metalness: 0.1, roughness: 0.5 }),
    paintLight: std({ color: 0xd9dedc, metalness: 0.05, roughness: 0.55 }),
    white: std({ color: 0xfaf9f7, metalness: 0, roughness: 0.6 }),
    steel: std({ color: 0x9faeae, metalness: 0.8, roughness: 0.34 }),
    rubber: std({ color: 0x55565b, metalness: 0, roughness: 0.82 }),
  };
}

export function add(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set(x, y, z); parent.add(mesh);
  return mesh;
}

/** Revolved profile around X; the reference's axis convention is preserved. */
export function lathe(points: [number, number][], segments = 64) {
  return new THREE.LatheGeometry(points.map(([x, radius]) => new THREE.Vector2(Math.max(radius, 0.0001), x)), segments).rotateZ(-Math.PI / 2);
}

export function barrel(radius: number, length: number, segments = 64, chamfer = Math.min(0.018, radius * 0.2, length * 0.2), caps = true) {
  const half = length / 2;
  const points: [number, number][] = caps ? [[-half, 0]] : [];
  points.push([-half, radius - chamfer], [-half + chamfer * 0.3, radius - chamfer * 0.3], [-half + chamfer, radius], [half - chamfer, radius], [half - chamfer * 0.3, radius - chamfer * 0.3], [half, radius - chamfer]);
  if (caps) points.push([half, 0]);
  return lathe(points, segments);
}

export const rbox = (w: number, h: number, d: number, radius = 0.015, segments = 3) => new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, w / 2.01, h / 2.01, d / 2.01));
