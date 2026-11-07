import * as Tooltip from "@radix-ui/react-tooltip";
import { Calculator, CircleHelp, Dices, Image, PencilRuler, Target, type LucideIcon } from "lucide-react";
import { CLAIM_STATUS_LABEL, getClaim, type Claim, type ClaimId, type ClaimStatus } from "../data/claims";
import { cn } from "./ui";

const icons: Record<ClaimStatus, LucideIcon> = {
  terhitung: Calculator, tersimulasi: Dices, target: Target,
  dirancang: PencilRuler, asumsi: CircleHelp, ilustratif: Image,
};

export function ClaimTag({ claim: input, className }: { claim: Claim | ClaimId; className?: string }) {
  const claim = typeof input === "string" ? getClaim(input) : input;
  const Icon = icons[claim.status];
  return <Tooltip.Provider delayDuration={200}>
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" className={cn("claim-tag squircle", `claim-${claim.status}`, className)}
          data-claim={claim.id} aria-label={`${CLAIM_STATUS_LABEL[claim.status]}: ${claim.tampil}. Sumber: ${claim.sumber}`}>
          <Icon size={12} aria-hidden="true" />{CLAIM_STATUS_LABEL[claim.status]}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Content className="claim-tooltip" sideOffset={6} collisionPadding={16}>
        {claim.sumber}<Tooltip.Arrow className="tooltip-arrow" />
      </Tooltip.Content></Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>;
}
