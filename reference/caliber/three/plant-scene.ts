/** The cracker unit as a coloured site model on an atlas, with shortage contours painted from real counts. Drag, zoom and turn it. */
import * as THREE from "three";
import { add, bake, ibeam, ladder, makeMats, pipe, rbox, scatter, type V3 } from "./kit";
import { createPipeline, type Pipeline } from "./stage";
import type { MachineSlug } from "@/lib/machines";

export type PlantData = {
  furnaces: { equipment: string; total: number; short: number }[];
  classes: Partial<Record<MachineSlug, { short: number; total: number }>>;
};

const W = 30;
const px = (x: number) => (x / 1024 - 0.5) * W;

const SITES: Record<MachineSlug, { x: number; y: number; rx: number; ry: number }> = {
  furnace: { x: 470, y: 500, rx: 210, ry: 190 },
  compressor: { x: 700, y: 400, rx: 170, ry: 150 },
  pump: { x: 320, y: 700, rx: 180, ry: 130 },
  turbine: { x: 640, y: 660, rx: 150, ry: 130 },
  exchanger: { x: 810, y: 560, rx: 130, ry: 170 },
};

/** Grass, sea, pads and roads, with shortage cut into stacked bands like a weather map. */
function groundTexture(data: PlantData) {
  const S = 2048;
  const k = S / 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.scale(k, k);
  g.fillStyle = "#a9c98d";
  g.fillRect(0, 0, 1024, 1024);
  /* sea and creek */
  g.fillStyle = "#6fb1cf";
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(1024, 0);
  g.lineTo(1024, 300);
  g.bezierCurveTo(930, 300, 880, 210, 740, 170);
  g.bezierCurveTo(600, 130, 470, 150, 330, 110);
  g.bezierCurveTo(200, 75, 90, 120, 0, 90);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(1024, 800);
  g.bezierCurveTo(960, 820, 910, 900, 890, 1024);
  g.lineTo(1024, 1024);
  g.closePath();
  g.fill();
  /* shore */
  g.strokeStyle = "#d9cfa8";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(1024, 300);
  g.bezierCurveTo(930, 300, 880, 210, 740, 170);
  g.bezierCurveTo(600, 130, 470, 150, 330, 110);
  g.bezierCurveTo(200, 75, 90, 120, 0, 90);
  g.stroke();
  /* unit pads */
  g.fillStyle = "#c9cbc6";
  for (const [x, y, w, h] of [[320, 420, 330, 215], [610, 330, 190, 150], [210, 650, 260, 105], [570, 600, 150, 120], [750, 440, 150, 240], [190, 310, 205, 125], [800, 700, 170, 80], [90, 225, 60, 60], [40, 650, 130, 90]]) {
    g.beginPath();
    g.roundRect(x, y, w, h, 8);
    g.fill();
  }
  /* roads */
  const roads: [number, number, number, number, number][] = [
    [60, 290, 980, 300, 14],
    [60, 790, 960, 790, 14],
    [170, 190, 170, 1000, 14],
    [920, 250, 920, 960, 14],
    [300, 640, 880, 620, 8],
    [530, 300, 530, 790, 8],
    [190, 430, 920, 430, 6],
  ];
  g.lineCap = "round";
  for (const [a, b, c2, d, w] of roads) {
    g.strokeStyle = "#7f858a";
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(a, b);
    g.lineTo(c2, d);
    g.stroke();
  }
  g.setLineDash([9, 9]);
  g.strokeStyle = "#e8e6dc";
  g.lineWidth = 1.2;
  for (const [a, b, c2, d, w] of roads) {
    if (w < 10) continue;
    g.beginPath();
    g.moveTo(a, b);
    g.lineTo(c2, d);
    g.stroke();
  }
  g.setLineDash([]);

  /* contour field */
  const zones: { x: number; y: number; rx: number; ry: number; w: number }[] = [];
  const maxF = Math.max(1, ...data.furnaces.map((f) => f.short));
  data.furnaces.forEach((f, i) => {
    zones.push({ x: 360 + (i % 6) * 48, y: 460 + (i < 6 ? 0 : 110), rx: 110, ry: 130, w: (f.short / maxF) * 0.14 });
  });
  const maxC = Math.max(1, ...Object.values(data.classes).map((v) => v?.short ?? 0));
  (Object.keys(SITES) as MachineSlug[]).forEach((s) => {
    const v = data.classes[s];
    if (v) zones.push({ ...SITES[s], w: (v.short / maxC) * 1.05 });
  });
  const N = 300;
  const field = new Float32Array(N * N);
  let max = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let f = 0;
      for (const z of zones) {
        const dx = ((x / N) * 1024 - z.x) / z.rx;
        const dy = ((y / N) * 1024 - z.y) / z.ry;
        f += z.w * Math.exp(-(dx * dx + dy * dy));
      }
      field[y * N + x] = f;
      if (f > max) max = f;
    }
  const bands: [number, number[], number][] = [
    [0.14, [102, 178, 86], 0.34],
    [0.3, [168, 204, 74], 0.46],
    [0.47, [246, 202, 52], 0.56],
    [0.66, [242, 138, 44], 0.62],
    [0.84, [226, 66, 42], 0.68],
  ];
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = N;
  const tg = tmp.getContext("2d")!;
  const img = tg.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const f = field[i] / (max || 1);
    let cur: (typeof bands)[number] | null = null;
    let prev: (typeof bands)[number] | null = null;
    for (const b of bands) {
      if (f >= b[0]) {
        prev = cur;
        cur = b;
      }
    }
    if (!cur) continue;
    const e = Math.min(1, (f - cur[0]) / 0.012);
    const c0 = prev ? prev[1] : cur[1];
    const a0 = prev ? prev[2] : 0;
    for (let q = 0; q < 3; q++) img.data[i * 4 + q] = c0[q] + (cur[1][q] - c0[q]) * e;
    img.data[i * 4 + 3] = (a0 + (cur[2] - a0) * e) * 255;
  }
  tg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(tmp, 0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export type PlantHandle = {
  pipeline: Pipeline;
  project: (key: string) => { x: number; y: number } | null;
  flyTo: (slug: MachineSlug, done: () => void) => void;
  zoomBy: (f: number) => void;
  turnBy: (a: number) => void;
  reset: () => void;
  dispose: () => void;
};

const std = (color: number, roughness = 0.55, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.7 });

