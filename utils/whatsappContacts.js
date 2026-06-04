const { normalizeChatId } = require("./whatsappGroups");

function normalizeContactId(contact) {
	if (!contact) return null;
	if (typeof contact.id === "string") return contact.id;
	if (contact.id?._serialized) return contact.id._serialized;
	if (contact.id?.user && contact.id?.server) return `${contact.id.user}@${contact.id.server}`;
	return normalizeChatId(contact);
}

function normalizeContactName(contact) {
	return (
		contact.name ||
		contact.pushname ||
		contact.verifiedName ||
		contact.shortName ||
		contact.formattedName ||
		"Unknown"
	);
}

function normalizeContactPhone(contact) {
	const id = normalizeContactId(contact);
	if (!id) return "";
	if (id.endsWith("@c.us")) return id.replace("@c.us", "");
	if (id.endsWith("@s.whatsapp.net")) return id.replace("@s.whatsapp.net", "");
	return id.split("@")[0] || "";
}

function mapContact(contact) {
	const id = normalizeContactId(contact);
	if (!id) return null;
	if (id.endsWith("@g.us")) return null;
	return {
		id,
		name: normalizeContactName(contact),
		phone: normalizeContactPhone(contact),
	};
}

function isPersonalContact(contact) {
	if (!contact) return false;
	if (contact.isGroup) return false;
	if (contact.isMe) return false;
	const id = normalizeContactId(contact);
	if (!id) return false;
	if (id.endsWith("@g.us")) return false;
	if (id === "status@broadcast") return false;
	return id.endsWith("@c.us") || id.endsWith("@s.whatsapp.net");
}

async function fetchWhatsAppContacts(client, query = "") {
	if (!client) return [];

	let contacts = [];
	try {
		contacts = (await client.getAllContacts()) || [];
	} catch (error) {
		console.log(`getAllContacts failed: ${error.message}`);
		return [];
	}

	let mapped = contacts.filter(isPersonalContact).map(mapContact).filter(Boolean);

	const q = String(query || "")
		.trim()
		.toLowerCase();
	if (q) {
		mapped = mapped.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.phone.includes(q) ||
				c.id.toLowerCase().includes(q)
		);
	}

	return mapped.slice(0, q ? 80 : 100);
}

function extractGroupChatIdFromCreateResult(result) {
	if (!result) return null;
	if (typeof result === "string" && result.includes("@g.us")) return result;
	if (result.gid?._serialized) return result.gid._serialized;
	if (typeof result.gid === "string") return result.gid;
	if (result.id?._serialized) return result.id._serialized;
	if (result.chatId) return result.chatId;
	if (result._serialized) return result._serialized;
	return normalizeChatId(result);
}

module.exports = {
	fetchWhatsAppContacts,
	extractGroupChatIdFromCreateResult,
	normalizeContactId,
};
