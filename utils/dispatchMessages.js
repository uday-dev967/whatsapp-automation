const REASON_MESSAGES = {
	missing_screenshot: "No screenshot image was received.",
	invalid_screenshot: "Screenshot image is empty or corrupted. Try Send again from the Dashboard.",
	screenshot_too_large: "Screenshot is too large (max 12 MB).",
	whatsapp_not_ready: "WhatsApp is not connected. Start OpenWA: npm run wa:server",
	scheduler_not_found: "Schedule not found.",
	scheduler_inactive: "Schedule is disabled.",
	scheduler_not_running:
		"Schedule is not running. Turn it ON in Scheduler (or use manual send from Dashboard).",
	group_not_found: "Target group not found.",
	no_running_schedules:
		"No running schedules. Activate at least one schedule, or use manual send from Dashboard.",
	no_active_target_groups:
		"No active target groups with a valid chatId. Register a group and set chatId.",
	dispatch_failed: "Failed to send to WhatsApp.",
};

function messageForReason(reason) {
	return REASON_MESSAGES[reason] || reason || "Dispatch failed";
}

module.exports = { REASON_MESSAGES, messageForReason };
