export type Event =
    | "mailbox_connected"
    | "campaign_launched";

// Browser product analytics disabled for privacy & zero-telemetry.
export function initProductAnalytics(): void {
    return;
}

export function capture(_event: Event, _properties?: Record<string, string | number | boolean>): void {
    return;
}
