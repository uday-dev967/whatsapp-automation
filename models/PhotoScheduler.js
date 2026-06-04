const mongoose = require("mongoose");

const screenshotDispatchScheduleSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		group: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "WhatsAppGroup",
			required: true,
		},
		cron: {
			type: String,
			required: true,
			trim: true,
		},
		timezone: {
			type: String,
			default: "Asia/Kolkata",
			trim: true,
		},
		caption: {
			type: String,
			default: "",
			trim: true,
		},
		isRunning: {
			type: Boolean,
			default: false,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("PhotoScheduler", screenshotDispatchScheduleSchema);
