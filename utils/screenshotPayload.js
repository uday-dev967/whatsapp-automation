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

function validateImageBuffer(buffer, mimetype = "image/png") {
	if (!buffer?.length || buffer.length < 50) {
		return false;
	}
	if (mimetype === "image/png" && buffer[0] === 0x89 && buffer[1] === 0x50) {
		return true;
	}
	if (mimetype === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8) {
		return true;
	}
	return buffer.length >= 100;
}

function screenshotFromRequest(req) {
	if (req.file?.buffer) {
		const mime = req.file.mimetype || "image/png";
		return {
			buffer: req.file.buffer,
			mimetype: mime,
			filename:
				req.file.originalname ||
				(mime === "image/jpeg" ? "screenshot.jpg" : "screenshot.png"),
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
			const mime = mimeType || "image/png";
			return {
				buffer: Buffer.from(imageBase64, "base64"),
				mimetype: mime,
				filename: mime === "image/jpeg" ? "screenshot.jpg" : "screenshot.png",
			};
		}
	}

	return null;
}

function assertValidScreenshot(image) {
	if (!image?.buffer?.length) {
		return { ok: false, reason: "missing_screenshot" };
	}
	if (image.buffer.length > 12 * 1024 * 1024) {
		return { ok: false, reason: "screenshot_too_large" };
	}
	if (!validateImageBuffer(image.buffer, image.mimetype)) {
		return { ok: false, reason: "invalid_screenshot" };
	}
	return { ok: true };
}

module.exports = {
	screenshotFromRequest,
	bufferToDataUrl,
	assertValidScreenshot,
};

function bufferToDataUrl(buffer, mimetype = "image/png") {
	return `data:${mimetype};base64,${buffer.toString("base64")}`;
}
