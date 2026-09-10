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
* Pipeline management: צינורות מכירה, שלבים מותאמים אישית, ממוצע שלבים, יצירה/עריכה/מחיקה, ספירת עסקאות.
* Kanban board: עסקאות, כרטיסי עסקאות, גרירה בין שלבים, סטטוסים ("פתוח", "מוסמך", "נסגר בהצלחה", "אבוד").

---

## 6. Docker Update-Proof Architecture (Preventing Overwrites)

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

---

## 7. Verification & Developer Runbook

Always verify changes using the fast feedback loop:

1. **TypeScript Typecheck**:
   ```powershell
   pnpm --filter web typecheck
   ```
2. **Rebuild & Deploy Web Container**:
   ```powershell
   docker compose build --no-cache web
   docker compose up -d --force-recreate web
   ```
3. **Access the Application**:
   Open `http://localhost:28173` to test live interactions.
