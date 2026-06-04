# WhatsApp Photo Automation — API Reference

All automation endpoints live under the **Automation** controller with API version **v1.0**.

## Base URL

```
http://localhost:5051/Automation/v1.0
```

Default port comes from `PORT` in `.env.dev` (5051). Replace the host/port if yours differs.

## Prerequisites

Before calling automation endpoints:

1. **Terminal 1** — `npm run wa:server` — log in to WhatsApp and leave running.
2. **Terminal 2** — `npm run dev` — Express API must show `Connected to OpenWA server`.
3. **MongoDB** — photos and target groups must exist in the database (insert photos directly in MongoDB; there is no seed API).

Check connectivity:

```http
GET /Automation/v1.0/whatsapp/connection-status
```

`ready: true` means the API can send messages.

## Conventions

| Item | Detail |
|------|--------|
| Content-Type | `application/json` for `POST` bodies |
| Success flag | Most responses include `"ok": true` or `"ok": false` |
| IDs | MongoDB ObjectIds as strings (24 hex characters) |
| `chatId` | WhatsApp group id, usually ends with `@g.us` |

### Typical workflow

```text
1. GET  /whatsapp/connection-status     → confirm WhatsApp is ready
2. GET  /photo-library                  → list photo _ids
3. GET  /whatsapp/available-groups       → discover chatId on WhatsApp (not yet registered)
4. GET  /registered-groups              → list groups saved in MongoDB
5. POST /target-groups                   → register a new group
6. POST /photo-dispatch-schedules        → create schedule (optional start: true)
7. POST /photo-dispatch-schedules/:id/activate   → start automatic sends
8. POST /photo-dispatch-schedules/:id/deactivate   → stop automatic sends
9. POST /photo-dispatch-schedules/:id/dispatch-now → send once immediately
```

One **target group** can have many **photo dispatch schedules** (different photos, cron, or timing).

---

## Example IDs (used below)

These sample ObjectIds are consistent across all examples. Replace with values from your database.

| Label | Example `_id` |
|-------|----------------|
| Photo — Promo 1 | `674a1b2c3d4e5f6789012345` |
| Photo — Promo 2 | `674a1b2c3d4e5f6789012346` |
| Photo — Banner | `674a1b2c3d4e5f6789012347` |
| Target group — Marketing | `674a1b2c3d4e5f678901234a` |
| Target group — Sales | `674a1b2c3d4e5f678901234b` |
| Schedule — Every 5 min | `674a1b2c3d4e5f6789012350` |
| Schedule — Daily 9 AM | `674a1b2c3d4e5f6789012351` |
| WhatsApp `chatId` | `120363123456789012@g.us` |

---

## End-to-end example (copy-paste flow)

### Step 1 — Check WhatsApp

**Request**

```http
GET http://localhost:5051/Automation/v1.0/whatsapp/connection-status
```

**Response**

```json
{
  "ok": true,
  "ready": true,
  "mode": "remote",
  "serverUrl": "http://localhost:8002",
  "hint": "WhatsApp is connected"
}
```

### Step 2 — List photos

**Request**

```http
GET http://localhost:5051/Automation/v1.0/photo-library
```

**Response**

```json
{
  "ok": true,
  "photos": [
    {
      "_id": "674a1b2c3d4e5f6789012345",
      "title": "Promo 1",
      "url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
      "caption": "Today's special — 20% off!",
      "isActive": true,
      "createdAt": "2026-05-29T08:00:00.000Z",
      "updatedAt": "2026-05-29T08:00:00.000Z"
    },
    {
      "_id": "674a1b2c3d4e5f6789012346",
      "title": "Promo 2",
      "url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
      "caption": "New menu items inside",
      "isActive": true,
      "createdAt": "2026-05-29T08:05:00.000Z",
      "updatedAt": "2026-05-29T08:05:00.000Z"
    }
  ]
}
```

### Step 3 — Discover groups on WhatsApp (optional)

**Request**

```http
GET http://localhost:5051/Automation/v1.0/whatsapp/available-groups
```

**Response**

```json
{
  "ok": true,
  "count": 2,
  "groups": [
    {
      "id": "120363123456789012@g.us",
      "name": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "participantCount": 42
    },
    {
      "id": "120363987654321098@g.us",
      "name": "Sales Alerts",
      "chatId": "120363987654321098@g.us",
      "participantCount": 18
    }
  ]
}
```

