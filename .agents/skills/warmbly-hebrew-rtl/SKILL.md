---
name: warmbly-hebrew-rtl
description: >-
  Complete architecture, localization engine, RTL layout rules, typography guidelines,
  and update persistence runbook for Warmbly Cold Outreach & Warmup Hebrew (RTL) Edition.
  Use whenever modifying Hebrew translations, RTL alignment, UI components, typography,
  or updating Warmbly via Docker/Git.
---

# Warmbly — Hebrew RTL Fork Architecture & Operations Guide

## 1. System Architecture Overview

This installation is a customized Hebrew (RTL) edition of **Warmbly** (cold email outreach, warmup, and mailbox deliverability platform).

* **Web Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, TanStack Query, i18next (`web/`).
* **Backend Control Plane**: Go 1.23, Gin framework, pgx, PostgreSQL (`cmd/backend`, `internal/`).
* **Workers & Execution Plane**: Go distributed workers (`cmd/worker`, `cmd/consumer`).
* **Realtime & Tracking**: Elixir/Phoenix WebSocket fanout (`realtime/`), Rust pixel tracker (`tracking/`).
* **Docker Container Stack**: Multi-service Docker Compose running on custom port mappings.

### Port Allocation Reference
| Service | Container Port | Host Port | Purpose |
|---|---|---|---|
| Web Frontend | `80` (nginx) | **`28173`** | Main Warmbly application UI |
| Admin Panel | `80` (nginx) | **`28174`** | Super-admin management console |
| Backend API | `8080` | **`28080`** | REST API & control plane |
| Tracking Service | `3000` | **`28300`** | Email open & link click tracking |
| Realtime WebSocket | `4000` | **`28400`** | Live UI updates & notifications |
| Forms Service | `8090` | **`28090`** | Public forms & booking embeds |

---

## 2. Typography & Font System

### A. Font Family: `Assistant`
* The default Hebrew font is **`Assistant`** (paired with `Inter` for Latin characters):
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700;800&family=Inter:opsz,wght@14..32,100..900&display=swap');
  ```
* **Why Assistant over Heebo**: `Heebo` has an excessively wide glyph geometry that causes dashboard tables, badge counters, and sidebars to wrap prematurely or feel bloated. `Assistant` is the industry-standard Hebrew counterpart to modern sans-serifs, providing crisp, proportional typography suited for data-dense interfaces.

### B. The Letter-Spacing Rule (Neutralizing `tracking-*`)
In Latin typography, uppercase badge titles and stat labels frequently use `tracking-[0.14em]` or `tracking-wider`. In Hebrew, letter-spacing breaks word cohesion because Hebrew letters are not designed to be spaced out.

To solve this across all existing and future components, `web/src/global.css` enforces:
```css
[dir="rtl"] [class*="tracking-"],
[dir="rtl"] .tracking-wider,
[dir="rtl"] .tracking-widest,
[dir="rtl"] .tracking-tight,
[dir="rtl"] .tracking-normal {
    letter-spacing: normal !important;
}
```

### C. Numbers & Monospace Direction
Tabular numbers and monospace IDs inside RTL containers must retain natural left-to-right digit flow:
```css
[dir="rtl"] .tabular-nums,
[dir="rtl"] .font-mono {
    direction: ltr;
    display: inline-block;
    unicode-bidi: isolate;
}
```

---

## 3. RTL Layout & Geometry Engine

### A. Popover & Select Menu Alignment (`web/src/components/ui/popover-menu.tsx`, `select-menu.tsx`, `dropdown-menu.tsx`, `select.tsx`)
* **Horizontal Alignment**: In RTL, popover menus calculate horizontal placement with inverted origins and edge anchors:
  ```tsx
  const isRtl = document.documentElement.dir === "rtl" || document.body.dir === "rtl";
  let left: number;
  if (align === "end") {
      left = isRtl ? r.left : r.right - cw;
  } else if (align === "center") {
      left = r.left + r.width / 2 - cw / 2;
  } else {
      left = isRtl ? r.right - cw : r.left; // Anchors to right edge, opens leftward
  }
  ```
* **Text Alignment**: All menu items and option rows must use `text-start rtl:text-right` rather than hardcoded `text-left`.
* **Selection Indicators & Dot Badges**: Selected checkmarks, radio dots, and item counters must align on the opposing side (`rtl:left-2.5 ltr:right-2.5` or `ltr:mr-2 rtl:ml-2`), ensuring they do not collide with Hebrew labels.
* **Global Text-Left Reset (`web/src/global.css`)**:
  ```css
  html[dir="rtl"] button.text-left,
  html[dir="rtl"] .text-left {
      text-align: right !important;
  }
  ```

### B. Compose Window Docking (`web/src/components/app/unibox/compose/ComposeWindow.tsx`)
* **Rule**: In RTL, the compose window docks at the **BOTTOM-LEFT** (`rtl:sm:left-4 rtl:sm:right-auto`), matching Gmail Hebrew and Outlook Hebrew standards:
  ```tsx
  className="fixed z-[70] inset-x-2 bottom-2 sm:inset-x-auto sm:right-4 rtl:sm:right-auto rtl:sm:left-4 sm:bottom-4 ..."
  ```

### C. Drawer Slide Direction & Margins
* Framer Motion drawer slides must invert directional offset: `x: isRtl ? -28 : 28` (or `-100%` vs `100%`) so drawers enter from the expected side.
* Directional arrows (`ArrowRightIcon`, `ChevronRight`) between stages or breadcrumbs must include `rtl:rotate-180`.
* Replace physical `ml-auto` with logical `ltr:ml-auto rtl:mr-auto` or `ms-auto`.

---

## 4. Date, Time & Calendar Formatting

### A. 24-Hour Clock Standard (`web/src/lib/core/time.ts`, `TimePicker.tsx`, `DateTimePicker.tsx`)
* All time displays and pickers use 24-hour Jerusalem time:
  ```ts
  export function formatJerusalemTime(isoString: string): string {
      return new Date(isoString).toLocaleTimeString("he-IL", {
          timeZone: "Asia/Jerusalem",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
      });
  }
  ```
* Time dropdown slots are generated from `00:00` through `23:30` with zero AM/PM suffixes.

### B. Hebrew Calendar Engine (`web/src/components/ui/DatePicker.tsx`, `Calendar.tsx`)
* Week starts on Sunday (`weekStartsOn: 0`).
* Days of week: `א'`, `ב'`, `ג'`, `ד'`, `ה'`, `ו'`, `ש'`.
* Months: `ינואר`, `פברואר`, `מרץ`, `אפריל`, `מאי`, `יוני`, `יולי`, `אוגוסט`, `ספטמבר`, `אוקטובר`, `נובמבר`, `דצמבר`.
* Quick actions: "היום" (Today), "נקה" (Clear).

