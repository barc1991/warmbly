// Cookieless product analytics.
//
// Two rules decide everything in this file.
//
// It is hosted-only. The dashboard image is the same for the hosted service and
// for a self-host, so the key comes from the container-injected runtime config
// and an unset key means the SDK chunk is never fetched and no PostHog host is
// ever contacted. A self-host therefore ships this code path and never runs it.
//
// It is cookieless, so there is no banner. `cookieless_mode: 'always'` stores
// nothing in the browser: no cookie, no localStorage, no sessionStorage. The
// visitor is derived server-side from a daily-rotated salt plus IP, root domain
// and user agent, and the salt is deleted at the end of the day, so there is no
// identifier to consent to. That only holds if we never call identify, which is
// why `person_profiles: 'never'` is set and why no event property below ever
// carries a user id, an organization id or an email.
//
// Session replay stays off deliberately: it would record mailbox and contact
// screens.
export type Event =
    | "mailbox_connected"
    | "campaign_launched";

export function initProductAnalytics(): void {
    return;
}

export function capture(_event: Event, _properties?: Record<string, string | number | boolean>): void {
    return;
}
