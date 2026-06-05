const { normalizeDispatchChatId } = require("./normalizeChatId");
const { mapContact } = require("./whatsappContacts");

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function dedupeMembers(members) {
	const byId = new Map();
	for (const member of members) {
		if (member?.id && !byId.has(member.id)) {
			byId.set(member.id, member);
		}
	}
	return [...byId.values()];
}

async function fetchGroupMembers(client, chatId) {
	if (!client) return [];
	const groupId = normalizeDispatchChatId(chatId);
	if (!groupId?.endsWith("@g.us")) {
		throw new Error("chatId must be a WhatsApp group id ending with @g.us");
	}
	const members = (await client.getGroupMembers(groupId)) || [];
	return dedupeMembers(members.map(mapContact).filter(Boolean));
}

/**
 * OpenWA group metadata can lag after add/remove — poll until the list reflects the change.
 */
async function fetchGroupMembersAfterChange(
	client,
	chatId,
	{ removedIds = [], addedIds = [] } = {}
) {
	const removed = new Set(removedIds.map(String));
	const added = addedIds.map(String);
	let latest = [];

	for (let attempt = 0; attempt < 6; attempt++) {
		if (attempt > 0) {
			await sleep(400 * attempt);
		}
		latest = await fetchGroupMembers(client, chatId);
		const ids = new Set(latest.map((m) => m.id));

		const removedOk = [...removed].every((id) => !ids.has(id));
		const addedOk = added.length === 0 || added.every((id) => ids.has(id));

		if (removedOk && addedOk) {
			return latest;
		}
	}

	return latest;
}

async function addGroupMembers(client, chatId, participantIds = []) {
	if (!client) {
		throw new Error("WhatsApp client is not connected");
	}
	const groupId = normalizeDispatchChatId(chatId);
	const ids = [...new Set(participantIds.map((id) => String(id).trim()).filter(Boolean))];
	if (!ids.length) {
		throw new Error("participantIds must be a non-empty array");
	}
	await client.addParticipant(groupId, ids);
	return { added: ids.length, participantIds: ids };
}

async function removeGroupMembers(client, chatId, participantIds = []) {
	if (!client) {
		throw new Error("WhatsApp client is not connected");
	}
	const groupId = normalizeDispatchChatId(chatId);
	const ids = [...new Set(participantIds.map((id) => String(id).trim()).filter(Boolean))];
	if (!ids.length) {
		throw new Error("participantIds must be a non-empty array");
	}
	const results = [];
	for (const participantId of ids) {
		const ok = await client.removeParticipant(groupId, participantId);
		results.push({ participantId, ok: Boolean(ok) });
	}
	return { removed: results.filter((r) => r.ok).length, results };
}

module.exports = {
	fetchGroupMembers,
	fetchGroupMembersAfterChange,
	addGroupMembers,
	removeGroupMembers,
	dedupeMembers,
};
