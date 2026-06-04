const mongoose = require("mongoose");

function parseScheduleId(raw) {
	const scheduleId = decodeURIComponent(String(raw || "")).trim();

	if (!scheduleId) {
		return {
			ok: false,
			status: 400,
			body: {
				ok: false,
				reason: "missing_schedule_id",
				message: "scheduleId is required",
			},
		};
	}

	if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
		return {
			ok: false,
			status: 400,
			body: {
				ok: false,
				reason: "invalid_schedule_id",
				message: "scheduleId must be a valid 24-character MongoDB ObjectId",
				scheduleId,
			},
		};
	}

	return { ok: true, scheduleId };
}

function scheduleNotFoundResponse(scheduleId) {
	return {
		status: 404,
		body: {
			ok: false,
			reason: "scheduler_not_found",
			message: "Photo dispatch schedule not found in database",
			scheduleId,
			hint:
				"Call GET /Automation/v1.0/screenshot-dispatch-schedules and use schedules[]._id — not a target group _id",
		},
	};
}

module.exports = { parseScheduleId, scheduleNotFoundResponse };
