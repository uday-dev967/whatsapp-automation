# WhatsApp Photo Automation (POC)

Node.js backend that sends photos to multiple WhatsApp groups on a schedule. Image URLs are stored in MongoDB (no S3 in this POC).

## Stack

- **Express** — API (Grogu.js boilerplate)
- **MongoDB + Mongoose** — photos and group configuration
- **[@open-wa/wa-automate](https://docs.openwa.dev/)** — WhatsApp Web (standalone server + socket client)
- **node-cron** — scheduled send job

## Architecture (recommended)

WhatsApp runs in a **separate process** on **port 8002** so `nodemon` restarts on **port 5051** do not kill your session:

```text
Terminal 1:  npm run wa:server   →  OpenWA + QR login (port 8002 — keep running)
Terminal 2:  npm run dev         →  Express API only (port 5051)
```

**How OpenWA is integrated and why two ports:** see **[docs/OPENWA.md](./docs/OPENWA.md)**.

## Quick start

### 1. Install

```sh
npm install
```

### 2. Configure `.env.dev`

Copy from `.sample.env`. Minimum:

```env
WA_SERVER_URL=http://localhost:8002
WA_API_KEY=dev-api-key
```

### 3. Terminal 1 — connect WhatsApp (OpenWA only)

```sh
npm run wa:server
```

- A Chrome window opens with WhatsApp Web.
- Scan the QR in the **terminal** or Chrome window (first time only).
- Wait until you see the session is ready / connected.
- **Leave this terminal running** — do not use nodemon here.
- QR wait is **unlimited** (`qrTimeout: 0` in `wa/cli.config.json`). Take your time scanning.

### 4. Terminal 2 — start the API

```sh
npm run dev
```

You should see: `Connected to OpenWA server — WhatsApp ready for API requests`

### 5. Configure groups, schedules, and test send

1. `GET http://localhost:5051/Automation/v1.0/whatsapp/available-groups`
2. `GET http://localhost:5051/Automation/v1.0/photo-library`
3. `GET http://localhost:5051/Automation/v1.0/registered-groups` — or `POST .../target-groups` to add one (`name`, `chatId`)
4. `POST http://localhost:5051/Automation/v1.0/photo-dispatch-schedules` — one or more schedules per group (see below)
5. `POST http://localhost:5051/Automation/v1.0/photo-dispatch-schedules/:scheduleId/activate`

### Photo dispatch schedules (multiple per group)

A **photo dispatch schedule** sends a chosen set of photos to a target group on a cron. One group can have many schedules. Control each schedule by **`scheduleId`** (MongoDB `_id`).

**Create a schedule**

```http
POST http://localhost:5051/Automation/v1.0/photo-dispatch-schedules
Content-Type: application/json

{
  "name": "Every 5 min — promo set A",
  "groupId": "<target-group-_id>",
  "photoIds": ["<photo-_id>", "<photo-_id>"],
  "cron": "*/5 * * * *",
  "start": true
}
```

### API documentation

Full reference with request bodies, examples, and error codes: **[docs/API.md](./docs/API.md)**

Bulk operations: `POST /target-groups/:groupId/activate-schedules`, `POST .../deactivate-schedules`, `DELETE /photo-dispatch-schedules` (by `scheduleIds` or `groupId`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run wa:server` | **OpenWA only** — login & keep session alive |
| `npm run dev` | Express API (connects to OpenWA server) |
| `npm run wa:clean` | Delete saved WhatsApp session files |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `WA_SERVER_URL` | `http://localhost:8002` | OpenWA socket server URL |
| `WA_API_KEY` | `dev-api-key` | Must match `wa:server` |
| `WA_SERVER_PORT` | `8002` | Port for `wa:server` |
| `CRON_SCHEDULE` | `*/5 * * * *` | Default cron when creating a scheduler (can override per scheduler) |

## Troubleshooting

**QR loop / restart after scan**  
You were running WhatsApp inside `npm run dev`. Use two terminals: `wa:server` first, then `dev`.

**API says "Could not connect to OpenWA server"**  
Start `npm run wa:server` and wait until WhatsApp is logged in.

**"Chrome 85+" error in browser**  
Run `npm run wa:clean`, then `npm run wa:server` again.

## Data model

**Photo** — `title`, `url`, `caption`, `isActive`

**WhatsAppGroup** — `name`, `chatId` (`...@g.us`), `photos[]`, `isActive`

**PhotoScheduler** (photo dispatch schedule) — `name`, `group`, `photos[]`, `cron`, `timezone`, `isRunning`, `isActive`
