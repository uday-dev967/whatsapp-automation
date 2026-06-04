# Screenshot dispatch — frontend integration

This API no longer sends images from a MongoDB photo library. **Your frontend application** captures screenshots on a timer and uploads them to the backend, which forwards them to WhatsApp groups configured in **screenshot dispatch schedules**.

## Architecture

```text
┌─────────────────────┐     POST /screenshots/dispatch      ┌──────────────────┐
│  Frontend app       │  (multipart image or imageBase64)  │  Express API     │
│  • capture screen   │ ─────────────────────────────────► │  port 5051       │
│  • timer per cron   │                                    │  Scheduler svc   │
└─────────────────────┘                                    └────────┬─────────┘
                                                                      │
                                                                      ▼
                                                             ┌──────────────────┐
                                                             │  OpenWA          │
                                                             │  WhatsApp groups │
                                                             └──────────────────┘
```

| Role | Responsibility |
|------|----------------|
| **Backend** | Stores target groups + schedules; sends screenshot bytes to WhatsApp when asked |
| **Backend** | `node-cron` per running schedule; emits `screenshot:capture` on Socket.IO |
| **Frontend** | Listens on Socket.IO, captures screenshot, `POST /screenshots/dispatch` (multipart) |

The `cron` field on a schedule is the **interval hint for the frontend** (e.g. `*/5 * * * *` = every 5 minutes). The server does **not** take screenshots itself.

---

## Setup flow

### 1. Start services

```sh
npm run wa:server   # Terminal 1 — WhatsApp login
npm run dev         # Terminal 2 — API
```

### 2. Register a WhatsApp target group

```http
POST /Automation/v1.0/target-groups
Content-Type: application/json

{
  "name": "Marketing Team",
  "chatId": "120363123456789012@g.us"
}
```

Get `chatId` from `GET /whatsapp/available-groups` if needed.

### 3. Create a screenshot dispatch schedule

```http
POST /Automation/v1.0/screenshot-dispatch-schedules
Content-Type: application/json

{
  "name": "Dashboard every 5 min",
  "groupId": "<target-group-_id>",
  "cron": "*/5 * * * *",
  "timezone": "Asia/Kolkata",
  "caption": "Live dashboard snapshot",
  "start": true
}
```

`start: true` sets `isRunning: true` so this schedule receives dispatches.

### 4. Frontend: load active schedules

```http
GET /Automation/v1.0/screenshot-dispatch-schedules?running=true
```

Activate schedules with `POST .../activate` (backend registers `node-cron`). Keep ReportFlow UI open so Socket.IO can trigger capture.

### 5. Frontend: capture and dispatch on each tick

**Option A — multipart (recommended)**

```http
POST /Automation/v1.0/screenshots/dispatch
Content-Type: multipart/form-data

image: <file>                    (required)
scheduleId: <schedule-_id>      (optional — send only to this schedule’s group)
groupId: <target-group-_id>    (optional — all running schedules for this group)
caption: Override caption       (optional)
```

**Option B — JSON base64**

```http
POST /Automation/v1.0/screenshots/dispatch
Content-Type: application/json

{
  "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
  "scheduleId": "674a1b2c3d4e5f6789012350",
  "caption": "Optional override"
}
```

### Dispatch targeting

| Body fields | Sends to |
|-------------|----------|
| `scheduleId` only | That schedule’s group (must be `isRunning: true`) |
| `groupId` only | All **running** schedules for that group (one message per unique `chatId`) |
| Neither | All **running** schedules (deduped by `chatId`) |

---

## Example: browser frontend (pseudo-code)

```javascript
const API = "http://localhost:5051/Automation/v1.0";

async function loadRunningSchedules() {
  const res = await fetch(`${API}/screenshot-dispatch-schedules?running=true`);
  const { schedules } = await res.json();
  return schedules;
}

async function captureScreenshotBlob() {
  // Use html2canvas, Electron desktopCapturer, Playwright, etc.
  const canvas = await html2canvas(document.body);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  return blob;
}

async function dispatchScreenshot(scheduleId, blob, caption) {
  const form = new FormData();
  form.append("image", blob, "screenshot.png");
  form.append("scheduleId", scheduleId);
  if (caption) form.append("caption", caption);

  const res = await fetch(`${API}/screenshots/dispatch`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

// Per schedule: parse cron and dispatch on interval (use cron-parser library)
const schedules = await loadRunningSchedules();
for (const schedule of schedules) {
  const ms = cronExpressionToMs(schedule.cron); // your helper
  setInterval(async () => {
    const blob = await captureScreenshotBlob();
    await dispatchScreenshot(schedule._id, blob, schedule.caption);
  }, ms);
}
```

---

## Schedule management APIs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/screenshot-dispatch-schedules` | List schedules (`?running=true`, `?groupId=`) |
| `POST` | `/screenshot-dispatch-schedules` | Create schedule |
| `POST` | `/screenshot-dispatch-schedules/:id/activate` | Enable (frontend should dispatch) |
| `POST` | `/screenshot-dispatch-schedules/:id/deactivate` | Disable |
| `POST` | `/target-groups/:groupId/activate-schedules` | Enable all for group |
| `POST` | `/target-groups/:groupId/deactivate-schedules` | Disable all for group |
| `DELETE` | `/screenshot-dispatch-schedules` | Delete by `scheduleIds` or `groupId` |

---

## Response example — dispatch

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "sent": 1,
    "results": [
      {
        "ok": true,
        "scheduleId": "674a1b2c3d4e5f6789012350",
        "scheduleName": "Dashboard every 5 min",
        "groupId": "674a1b2c3d4e5f678901234a",
        "groupName": "Marketing Team",
        "chatId": "120363123456789012@g.us"
      }
    ]
  }
}
```

---

## Removed (no longer used)

- `GET /photo-library`
- MongoDB `Photo` collection / `photoIds` on schedules
- Server-side cron auto-send from DB images
- `POST /photo-dispatch-schedules/.../dispatch-now` (legacy name) → use `POST /screenshot-dispatch-schedules/:id/dispatch-now` (socket trigger) + `POST /screenshots/dispatch` (actual send with image)

---

## Related docs

- [API.md](./API.md) — full REST reference (being updated for screenshot paths)
- [OPENWA.md](./OPENWA.md) — WhatsApp connection
