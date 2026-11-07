import { memo, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { Bell, BellRing, CircleCheck, EarOff, HandHelping, Megaphone, WifiOff } from "lucide-react";
import { attrib } from "../../reference/analysis.json";
import { attribute } from "../sim/attribution";
import { ZONES, type Endpoint, type PacketTrace, type SimEffect, type ZoneId, type ZoneState } from "../sim/types";

export interface RoomViewProps {
  zones: Record<ZoneId, ZoneState>;
  effects: readonly SimEffect[];
  packets: readonly PacketTrace[];
  onFloorClick: (x: number, y: number) => void;
  onFloorHover: (x: number, y: number) => void;
}

export type FloorCell = readonly [x: number, y: number, primary: number, secondary: number, deltaDb: number];
// Keep the golden cells confined to the floor views; the data summary excludes them.
export const FLOOR_CELLS: readonly FloorCell[] = attrib.cells.map(([x, y, primary, secondary, deltaDb]) => [x, y, primary, secondary, deltaDb]);
const nodeXY = (index: number): readonly [number, number] => [attrib.nodes[index][0], attrib.nodes[index][1]];
export const NODE_XY = { A: nodeXY(0), B: nodeXY(1), C: nodeXY(2), D: nodeXY(3) } satisfies Record<ZoneId, readonly [number, number]>;
export const FLOOR_TINTS = ["#e6f3ef", "#d3e9e3", "#e6f3ef", "#d3e9e3"] as const;
export const traceKey = (trace: SimEffect | PacketTrace) => `${trace.id}:${trace.tMs}:${trace.kind}`;

export function endpointXY(endpoint: Endpoint): readonly [number, number] {
  if (endpoint === "PAGER") return [10.9, 3.7];
  if (endpoint === "DASBOR") return [10.9, 1.7];
  return NODE_XY[endpoint];
}

export function zoneAppearance(zone: ZoneState) {
  if (zone.nodeStatus === "luring") return { label: "Luring", color: "#55565b", fill: "#efedea", Icon: WifiOff };
  if (zone.nodeStatus === "terbatas") return { label: "Terbatas", color: "#55565b", fill: "#efedea", Icon: EarOff };
  if (zone.tier === "menunggu") return { label: zone.rebuzzCount > 0 ? "Eskalasi" : "Tindakan", color: "#855a00", fill: "#fdf1da", Icon: zone.rebuzzCount > 0 ? BellRing : Bell };
  if (zone.tier === "tingkat1") return { label: "Ajakan", color: "#156b6b", fill: "#cfe9e2", Icon: Megaphone };
  if (zone.tier === "ditangani") return { label: "Ditangani", color: "#156b6b", fill: "#e6f3ef", Icon: HandHelping };
  return { label: "Normal", color: "#156b6b", fill: "#e6f3ef", Icon: CircleCheck };
}

/** Golden-cell preview only: exact attribution is owned by the missing T03 module.
 * Never uses this preview to choose a status or to alter callback coordinates. */
export function floorPreview(x: number, y: number) {
  const result = attribute(x, y);
  if (!result) return "Di luar jangkauan simpul";
  const names = result.secondary ? `Zona ${result.primary} dan ${result.secondary}` : `Zona ${result.primary}`;
  return `${names} · ΔL ${result.deltaDb.toFixed(1).replace(".", ",")} dB`;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = () => setMatches(media.matches);
    change(); media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [query]);
  return matches;
}

export function ZoneLabels({ zones }: Pick<RoomViewProps, "zones">) {
  return <ul aria-label="Status zona" style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", padding: 0, margin: "12px 0", listStyle: "none", fontSize: 12 }}>
    {ZONES.map((id) => {
      const { label, color, Icon } = zoneAppearance(zones[id]);
      return <li key={id} style={{ display: "flex", alignItems: "center", gap: 5, color }}><Icon size={15} aria-hidden="true" />Zona {id} · {label}</li>;
    })}
  </ul>;
}