### Step 4 — Register target group

**Request**

```http
POST http://localhost:5051/Automation/v1.0/target-groups
Content-Type: application/json
```

**Request body**

```json
{
  "name": "Marketing Team",
  "chatId": "120363123456789012@g.us",
  "photoIds": [],
  "isActive": true
}
```

**Response `201`**

```json
{
  "ok": true,
  "group": {
    "_id": "674a1b2c3d4e5f678901234a",
    "name": "Marketing Team",
    "chatId": "120363123456789012@g.us",
    "photos": [],
    "isActive": true,
    "createdAt": "2026-05-29T09:00:00.000Z",
    "updatedAt": "2026-05-29T09:00:00.000Z",
    "__v": 0
  }
}
```

### Step 5 — Create schedule (auto-start)

**Request**

```http
POST http://localhost:5051/Automation/v1.0/photo-dispatch-schedules
Content-Type: application/json
```

**Request body**

```json
{
  "name": "Every 5 min — promo set A",
  "groupId": "674a1b2c3d4e5f678901234a",
  "photoIds": [
    "674a1b2c3d4e5f6789012345",
    "674a1b2c3d4e5f6789012346"
  ],
  "cron": "*/5 * * * *",
  "timezone": "Asia/Kolkata",
  "start": true,
  "isActive": true
}
```

**Response `201`**

```json
{
  "ok": true,
  "schedule": {
    "_id": "674a1b2c3d4e5f6789012350",
    "name": "Every 5 min — promo set A",
    "group": {
      "_id": "674a1b2c3d4e5f678901234a",
      "name": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "isActive": true
    },
    "photos": [
      {
        "_id": "674a1b2c3d4e5f6789012345",
        "title": "Promo 1",
        "url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
        "isActive": true
      },
      {
        "_id": "674a1b2c3d4e5f6789012346",
        "title": "Promo 2",
        "url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
        "isActive": true
      }
    ],
    "cron": "*/5 * * * *",
    "timezone": "Asia/Kolkata",
    "isRunning": true,
    "isActive": true,
    "createdAt": "2026-05-29T09:10:00.000Z",
    "updatedAt": "2026-05-29T09:10:00.000Z"
  },
  "activateResult": {
    "ok": true,
    "started": true,
    "scheduler": {
      "id": "674a1b2c3d4e5f6789012350",
      "name": "Every 5 min — promo set A",
      "groupId": "674a1b2c3d4e5f678901234a",
      "groupName": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "photoIds": [
        "674a1b2c3d4e5f6789012345",
        "674a1b2c3d4e5f6789012346"
      ],
      "cron": "*/5 * * * *",
      "timezone": "Asia/Kolkata",
      "isRunning": true,
      "isActive": true
    }
  }
}
```

### Step 6 — Second schedule on same group (different photos & cron)

**Request body**

```json
{
  "name": "Daily 9 AM — banner only",
  "groupId": "674a1b2c3d4e5f678901234a",
  "photoIds": ["674a1b2c3d4e5f6789012347"],
  "cron": "0 9 * * *",
  "timezone": "Asia/Kolkata",
  "start": false,
  "isActive": true
}
```

Then activate manually:

```http
POST http://localhost:5051/Automation/v1.0/photo-dispatch-schedules/674a1b2c3d4e5f6789012351/activate
```

### Step 7 — Stop one schedule only

**Request**

```http
POST http://localhost:5051/Automation/v1.0/photo-dispatch-schedules/674a1b2c3d4e5f6789012350/deactivate
```

**Response**

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "stopped": true,
    "scheduler": {
      "id": "674a1b2c3d4e5f6789012350",
      "name": "Every 5 min — promo set A",
      "groupId": "674a1b2c3d4e5f678901234a",
      "groupName": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "photoIds": [
        "674a1b2c3d4e5f6789012345",
        "674a1b2c3d4e5f6789012346"
      ],
      "cron": "*/5 * * * *",
      "timezone": "Asia/Kolkata",
      "isRunning": false,
      "isActive": true
    }
  }
}
```

### Step 8 — Manual send (test without waiting for cron)

**Request**

```http
POST http://localhost:5051/Automation/v1.0/photo-dispatch-schedules/674a1b2c3d4e5f6789012350/dispatch-now
```

**Response**

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "sent": 2,
    "schedulerId": "674a1b2c3d4e5f6789012350",
    "schedulerName": "Every 5 min — promo set A"
  }
}
```

