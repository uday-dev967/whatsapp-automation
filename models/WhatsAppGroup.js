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
	},
	{ timestamps: true }
);

module.exports = mongoose.model("WhatsAppGroup", whatsAppGroupSchema);
