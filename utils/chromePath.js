const fs = require("fs");

const WINDOWS_CHROME_PATHS = [
	process.env.WA_CHROME_PATH,
	process.env.CHROME_PATH,
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
	process.env.LOCALAPPDATA
		? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
		: null,
].filter(Boolean);

function resolveChromeExecutablePath() {
	for (const chromePath of WINDOWS_CHROME_PATHS) {
		if (fs.existsSync(chromePath)) {
			return chromePath;
		}
	}
	return null;
}

module.exports = {
	resolveChromeExecutablePath,
};