---

## Sample MongoDB documents (photos)

Photos are inserted directly in MongoDB (no upload API). Example documents for the `photos` collection:

```json
{
  "title": "Promo 1",
  "url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
  "caption": "Today's special — 20% off!",
  "isActive": true
}
```

```json
{
  "title": "Promo 2",
  "url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
  "caption": "New menu items inside",
  "isActive": true
}
```

---

## Photo library

Photos are stored in MongoDB. The API reads them; it does not upload files. Each photo needs a public `url` the server can fetch when sending to WhatsApp.

### List photos

```http
GET /Automation/v1.0/photo-library
```

**Response `200`**

```json
{
  "ok": true,
  "photos": [
    {
      "_id": "674a1b2c3d4e5f6789012345",
      "title": "Promo 1",
      "url": "https://example.com/image.jpg",
      "caption": "Optional caption sent with the image",
      "isActive": true,
      "createdAt": "2026-05-29T10:00:00.000Z",
      "updatedAt": "2026-05-29T10:00:00.000Z"
    }
  ]
}
```

Use `_id` values as `photoIds` when creating schedules. Only photos with `isActive: true` are sent.

---

## Target groups (registered in MongoDB)

A **target group** is a WhatsApp group you registered for automation (`name` + `chatId`). This is different from **available groups** on WhatsApp (`GET /whatsapp/available-groups`), which lists chats visible on the logged-in account but not yet saved in your database.

### List all registered groups

```http
GET /Automation/v1.0/registered-groups
```

Alias (same response):

```http
GET /Automation/v1.0/target-groups
```

**Response `200`**

