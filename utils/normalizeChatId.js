/**
 * Ensure WhatsApp group chatId is in OpenWA format (e.g. 120363...@g.us).
 */
function normalizeDispatchChatId(chatId) {
	const id = String(chatId || "").trim();
	if (!id) {
		return id;
	}
	if (id.includes("@")) {
		return id;
	}
	return `${id.replace(/[^\d-]/g, "")}@g.us`;
}

module.exports = { normalizeDispatchChatId };