---

## 5. Translated Functional Modules

### A. Unibox
* Unified inbox for cold outreach and warmup replies.
* Folders and scopes: תיבת דואר נכנס, הכל, לא נקרא, חיובי, מתעניין, נקבעה פגישה, לא מעוניין, מענה אוטומטי, שגיאות מסירה, ספאם, ארכיון.
* Compose window: recipient fields, subject, auto/best mailbox picker ("אוטומטי", "הטובה ביותר", "ברירת מחדל"), template selector, rich text editor with RTL toolbar.

### B. Integrations
* Directory and cards: Google Workspace, Microsoft 365, HubSpot, Salesforce, Pipedrive, Calendly, Cal.com, Slack, Discord, Inbound Webhooks.
* Connect drawer, field mapping editor ("העתק ערך", "ערך קבוע"), status pills ("מחובר", "מאמת", "ממתין", "מוגבל", "חבר מחדש", "לא מחובר"), inbound webhook URL dialog.

### C. Automations
* Trigger and action builder for cold outreach workflows.
* Action labels: Slack notification, Discord alert, create CRM deal, move deal stage, unsubscribe contact, mark warmup state.
* Operators: שווה ל-, מכיל, מתחיל ב-, גדול מ-, קטן מ-, קיים, ריק.
* Pre-built template gallery with Hebrew copy.

### D. CRM Pipelines & Deals
### E. Frappe CRM Integration
* **Provider Identifier**: `frappe_crm` (`IntegrationProvider`).
* **Connection Credentials**: `server_url` (Instance Base URL), `api_key` (API Key), `api_secret` (API Secret).
* **Doctype Support**: Automatically synchronizes and upserts leads into **`CRM Lead`** (with automatic fallback to ERPNext core **`Lead`** if `CRM Lead` is not installed).
* **Capabilities**: Synchronous push (`SupportsPush: true`), automated workflow events (reply received, meeting booked, bounced), and bidirectional field mapping (`first_name`, `last_name`, `email`, `phone`, `organization`, `job_title`).