```json
{
  "ok": true,
  "count": 2,
  "groups": [
    {
      "_id": "674a1b2c3d4e5f678901234a",
      "name": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "photos": [],
      "isActive": true,
      "scheduleCount": 2,
      "runningScheduleCount": 1,
      "createdAt": "2026-05-29T09:00:00.000Z",
      "updatedAt": "2026-05-29T09:00:00.000Z"
    },
    {
      "_id": "674a1b2c3d4e5f678901234b",
      "name": "Sales Alerts",
      "chatId": "120363987654321098@g.us",
      "photos": [],
      "isActive": true,
      "scheduleCount": 0,
      "runningScheduleCount": 0,
      "createdAt": "2026-05-29T09:05:00.000Z",
      "updatedAt": "2026-05-29T09:05:00.000Z"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `count` | Number of registered groups |
| `scheduleCount` | Photo dispatch schedules linked to this group |
| `runningScheduleCount` | Schedules currently active (`isRunning: true`) |

### Register a target group

```http
POST /Automation/v1.0/target-groups
Content-Type: application/json
```

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name for your reference |
| `chatId` | string | yes | WhatsApp group id (e.g. `...@g.us`) |
| `photoIds` | string[] | no | Optional default photos linked to the group |
| `isActive` | boolean | no | Default `true` |

**Example**

```json
{
  "name": "Marketing Team",
  "chatId": "120363123456789012@g.us",
  "photoIds": [],
  "isActive": true
}
```

**Response `201`**

```json
{
  "ok": true,
  "group": {
    "_id": "674a1b2c3d4e5f678901234a",
    "name": "Marketing Team",
    "chatId": "120363123456789012@g.us",
    "photos": [],
    "isActive": true,
    "createdAt": "2026-05-29T09:00:00.000Z",
    "updatedAt": "2026-05-29T09:00:00.000Z"
  }
}
```

**Request body — with optional linked photos**

```json
{
  "name": "Sales Alerts",
  "chatId": "120363987654321098@g.us",
  "photoIds": [
    "674a1b2c3d4e5f6789012345"
  ],
  "isActive": true
}
```

**Error response `400`**

```json
{
  "ok": false,
  "message": "name and chatId are required"
}
```

**Error response `400` (invalid photo ids)**

```json
{
  "ok": false,
  "message": "One or more photoIds do not exist in the photo library"
}
```

**Errors**

| Status | Cause |
|--------|--------|
| `400` | Missing `name` or `chatId`, or invalid `photoIds` |
| `500` | Server/database error (e.g. duplicate `chatId`) |

---

## WhatsApp

### Connection status

```http
GET /Automation/v1.0/whatsapp/connection-status
```

**Response `200`**

```json
{
  "ok": true,
  "ready": true,
  "mode": "remote",
  "serverUrl": "http://localhost:8002",
  "hint": "WhatsApp is connected"
}
```

When `ready` is `false`, start `npm run wa:server` and wait for the client to be ready, then restart or reload `npm run dev`.

**Response when not connected**

```json
{
  "ok": true,
  "ready": false,
  "mode": "remote",
  "serverUrl": "http://localhost:8002",
  "hint": "Terminal 1: npm run wa:server → wait for 'Client is ready'. Terminal 2: npm run dev (or nodemon rs)"
}
```

### Available groups (from WhatsApp account)

Lists groups visible to the logged-in WhatsApp session. Use this to find `chatId` when registering a target group.

```http
GET /Automation/v1.0/whatsapp/available-groups
```

**Response `200`**

```json
{
  "ok": true,
  "count": 2,
  "groups": [
    {
      "id": "120363123456789012@g.us",
      "name": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "participantCount": 42
    }
  ]
}
```

**Error response `503`**

```json
{
  "ok": false,
  "message": "WhatsApp client is not ready"
}
```

**Tip:** If `count` is `0`, open WhatsApp Web in the Chrome window from `wa:server`, click each group once, then call this endpoint again.

---

## Photo dispatch schedules

A **photo dispatch schedule** sends a specific set of photos to a target group on a **cron** expression. Each schedule has its own `scheduleId` for activate / deactivate / dispatch-now.

Schedules with `isRunning: true` are restored automatically when the API restarts.

### List schedules

```http
GET /Automation/v1.0/photo-dispatch-schedules
```

**Response `200`**

```json
{
  "ok": true,
  "schedules": [
    {
      "_id": "674a1b2c3d4e5f678901234b",
      "name": "Every 5 min — promo set A",
      "group": { "_id": "...", "name": "Marketing Team", "chatId": "120363...@g.us", "isActive": true },
      "photos": [{ "_id": "...", "title": "Promo 1", "url": "https://...", "isActive": true }],
      "cron": "*/5 * * * *",
      "timezone": "Asia/Kolkata",
      "isRunning": true,
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### Schedule engine status

Overview of all schedules and whether each cron job is registered in memory.

```http
GET /Automation/v1.0/photo-dispatch-schedules/status
```

**Response `200`**

```json
{
  "ok": true,
  "globalEnabled": true,
  "defaultCron": "*/5 * * * *",
  "defaultTimezone": "Asia/Kolkata",
  "schedulers": [
    {
      "id": "674a1b2c3d4e5f678901234b",
      "name": "Every 5 min — promo set A",
      "groupId": "674a1b2c3d4e5f678901234a",
      "groupName": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "photoIds": ["674a1b2c3d4e5f6789012345"],
      "cron": "*/5 * * * *",
      "timezone": "Asia/Kolkata",
      "isRunning": true,
      "isActive": true,
      "cronRegistered": true
    }
  ]
}
```

### Get one schedule

```http
GET /Automation/v1.0/photo-dispatch-schedules/:scheduleId
```

Example: `GET .../photo-dispatch-schedules/674a1b2c3d4e5f6789012350`

**Response `200`**

```json
{
  "ok": true,
  "schedule": {
    "_id": "674a1b2c3d4e5f6789012350",
    "name": "Every 5 min — promo set A",
    "group": {
      "_id": "674a1b2c3d4e5f678901234a",
      "name": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "isActive": true
    },
    "photos": [
      {
        "_id": "674a1b2c3d4e5f6789012345",
        "title": "Promo 1",
        "url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
        "isActive": true
      }
    ],
    "cron": "*/5 * * * *",
    "timezone": "Asia/Kolkata",
    "isRunning": true,
    "isActive": true,
    "createdAt": "2026-05-29T09:10:00.000Z",
    "updatedAt": "2026-05-29T09:10:00.000Z"
  }
}
```

**Error response `404`**

```json
{
  "ok": false,
  "message": "Photo dispatch schedule not found"
}
```

### Create a schedule

```http
POST /Automation/v1.0/photo-dispatch-schedules
Content-Type: application/json
```

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Label for this schedule |
| `groupId` | string | yes | Target group `_id` from `GET /target-groups` |
| `photoIds` | string[] | yes | At least one photo `_id` from `GET /photo-library` |
| `cron` | string | no | Cron expression; default from `CRON_SCHEDULE` env (`*/5 * * * *`) |
| `timezone` | string | no | Default `Asia/Kolkata` (or `CRON_TIMEZONE`) |
| `start` | boolean | no | If `true`, activates immediately after create |
| `isActive` | boolean | no | Default `true`; inactive schedules cannot be activated |

**Example**

```json
{
  "name": "Every 5 min — promo set A",
  "groupId": "674a1b2c3d4e5f678901234a",
  "photoIds": [
    "674a1b2c3d4e5f6789012345",
    "674a1b2c3d4e5f6789012346"
  ],
  "cron": "*/5 * * * *",
  "timezone": "Asia/Kolkata",
  "start": true
}
```

**Response `201` (with `start: true`)** — see [Step 5](#step-5--create-schedule-auto-start) in the end-to-end example for the full payload.

**Response `201` (with `start: false`)**

```json
{
  "ok": true,
  "schedule": {
    "_id": "674a1b2c3d4e5f6789012351",
    "name": "Daily 9 AM — banner only",
    "group": {
      "_id": "674a1b2c3d4e5f678901234a",
      "name": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "isActive": true
    },
    "photos": [
      {
        "_id": "674a1b2c3d4e5f6789012347",
        "title": "Banner",
        "url": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800",
        "isActive": true
      }
    ],
    "cron": "0 9 * * *",
    "timezone": "Asia/Kolkata",
    "isRunning": false,
    "isActive": true,
    "createdAt": "2026-05-29T09:15:00.000Z",
    "updatedAt": "2026-05-29T09:15:00.000Z"
  },
  "activateResult": null
}
```

If `start` is `false`, call **activate** before automatic sends run.

**Error response `400`**

```json
{
  "ok": false,
  "message": "photoIds must include at least one photo from the photo library"
}
```

**Error response `404`**

```json
{
  "ok": false,
  "message": "Target group not found"
}
```

**Cron examples**

| Expression | Meaning |
|------------|---------|
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour at minute 0 |
| `0 9 * * *` | Every day at 09:00 |
| `0 9 * * 1-5` | Weekdays at 09:00 |

**Errors**

| Status | Cause |
|--------|--------|
| `400` | Missing `name`/`groupId`, empty `photoIds`, or invalid photo ids |
| `404` | Target group not found |

### Activate a schedule (start automatic sends)

Starts the cron job for **this schedule only**. Other schedules are unaffected.

```http
POST /Automation/v1.0/photo-dispatch-schedules/:scheduleId/activate
```

No request body. Example URL:

```http
POST http://localhost:5051/Automation/v1.0/photo-dispatch-schedules/674a1b2c3d4e5f6789012351/activate
```

**Response `200`**

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "started": true,
    "scheduler": {
      "id": "674a1b2c3d4e5f678901234b",
      "name": "Every 5 min — promo set A",
      "groupId": "...",
      "groupName": "Marketing Team",
      "chatId": "120363123456789012@g.us",
      "photoIds": ["..."],
      "cron": "*/5 * * * *",
      "timezone": "Asia/Kolkata",
      "isRunning": true,
      "isActive": true
    }
  }
}
```

**Error response `404`**

```json
{
  "ok": false,
  "reason": "scheduler_not_found"
}
```

**Error response `400`**

```json
{
  "ok": false,
  "reason": "group_inactive",
  "message": "Group is inactive (isActive: false)"
}
```

### Deactivate a schedule (stop automatic sends)

Stops the cron for **this schedule only**. Does not delete the schedule from the database.

```http
POST /Automation/v1.0/photo-dispatch-schedules/:scheduleId/deactivate
```

**Response `200`** — see [Step 7](#step-7--stop-one-schedule-only) in the end-to-end example.

**Error response `404`**

```json
{
  "ok": false,
  "reason": "scheduler_not_found"
}
```

### Dispatch now (manual one-time send)

Sends all active photos on this schedule to the target group **immediately**, regardless of `isRunning`. Useful for testing.

```http
POST /Automation/v1.0/photo-dispatch-schedules/:scheduleId/dispatch-now
```

**Response `200`**

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "sent": 2,
    "schedulerId": "674a1b2c3d4e5f678901234b",
    "schedulerName": "Every 5 min — promo set A"
  }
}
```

**Error response `503`**

```json
{
  "ok": false,
  "result": {
    "ok": false,
    "reason": "whatsapp_not_ready"
  }
}
```

---

## Bulk schedule operations (by target group)

### Activate all schedules for a group

Starts every photo dispatch schedule linked to the target group.

```http
POST /Automation/v1.0/target-groups/:groupId/activate-schedules
```

Example:

```http
POST http://localhost:5051/Automation/v1.0/target-groups/674a1b2c3d4e5f678901234a/activate-schedules
```

**Response `200`**

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "groupId": "674a1b2c3d4e5f678901234a",
    "groupName": "Marketing Team",
    "total": 2,
    "activated": 2,
    "failed": 0,
    "results": [
      {
        "scheduleId": "674a1b2c3d4e5f6789012350",
        "name": "Every 5 min — promo set A",
        "ok": true,
        "started": true,
        "scheduler": { "id": "674a1b2c3d4e5f6789012350", "isRunning": true }
      },
      {
        "scheduleId": "674a1b2c3d4e5f6789012351",
        "name": "Daily 9 AM — banner only",
        "ok": true,
        "started": true,
        "scheduler": { "id": "674a1b2c3d4e5f6789012351", "isRunning": true }
      }
    ]
  }
}
```

If a schedule cannot start (e.g. no active photos), it appears in `results` with `ok: false` and a `reason`; other schedules still run.

### Deactivate all schedules for a group

Stops automatic sends for every schedule on that group.

```http
POST /Automation/v1.0/target-groups/:groupId/deactivate-schedules
```

Example:

```http
POST http://localhost:5051/Automation/v1.0/target-groups/674a1b2c3d4e5f678901234a/deactivate-schedules
```

**Response `200`**

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "groupId": "674a1b2c3d4e5f678901234a",
    "groupName": "Marketing Team",
    "total": 2,
    "deactivated": 2,
    "results": [
      {
        "scheduleId": "674a1b2c3d4e5f6789012350",
        "name": "Every 5 min — promo set A",
        "ok": true,
        "stopped": true,
        "scheduler": { "id": "674a1b2c3d4e5f6789012350", "isRunning": false }
      }
    ]
  }
}
```

