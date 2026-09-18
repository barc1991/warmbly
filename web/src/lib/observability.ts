import type { PostHogIdentity } from "./posthog";

export type Identity = PostHogIdentity | null;
export type StepProperties = Record<string, string | number | boolean>;

// Browser error reporting disabled for privacy & zero-telemetry.
export function initErrorReporting(): void {
    return;
}

export function captureException(_error: unknown): void {
    return;
}

export function setErrorIdentity(_next: Identity): void {
    return;
}

export function noteStep(_message: string, _properties?: StepProperties): void {
    return;
}
