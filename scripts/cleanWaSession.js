const fs = require("fs");
const path = require("path");

const sessionId = process.env.WA_SESSION_ID || "whatsapp-automation-poc";
const projectRoot = path.join(__dirname, "..");
const ignoreDir = path.join(projectRoot, `_IGNORE_${sessionId}`);
const dataFile = path.join(projectRoot, `${sessionId}.data.json`);

for (const target of [ignoreDir, dataFile]) {
	if (fs.existsSync(target)) {
		fs.rmSync(target, { recursive: true, force: true });
		console.log(`Removed: ${target}`);
	}
}

console.log("WhatsApp session data cleared. Restart npm run dev and scan QR again.");
