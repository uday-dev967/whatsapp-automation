/**
 * Quick dispatch smoke test (requires API + MongoDB + OpenWA).
 * Usage: node scripts/test-dispatch.js dev
 */
const path = require("path");
const rootDir = path.join(__dirname, "..");

const env = process.argv[2] || "dev";
require("dotenv").config({ path: path.join(rootDir, `.env.${env}`) });

const PORT = process.env.PORT || 5051;
const BASE = `http://127.0.0.1:${PORT}/Automation/v1.0`;

// Valid 1x1 PNG
const TINY_IMAGE_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
	console.log("1. WhatsApp status...");
	const statusRes = await fetch(`${BASE}/whatsapp/connection-status`);
	const status = await statusRes.json();
	console.log(status);
	if (!status.ready) {
		console.error("WhatsApp not ready — run: npm run wa:server");
		process.exit(1);
	}

	console.log("2. Registered groups...");
	const groupsRes = await fetch(`${BASE}/registered-groups`);
	const groupsData = await groupsRes.json();
	const groups = groupsData.groups || [];
	console.log(`Found ${groups.length} group(s)`);
	if (!groups.length) {
		console.error("No registered groups — add one in ReportFlow UI");
		process.exit(1);
	}

	console.log("3. POST /screenshots/dispatch (manual, tiny image)...");
	const dispatchRes = await fetch(`${BASE}/screenshots/dispatch`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			imageBase64: TINY_IMAGE_BASE64,
			mimeType: "image/png",
			manual: true,
			caption: "ReportFlow dispatch test",
		}),
		signal: AbortSignal.timeout(180_000),
	});
	const dispatch = await dispatchRes.json();
	console.log(dispatchRes.status, dispatch);

	if (!dispatch.ok) {
		process.exit(1);
	}
	console.log(`Sent to ${dispatch.result?.sent ?? 0} group(s)`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
