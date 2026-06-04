function normalizeChatId(chat) {
	if (!chat) return null;
	if (typeof chat.id === "string") return chat.id;
	if (chat.id?._serialized) return chat.id._serialized;
	if (chat.id?.user && chat.id?.server) return `${chat.id.user}@${chat.id.server}`;
	return null;
}

function normalizeGroupName(chat) {
	return chat.name || chat.formattedTitle || chat.contact?.name || "Unnamed group";
}

function isGroupChat(chat) {
	const chatId = normalizeChatId(chat);
	if (chatId && chatId.endsWith("@g.us")) return true;
	return Boolean(chat.isGroup);
}

function mapGroup(chat) {
	const chatId = normalizeChatId(chat);
	return {
		id: chatId,
		name: normalizeGroupName(chat),
		chatId,
		participantCount: chat.groupMetadata?.participants?.length || chat.size || null,
	};
}

async function fetchWhatsAppGroups(client) {
	if (!client) return [];

	let groups = [];

	try {
		groups = (await client.getAllGroups()) || [];
	} catch (error) {
		console.log(`getAllGroups failed: ${error.message}`);
	}

	if (!groups.length) {
		try {
			const chats = (await client.getAllChats()) || [];
			groups = chats.filter(isGroupChat);
			console.log(`getAllGroups empty — found ${groups.length} group(s) via getAllChats`);
		} catch (error) {
			console.log(`getAllChats failed: ${error.message}`);
		}
	}

	return groups.map(mapGroup).filter((g) => g.chatId);
}

module.exports = {
	normalizeChatId,
	fetchWhatsAppGroups,
};
