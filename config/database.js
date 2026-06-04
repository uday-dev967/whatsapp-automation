const mongoose = require("mongoose");
const { logger } = require("../utils");

function getDatabaseUrl() {
	const database = (process.env.DATABASE || process.env.MONGODB_URI || "").trim();
	if (!database) {
		return null;
	}

	// Full URI pasted from Atlas / NoSQL Booster (password already in the string)
	if (!database.includes("<PASSWORD>")) {
		return database;
	}

	const password = (process.env.DATABASE_PASSWORD || "").trim();
	if (!password) {
		throw new Error("DATABASE_PASSWORD is required when DATABASE contains <PASSWORD>");
	}

	return database.replace("<PASSWORD>", encodeURIComponent(password));
}

async function connectDatabase() {
	const url = getDatabaseUrl();
	if (!url) {
		throw new Error("DATABASE environment variable is not set");
	}

	await mongoose.connect(url);

	const { host, name } = mongoose.connection;
	console.log(`Database connection successful`);
	logger.info(`MongoDB connected: ${host}`);
	return mongoose.connection;
}

module.exports = {
	getDatabaseUrl,
	connectDatabase,
};
