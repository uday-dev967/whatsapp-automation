const mongoose = require("mongoose");

function parseGroupId(raw) {
	const groupId = decodeURIComponent(String(raw || "")).trim();

	if (!groupId) {
		return {
			ok: false,
			status: 400,
			body: {
				ok: false,
				reason: "missing_group_id",
				message: "groupId is required",
			},
		};
	}

	if (!mongoose.Types.ObjectId.isValid(groupId)) {
		return {
			ok: false,
			status: 400,
			body: {
				ok: false,
				reason: "invalid_group_id",
				message: "groupId must be a valid 24-character MongoDB ObjectId",
				groupId,
			},
		};
	}

	return { ok: true, groupId };
}

function validateScheduleIdList(scheduleIds) {
	if (!Array.isArray(scheduleIds) || !scheduleIds.length) {
		return {
			ok: false,
			body: {
				ok: false,
				reason: "invalid_schedule_ids",
				message: "scheduleIds must be a non-empty array",
			},
		};
	}

	const normalized = scheduleIds.map((id) => String(id).trim());
	const invalid = normalized.filter((id) => !mongoose.Types.ObjectId.isValid(id));
	if (invalid.length) {
		return {
			ok: false,
			body: {
				ok: false,
				reason: "invalid_schedule_ids",
				message: "Every scheduleId must be a valid MongoDB ObjectId",
				invalidIds: invalid,
			},
		};
	}

	return { ok: true, scheduleIds: normalized };
}

module.exports = { parseGroupId, validateScheduleIdList };