function useTransientTraces(effects: readonly SimEffect[], packets: readonly PacketTrace[], reduced: boolean) {
  const [visible, setVisible] = useState<{ effects: SimEffect[]; packets: PacketTrace[] }>({ effects: [], packets: [] });
  const seenEffects = useRef(new Set(effects.map(traceKey)));
  const seenPackets = useRef(new Set(packets.map(traceKey)));
  const timers = useRef(new Set<number>());
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); timers.current.clear(); }, []);
  useEffect(() => {
    const freshEffects = effects.filter((effect) => !seenEffects.current.has(traceKey(effect)) && effect.kind !== "buzz");
    const freshPackets = packets.filter((packet) => !seenPackets.current.has(traceKey(packet)));
    seenEffects.current = new Set(effects.map(traceKey));
    seenPackets.current = new Set(packets.map(traceKey));
    if (reduced || (!effects.length && !packets.length)) {
      timers.current.forEach(window.clearTimeout); timers.current.clear();
      setVisible({ effects: [], packets: [] }); return;
    }
    if (!freshEffects.length && !freshPackets.length) return;
    setVisible((previous) => ({ effects: [...previous.effects, ...freshEffects], packets: [...previous.packets, ...freshPackets] }));
    const expire = (kind: "effects" | "packets", traces: readonly (SimEffect | PacketTrace)[], delay: number) => {
      if (!traces.length) return;
      const keys = new Set(traces.map(traceKey));
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        setVisible((previous) => ({ ...previous, [kind]: previous[kind].filter((trace) => !keys.has(traceKey(trace))) }));
      }, delay);
      timers.current.add(timer);
    };
    expire("effects", freshEffects, 900); expire("packets", freshPackets, 500);
  }, [effects, packets, reduced]);
  return visible;
}

const FloorCells = memo(function FloorCells({ zones, hatch }: { zones: RoomViewProps["zones"]; hatch: string }) {
  return <g shapeRendering="crispEdges" pointerEvents="none">
    {FLOOR_CELLS.map(([x, y, primary, , deltaDb], index) => {
      const zone = zones[ZONES[primary]];
      const fill = zone.nodeStatus === "normal" && zone.tier === "normal" ? FLOOR_TINTS[primary] : zoneAppearance(zone).fill;
      return <g key={index} data-floor-cell={index}>
        <rect x={x - 0.125} y={y - 0.125} width={0.25} height={0.25} fill={fill} />
        {(deltaDb < 3 || zone.nodeStatus === "luring") && <rect x={x - 0.125} y={y - 0.125} width={0.25} height={0.25} fill={`url(#${hatch})`} />}
      </g>;
    })}
  </g>;
});