### F. Additional Localized Modules
* **Notifications Popover (`NotificationBell.tsx`)**: RTL viewport alignment (`ltr:right-0 rtl:left-0`), translated notification types, relative times (`לפני 5 דק'`, `אתמול`), and filter categories.
* **AI Assistant Drawer (`AgentPanel.tsx`)**: Full Hebrew localization ("עוזר AI"), prompt starters, history drawer recency buckets, and action tags.
* **Confirm Dialog (`ConfirmProvider.tsx`)**: Unified in-app confirmations ("אישור", "האם אתה בטוח?", "ביטול").
* **Credits & Activity Meter (`CreditsMeter.tsx`)**: Localized month names (`ב-6 בספטמבר`), balance rows, and inverted popover placement.
* **API Permission Scopes (`APIPermission.ts`)**: 24 Hebrew descriptions across READ, WRITE, BULK, and REALTIME scopes.
* **Breadcrumbs & Navigation (`AppHeader.tsx`, `nav.json`)**: Terminology cleaned up without English brackets ("תיבת דואר מאוחדת", "יומן פעילות", "דיוור", "ניהול לקוחות", "קטגוריות", "סגמנטים", "רשימת חסימה").

### G. Mailbox Connection & Onboarding Suite
* **Main Provider Picker (`AddEmailModal.tsx`, `view === "pick"`)**: Google Workspace/Gmail, Microsoft 365/Outlook, SMTP/IMAP, Bulk CSV, and Warmbly Cloud workspace accounts.
* **Self-Host Missing OAuth (`ProviderNotConfigured`)**: Complete Hebrew instructions for self-hosted instances with `dir="ltr"` on `.env` keys (`BOX_GOOGLE_CLIENT_ID=`, `BOX_OUTLOOK_CLIENT_ID=`) to prevent RTL sign inversion, plus Cloud skip option.
* **OAuth Authorization Panel (`OAuthPanel`)**: Localized consent scopes ("שליחה וקריאה של מיילים בשמך", "מעקב אחר מענים ומסירות", "אסימונים מוצפנים") and interactive buttons.
* **Manual SMTP & IMAP Form (`SmtpImapPanel`)**: Localized Account, IMAP, SMTP sections, single-credential toggle, port presets, server verification notice, and `ltr:pl-[76px] rtl:pr-[76px]` alignment.
* **Security Selector (`SecuritySelect.tsx`)**: Segmented control with localized options (SSL / TLS, STARTTLS, ללא הצפנה), tooltips, and localhost-only security warnings.
* **Bulk CSV Connect Wizard (`BulkConnectPanel.tsx`)**: Drag-and-drop dropzone, sample CSV template download, column format guides, real-time batch processing progress meter (`DitherMeter`), failed rows CSV report download, and retry flow.
* **Mailbox Allowance & Fair-Use Dialog (`MailboxAllowanceDialog.tsx`)**: Quota usage meter, fair-use calculation breakdown, plan upgrade comparison cards, inline quota increase request form with Hebrew date formatting, and request withdrawal prompts.
* **Credential Refresh & Re-Auth Dialog (`UpdateCredentialsDialog.tsx`)**: Replacement credentials dialog for broken or modified mailbox passwords, with server testing before saving.

### H. Deliverability Advisor & Recommendations Suite (`Advisor.ts`, `AdvisorFixDrawer.tsx`, `AdvisorSnippets.tsx`, `AdvisorCard.tsx`)
* **Client-Side Localization Engine (`localizeFinding`)**:
  * Advisor findings are generated by Go backend detectors (`internal/app/advisor/`), persisted to PostgreSQL (`advisor_findings`), and fetched via `/v1/advisor/recommendations`.
  * To maintain backend schema consistency and pass CI test suites while presenting native Hebrew to users, findings are translated on the API boundary using `localizeFinding` in `web/src/lib/api/models/app/advisor/Advisor.ts`.
  * Automatically localizes titles, details ("מדוע זה קורה"), remedies ("מה כדאי לעשות"), ordered step-by-step instructions, and snippet labels/notes across deliverability (`mailbox_domain_auth`, `mailbox_shared_tracking_domain`), mailbox health (`mailbox_errors_unresolved`, `mailbox_cap_too_high`), warmup (`warmup_off_while_sending`), campaigns, and lists.
