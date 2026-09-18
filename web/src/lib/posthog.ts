import type { PostHog, Properties } from "posthog-js";

export type PostHogIdentity = {
    userId: string;
    email?: string | null;
    name?: string | null;
    organizationId?: string | null;
    organizationName?: string | null;
    plan?: string | null;
};

// PostHog client neutralized for zero-telemetry & privacy.
export function loadPostHog(): Promise<PostHog | null> {
    return Promise.resolve(null);
}

export function postHogClient(): PostHog | null {
    return null;
}

export function setPostHogIdentity(_next: PostHogIdentity | null): void {
    return;
}

export function notePostHogStep(_message: string, _properties?: Properties): void {
    return;
}