**Error `404`**

```json
{
  "ok": false,
  "reason": "group_not_found"
}
```

---

## Delete photo dispatch schedules

Permanently removes schedules from MongoDB and stops any running cron jobs. Provide **either** `scheduleIds` **or** `groupId` in the body — not both.

```http
DELETE /Automation/v1.0/photo-dispatch-schedules
Content-Type: application/json
```

### Delete by schedule id list

**Request body**

```json
{
  "scheduleIds": [
    "674a1b2c3d4e5f6789012350",
    "674a1b2c3d4e5f6789012351"
  ]
}
```

**Response `200`**

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "deletedCount": 2,
    "deleted": [
      {
        "scheduleId": "674a1b2c3d4e5f6789012350",
        "name": "Every 5 min — promo set A",
        "groupId": "674a1b2c3d4e5f678901234a"
      },
      {
        "scheduleId": "674a1b2c3d4e5f6789012351",
        "name": "Daily 9 AM — banner only",
        "groupId": "674a1b2c3d4e5f678901234a"
      }
    ]
  }
}
```

### Delete all schedules for a group

**Request body**

```json
{
  "groupId": "674a1b2c3d4e5f678901234a"
}
```

**Response `200`**

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "deletedCount": 2,
    "deleted": [
      {
        "scheduleId": "674a1b2c3d4e5f6789012350",
        "name": "Every 5 min — promo set A",
        "groupId": "674a1b2c3d4e5f678901234a"
      }
    ]
  }
}
```

