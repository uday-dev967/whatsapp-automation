const mongoose = require("mongoose");

const whatsAppGroupSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		chatId: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		state: {
			type: String,
			trim: true,
			default: "",
		},
		region: {
			type: String,
			trim: true,
			default: "",
		},
		manager: {
			type: String,
			trim: true,
			default: "",
		},
		reportTypes: {
			type: [String],
			default: ["Productivity Report"],
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("WhatsAppGroup", whatsAppGroupSchema);
