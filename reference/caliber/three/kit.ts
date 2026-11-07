/**
 * Building blocks for the procedural plant equipment: PBR materials with generated surface maps,
 * chamfered primitives, real bolt circles, weld-neck flanges, pipe runs, valves, gauges, ladders.
 * Everything is geometry and canvas: no downloaded assets, no licences to chase.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type V3 = [number, number, number];

/* ------------------------------------------------------------ surface maps */

function canvas(size: number, h = size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(c: HTMLCanvasElement, repeat = 1, srgb = false) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft mottled noise: paint orange-peel, cast iron, grime. */
function noiseMap(size: number, base: number, amp: number, scale: number, seed: number) {
  const { c, g } = canvas(size);
  const rnd = mulberry(seed);
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.09 * scale; i++) {
    const v = base + (rnd() - 0.5) * amp * 2;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    const r = rnd() * 1.6 * scale + 0.4;
    g.beginPath();
    g.arc(rnd() * size, rnd() * size, r, 0, 7);
    g.fill();
  }
  return c;
}

/** Long fine streaks: machined and brushed metal. */
function brushedMap(size: number, base: number, amp: number, seed: number) {
  const { c, g } = canvas(size);
  const rnd = mulberry(seed);
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 5; i++) {
    const v = base + (rnd() - 0.5) * amp * 2;
    g.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    g.lineWidth = rnd() * 1.1 + 0.2;
    const y = rnd() * size;
    const x = rnd() * size;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rnd() * size * 0.7, y);
    g.stroke();
  }
  return c;
}