**Error `400` (must send exactly one filter)**

```json
{
  "ok": false,
  "reason": "invalid_delete_filter",
  "message": "Provide exactly one of scheduleIds (array) or groupId in the request body"
}
```

---

## Quick reference — request bodies only

| Endpoint | Request body |
|----------|----------------|
| `POST /target-groups` | `{"name":"Marketing Team","chatId":"120363123456789012@g.us","photoIds":[],"isActive":true}` |
| `POST /target-groups/:groupId/activate-schedules` | *(no body)* |
| `POST /target-groups/:groupId/deactivate-schedules` | *(no body)* |
| `POST /photo-dispatch-schedules` | `{"name":"Every 5 min — promo set A","groupId":"674a1b2c3d4e5f678901234a","photoIds":["674a1b2c3d4e5f6789012345"],"cron":"*/5 * * * *","start":true}` |
| `DELETE /photo-dispatch-schedules` | `{"scheduleIds":["674a1b2c3d4e5f6789012350"]}` or `{"groupId":"674a1b2c3d4e5f678901234a"}` |
| `POST .../activate` | *(no body)* |
| `POST .../deactivate` | *(no body)* |
| `POST .../dispatch-now` | *(no body)* |

---

## Data models (MongoDB)

### Photo

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Required |
| `url` | string | Required, unique, publicly reachable image URL |
| `caption` | string | Sent as WhatsApp image caption (falls back to `title`) |
| `isActive` | boolean | Inactive photos are skipped |

