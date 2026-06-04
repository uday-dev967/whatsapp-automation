const { execSync } = require("child_process");

// Matches @open-wa/wa-automate patch (Chrome 147+). Do not use the old WhatsApp/2.x + Chrome 104 UA.
const FALLBACK_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function getChromeVersionFromPath(chromePath) {
	if (!chromePath) return null;
	try {
		const output = execSync(`powershell -NoProfile -Command "(Get-Item '${chromePath}').VersionInfo.ProductVersion"`, {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "ignore"],
		}).trim();
		const major = output.split(".")[0];
		return major || null;
	} catch {
		return null;
	}
}

function buildUserAgent(chromeMajorVersion) {
	const version = chromeMajorVersion || "131";
	return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
}

function applyWhatsappUserAgent({ customUserAgent, chromeExecutablePath } = {}) {
	const puppeteerConfig = require("@open-wa/wa-automate/dist/config/puppeteer.config");
	const chromeMajor = getChromeVersionFromPath(chromeExecutablePath);
	const userAgent = customUserAgent || buildUserAgent(chromeMajor) || FALLBACK_USER_AGENT;
	puppeteerConfig.useragent = userAgent;
	return userAgent;
}

module.exports = {
	FALLBACK_USER_AGENT,
	buildUserAgent,
	applyWhatsappUserAgent,
};
