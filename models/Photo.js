const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
		},
		url: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		caption: {
			type: String,
			default: "",
			trim: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Photo", photoSchema);
