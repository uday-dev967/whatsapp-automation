const mongoose = require("mongoose");

const photoSchedulerSchema = new mongoose.Schema(
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
		photos: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Photo",
			},
		],
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

module.exports = mongoose.model("PhotoScheduler", photoSchedulerSchema);
