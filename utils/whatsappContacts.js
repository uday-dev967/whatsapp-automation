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

function pickBetterContactName(a, b) {
	const nameA = String(a || "").trim();
	const nameB = String(b || "").trim();
	const aKnown = nameA && nameA !== "Unknown";
	const bKnown = nameB && nameB !== "Unknown";
	if (aKnown && !bKnown) return nameA;
	if (bKnown && !aKnown) return nameB;
	if (nameA.length >= nameB.length) return nameA || "Unknown";
	return nameB || "Unknown";
}

function dedupeContacts(contacts) {
	const byPhone = new Map();
	for (const contact of contacts) {
		const phone = String(contact?.phone || "").trim();
		if (!phone) continue;

		const canonical = {
			id: `${phone}@c.us`,
			name: contact.name || "Unknown",
			phone,
		};

		if (!byPhone.has(phone)) {
			byPhone.set(phone, canonical);
			continue;
		}

		const existing = byPhone.get(phone);
		existing.name = pickBetterContactName(existing.name, canonical.name);
	}

	return [...byPhone.values()];
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
	mapped = dedupeContacts(mapped);

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
	mapContact,
	normalizeContactName,
	normalizeContactPhone,
	dedupeContacts,
};