* **Evidence Dictionary (`evidenceLabel`, `evidenceValue`)**:
  * Maps snake_case metrics (`spf`, `dkim`, `dmarc`, `dmarc_policy`, `unresolved_errors_7d`, `currently_sending_cold`, `sending_blocked`) to clean Hebrew labels.
  * Translates values into Hebrew (`כן`/`לא`, `ללא חסימה (none)`, `הסגר (quarantine)`, `דחייה (reject)`, `פעיל`, `תקין`).
* **Contextual Deep Linking (`findingLink`)**:
  * Mailbox findings automatically deep link to `/app/emails?mailbox=<id>`.
  * For domain authentication issues (`mailbox_domain_auth`), the link appends `&tab=warmup` to open the mailbox details directly on the DNS/Warmup tab.
  * The drawer component passes `onClose` to the link so clicking "פתיחת תיבת הדואר" closes the overlay smoothly.
* **Consumer Gmail Accounts (@gmail.com) Caveat**:
  * Google owns the `gmail.com` DNS zone; users cannot add custom DKIM TXT records at `google._domainkey.gmail.com`.
  * If a user connects a personal `@gmail.com` account, the DKIM finding will naturally fire. The platform guidelines recommend keeping `@gmail.com` accounts strictly as internal warmup nodes rather than cold outreach senders.
* **Findings Cleanup on Mailbox Deletion**:
  * `advisor_findings` lacks an `ON DELETE CASCADE` foreign key because `entity_id` is generic.
  * In `internal/repository/pg_email.go`, `Delete` runs a transactional cleanup: `DELETE FROM advisor_findings WHERE entity_id = $1`.
  * In `web/src/app/app/emails/page.tsx`, `removeSelected` triggers `queryClient.invalidateQueries({ queryKey: ["advisor"] })` to eliminate stale ghost recommendations immediately.

### I. Unibox Thread Actions & Mailbox Sync Integrity
* **Thread Action Controls (`ThreadView.tsx`)**:
  * Header and mobile popover actions: "סמן כלא נקרא" (Mark as unread), "העבר לארכיון" (Archive), "מחק שרשור" (Delete).
  * Marking unread executes `markSeenMutate({ ids, threadId, seen: false })`, clears `selectedThreadId`, and displays toast confirmation.
  * Archiving and deleting trigger API updates and display informative Hebrew toasts.
* **Mailbox Sync Multi-Tenant Scoping (`email_sync.go`, `service.go`)**:
  * Email account sync state queries check `WHERE organization_id = $1 AND id = $2`.
  * The Gin handler in `internal/api/handler/email_sync.go` must pass `middleware.GetOrganizationID(c).String()` (organization UUID), NOT user UUID, to prevent false `404 Not Found` errors.
  * TanStack Query hook `useSync.ts` uses `retry: false` to stop endless polling loops when sync state is absent or disabled.

---

## 6. Autonomous BDR & AI Engine (Gemini 3.8 Flash, Serper & Frappe CRM)

The platform includes an autonomous B2B Business Development Representative (BDR) and data enrichment engine tailored for advertising agencies:

### A. Gemini 3.8 Flash & Multi-Tier Fallback Chain
* **Google GenAI SDK**: Powered by `google.golang.org/genai`.
* **Dynamic Fallback Chain**:
  1. `gemini-3.8-flash` (Primary default, optimal latency and tool execution).
  2. `gemini-3.7-flash` (First fallback under load or rate limits).
  3. `gemini-3.6-flash` (Second fallback for extreme load).
  4. `gemini-3.5-flash-lite` (Lightweight third fallback).
* **Multi-Key Rotator**: Manages multiple free-tier Gemini API keys per organization with automatic round-robin, 429 cooldown detection, and quota tracking.

### B. Serper Google Search Key Rotator & 7-Day Quota Cache
* **Quota Tracking**: Tracks usage up to the 2,500 queries limit per free-tier key.
* **7-Day Multi-Tier Caching**: Caches search results in Redis and PostgreSQL (`org_serper_cache`) for 7 days to eliminate duplicate queries and preserve credits.
* **Org DEK Encryption**: All Serper API keys stored in `org_serper_keys` are encrypted at rest using the organization data encryption key (`KeyDomainOrgDEK`).
* **Settings & UI (`ai-models/page.tsx`)**: Visual progress bar (`X / 2,500`), status pills, bulk key import, live key testing (`/test`), and BDR setting toggles.