export function Denah2D({ zones, effects, packets, onFloorClick, onFloorHover }: RoomViewProps) {
  const id = useId().replaceAll(":", "");
  const hatch = `floor-hatch-${id}`;
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const visible = useTransientTraces(effects, packets, reduced);
  const svg = useRef<SVGSVGElement>(null);
  const press = useRef<{ id: number; x: number; y: number; dragged: boolean } | null>(null);
  const [hover, setHover] = useState<readonly [number, number] | null>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setHover(null); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  const position = (event: PointerEvent<SVGSVGElement>) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    // Inverting the SVG matrix accounts for viewBox letterboxing and CSS scaling.
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (point.x < -0.00001 || point.x > 10.00001 || point.y < -0.00001 || point.y > 5.00001) return null;
    return [Math.max(0, Math.min(10, point.x)), Math.max(0, Math.min(5, point.y))] as const;
  };
  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (press.current) { press.current.dragged = true; return; }
    if (!event.isPrimary || event.button !== 0 || !position(event)) return;
    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const start = press.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) start.dragged = true;
    const point = position(event); setHover(point);
    if (point) onFloorHover(...point);
  };
  const up = (event: PointerEvent<SVGSVGElement>) => {
    const start = press.current;
    if (!start || start.id !== event.pointerId) return;
    press.current = null;
    const point = position(event);
    if (!start.dragged && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 5 && point) onFloorClick(...point);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <figure style={{ margin: 0, padding: "12px 16px", color: "var(--ink)", minWidth: 0 }}>
    <svg ref={svg} viewBox="-0.4 -0.65 12.2 6.25" role="img" aria-labelledby={`floor-title-${id} floor-desc-${id}`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onPointerCancel={() => { press.current = null; }} onLostPointerCapture={() => { press.current = null; }}
      onPointerLeave={() => setHover(null)} style={{ display: "block", width: "100%", height: "auto", touchAction: "pan-y", cursor: "crosshair" }}>
      <title id={`floor-title-${id}`}>Denah ruang tunggu 10 × 5 meter, zona A sampai D</title>
      <desc id={`floor-desc-${id}`}>Klik lantai untuk memperagakan batuk. Dengan keyboard, gunakan tombol batuk per zona pada halaman. Arsir menandai sel dengan selisih level di bawah 3 dB. Titik asal berada di kiri atas.</desc>
      <defs><pattern id={hatch} width={0.12} height={0.12} patternUnits="userSpaceOnUse"><path d="M-.03 .03L.03 -.03M0 .12L.12 0M.09 .15L.15 .09" stroke="#5f6e82" strokeWidth={0.012} opacity={0.5} /></pattern></defs>
      <FloorCells zones={zones} hatch={hatch} />
      <g pointerEvents="none">
        <path d="M0 5V0H10M10 0V5H0" fill="none" stroke="#14365e" strokeWidth={0.025} />
        {[2.5, 5, 7.5].map((x) => <path key={x} d={`M${x} 0V5`} stroke="#5f6e82" strokeWidth={0.015} strokeDasharray=".07 .07" />)}
        {ZONES.map((zone) => <g key={zone}>
          {[0.8, 3.9].flatMap((y) => [0, 1, 2, 3].map((chair) => <rect key={`${y}:${chair}`} x={NODE_XY[zone][0] - 0.96 + chair * 0.5} y={y} width={0.42} height={0.38} rx={0.06} fill="#d9dedc" stroke="#5f6e82" strokeWidth={0.015} />))}
          <text x={NODE_XY[zone][0]} y={-0.24} textAnchor="middle" fontSize={0.21} fill="#14365e">Zona {zone}</text>
          <circle cx={NODE_XY[zone][0]} cy={2.5} r={0.16} fill={zones[zone].nodeStatus === "luring" ? "#efedea" : zoneAppearance(zones[zone]).color} stroke="#ffffff" strokeWidth={0.04} />
          <text x={NODE_XY[zone][0]} y={2.92} textAnchor="middle" fontSize={0.18} fill="#14365e">{zone}</text>
        </g>)}
        <text x={0} y={5.36} fontSize={0.17} fill="#3f5269">(0, 0) di kiri atas</text>
        <text x={10} y={5.36} textAnchor="end" fontSize={0.17} fill="#3f5269">10 × 5 m</text>
        <rect x={10.3} y={0.8} width={1.1} height={3.5} rx={0.1} fill="#faf9f7" stroke="#5f6e82" strokeWidth={0.02} />
        <text x={10.85} y={1.25} textAnchor="middle" fontSize={0.16} fill="#14365e">Petugas</text>
        <text x={10.85} y={1.75} textAnchor="middle" fontSize={0.14} fill="#3f5269">Dasbor</text>
        <text x={10.85} y={3.75} textAnchor="middle" fontSize={0.14} fill="#3f5269">Pager</text>
        {visible.effects.flatMap((effect) => {
          const points = effect.x !== undefined && effect.y !== undefined ? [[effect.x, effect.y]] : (effect.zones ?? []).map((zone) => NODE_XY[zone]);
          return points.map(([x, y], index) => <circle key={`${traceKey(effect)}:${index}`} cx={x} cy={y} r={0.1} fill="none" stroke={effect.kind === "speech" ? "#7d8088" : "#1f8a8a"} strokeWidth={0.035}>
            <animate attributeName="r" from="0.1" to="1.1" dur="900ms" fill="freeze" /><animate attributeName="opacity" from="0.8" to="0" dur="900ms" fill="freeze" />
          </circle>);
        })}
        {visible.packets.map((packet) => {
          const from = endpointXY(packet.from); const to = endpointXY(packet.to);
          return <circle key={traceKey(packet)} r={0.055} fill={packet.kind === "ALERT" ? "#855a00" : "#14365e"}>
            <animateMotion path={`M${from[0]},${from[1]} L${to[0]},${to[1]}`} dur="500ms" fill="freeze" />
          </circle>;
        })}
      </g>
    </svg>
    <figcaption>
      <p style={{ margin: "8px 0", fontSize: 12, color: "var(--ink-3)" }}>Menampilkan denah 2D. Logikanya sama. Arsir: ΔL &lt; 3 dB.</p>
      <ZoneLabels zones={zones} />
      <p role="tooltip" style={{ minHeight: 40, margin: 0, fontSize: 12, color: "var(--ink-2)" }}>
        {hover ? <>{floorPreview(...hover)}<br />Klik untuk memperagakan batuk di sini</> : "Klik lantai atau gunakan tombol batuk per zona pada halaman."}
      </p>
    </figcaption>
  </figure>;
}

export default Denah2D;