### Target group (`WhatsAppGroup`)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Required |
| `chatId` | string | Required, unique WhatsApp group id |
| `photos` | ObjectId[] | Optional legacy link to photos |
| `isActive` | boolean | Inactive groups block schedule activation |

### Photo dispatch schedule (`PhotoScheduler`)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Required label |
| `group` | ObjectId | Ref to target group |
| `photos` | ObjectId[] | Photos to send each run |
| `cron` | string | Required cron expression |
| `timezone` | string | Cron timezone |
| `isRunning` | boolean | `true` when cron is active |
| `isActive` | boolean | Soft-disable without deleting |

---

## Environment variables (scheduling)

| Variable | Default | Description |
|----------|---------|-------------|
| `SCHEDULER_ENABLED` | `true` | Set `false` to disable all cron registration |
| `CRON_SCHEDULE` | `*/5 * * * *` | Default cron when creating a schedule |
| `CRON_TIMEZONE` | `Asia/Kolkata` | Default timezone for new schedules |
| `WA_SERVER_URL` | `http://localhost:8002` | OpenWA server for sending |
| `WA_API_KEY` | `dev-api-key` | Must match `wa:server` |

---

## Other endpoints

### Health check (Public controller)

```http
GET /Public/v1.0/test
```

**Response `200`**

```json
{ "ok": true, "message": "hello world" }
```

---

## cURL examples (with payloads)

**Register target group**

```bash
curl -X POST "http://localhost:5051/Automation/v1.0/target-groups" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Marketing Team\",\"chatId\":\"120363123456789012@g.us\",\"photoIds\":[],\"isActive\":true}"
```

**Create and start a schedule**

```bash
curl -X POST "http://localhost:5051/Automation/v1.0/photo-dispatch-schedules" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Every 5 min — promo set A\",\"groupId\":\"674a1b2c3d4e5f678901234a\",\"photoIds\":[\"674a1b2c3d4e5f6789012345\",\"674a1b2c3d4e5f6789012346\"],\"cron\":\"*/5 * * * *\",\"timezone\":\"Asia/Kolkata\",\"start\":true}"
```

**Deactivate all schedules for a group**

```bash
curl -X POST "http://localhost:5051/Automation/v1.0/target-groups/674a1b2c3d4e5f678901234a/deactivate-schedules"
```

**Delete schedules by ids**

```bash
curl -X DELETE "http://localhost:5051/Automation/v1.0/photo-dispatch-schedules" \
  -H "Content-Type: application/json" \
  -d "{\"scheduleIds\":[\"674a1b2c3d4e5f6789012350\",\"674a1b2c3d4e5f6789012351\"]}"
```

**Delete all schedules for a group**

```bash
curl -X DELETE "http://localhost:5051/Automation/v1.0/photo-dispatch-schedules" \
  -H "Content-Type: application/json" \
  -d "{\"groupId\":\"674a1b2c3d4e5f678901234a\"}"
```

**Dispatch now (one schedule)**

```bash
curl -X POST "http://localhost:5051/Automation/v1.0/photo-dispatch-schedules/674a1b2c3d4e5f6789012350/dispatch-now"
```

---

## Related docs

- [README.md](../README.md) — setup, two-terminal workflow, troubleshooting
- [OPENWA.md](./OPENWA.md) — OpenWA integration, ports 8002 vs 5051, step-by-step
- [index.md](./index.md) — Grogu.js controller conventions
