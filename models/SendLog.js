const mongoose = require("mongoose");

const sendLogSchema = new mongoose.Schema(
	{
		scheduleId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "PhotoScheduler",
		},
		scheduleName: {
			type: String,
			default: "",
		},
		groupIds: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "WhatsAppGroup",
			},
		],
		groupCount: {
			type: Number,
			default: 0,
		},
		status: {
			type: String,
			enum: ["success", "failed"],
			default: "success",
		},
		errorMessage: {
			type: String,
			default: "",
		},
		sentAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: false }
);

module.exports = mongoose.model("SendLog", sendLogSchema);
