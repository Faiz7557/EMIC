import { Megaphone } from "lucide-react";
import { copy } from "../data/copy";
import { ZONES, type SimState } from "../sim/types";

export function Board({ zones }: Pick<SimState, "zones">) {
  const invited = ZONES.filter((id) => zones[id].tier === "tingkat1" || zones[id].tier === "menunggu");
  return <section aria-label="Papan informasi pengunjung" style={{ background: "var(--ink)", color: "white", borderRadius: 12, padding: 20 }}>
    <p style={{ color: "var(--lime)", fontSize: 12, fontWeight: 600 }}>{copy.board.label}</p>
    <h3 style={{ fontSize: 18, margin: "0 0 12px" }}>{copy.board.title}</h3>
    <p>{copy.board.body}</p>
    {!!invited.length && <div style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", borderRadius: 12, padding: 16 }}>
      <Megaphone size={20} aria-hidden="true" />
      <p style={{ fontWeight: 600 }}>{copy.board.invitationTitle}</p>
      <p>{copy.board.invitation}</p>
      <p style={{ margin: 0, fontSize: 12 }}>Ajakan aktif di zona {invited.join(", ")}.</p>
    </div>}
  </section>;
}