### C. Gemini BDR AI Tools (`internal/app/aitools/tools_bdr.go`)
1. `serper_google_search`: Real-time Google search for company details, decision-maker contacts, and domains.
2. `fetch_url_content`: In-depth web crawling with strict SSRF protection (`webhook.ValidateOutboundURL` and `safehttp`), 7-second hard timeout, and 2MB HTML size cap.
3. `update_lead_fields`: Updates contact fields in Warmbly with smart Hebrew/English name normalization (stripping corporate suffixes like "בע\"מ", "בעמ", "LTD", "LLC", "חברת...").
4. `frappe_crm_sync`: Syncs enriched leads directly to Frappe CRM with email-based deduplication, custom fields, and task/event creation.
5. `mark_do_not_contact`: Marks DNC across both Warmbly and Frappe CRM on unsubscribes or objections.

### D. Autonomous Inbox Agent & Deliverability Guardrails (`internal/app/inboxagent/`)
* **Intent Classification**: Classifies inbound replies into `INTERESTED`, `MEETING_REQUEST`, `OUT_OF_OFFICE`, `REFERRAL`, `NOT_INTERESTED`, `UNSUBSCRIBE`, `NEUTRAL`.
* **First-Reply Website Crawling**: Crawls the lead's domain on initial reply to extract ICP insights and inject into `research_notes`.
* **Deliverability & Spam Guardrails**: Blocks aggressive spam keywords or suspicious links unless explicitly requested; always appends the sender mailbox signature.
* **Autonomous Auto-Send**: Automatically drafts and transmits replies for high-intent leads (`INTERESTED` or `MEETING_REQUEST`) when confidence exceeds the configured threshold (default 85%).
* **Unibox Rationale (`AgentDraftCard.tsx`)**: Renders intent badges, confidence %, key business insight, and extracted signature details (phone, title, company).
* **Agent Panel (`AgentPanel.tsx`)**: Quick Action pills ("חקור ליד והעשר נתונים", "סנכרן ל-Frappe CRM", "תאם פגישה ביומן", "נסח תגובה להתנגדות") and slash commands (`/enrich`, `/crm`, `/book`, `/reply`).

---

## 7. Numeric Badge & Circle Centering Rules

To prevent vertical baseline offsets or digit clipping in RTL number badges and step circles (e.g. Sequence steps `1`, `2` in `NewCampaignDialog.tsx`, onboarding wizards, and status counters):
1. **Remove `tabular-nums`** from circle badge containers or use `tabular-nums leading-none`.
2. **Container Flexbox**: Use `flex items-center justify-center shrink-0 rounded-full leading-none`.
3. **Global CSS Enforcement (`web/src/global.css`)**:
   ```css
   .rounded-full.flex,
   .rounded-full.inline-flex {
       line-height: 1;
   }
   .rounded-full > span {
       display: inline-flex;
       align-items: center;
       justify-content: center;
       line-height: 1;
   }
   ```

---

## 8. Docker Update-Proof Architecture (Preventing Overwrites)

### The Problem
In standard Warmbly self-hosted setups, `docker-compose.yml` specifies:
```yaml
image: ${WARMBLY_IMAGE_PREFIX:-ghcr.io/warmbly/warmbly}/web:${WARMBLY_TAG:-prod}
```
If a user runs `docker compose pull`, Docker downloads the official prebuilt image from GitHub Container Registry (`ghcr.io`), which is English-only. The local container is recreated and all Hebrew translations disappear!

### The Multi-Layer Solution

#### Layer 1: `docker-compose.override.yml`
Docker Compose automatically loads `docker-compose.override.yml` alongside `docker-compose.yml`:
```yaml
services:
  web:
    image: warmbly-web-local:latest
    build:
      context: ./web
      dockerfile: Dockerfile
```
* Because `image: warmbly-web-local:latest` has no remote registry prefix, `docker compose pull` skips it or fails gracefully without overwriting the local image.
* When `docker compose up -d` runs, it uses the locally built Hebrew image.

#### Layer 2: Safe Update Scripts
Two scripts are provided to perform updates safely:
* **Windows (PowerShell)**: `scripts/update-warmbly.ps1`
* **Linux / macOS (Shell)**: `scripts/update-warmbly.sh`

Both scripts execute:
1. `docker compose pull backend worker consumer realtime tracking forms admin postgres redis nats` (updates all backend & infrastructure images from upstream).
2. `docker compose build --no-cache web` (rebuilds the web image using the local Hebrew frontend source code).
3. `docker compose up -d --force-recreate web` (restarts web container cleanly).

