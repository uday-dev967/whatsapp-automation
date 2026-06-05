const mongoose = require("mongoose");

const salesDataSchema = new mongoose.Schema(
	{
		state: {
			type: String,
			required: true,
			trim: true,
		},
		region: {
			type: String,
			required: true,
			trim: true,
		},
		manager: {
			type: String,
			required: true,
			trim: true,
		},
		reportType: {
			type: String,
			default: "Productivity Report",
			trim: true,
		},
		target: {
			type: Number,
			required: true,
		},
		achievement: {
			type: Number,
			required: true,
		},
		achievementPct: {
			type: Number,
			required: true,
		},
		activeSKUs: {
			type: Number,
			default: 0,
		},
		ordersCount: {
			type: Number,
			default: 0,
		},
		distributors: {
			type: Number,
			default: 0,
		},
		recordDate: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: true }
);

salesDataSchema.index({ state: 1 });
salesDataSchema.index({ region: 1 });
salesDataSchema.index({ manager: 1 });
salesDataSchema.index({ recordDate: 1 });

module.exports = mongoose.model("SalesData", salesDataSchema);
