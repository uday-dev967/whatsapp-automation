# WhatsApp Screenshot Automation

Node.js backend that sends **frontend screenshots** to WhatsApp groups on configurable intervals. Target groups and schedules live in MongoDB; images are **not** stored in a photo collection.

## Stack

- **Express** — REST API (port 5051)
- **MongoDB + Mongoose** — target groups and screenshot dispatch schedules
- **[@open-wa/wa-automate](https://docs.openwa.dev/)** — WhatsApp (standalone server, port 8002)
- **Frontend** — captures screenshots on a timer and `POST`s them to the API

## Architecture

```text
Terminal 1:  npm run wa:server   →  OpenWA + WhatsApp (port 8002)
Terminal 2:  npm run dev         →  Express API (port 5051)
Frontend:    capture screenshot  →  POST /screenshots/dispatch
```

**OpenWA integration:** [docs/OPENWA.md](./docs/OPENWA.md)  
**Frontend screenshot flow:** [docs/SCREENSHOT.md](./docs/SCREENSHOT.md)  
**API reference:** [docs/API.md](./docs/API.md)

## Quick start

### 1. Install

```sh
npm install
```

### 2. Configure `.env.dev`

```env
WA_SERVER_URL=http://localhost:8002
WA_API_KEY=dev-api-key
PORT=5051
```

### 3. Terminal 1 — WhatsApp

```sh
npm run wa:server
```

Scan QR, wait until connected. Leave running.

### 4. Terminal 2 — API

```sh
npm run dev
```

### 5. Register group + schedule

```http
POST /Automation/v1.0/target-groups
{ "name": "My Group", "chatId": "120363...@g.us" }

POST /Automation/v1.0/screenshot-dispatch-schedules
{
  "name": "Every 5 min",
  "groupId": "<group-_id>",
  "cron": "*/5 * * * *",
  "start": true
}
```

### 6. Frontend dispatches screenshots

On each interval, capture the screen and:

```http
POST /Automation/v1.0/screenshots/dispatch
Content-Type: multipart/form-data

image: <screenshot file>
scheduleId: <schedule-_id>
```

See [docs/SCREENSHOT.md](./docs/SCREENSHOT.md) for full frontend examples.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run wa:server` | OpenWA + WhatsApp session |
| `npm run dev` | Express API |
| `npm run wa:clean` | Clear WhatsApp session files |

## Data model

**WhatsAppGroup** — `name`, `chatId`, `isActive`

**PhotoScheduler** (screenshot dispatch schedule) — `name`, `group`, `cron`, `timezone`, `caption`, `isRunning`, `isActive`

`isRunning: true` means the frontend should include this schedule when dispatching. `cron` is the interval the frontend should use.