#### Layer 3: Git Branch Hygiene
All customizations are committed to git on the working branch (`feat/hebrew-and-rtl-support`). When pulling upstream Git updates:
```bash
git pull upstream main --rebase
```
Translations remain committed and intact in the repository tree.

#### Layer 4: Disabling In-App UI Updates (Keeping Release Validation Active)
To ensure that an administrator does not accidentally trigger an automatic update from the dashboard (which would pull upstream images and overwrite local customizations):
* **UI Update Buttons Disabled**: In `UpdateDialog.tsx` (`web/` and `admin/`), the "עדכן והפעל מחדש" / "Update and restart" button is disabled and displays **"עדכון ידני בלבד"** (**"Manual update only"**).
* **Release Check Validation Active**: The **"בדוק כעת"** (**"Check now"**) button and GitHub release checks remain 100% active, displaying notifications when a new version is available without executing destructive auto-updates.
* **Backend API Protection**: The endpoint `POST /admin/instance/update/apply` returns `403 Forbidden` (`errx.Forbidden`), preventing even scripted API executions from running the host updater.
* **Manual Update Procedure**: Updates must be executed via `scripts/update-warmbly.sh` or Git rebasing.

---

## 9. Realtime WebSocket Resilience & Channel Queuing (`SocketProvider.tsx`)

### The Ephemeral Push Problem
In Phoenix WebSocket channels, a client cannot push events to a topic until the channel join handshake has completed (receiving `phx_reply` with `status: "ok"`).
During initial page mount, route transitions, or network reconnections, components like `PresenceProvider` (`presence:update`) and `useLiveCursors` (`live:cursor`) frequently fire before the join reply arrives, while the channel is in state `'joining'`.
In standard implementations, this throws a noisy warning:
```
[WS] Cannot push to channel - not joined: org:<uuid>
```
and permanently drops the initial presence or cursor state.

### The In-Memory Queuing Solution
In `web/src/hooks/SocketProvider.tsx`:
1. **Queue on Joining**: `pendingPushesRef` (`Map<string, Array<{ event, payload }>>`) captures and buffers outgoing messages when `channel.state === 'joining'`.
2. **Flush on Join Ack**: When `reply.status === 'ok'`, `handleMessage` flushes all buffered pushes for that topic using the assigned `channel.joinRef`.
3. **Clean Teardown**: When leaving a channel (`leaveChannel`), any pending buffered pushes are cleanly deleted.
4. **Quiet on Drop**: Ephemeral presence and cursor updates for closed or unjoined topics are silently ignored instead of filling DevTools logs with redundant warnings.

---

## 10. Verification & Fast Deployment Runbook

### Fast In-Place Deployment (No Container Rebuild Needed)
Rather than executing slow `docker compose build` commands on every UI or Go change:

1. **Frontend Fast-Deploy (Vite Build + Nginx Reload)**:
   ```powershell
   # 1. Typecheck and build frontend dist
   pnpm --dir web typecheck
   pnpm --dir web build

   # 2. Copy built bundle into the live nginx container and reload
   docker cp web/dist/. warmbly-web-1:/usr/share/nginx/html/
   docker exec warmbly-web-1 nginx -s reload
   ```
   *Total turnaround time: ~40 seconds.*

2. **Backend Fast-Deploy (Cross-Compile + Container Restart)**:
   ```powershell
   # 1. Cross-compile Go for Linux amd64 from Windows
   $env:GOOS="linux"; $env:GOARCH="amd64"; $env:CGO_ENABLED="0"; go build -o ./bin/backend ./cmd/backend

   # 2. Copy binary into backend container and restart service
   docker cp ./bin/backend warmbly-backend-1:/app/backend
   docker restart warmbly-backend-1
   ```
   *Total turnaround time: ~10 seconds.*

### Standard CI & Build Verification
Always verify changes against the repo's quality gates:

1. **TypeScript Typecheck**:
   ```powershell
   pnpm --dir web typecheck
   pnpm --dir admin typecheck
   ```
2. **Go Formatting & Vet**:
   ```powershell
   gofmt -w internal/ cmd/
   gofmt -l internal/ cmd/  # Must output nothing!
   go vet ./internal/...
   ```
3. **Full Container Rebuild (When Dockerfile or dependencies change)**:
   ```powershell
   docker compose build --no-cache web backend
   docker compose up -d --force-recreate web backend
   ```
4. **Access the Application**:
   Open `http://localhost:28173` to test live interactions.
