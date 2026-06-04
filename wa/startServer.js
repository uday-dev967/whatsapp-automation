/**

 * Standalone OpenWA EASY API + socket server.

 * Run this in its own terminal (no nodemon): npm run wa:server

 */

const fs = require("fs");

const path = require("path");

const { spawn } = require("child_process");

const { resolveChromeExecutablePath } = require("../utils/chromePath");

const { applyWhatsappUserAgent } = require("../utils/whatsappUserAgent");



const projectRoot = path.join(__dirname, "..");

const envFile = process.argv[2] ? `.env.${process.argv[2]}` : ".env.dev";

const envPath = path.join(projectRoot, envFile);

const cliConfigPath = path.join(__dirname, "cli.config.json");



if (!fs.existsSync(envPath)) {

	console.error(`Environment file not found: ${envPath}`);

	process.exit(1);

}



require("dotenv").config({ path: envPath });



const chromePath = process.env.WA_CHROME_PATH || resolveChromeExecutablePath();

if (!chromePath) {

	console.error("Google Chrome not found. Install Chrome or set WA_CHROME_PATH.");

	process.exit(1);

}



const sessionId = process.env.WA_SESSION_ID || "whatsapp-automation-poc";

const port = process.env.WA_SERVER_PORT || "8002";

const apiKey = process.env.WA_API_KEY || "dev-api-key";



// Patch user-agent before OpenWA starts

applyWhatsappUserAgent({

	customUserAgent: process.env.WA_CUSTOM_USER_AGENT,

	chromeExecutablePath: chromePath,

});



// Do NOT set WA_QR_TIMEOUT=0 in env — OpenWA parses "0" as a string and still times out at 60s.

// qrTimeout: 0 (number) in wa/cli.config.json means wait indefinitely for QR scan.

const waEnv = {

	...process.env,

	WA_SESSION_ID: sessionId,

	WA_USE_CHROME: "true",

	WA_EXECUTABLE_PATH: chromePath,

	WA_HEADLESS: "false",

};



const serverBin = require.resolve("@open-wa/wa-automate/bin/server.js");

const args = [

	serverBin,

	"--socket",

	"-p",

	port,

	"-k",

	apiKey,

	"--headful",

	"--keep-alive",

	"-c",

	cliConfigPath,

];



console.log("Starting OpenWA server (scan QR here once)...");

console.log(`  URL:      http://localhost:${port}`);

console.log(`  Session:  ${sessionId}`);

console.log(`  Chrome:   ${chromePath}`);

console.log(`  QR wait:  unlimited (qrTimeout: 0 in wa/cli.config.json)`);

console.log("Keep this terminal open. Start the API separately with: npm run dev");



const child = spawn(process.execPath, args, {

	cwd: projectRoot,

	env: waEnv,

	stdio: "inherit",

});



child.on("exit", (code) => process.exit(code ?? 0));


