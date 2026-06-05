const mongoose = require("mongoose");

const reportTypeSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("ReportType", reportTypeSchema);
