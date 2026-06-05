const mongoose = require("mongoose");

const dailyTrendSchema = new mongoose.Schema(
	{
		date: {
			type: String,
			required: true,
			trim: true,
		},
		value: {
			type: Number,
			required: true,
		},
	},
	{ timestamps: true }
);

dailyTrendSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model("DailyTrend", dailyTrendSchema);
