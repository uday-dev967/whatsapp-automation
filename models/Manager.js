const mongoose = require("mongoose");

const managerSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
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
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

managerSchema.index({ state: 1 });
managerSchema.index({ region: 1 });

module.exports = mongoose.model("Manager", managerSchema);
