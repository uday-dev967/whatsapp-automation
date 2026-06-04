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
		photos: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Photo",
			},
		],
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("WhatsAppGroup", whatsAppGroupSchema);
