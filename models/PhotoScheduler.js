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
		groups: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "WhatsAppGroup",
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
		filters: {
			states: {
				type: [String],
				default: [],
			},
			regions: {
				type: [String],
				default: [],
			},
			managers: {
				type: [String],
				default: [],
			},
			reportType: {
				type: String,
				default: "Productivity Report",
				trim: true,
			},
			dateRange: {
				type: String,
				default: "last30days",
				trim: true,
			},
			startDate: {
				type: String,
				default: "",
				trim: true,
			},
			endDate: {
				type: String,
				default: "",
				trim: true,
			},
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("PhotoScheduler", screenshotDispatchScheduleSchema);
