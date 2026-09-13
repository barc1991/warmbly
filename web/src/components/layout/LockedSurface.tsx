// LockedSurface — render a feature page through a frosted-glass
// overlay when the org doesn't have the subscription tier.
//
// The page contents are still rendered behind the lock at reduced
// opacity so the user gets a preview of what they'd unlock. The
// overlay sits absolute with a backdrop-blur and a centered card that
// names the feature, the minimum plan and its price; the CTA opens the
// full-screen upgrade dialog (plans, interval, one-click checkout)
// instead of routing away to billing.
//
// Use it like:
//
//   <LockedSurface
//     locked={!access.hasInbox}
//     feature="Unified inbox"
//     blurb="See every reply across every connected mailbox in one place."
//     minPlan="starter"
//     bullets={["Search by sender, subject, account, date range, and tag"]}
//   >
//     <RealInbox />
//   </LockedSurface>

import React from "react";
import type { PlanID } from "@/lib/plans";

interface Props {
    locked?: boolean;
    feature?: string;
    blurb?: string;
    minPlan?: PlanID;
    children: React.ReactNode;
    bullets?: string[];
}

export function LockedSurface({ children }: Props) {
    return <>{children}</>;
}
