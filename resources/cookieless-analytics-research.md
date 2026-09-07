# Cookieless analytics for the hosted properties

Research behind issue #352. Everything below was checked against a primary
source, and the source is named. Verified September 2026.

## The question

Understand who visits warmbly.com, which pages and channels bring signups, and
what new customers do in the dashboard, with **no cookie banner**: nothing
stored in the visitor's browser and no consent prompt.

That rules out any tool whose identity model is "write an id into the browser
and read it back". It does not rule out counting visitors, because a visitor
can be counted without being remembered.

## Options considered

| Tool | Storage in the browser | Product funnels | Self-host story | Cost at our size |
|---|---|---|---|---|
| **PostHog Cloud EU, cookieless mode** | none in `cookieless_mode: 'always'` | yes | MIT core, self-hostable | 1M events/month free |
| Plausible Cloud | none | no (page analytics only) | AGPL, self-hostable | paid from the first month |
| Fathom | none | no | closed | paid |
| Umami | none | thin | MIT | free self-hosted, we run the server |
| GA4 | cookies, consent required | yes | none | free |
| Matomo (cookieless config) | none when configured | thin | GPL | free self-hosted |

GA4 is out on the banner requirement alone. Plausible, Fathom and Umami answer
"which page" but not "did this person connect a mailbox and launch a campaign",
which is the half of the question that decides what we build next. Matomo would
work but means running and patching another database.

**Decision: PostHog Cloud EU in cookieless mode**, plus a first-party
attribution record written at signup for anything that has to outlive a day.

## How PostHog cookieless mode actually works

Nothing is written to the browser. The identity is computed on PostHog's
servers as a hash. From `rust/common/cookieless/src/manager.rs` in the PostHog
repository, the hash inputs are:

- the team id
- a **daily-rotated salt**, held for `SALT_TTL_SECONDS` and then deleted
- the IP address
- the user agent
- the **root domain** (eTLD+1) of the host, via `extract_root_domain`

Two consequences matter to us:

1. **The salt is deleted daily**, so the same visitor on two different days is
   two different hashes. There is no persistent identifier, and no way to walk
   one back to a person. This is what makes the no-banner position defensible.
2. **The hash uses the registrable root domain**, so `warmbly.com` and
   `app.warmbly.com` are one visitor and one session within a day, with no
   cross-domain wiring on our side.

### Client configuration

From PostHog's cookieless tracking tutorial:

```javascript
posthog.init("<token>", {
  cookieless_mode: "always",
  api_host: "https://eu.i.posthog.com",
});
```

PostHog's own privacy documentation adds: set `person_profiles: 'never'`, since
"a persistent distinct ID is considered Personal Data under GDPR", which turns
`identify()` into a no-op. `alias` events are dropped at ingestion in this mode.
Cookieless server hash mode has to be enabled in the project settings first.

### Server-side events

A backend event has to join the same hash, or it lands as a separate visitor.
The constants are in `rust/common/cookieless/src/constants.rs`:

```rust
pub const COOKIELESS_SENTINEL_VALUE: &str = "$posthog_cookieless";
pub const COOKIELESS_MODE_FLAG_PROPERTY: &str = "$cookieless_mode";
```

and `nodejs/src/ingestion/common/cookieless/cookieless-manager.ts` reads
`$raw_user_agent`, `$ip` and `$host` off the event to compute it. So a
server-side capture is:

```json
{
  "api_key": "<token>",
  "event": "signup_completed",
  "distinct_id": "$posthog_cookieless",
  "properties": {
    "$cookieless_mode": true,
    "$raw_user_agent": "<the browser's UA>",
    "$ip": "<the browser's IP>",
    "$host": "app.warmbly.com"
  }
}
```

posted to `https://eu.i.posthog.com/i/v0/e/` (PostHog's capture API reference).
The same file shows the ingester **deletes** `$ip` and `$raw_user_agent` from
the event once the hash is computed, so the raw values are not retained.

## The legal position

The CNIL's 2025 guidance on audience-measurement exemptions accepts a salted,
daily-rotated hash as an identifier that does not require consent, which is
exactly the construction above. The exemption is narrow, and it does **not**
cover acquisition-channel or conversion measurement.

That is the honest limit of what the exemption buys, and it is why the
acquisition record below is a deliberate product decision recorded here rather
than something smuggled in under "analytics": it is kept minimal, first-party,
written once at signup as part of the account record, and it travels with a
workspace export like the rest of the customer's data.

## Why a first-party record as well

Cookieless mode buys aggregate truth for a day. It cannot answer "the customer
who upgraded in March came from the deliverability guide in January", because
by design nothing joins those two days.

So the channel is recorded once, at signup, on the organization itself:
`landing_path`, `referrer_host`, and the five UTM fields. Nothing is stored in
the browser before signup — the values ride the query string from the marketing
site to the dashboard's signup page and are read there. Revenue by channel is
then a SQL join against subscriptions, owned by us, and it keeps working if the
analytics provider is blocked, changed or dropped.

## Explicitly out of scope

Session replay, heatmaps, surveys and feature flags each store or record more
than a cookieless pageview and would need their own decision. Session replay in
particular would record mailbox and contact screens.

Self-hosted Warmbly loads none of this: the code path exists in the image, and
without a key it is never initialised. See `docs/content/docs/development/data-control.mdx`.

## Sources

- PostHog, "How to do cookieless tracking with PostHog": <https://posthog.com/tutorials/cookieless-tracking>
- PostHog, "Controlling data collection": <https://posthog.com/docs/privacy/data-collection>
- PostHog, capture API reference: <https://posthog.com/docs/api/capture>
- PostHog source, `rust/common/cookieless/src/constants.rs` and `manager.rs`
- PostHog source, `nodejs/src/ingestion/common/cookieless/cookieless-manager.ts`
- PostHog, "Bot and traffic detection" (on `$raw_user_agent` for server-side capture): <https://posthog.com/docs/web-analytics/bot-detection>
