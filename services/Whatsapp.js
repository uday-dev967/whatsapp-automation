const { SocketClient } = require("@open-wa/wa-automate");
const { logger } = require("../utils");
const { urlToDataUrl, filenameFromUrl } = require("../utils/imageUrl");
const { fetchWhatsAppGroups } = require("../utils/whatsappGroups");

const disabledService = {
	isReady: () => false,
	getClient: () => null,
	listGroups: async () => [],
	sendImageFromUrl: async () => {
		throw new Error("WhatsApp is not connected. Run npm run wa:server first.");
	},
};

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(serverUrl, apiKey, maxAttempts = 30, delayMs = 2000) {
	let lastError;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await SocketClient.connect(serverUrl, apiKey);
		} catch (error) {
			lastError = error;
			console.log(
				`OpenWA not reachable (attempt ${attempt}/${maxAttempts}): ${error.message}`
			);
			if (attempt < maxAttempts) {
				await sleep(delayMs);
			}
		}
	}
	throw lastError;
}

module.exports = async function ({ config }) {
	if (config.whatsapp.enabled === false) {
		console.log("WhatsApp disabled (WA_ENABLED=false)");
		return disabledService;
	}

	const { serverUrl, apiKey } = config.whatsapp;
	let client = null;

	console.log(`Connecting to OpenWA server at ${serverUrl} ...`);
	console.log("(Start Terminal 1 with: npm run wa:server — wait for 'Client is ready')");

	try {
		client = await connectWithRetry(serverUrl, apiKey);
		console.log("Connected to OpenWA server — WhatsApp ready for API requests");
		logger.info("WhatsApp remote client connected");
	} catch (error) {
		console.log("");
		console.log("Could not connect to OpenWA server.");
		console.log("  1. Open a NEW terminal (leave this one as-is)");
		console.log("  2. Run: npm run wa:server");
		console.log("  3. Wait until you see: Client is ready");
		console.log("  4. Come back here and run: npm run dev  (or type rs in nodemon)");
		console.log("");
		logger.warn(`WhatsApp remote connect failed: ${error.message}`);
		return disabledService;
	}

	return {
		isReady: () => !!client,
		getClient: () => client,
		listGroups: async () => {
			if (!client) return [];
			return fetchWhatsAppGroups(client);
		},
		sendImageFromUrl: async (chatId, imageUrl, caption = "") => {
			if (!client) {
				throw new Error("WhatsApp client is not connected");
			}
			const dataUrl = await urlToDataUrl(imageUrl);
			const filename = filenameFromUrl(imageUrl);
			return client.sendImage(chatId, dataUrl, filename, caption);
		},
	};
};
