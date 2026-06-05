const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { logger } = require("../utils");
const { normalizeFiltersFromBody } = require("../utils/dashboardFilters");

const DATE_RANGE_LABELS = {
	today: "Today",
	last7days: "Last 7 Days",
	last30days: "Last 30 Days",
	thisMonth: "This Month",
};

let browserInstance = null;

module.exports = async function ({ config, Services }) {
	const templatePath = path.join(config.rootDir, "assets", "report-template.html");
	const templateHtml = fs.readFileSync(templatePath, "utf8");

	async function getBrowser() {
		if (browserInstance && browserInstance.isConnected()) {
			return browserInstance;
		}
		browserInstance = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
		});
		return browserInstance;
	}

	function buildReportPayload(summary, filters) {
		const today = new Date().toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});

		return {
			title: filters.reportType || "Productivity Report",
			generatedAt: `Generated on ${today}`,
			filters: {
				...filters,
				dateRangeLabel: DATE_RANGE_LABELS[filters.dateRange] || filters.dateRange,
			},
			kpis: summary.kpis,
			rows: summary.rows,
			regionContribution: summary.regionContribution,
		};
	}

	async function generate(filters = {}) {
		const normalized = normalizeFiltersFromBody(filters);
		const summary = await Services.Dashboard.getSummary(normalized);
		const reportData = buildReportPayload(summary, normalized);

		const browser = await getBrowser();
		const page = await browser.newPage();
		try {
			await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });

			const dataScript = `<script>window.__REPORT_DATA__ = ${JSON.stringify(reportData)};</script>`;
			const html = templateHtml.replace(
				"<!-- __REPORT_DATA_PLACEHOLDER__ -->",
				dataScript
			);

			await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
			await page.waitForFunction(
				() => document.getElementById("charts-ready")?.textContent === "ready",
				{ timeout: 15000 }
			);
			await new Promise((r) => setTimeout(r, 300));

			const buffer = await page.screenshot({
				type: "jpeg",
				quality: 85,
				fullPage: true,
			});

			return {
				buffer,
				mimetype: "image/jpeg",
				filename: "productivity-report.jpg",
			};
		} catch (err) {
			logger.error("ReportImageService.generate failed:", err.message);
			throw err;
		} finally {
			await page.close();
		}
	}

	async function close() {
		if (browserInstance) {
			await browserInstance.close();
			browserInstance = null;
		}
	}

	return {
		generate,
		close,
	};
};
