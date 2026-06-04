function parseDataUrl(dataUrl) {
	const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
	if (!match) {
		return null;
	}
	return {
		mimetype: match[1],
		buffer: Buffer.from(match[2], "base64"),
	};
}

function screenshotFromRequest(req) {
	if (req.file?.buffer) {
		return {
			buffer: req.file.buffer,
			mimetype: req.file.mimetype || "image/png",
			filename: req.file.originalname || "screenshot.png",
		};
	}

	const { imageBase64, mimeType = "image/png" } = req.body || {};
	if (imageBase64) {
		const parsed = parseDataUrl(imageBase64);
		if (parsed) {
			return {
				buffer: parsed.buffer,
				mimetype: parsed.mimetype,
				filename: "screenshot.png",
			};
		}
		if (typeof imageBase64 === "string") {
			return {
				buffer: Buffer.from(imageBase64, "base64"),
				mimetype: mimeType,
				filename: "screenshot.png",
			};
		}
	}

	return null;
}

module.exports = {
	screenshotFromRequest,
	bufferToDataUrl,
};

function bufferToDataUrl(buffer, mimetype = "image/png") {
	return `data:${mimetype};base64,${buffer.toString("base64")}`;
}
