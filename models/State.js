const mongoose = require("mongoose");

const stateSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		region: {
			type: String,
			required: true,
			trim: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

stateSchema.index({ region: 1 });

module.exports = mongoose.model("State", stateSchema);