export function createPlant(canvas: HTMLCanvasElement, data: PlantData, cb: { onHover: (h: { slug: MachineSlug; unit?: string } | null, x: number, y: number) => void; onPick: (slug: MachineSlug, unit?: string) => void; onCamera: () => void; onReady: () => void }): PlantHandle {
  const p = createPipeline(canvas, { fov: 24, exposure: 0.9, ao: false, onFirstFrame: cb.onReady });
  const { scene, camera, renderer } = p;
  const SKY = 0xa9c98d;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 70, 130);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const m = makeMats();
  const C = {
    furnace: std(0xd9541e, 0.5),
    furnaceDark: std(0x8f3a16, 0.55),
    steel: std(0x565d63, 0.5, 0.5),
    stack: std(0x34383c, 0.6, 0.4),
    silver: std(0xdfe3e5, 0.38, 0.45),
    silver2: std(0xaab2b6, 0.45, 0.45),
    yellow: std(0xe6b422, 0.5),
    pipeGreen: std(0x3c8f5c, 0.45, 0.2),
    pipeBlue: std(0x2f6fb0, 0.45, 0.2),
    pipeRed: std(0xb93a2b, 0.45, 0.2),
    pipeGrey: std(0x8f979c, 0.4, 0.5),
    roof: std(0x2f6f9f, 0.55),
    motor: std(0x2a5f9e, 0.5, 0.2),
    orange: std(0xe0641f, 0.45),
    teal: std(0x3f8f96, 0.6),
    white: std(0xeeeeea, 0.6, 0),
    concrete: std(0xb4b5b0, 0.9, 0),
    red: std(0xc23a2a, 0.45),
    tree: std(0x4f8f49, 0.9, 0),
  };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshStandardMaterial({ map: groundTexture(data), roughness: 1, envMapIntensity: 0.35 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: SKY }));
  beyond.rotation.x = -Math.PI / 2;
  beyond.position.y = -0.03;
  scene.add(beyond);

  const sun = new THREE.DirectionalLight(0xfff3e2, 2.2);
  sun.position.set(-10, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x8a9a70, 0.5));

  const anchors: Record<string, THREE.Object3D> = {};
  const pickables: THREE.Object3D[] = [];
  const site = (slug: MachineSlug) => {
    const g = new THREE.Group();
    g.userData.slug = slug;
    scene.add(g);
    pickables.push(g);
    return g;
  };
  const anchor = (key: string, x: number, y: number, h: number) => {
    const a = new THREE.Object3D();
    a.position.set(px(x), h, px(y));
    scene.add(a);
    anchors[key] = a;
  };

  /* ---------- furnace bank: height follows the parts each furnace needs ---------- */
  const furn = site("furnace");
  const maxT = Math.max(1, ...data.furnaces.map((f) => f.total));
  const units: THREE.Group[] = [];
  data.furnaces.forEach((f, i) => {
    const u = new THREE.Group();
    u.position.set(px(360 + (i % 6) * 48), 0, px(460 + (i < 6 ? 0 : 110)));
    u.userData.unit = f.equipment;
    furn.add(u);
    units.push(u);
    const h = 0.75 + (f.total / maxT) * 0.75;
    add(u, rbox(0.86, 0.1, 1.86, 0.01), C.concrete, 0, 0.05, 0);
    add(u, rbox(0.76, h, 1.7, 0.012), C.furnace, 0, 0.1 + h / 2, 0);
    for (let k = 0; k < 4; k++) add(u, new THREE.BoxGeometry(0.78, 0.02, 0.02), C.furnaceDark, 0, 0.1 + ((k + 0.5) / 4) * h, 0.852);
    for (const z of [-0.85, 0, 0.85]) for (const x of [-0.39, 0.39]) add(u, new THREE.BoxGeometry(0.03, h, 0.03), C.steel, x, 0.1 + h / 2, z);
    add(u, rbox(0.5, 0.3, 1.02, 0.012), C.steel, 0, h + 0.25, 0);
    add(u, new THREE.CylinderGeometry(0.1, 0.34, 0.26, 4).rotateY(Math.PI / 4).scale(1, 1, 1.5), C.furnaceDark, 0, h + 0.53, 0);
    add(u, new THREE.CylinderGeometry(0.075, 0.09, 1.2, 14), C.stack, 0, h + 1.26, 0);
    add(u, new THREE.CylinderGeometry(0.03, 0.03, 0.82, 8).rotateX(Math.PI / 2), C.pipeGrey, 0.3, h + 0.18, 0);
    const ratio = f.total ? f.short / f.total : 0;
    add(u, new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), std(ratio > 0.55 ? 0xe6543a : ratio > 0.4 ? 0xf3973e : 0xf6d14d, 0.4), 0, h + 1.88, 0);
    anchors[f.equipment] = u;
  });

  /* main pipe rack between the rows */
  const rack = new THREE.Group();
  furn.add(rack);
  const rackZ = px(515);
  for (let i = 0; i < 12; i++) {
    const x = px(340 + i * 28);
    for (const z of [-0.26, 0.26]) add(rack, new THREE.BoxGeometry(0.035, 0.72, 0.035), C.yellow, x, 0.36, rackZ + z);
    add(rack, new THREE.BoxGeometry(0.035, 0.035, 0.58), C.yellow, x, 0.72, rackZ);
    add(rack, new THREE.BoxGeometry(0.035, 0.035, 0.58), C.yellow, x, 0.42, rackZ);
  }
  const rl = px(650) - px(330);
  const rc = (px(650) + px(330)) / 2;
  add(rack, ibeam(rl, 0.03, 0.03, 0.006), C.yellow, rc, 0.72, rackZ - 0.27);
  add(rack, ibeam(rl, 0.03, 0.03, 0.006), C.yellow, rc, 0.72, rackZ + 0.27);
  const lines: [number, number, number, THREE.Material][] = [
    [-0.19, 0.79, 0.05, C.pipeGreen],
    [-0.06, 0.8, 0.065, C.pipeGrey],
    [0.08, 0.78, 0.04, C.pipeBlue],
    [0.19, 0.78, 0.04, C.pipeRed],
    [-0.16, 0.48, 0.04, C.pipeBlue],
    [0.02, 0.49, 0.05, C.pipeGrey],
    [0.18, 0.48, 0.035, C.pipeGreen],
  ];
  for (const [z, y, r, mat] of lines) add(rack, new THREE.CylinderGeometry(r, r, rl, 10).rotateZ(Math.PI / 2), mat, rc, y, rackZ + z);

  /* quench columns and a fractionator by the bank */
  const columns = new THREE.Group();
  furn.add(columns);
  const col = (g: THREE.Object3D, x: number, y: number, h: number, r: number) => {
    const X = px(x);
    const Z = px(y);
    add(g, new THREE.CylinderGeometry(r * 1.25, r * 1.4, 0.2, 20), C.concrete, X, 0.1, Z);
    add(g, new THREE.CylinderGeometry(r, r, h, 24), C.silver, X, 0.2 + h / 2, Z);
    add(g, new THREE.SphereGeometry(r, 20, 10, 0, 6.3, 0, Math.PI / 2), C.silver, X, 0.2 + h, Z);
    for (let t = 0; t < Math.floor(h / 0.55); t++) {
      add(g, new THREE.TorusGeometry(r * 1.32, 0.009, 5, 22).rotateX(Math.PI / 2), C.yellow, X, 0.55 + t * 0.55, Z);
      add(g, new THREE.CylinderGeometry(r * 1.32, r * 1.32, 0.014, 22), C.steel, X, 0.45 + t * 0.55, Z);
    }
    add(g, new THREE.CylinderGeometry(0.03, 0.03, h + 0.3, 8), C.pipeRed, X + r * 0.92, 0.2 + (h + 0.3) / 2, Z + r * 0.5);
  };
  col(columns, 610, 545, 4.1, 0.36);
  col(columns, 648, 500, 3.0, 0.27);
  col(columns, 582, 600, 2.4, 0.22);

  /* ---------- compressor shelter ---------- */
  const comp = site("compressor");
  const hx = px(700);
  const hz = px(400);
  add(comp, rbox(3.6, 0.1, 2.7, 0.01), C.concrete, hx, 0.05, hz);
  for (const [dx, dz, L] of [[-0.75, -0.7, 1.5], [0.8, -0.7, 1.3], [-0.75, 0.62, 1.5], [0.8, 0.62, 1.3]] as const) {
    add(comp, new THREE.CylinderGeometry(0.2, 0.2, L * 0.46, 18).rotateZ(Math.PI / 2), C.orange, hx + dx, 0.34, hz + dz);
    add(comp, rbox(L * 0.46, 0.16, 0.5, 0.01), C.steel, hx + dx, 0.18, hz + dz);
    add(comp, new THREE.CylinderGeometry(0.16, 0.16, L * 0.32, 14).rotateZ(Math.PI / 2), C.motor, hx + dx - L * 0.42, 0.34, hz + dz);
    add(comp, new THREE.CylinderGeometry(0.08, 0.08, 0.7, 10), C.pipeGrey, hx + dx, 0.75, hz + dz);
  }
  for (const dx of [-1.7, -0.57, 0.57, 1.7]) for (const dz of [-1.25, 1.25]) add(comp, new THREE.BoxGeometry(0.06, 1.6, 0.06), C.yellow, hx + dx, 0.85, hz + dz);
  for (const dz of [-1.25, 1.25]) add(comp, new THREE.BoxGeometry(3.45, 0.06, 0.06), C.yellow, hx, 1.62, hz + dz);
  for (const dx of [-1.7, -0.57, 0.57, 1.7]) add(comp, new THREE.BoxGeometry(0.06, 0.06, 2.55), C.yellow, hx + dx, 1.62, hz);
  for (const s of [-1, 1]) {
    const roof = add(comp, new THREE.BoxGeometry(3.6, 0.025, 1.42), C.roof, hx, 1.83, hz + s * 0.63);
    roof.rotation.x = s * 0.34;
  }

  /* ---------- pump row with discharge header ---------- */
  const pm = site("pump");
  for (let i = 0; i < 9; i++) {
    const X = px(235 + i * 26);
    const Z = px(700);
    add(pm, rbox(0.56, 0.06, 0.26, 0.006), C.concrete, X, 0.03, Z);
    add(pm, new THREE.CylinderGeometry(0.07, 0.07, 0.22, 12).rotateZ(Math.PI / 2), C.motor, X - 0.13, 0.15, Z);
    add(pm, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16).rotateZ(Math.PI / 2), C.orange, X + 0.1, 0.15, Z);
    add(pm, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), C.pipeGrey, X + 0.1, 0.34, Z);
    add(pm, new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8).rotateX(Math.PI / 2), C.pipeGrey, X + 0.1, 0.48, Z - 0.17);
  }
  const hdrL = px(450) - px(225);
  add(pm, new THREE.CylinderGeometry(0.055, 0.055, hdrL, 10).rotateZ(Math.PI / 2), C.pipeGreen, (px(450) + px(225)) / 2, 0.48, px(700) - 0.35);

  /* ---------- turbines ---------- */
  const tb = site("turbine");
  for (const [x, y] of [[610, 660], [670, 660]]) {
    const X = px(x);
    const Z = px(y);
    add(tb, rbox(1.25, 0.14, 0.95, 0.01), C.concrete, X, 0.07, Z);
    const g = new THREE.LatheGeometry([new THREE.Vector2(0.12, -0.5), new THREE.Vector2(0.26, -0.42), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.42, 0.34), new THREE.Vector2(0.28, 0.5), new THREE.Vector2(0.1, 0.55)], 24).rotateZ(-Math.PI / 2);
    add(tb, g, C.orange, X, 0.58, Z);
    add(tb, rbox(0.22, 0.42, 0.34, 0.01), C.stack, X - 0.65, 0.28, Z);
    add(tb, new THREE.CylinderGeometry(0.1, 0.1, 0.28, 12), C.silver2, X - 0.18, 1.0, Z);
    add(tb, new THREE.CylinderGeometry(0.055, 0.055, 0.6, 10).rotateX(Math.PI / 2), C.pipeRed, X - 0.18, 1.1, Z - 0.3);
  }

  /* ---------- exchanger bay ---------- */
  const ex = site("exchanger");
  for (let i = 0; i < 6; i++) {
    const X = px(790);
    const Z = px(470 + i * 36);
    for (const lvl of [0, 1]) {
      const y = 0.26 + lvl * 0.46;
      add(ex, new THREE.CylinderGeometry(0.17, 0.17, 1.5, 16).rotateZ(Math.PI / 2), C.silver, X, y, Z);
      add(ex, new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16).rotateZ(Math.PI / 2), C.orange, X + 0.74, y, Z);
      add(ex, new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), C.pipeBlue, X + 0.4, y + 0.2, Z);
    }
    for (const dx of [-0.5, 0.4]) add(ex, new THREE.BoxGeometry(0.05, 0.52, 0.3), C.steel, X + dx, 0.14, Z);
  }

  /* ---------- context: tanks, cooling cells, control room, flare, trees ---------- */
  const ctx = new THREE.Group();
  scene.add(ctx);
  for (const [x, y, r] of [[235, 355, 0.95], [305, 340, 0.85], [235, 405, 0.7], [360, 385, 0.72]] as const) {
    const X = px(x);
    const Z = px(y);
    add(ctx, new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.04, 32), C.concrete, X, 0.02, Z);
    add(ctx, new THREE.CylinderGeometry(r, r, 0.84, 36), C.silver, X, 0.46, Z);
    add(ctx, new THREE.CylinderGeometry(r * 0.2, r, 0.14, 36), C.silver2, X, 0.95, Z);
    const pts: V3[] = [];
    for (let k = 0; k <= 16; k++) {
      const a = 0.4 + (k / 16) * 1.7;
      pts.push([X + Math.cos(a) * (r + 0.02), 0.06 + (k / 16) * 0.84, Z + Math.sin(a) * (r + 0.02)]);
    }
    pipe(ctx, C.yellow, pts, 0.012, 0.01);
  }
  for (let i = 0; i < 4; i++) {
    const X = px(820 + i * 34);
    const Z = px(735);
    add(ctx, rbox(0.86, 0.62, 0.98, 0.012), C.teal, X, 0.33, Z);
    add(ctx, new THREE.CylinderGeometry(0.34, 0.3, 0.3, 22), C.white, X, 0.78, Z);
    add(ctx, new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), C.stack, X, 0.9, Z);
  }
  /* control room */
  add(ctx, rbox(2.6, 0.7, 1.5, 0.02), C.white, px(100), 0.35, px(695));
  add(ctx, rbox(2.72, 0.05, 1.62, 0.01), C.roof, px(100), 0.73, px(695));
  /* flare */
  const fX = px(115);
  const fZ = px(255);
  add(ctx, new THREE.CylinderGeometry(0.03, 0.05, 2.3, 10), C.white, fX, 1.15, fZ);
  add(ctx, new THREE.CylinderGeometry(0.03, 0.03, 2.3, 10), C.red, fX, 3.45, fZ);
  add(ctx, new THREE.CylinderGeometry(0.075, 0.05, 0.2, 12), C.stack, fX, 4.7, fZ);
  ladder(ctx, m, [fX + 0.06, 0, fZ], 4.4, false, C.steel);
  for (const a of [0.4, 2.5, 4.6]) pipe(ctx, C.steel, [[fX, 3.4, fZ], [fX + Math.cos(a) * 2.1, 0, fZ + Math.sin(a) * 2.1]], 0.005);
  /* trees on the green belts, seeded so the site never changes */
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const belts = [[40, 830, 240, 170], [690, 850, 160, 150], [40, 400, 110, 240], [40, 160, 110, 90], [960, 330, 50, 400], [300, 820, 360, 170]];
  const treeSpots: [number, number, number][] = [];
  for (const [x, y, w, h] of belts) {
    const n = Math.round((w * h) / 900);
    for (let i = 0; i < n; i++) treeSpots.push([x + rnd() * w, y + rnd() * h, 0.75 + rnd() * 0.6]);
  }
  scatter(ctx, new THREE.IcosahedronGeometry(0.2, 1), C.tree, (i, o) => {
    const s = treeSpots[i];
    o.position.set(px(s[0]), 0.22 * s[2], px(s[1]));
    o.scale.setScalar(s[2]);
  }, treeSpots.length);

  units.forEach((u) => bake(u));
  [rack, columns, comp, pm, tb, ex, ctx].forEach((g) => bake(g));

  anchor("furnace", 470, 400, 3.2);
  anchor("compressor", 730, 345, 2.3);
  anchor("pump", 325, 730, 0.9);
  anchor("turbine", 640, 715, 1.3);
  anchor("exchanger", 855, 545, 1.2);

  /* ---------- camera: a target on the ground, an orbit around it ---------- */
  const HOME = { x: 0.6, z: 1.3, dist: 38, yaw: 0.04, pitch: 0.95 };
  const goal = { ...HOME };
  const cam = { ...HOME };
  let fly: { start: number; from: typeof HOME; to: typeof HOME; done: () => void } | null = null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const look = new THREE.Vector3();
  const apply = () => {
    const fit = Math.max(1, 1.85 / camera.aspect);
    const d = cam.dist * fit;
    camera.position.set(cam.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * d, Math.sin(cam.pitch) * d, cam.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * d);
    look.set(cam.x, 0, cam.z);
    camera.lookAt(look);
    cb.onCamera();
  };
  apply();
  const clamp = () => {
    goal.x = Math.max(-13, Math.min(13, goal.x));
    goal.z = Math.max(-13, Math.min(13, goal.z));
    goal.dist = Math.max(10, Math.min(52, goal.dist));
    goal.pitch = Math.max(0.42, Math.min(1.35, goal.pitch));
  };

  let lastSize = "";
  p.onTick((dt) => {
    const size = `${p.size.w}x${p.size.h}`;
    let moved = size !== lastSize;
    lastSize = size;
    if (fly) {
      const t = Math.min(1, (performance.now() - fly.start) / 650);
      const e = 1 - Math.pow(1 - t, 3);
      (Object.keys(cam) as (keyof typeof HOME)[]).forEach((k) => {
        cam[k] = fly!.from[k] + (fly!.to[k] - fly!.from[k]) * e;
      });
      moved = true;
      if (t >= 1) {
        const d = fly.done;
        fly = null;
        d();
      }
    } else {
      const f = reduce ? 1 : 1 - Math.exp(-dt * 11);
      (Object.keys(cam) as (keyof typeof HOME)[]).forEach((k) => {
        const delta = goal[k] - cam[k];
        if (Math.abs(delta) > 0.0006) {
          cam[k] += delta * f;
          moved = true;
        } else cam[k] = goal[k];
      });
    }
    if (moved) apply();
    return moved;
  });

  /* picking: cheap tinted copies, cached per material, read at most ten times a second */
  const ray = new THREE.Raycaster();
  const v2 = new THREE.Vector2();
  const tinted = new Map<THREE.Material, THREE.Material>();
  const originals = new Map<THREE.Mesh, THREE.Material>();
  let hovered: THREE.Object3D | null = null;
  const setTint = (g: THREE.Object3D | null, on: boolean) => {
    if (!g) return;
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (on) {
        const src = mesh.material as THREE.MeshStandardMaterial;
        originals.set(mesh, src);
        let t = tinted.get(src);
        if (!t) {
          const c = src.clone();
          c.emissive = new THREE.Color(0xffa35c);
          c.emissiveIntensity = 0.32;
          t = c;
          tinted.set(src, t);
        }
        mesh.material = t;
      } else if (originals.has(mesh)) {
        mesh.material = originals.get(mesh)!;
        originals.delete(mesh);
      }
    });
    p.invalidate();
  };
  const hit = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, camera);
    const hits = ray.intersectObjects(pickables, true);
    if (!hits.length) return null;
    let o: THREE.Object3D | null = hits[0].object;
    let unit: THREE.Object3D | null = null;
    while (o) {
      if (o.userData.unit) unit = o;
      if (o.userData.slug) return { site: o, slug: o.userData.slug as MachineSlug, unit };
      o = o.parent;
    }
    return null;
  };

  let drag: { x: number; y: number; moved: boolean; turn: boolean; gx: number; gz: number; yaw: number; pitch: number } | null = null;
  let lastPick = 0;
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, moved: false, turn: e.button === 2 || e.shiftKey, gx: goal.x, gz: goal.z, yaw: goal.yaw, pitch: goal.pitch };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety */
    }
    canvas.style.cursor = drag.turn ? "ew-resize" : "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      if (drag.turn) {
        goal.yaw = drag.yaw - dx * 0.005;
        goal.pitch = drag.pitch + dy * 0.004;
      } else {
        const fit = Math.max(1, 1.85 / camera.aspect);
        const perPx = (2 * cam.dist * fit * Math.tan((camera.fov * Math.PI) / 360)) / r.height;
        const c = Math.cos(cam.yaw);
        const s = Math.sin(cam.yaw);
        const k = 1 / Math.max(0.5, Math.sin(cam.pitch));
        goal.x = drag.gx - (dx * c + dy * k * s) * perPx;
        goal.z = drag.gz - (-dx * s + dy * k * c) * perPx;
      }
      clamp();
      p.invalidate();
      cb.onHover(null, 0, 0);
      return;
    }
    const now = performance.now();
    if (now - lastPick < 90) return;
    lastPick = now;
    const h = hit(e);
    const target = h?.unit ?? h?.site ?? null;
    if (target !== hovered) {
      setTint(hovered, false);
      setTint(target, true);
      hovered = target;
    }
    canvas.style.cursor = h ? "pointer" : "grab";
    cb.onHover(h ? { slug: h.slug, unit: h.unit?.userData.unit } : null, e.clientX - r.left, e.clientY - r.top);
  };
  const onUp = (e: PointerEvent) => {
    const d = drag;
    drag = null;
    canvas.style.cursor = "grab";
    if (!d || d.moved || d.turn) return;
    const h = hit(e);
    if (h) cb.onPick(h.slug, h.unit?.userData.unit);
  };
  const onLeave = () => {
    setTint(hovered, false);
    hovered = null;
    cb.onHover(null, 0, 0);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    goal.dist *= Math.exp(e.deltaY * 0.0011);
    clamp();
    p.invalidate();
  };
  const onMenu = (e: Event) => e.preventDefault();
  const onKey = (e: KeyboardEvent) => {
    const step = cam.dist * 0.06;
    const c = Math.cos(cam.yaw);
    const s = Math.sin(cam.yaw);
    if (e.key === "ArrowLeft") {
      goal.x -= step * c;
      goal.z += step * s;
    } else if (e.key === "ArrowRight") {
      goal.x += step * c;
      goal.z -= step * s;
    } else if (e.key === "ArrowUp") {
      goal.x -= step * s;
      goal.z -= step * c;
    } else if (e.key === "ArrowDown") {
      goal.x += step * s;
      goal.z += step * c;
    } else if (e.key === "+" || e.key === "=") goal.dist *= 0.85;
    else if (e.key === "-") goal.dist *= 1.18;
    else return;
    e.preventDefault();
    clamp();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onMenu);
  canvas.addEventListener("keydown", onKey);
  canvas.style.cursor = "grab";
  canvas.style.touchAction = "none";

  const vec = new THREE.Vector3();
  return {
    pipeline: p,
    project(key) {
      const a = anchors[key];
      if (!a) return null;
      a.getWorldPosition(vec);
      vec.project(camera);
      return { x: (vec.x * 0.5 + 0.5) * p.size.w, y: (-vec.y * 0.5 + 0.5) * p.size.h };
    },
    flyTo(slug, done) {
      if (reduce) return done();
      const s = SITES[slug];
      let called = false;
      const once = () => {
        if (!called) {
          called = true;
          done();
        }
      };
      window.setTimeout(once, 700);
      fly = { start: performance.now(), from: { ...cam }, to: { x: px(s.x), z: px(s.y), dist: 15, yaw: cam.yaw, pitch: 0.82 }, done: once };
    },
    zoomBy(f) {
      goal.dist *= f;
      clamp();
      p.invalidate();
    },
    turnBy(a) {
      goal.yaw += a;
      p.invalidate();
    },
    reset() {
      Object.assign(goal, HOME);
      p.invalidate();
    },
    dispose() {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onMenu);
      canvas.removeEventListener("keydown", onKey);
      p.dispose();
    },
  };
}
