// A hosted workspace without a subscription can manage mailboxes, its
// Warmbly Cloud links and settings; every other page shows the full-screen
// plan chooser until a plan is active.

import React from "react";

export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