function firebrickMaps() {
  const { c, g } = canvas(512);
  const b = canvas(512);
  const rnd = mulberry(11);
  const bw = 128;
  const bh = 58;
  g.fillStyle = "#7c6a58";
  g.fillRect(0, 0, 512, 512);
  b.g.fillStyle = "#000";
  b.g.fillRect(0, 0, 512, 512);
  for (let row = 0; row * bh < 512; row++) {
    for (let col = -1; col * bw < 512; col++) {
      const x = col * bw + (row % 2 ? bw / 2 : 0);
      const y = row * bh;
      const l = 62 + rnd() * 16;
      g.fillStyle = `hsl(${26 + rnd() * 10},${34 + rnd() * 18}%,${l}%)`;
      g.fillRect(x + 2.5, y + 2.5, bw - 5, bh - 5);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(90,60,40,${rnd() * 0.16})`;
        g.fillRect(x + 3 + rnd() * (bw - 8), y + 3 + rnd() * (bh - 8), 1 + rnd() * 3, 1 + rnd() * 3);
      }
      b.g.fillStyle = "#fff";
      b.g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    }
  }
  return { map: tex(c, 1, true), bump: tex(b.c, 1) };
}

function fiberMaps() {
  const { c, g } = canvas(512);
  const rnd = mulberry(23);
  g.fillStyle = "#e8e2d4";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = `rgba(${150 + rnd() * 90},${140 + rnd() * 90},${120 + rnd() * 90},0.22)`;
    g.lineWidth = rnd() * 1.4;
    const x = rnd() * 512;
    const y = rnd() * 512;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + rnd() * 26 - 13, y + rnd() * 26 - 13, x + rnd() * 42 - 21, y + rnd() * 42 - 21);
    g.stroke();
  }
  /* blanket seams */
  g.strokeStyle = "rgba(110,95,70,.55)";
  g.lineWidth = 3;
  for (let i = 0; i <= 512; i += 170) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  return tex(c, 1, true);
}

function gratingMap() {
  const { c, g } = canvas(256);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#fff";
  for (let i = 0; i < 256; i += 32) g.fillRect(i, 0, 6, 256);
  for (let i = 0; i < 256; i += 16) g.fillRect(0, i, 256, 3);
  return tex(c, 1);
}

function dialTexture() {
  const { c, g } = canvas(128);
  g.fillStyle = "#f5f3ee";
  g.fillRect(0, 0, 128, 128);
  g.translate(64, 64);
  g.strokeStyle = "#222";
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI * 1.25 + (i / 20) * Math.PI * 1.5;
    g.lineWidth = i % 5 ? 1 : 2.4;
    g.beginPath();
    g.moveTo(Math.cos(a) * 42, Math.sin(a) * 42);
    g.lineTo(Math.cos(a) * (i % 5 ? 50 : 54), Math.sin(a) * (i % 5 ? 50 : 54));
    g.stroke();
  }
  g.strokeStyle = "#c62f1e";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(0, 0, 53, Math.PI * 0.05, Math.PI * 0.25);
  g.stroke();
  g.strokeStyle = "#111";
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(-6, 6);
  g.lineTo(26, -30);
  g.stroke();
  g.fillStyle = "#111";
  g.beginPath();
  g.arc(0, 0, 5, 0, 7);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Stamped equipment plate with the tag on it. */
export function plateTexture(lines: string[]) {
  const { c, g } = canvas(256, 128);
  g.fillStyle = "#d8dadb";
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#4e5457";
  g.lineWidth = 4;
  g.strokeRect(5, 5, 246, 118);
  g.fillStyle = "#1c2124";
  g.font = "bold 28px Arial";
  g.fillText(lines[0] ?? "", 18, 42);
  g.font = "16px Arial";
  lines.slice(1).forEach((l, i) => g.fillText(l, 18, 68 + i * 21));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ---------------------------------------------------------------- materials */

export type Mats = ReturnType<typeof makeMats>;

let shared: ReturnType<typeof surfaces> | null = null;
function surfaces() {
  return {
    peel: tex(noiseMap(256, 150, 34, 1, 3), 3),
    peelBump: tex(noiseMap(256, 128, 60, 1, 4), 5),
    cast: tex(noiseMap(256, 165, 70, 1.8, 7), 3),
    castBump: tex(noiseMap(256, 128, 110, 1.6, 8), 4),
    brushed: tex(brushedMap(256, 90, 60, 13), 1),
    galv: tex(noiseMap(256, 120, 60, 3, 17), 2),
    concrete: tex(noiseMap(256, 200, 50, 2.4, 29), 3),
    brick: firebrickMaps(),
    fiber: fiberMaps(),
    grate: gratingMap(),
    dial: dialTexture(),
  };
}

export function makeMats(accent = 0xd9480f) {
  const s = (shared ??= surfaces());
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
  return {
    paint: new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0.05, roughness: 0.42, roughnessMap: s.peel, bumpMap: s.peelBump, bumpScale: 0.25, clearcoat: 0.55, clearcoatRoughness: 0.28 }),
    paintDark: new THREE.MeshPhysicalMaterial({ color: 0x2a2f33, metalness: 0.1, roughness: 0.5, roughnessMap: s.peel, bumpMap: s.peelBump, bumpScale: 0.25, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    paintGrey: new THREE.MeshPhysicalMaterial({ color: 0x8b9398, metalness: 0.1, roughness: 0.48, roughnessMap: s.peel, bumpMap: s.peelBump, bumpScale: 0.2, clearcoat: 0.3 }),
    paintLight: std({ color: 0xcdd1d2, metalness: 0.05, roughness: 0.55, roughnessMap: s.peel, bumpMap: s.peelBump, bumpScale: 0.2 }),
    guard: new THREE.MeshPhysicalMaterial({ color: 0xf0b416, metalness: 0.05, roughness: 0.42, roughnessMap: s.peel, clearcoat: 0.4 }),
    cast: std({ color: 0x3d4145, metalness: 0.55, roughness: 0.82, roughnessMap: s.cast, bumpMap: s.castBump, bumpScale: 0.7 }),
    steel: std({ color: 0xbfc4c8, metalness: 1, roughness: 0.34, roughnessMap: s.brushed }),
    machined: std({ color: 0xd6d9dc, metalness: 1, roughness: 0.22, roughnessMap: s.brushed }),
    galv: std({ color: 0x9aa1a4, metalness: 0.85, roughness: 0.55, roughnessMap: s.galv }),
    bolt: std({ color: 0x3a3c3e, metalness: 0.9, roughness: 0.42 }),
    boltZinc: std({ color: 0xc2b98f, metalness: 0.95, roughness: 0.36 }),
    brass: std({ color: 0xc49a45, metalness: 1, roughness: 0.3, roughnessMap: s.brushed }),
    copper: std({ color: 0xb86b3f, metalness: 1, roughness: 0.32 }),
    rubber: std({ color: 0x141516, metalness: 0, roughness: 0.82 }),
    gasket: std({ color: 0x4d5053, metalness: 0.4, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xf2f6f8, metalness: 0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.32, clearcoat: 1 }),
    oil: std({ color: 0x8a5a14, metalness: 0.1, roughness: 0.2 }),
    concrete: std({ color: 0xb4b1a9, metalness: 0, roughness: 0.95, roughnessMap: s.concrete, bumpMap: s.concrete, bumpScale: 0.5 }),
    firebrick: std({ map: s.brick.map, bumpMap: s.brick.bump, bumpScale: 1.4, roughness: 0.92, metalness: 0 }),
    fiber: std({ map: s.fiber, roughness: 1, metalness: 0 }),
    castable: std({ color: 0xbfb6a6, roughness: 0.96, metalness: 0, bumpMap: s.concrete, bumpScale: 1 }),
    heat: std({ color: 0x5a4d47, metalness: 0.9, roughness: 0.55, roughnessMap: s.cast }),
    grate: std({ color: 0x8e9496, metalness: 0.8, roughness: 0.5, alphaMap: s.grate, alphaTest: 0.5, side: THREE.DoubleSide }),
    dial: std({ map: s.dial, roughness: 0.4 }),
    insul: std({ color: 0xb9bcbd, metalness: 0.9, roughness: 0.42, roughnessMap: s.galv }),
    green: std({ color: 0x2f7d4f, metalness: 0.1, roughness: 0.45 }),
    red: std({ color: 0xb6281b, metalness: 0.1, roughness: 0.4 }),
    black: std({ color: 0x111214, metalness: 0.3, roughness: 0.5 }),
  };
}

/* --------------------------------------------------------------- primitives */

type Mat = THREE.Material;

export function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: Mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** A revolved profile around X. Points are [x, radius]. Sharp corners keep their own normals. */
export function lathe(points: [number, number][], seg = 64) {
  const pts = points.map(([x, r]) => new THREE.Vector2(Math.max(r, 0.0001), x));
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** Cylinder along X with a small chamfer on both ends; the chamfer is what catches the light. */
export function barrel(r: number, len: number, seg = 64, ch = Math.min(0.018, r * 0.2, len * 0.2), caps = true) {
  const h = len / 2;
  const p: [number, number][] = [];
  if (caps) p.push([-h, 0]);
  p.push([-h, r - ch], [-h + ch * 0.3, r - ch * 0.3], [-h + ch, r], [h - ch, r], [h - ch * 0.3, r - ch * 0.3], [h, r - ch]);
  if (caps) p.push([h, 0]);
  const g = lathe(p, seg);
  return g;
}

export const barrelY = (r: number, len: number, seg = 48, ch?: number) => barrel(r, len, seg, ch).rotateZ(Math.PI / 2);
export const barrelZ = (r: number, len: number, seg = 48, ch?: number) => barrel(r, len, seg, ch).rotateY(Math.PI / 2);

export const rbox = (w: number, h: number, d: number, r = 0.015, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2.01, h / 2.01, d / 2.01));

/** Structural I-beam running along X. */
export function ibeam(len: number, h: number, w: number, t = 0.02) {
  const s = new THREE.Shape();
  const hh = h / 2;
  const hw = w / 2;
  s.moveTo(-hw, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, -hh + t);
  s.lineTo(t / 2, -hh + t);
  s.lineTo(t / 2, hh - t);
  s.lineTo(hw, hh - t);
  s.lineTo(hw, hh);
  s.lineTo(-hw, hh);
  s.lineTo(-hw, hh - t);
  s.lineTo(-t / 2, hh - t);
  s.lineTo(-t / 2, -hh + t);
  s.lineTo(-hw, -hh + t);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function hexBoltGeo(size: number, shank: number) {
  const head = new THREE.CylinderGeometry(size, size, size * 0.72, 6);
  head.translate(0, size * 0.36, 0);
  const washer = new THREE.CylinderGeometry(size * 1.16, size * 1.16, size * 0.14, 16);
  washer.translate(0, -size * 0.07, 0);
  const stud = new THREE.CylinderGeometry(size * 0.56, size * 0.56, shank, 10);
  stud.translate(0, -shank / 2, 0);
  const g = mergeGeometries([head.toNonIndexed(), washer.toNonIndexed(), stud.toNonIndexed()])!;
  g.computeVertexNormals();
  return g;
}

/**
 * A ring of real hex bolts on a flange face. `axis` is the direction the heads face.
 * Instanced, so a compressor end cover with 40 studs costs one draw call.
 */
export function boltCircle(parent: THREE.Object3D, mat: Mat, n: number, r: number, axis: "x" | "-x" | "y" | "-y" | "z" | "-z", at: V3, size = 0.022, shank = 0.03, start = 0.5) {
  const geo = hexBoltGeo(size, shank);
  const im = new THREE.InstancedMesh(geo, mat, n);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const dir = { x: [1, 0, 0], "-x": [-1, 0, 0], y: [0, 1, 0], "-y": [0, -1, 0], z: [0, 0, 1], "-z": [0, 0, -1] }[axis];
  q.setFromUnitVectors(up, new THREE.Vector3(dir[0], dir[1], dir[2]));
  const u = new THREE.Vector3(axis.endsWith("x") ? 0 : 1, axis.endsWith("x") ? 1 : 0, 0);
  const v = new THREE.Vector3(dir[0], dir[1], dir[2]).cross(u).normalize();
  const m = new THREE.Matrix4();
  const spin = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const a = ((i + start) / n) * Math.PI * 2;
    const p = new THREE.Vector3(...at).addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r);
    spin.setFromAxisAngle(up, (i * 1.7) % 1);
    m.compose(p, q.clone().multiply(spin), new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(i, m);
  }
  im.castShadow = true;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}

/** A straight row of hex bolts, for split lines and cover plates. */
export function boltRow(parent: THREE.Object3D, mat: Mat, from: V3, to: V3, n: number, face: V3 = [0, 1, 0], size = 0.02, shank = 0.03) {
  const im = new THREE.InstancedMesh(hexBoltGeo(size, shank), mat, n);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...face).normalize());
  const m = new THREE.Matrix4();
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  for (let i = 0; i < n; i++) {
    m.compose(a.clone().lerp(b, n === 1 ? 0.5 : i / (n - 1)), q, new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(i, m);
  }
  im.castShadow = true;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}

/** Instance one geometry at a list of matrices. */
export function scatter(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: Mat, place: (i: number, o: THREE.Object3D) => void, n: number) {
  const im = new THREE.InstancedMesh(geo, mat, n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    place(i, o);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  }
  im.castShadow = true;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}

/**
 * Raised-face weld-neck flange, facing +X from the origin, as a real profile:
 * neck taper, hub, flange thickness, raised face. Add a gasket and studs on top.
 */
export function flange(parent: THREE.Object3D, m: Mats, opt: { bore: number; od: number; t: number; neck?: number; bolts: number; mat?: Mat; boltMat?: Mat; at: V3; dir?: "x" | "-x" | "y" | "-y" | "z" | "-z" }) {
  const { bore, od, t, bolts } = opt;
  const neck = opt.neck ?? t * 2.2;
  const mat = opt.mat ?? m.paint;
  const f = new THREE.Group();
  const hub = bore + (od - bore) * 0.34;
  const rf = bore + (od - bore) * 0.46;
  f.add(
    new THREE.Mesh(
      lathe(
        [
          [-neck, bore * 1.02],
          [-t * 0.9, hub],
          [-t, od - 0.006],
          [-t + 0.006, od],
          [-0.006, od],
          [0, od - 0.006],
          [0, rf],
          [0.012, rf],
          [0.012, 0],
        ],
        72,
      ),
      mat,
    ),
  );
  /* gasket line between mating faces */
  f.add(new THREE.Mesh(barrel(rf * 0.98, 0.006, 56, 0.001).translate(0.015, 0, 0), m.gasket));
  f.children.forEach((c) => {
    c.castShadow = c.receiveShadow = true;
  });
  boltCircle(f, opt.boltMat ?? m.boltZinc, bolts, (od + rf) / 2, "-x", [-t, 0, 0], Math.max(0.011, (od - rf) * 0.23), t + 0.04);
  boltCircle(f, opt.boltMat ?? m.boltZinc, bolts, (od + rf) / 2, "x", [0.014, 0, 0], Math.max(0.011, (od - rf) * 0.23), 0.014);
  f.position.set(...opt.at);
  const d = opt.dir ?? "x";
  if (d === "-x") f.rotation.y = Math.PI;
  if (d === "y") f.rotation.z = Math.PI / 2;
  if (d === "-y") f.rotation.z = -Math.PI / 2;
  if (d === "z") f.rotation.y = -Math.PI / 2;
  if (d === "-z") f.rotation.y = Math.PI / 2;
  parent.add(f);
  return f;
}

/** A pipe through a list of points, with bent corners and a weld bead at every joint. */
export function pipe(parent: THREE.Object3D, mat: Mat, pts: V3[], r: number, bend = r * 2.4, weldMat?: Mat) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const P = pts.map((p) => new THREE.Vector3(...p));
  let cur = P[0];
  for (let i = 1; i < P.length; i++) {
    if (i === P.length - 1) {
      path.add(new THREE.LineCurve3(cur, P[i]));
    } else {
      const a = P[i].clone().sub(P[i - 1]).normalize();
      const b = P[i + 1].clone().sub(P[i]).normalize();
      const r1 = Math.min(bend, P[i].distanceTo(P[i - 1]) * 0.48, P[i].distanceTo(P[i + 1]) * 0.48);
      const s = P[i].clone().addScaledVector(a, -r1);
      const e = P[i].clone().addScaledVector(b, r1);
      path.add(new THREE.LineCurve3(cur, s));
      path.add(new THREE.QuadraticBezierCurve3(s, P[i], e));
      cur = e;
    }
  }
  const len = path.getLength();
  const g = new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, Math.max(12, Math.round(len / 0.03)), r, Math.max(10, Math.round(r * 220)), false);
  const mesh = add(parent, g, mat);
  /* end caps */
  for (const [p, q] of [[P[0], P[1]], [P[P.length - 1], P[P.length - 2]]] as const) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 18), mat);
    cap.position.copy(p);
    cap.lookAt(p.clone().add(p.clone().sub(q)));
    parent.add(cap);
  }
  if (weldMat) {
    for (let i = 1; i < P.length - 1; i++) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, r * 0.05, 8, 24), weldMat);
      const a = P[i].clone().sub(P[i - 1]).normalize();
      b.position.copy(P[i]).addScaledVector(a, -Math.min(bend, P[i].distanceTo(P[i - 1]) * 0.48));
      b.lookAt(b.position.clone().add(a));
      parent.add(b);
    }
  }
  return mesh;
}

/** Sweep a varying circle along a path, for volutes and transitions. */
export function sweep(path: V3[], radius: (t: number) => number, squash = 1, seg = 28) {
  const P = path.map((p) => new THREE.Vector3(...p));
  const pos: number[] = [];
  const idx: number[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(P.length - 1, i + 1)];
    const T = b.clone().sub(a).normalize();
    const N = new THREE.Vector3().crossVectors(T, X).normalize();
    const r = radius(i / (P.length - 1));
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const v = P[i].clone().addScaledVector(N, Math.cos(th) * r).addScaledVector(X, Math.sin(th) * r * squash);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < P.length - 1; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j;
      const b = i * seg + ((j + 1) % seg);
      idx.push(a, b, a + seg, b, b + seg, a + seg);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* --------------------------------------------------------------- assemblies */

/** Bourdon pressure gauge on a brass stem with a dial you can read. */
export function gauge(parent: THREE.Object3D, m: Mats, at: V3, r = 0.05, stem: V3 = [0, -1, 0], face: V3 = [0, 0, 1]) {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(r, r, r * 0.55, 36).rotateX(Math.PI / 2), m.black);
  const d = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 32), m.dial);
  d.position.z = r * 0.28;
  g.add(d);
  add(g, new THREE.TorusGeometry(r * 0.92, r * 0.09, 10, 36), m.steel, 0, 0, r * 0.28);
  const q = new THREE.Vector3(...stem).normalize();
  const s = add(g, new THREE.CylinderGeometry(r * 0.16, r * 0.16, r * 1.6, 12), m.brass);
  s.position.copy(q.clone().multiplyScalar(r * 1.5));
  s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q);
  g.position.set(...at);
  g.lookAt(g.position.clone().add(new THREE.Vector3(...face)));
  parent.add(g);
  return g;
}

/** Rising-stem gate valve: flanged body, bonnet, yoke, threaded stem, handwheel. Axis along X, handwheel up. */
export function gateValve(parent: THREE.Object3D, m: Mats, at: V3, s = 1, opt: { body?: Mat; wheel?: Mat; rot?: number } = {}) {
  const g = new THREE.Group();
  const body = opt.body ?? m.paintDark;
  add(g, barrel(0.1 * s, 0.26 * s, 40), body);
  add(g, new THREE.SphereGeometry(0.125 * s, 32, 20).scale(0.8, 1.05, 1), body);
  flange(g, m, { bore: 0.07 * s, od: 0.13 * s, t: 0.025 * s, neck: 0.05 * s, bolts: 8, mat: body, at: [0.14 * s, 0, 0] });
  flange(g, m, { bore: 0.07 * s, od: 0.13 * s, t: 0.025 * s, neck: 0.05 * s, bolts: 8, mat: body, at: [-0.14 * s, 0, 0], dir: "-x" });
  add(g, barrelY(0.075 * s, 0.14 * s, 32), body, 0, 0.17 * s, 0);
  add(g, barrelY(0.095 * s, 0.024 * s, 32), body, 0, 0.245 * s, 0);
  boltCircle(g, m.boltZinc, 6, 0.08 * s, "y", [0, 0.26 * s, 0], 0.011 * s, 0.02 * s);
  /* yoke */
  for (const x of [-0.05, 0.05]) add(g, rbox(0.018 * s, 0.17 * s, 0.03 * s, 0.004), body, x * s, 0.34 * s, 0);
  add(g, rbox(0.13 * s, 0.03 * s, 0.05 * s, 0.006), body, 0, 0.43 * s, 0);
  add(g, new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.34 * s, 12), m.machined, 0, 0.42 * s, 0);
  /* handwheel */
  const w = opt.wheel ?? m.red;
  add(g, new THREE.TorusGeometry(0.085 * s, 0.011 * s, 12, 40).rotateX(Math.PI / 2), w, 0, 0.47 * s, 0);
  for (let i = 0; i < 3; i++) {
    const b = add(g, new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.17 * s, 8).rotateZ(Math.PI / 2), w, 0, 0.47 * s, 0);
    b.rotation.y = (i / 3) * Math.PI;
  }
  add(g, barrelY(0.022 * s, 0.03 * s, 16), w, 0, 0.47 * s, 0);
  g.position.set(...at);
  if (opt.rot) g.rotation.y = opt.rot;
  parent.add(g);
  return g;
}

/** Flexible electrical conduit with gland: a thin dark tube with a machined end. */
export function conduit(parent: THREE.Object3D, m: Mats, pts: V3[], r = 0.012) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  add(parent, new THREE.TubeGeometry(c, 40, r, 8), m.rubber);
  const end = pts[0];
  add(parent, new THREE.SphereGeometry(r * 1.5, 10, 8), m.brass, end[0], end[1], end[2]);
}

/** Terminal or junction box with lid screws, gland and stamped plate. */
export function junctionBox(parent: THREE.Object3D, m: Mats, at: V3, size: V3 = [0.2, 0.12, 0.16], mat?: Mat) {
  const g = new THREE.Group();
  const [w, h, d] = size;
  add(g, rbox(w, h, d, 0.012), mat ?? m.paintDark);
  add(g, rbox(w * 1.04, h * 0.14, d * 1.04, 0.006), mat ?? m.paintDark, 0, h * 0.54, 0);
  boltRow(g, m.boltZinc, [-w * 0.42, h * 0.6, -d * 0.42], [w * 0.42, h * 0.6, -d * 0.42], 2, [0, 1, 0], 0.008, 0.008);
  boltRow(g, m.boltZinc, [-w * 0.42, h * 0.6, d * 0.42], [w * 0.42, h * 0.6, d * 0.42], 2, [0, 1, 0], 0.008, 0.008);
  add(g, barrelY(0.018, 0.04, 14), m.brass, -w * 0.2, -h * 0.6, 0);
  add(g, barrelY(0.018, 0.04, 14), m.brass, w * 0.2, -h * 0.6, 0);
  g.position.set(...at);
  parent.add(g);
  return g;
}

export function plate(parent: THREE.Object3D, lines: string[], at: V3, w = 0.16, face: V3 = [0, 0, 1]) {
  const mat = new THREE.MeshStandardMaterial({ map: plateTexture(lines), metalness: 0.5, roughness: 0.4 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), mat);
  p.position.set(...at);
  p.lookAt(p.position.clone().add(new THREE.Vector3(...face)));
  parent.add(p);
  return p;
}

/** Caged vertical ladder climbing +Y at a position. */
export function ladder(parent: THREE.Object3D, m: Mats, at: V3, h: number, cage = true, mat?: Mat) {
  const g = new THREE.Group();
  const s = mat ?? m.guard;
  for (const x of [-0.09, 0.09]) add(g, new THREE.CylinderGeometry(0.009, 0.009, h, 8), s, x, h / 2, 0);
  const n = Math.round(h / 0.11);
  scatter(g, new THREE.CylinderGeometry(0.0055, 0.0055, 0.18, 6).rotateZ(Math.PI / 2), s, (i, o) => o.position.set(0, ((i + 0.5) / n) * h, 0), n);
  if (cage && h > 0.8) {
    const rings = Math.floor((h - 0.5) / 0.26);
    for (let i = 0; i < rings; i++) {
      add(g, new THREE.TorusGeometry(0.15, 0.006, 6, 24, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), s, 0, 0.5 + i * 0.26, 0.15);
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 4) * Math.PI;
      add(g, new THREE.CylinderGeometry(0.004, 0.004, h - 0.5, 5), s, Math.cos(a) * 0.15, 0.5 + (h - 0.5) / 2, 0.15 + Math.sin(a) * 0.15);
    }
  }
  g.position.set(...at);
  parent.add(g);
  return g;
}

/** Handrail with mid rail and toe board along a straight line. */
export function rail(parent: THREE.Object3D, m: Mats, from: V3, to: V3, posts = 5, mat?: Mat) {
  const s = mat ?? m.guard;
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const L = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
  const bar = (y: number, r: number) => {
    const c = add(parent, new THREE.CylinderGeometry(r, r, L, 8).rotateZ(Math.PI / 2), s);
    c.position.copy(a.clone().lerp(b, 0.5)).setY(a.y + y);
    c.quaternion.copy(q);
  };
  bar(0.32, 0.008);
  bar(0.17, 0.0055);
  scatter(parent, new THREE.CylinderGeometry(0.008, 0.008, 0.32, 8), s, (i, o) => {
    o.position.copy(a.clone().lerp(b, i / (posts - 1)));
    o.position.y += 0.16;
  }, posts);
}

/** Open-grid walkway on two stringers. Centre at `at`. */
export function walkway(parent: THREE.Object3D, m: Mats, at: V3, w: number, d: number) {
  const top = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  const uv = top.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.4), uv.getY(i) * (d / 0.4));
  const mesh = new THREE.Mesh(top, m.grate);
  mesh.position.set(...at);
  mesh.receiveShadow = mesh.castShadow = true;
  parent.add(mesh);
  for (const s of [-1, 1]) add(parent, rbox(w, 0.035, 0.012, 0.002), m.paintGrey, at[0], at[1] - 0.018, at[2] + (s * d) / 2);
  for (const s of [-1, 1]) add(parent, rbox(0.012, 0.035, d, 0.002), m.paintGrey, at[0] + (s * w) / 2, at[1] - 0.018, at[2]);
}

/** Merge same-material static meshes in a subtree so a detailed machine stays a few dozen draw calls. */
export function bake(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    g = g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const entry = groups.get(m.material) ?? { geos: [], meshes: [] };
    entry.geos.push(g);
    entry.meshes.push(m);
    groups.set(m.material, entry);
  });
  for (const { meshes } of groups.values()) for (const m of meshes) m.parent?.remove(m);
  for (const [mat, { geos }] of groups) {
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = mesh.receiveShadow = !(mat as THREE.Material).transparent;
    root.add(mesh);
  }
  /* drop now-empty groups */
  const empties: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && !(o as THREE.Mesh).isMesh && o.children.length === 0 && o.type === "Group") empties.push(o);
  });
  empties.forEach((e) => e.parent?.remove(e));
}
