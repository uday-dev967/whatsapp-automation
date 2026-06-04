const path = require("path");

async function urlToDataUrl(imageUrl) {
	const response = await fetch(imageUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch image (${response.status}): ${imageUrl}`);
	}

	const contentType = response.headers.get("content-type") || "image/jpeg";
	const buffer = Buffer.from(await response.arrayBuffer());
	return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function filenameFromUrl(imageUrl, fallback = "photo.jpg") {
	try {
		const pathname = new URL(imageUrl).pathname;
		const base = path.basename(pathname);
		if (base && base.includes(".")) {
			return base.split("?")[0];
		}
	} catch {
		// use fallback
	}
	return fallback;
}

module.exports = {
	urlToDataUrl,
	filenameFromUrl,
};
