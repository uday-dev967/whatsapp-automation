/**
 * conf.js
 * this is the main config file and can be accessed through the "config" dependency
 * which is injected in both controllers and middlewares
 */
const { getDatabaseUrl } = require("./database");

module.exports = {
	getDatabaseUrl,
	whatsapp: {
		enabled: process.env.WA_ENABLED !== "false",
		serverUrl: process.env.WA_SERVER_URL || "http://localhost:8002",
		apiKey: process.env.WA_API_KEY || "dev-api-key",
		sessionId: process.env.WA_SESSION_ID || "whatsapp-automation-poc",
	},
	scheduler: {
		enabled: process.env.SCHEDULER_ENABLED !== "false",
		cron: process.env.CRON_SCHEDULE || "*/5 * * * *",
		timezone: process.env.CRON_TIMEZONE || "Asia/Kolkata",
	},
};
