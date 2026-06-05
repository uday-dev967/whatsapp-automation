const SalesData = require("../models/SalesData");
const DailyTrend = require("../models/DailyTrend");
const State = require("../models/State");
const Manager = require("../models/Manager");
const ReportType = require("../models/ReportType");
const {
	buildSalesQuery,
	buildTrendQuery,
	computeKpis,
	computeRegionContribution,
	normalizeFiltersFromQuery,
	normalizeFiltersFromBody,
} = require("../utils/dashboardFilters");

module.exports = async function () {
	async function getSummary(filters = {}) {
		const normalized = normalizeFiltersFromBody(filters);
		const query = buildSalesQuery(normalized);
		const rows = await SalesData.find(query).sort({ achievementPct: -1 }).lean();
		const kpis = computeKpis(rows);
		const regionContribution = computeRegionContribution(rows);

		return {
			filters: normalized,
			kpis,
			rows: rows.map((r) => ({
				id: r._id,
				state: r.state,
				region: r.region,
				manager: r.manager,
				target: r.target,
				achievement: r.achievement,
				achievementPct: r.achievementPct,
				activeSKUs: r.activeSKUs,
				ordersCount: r.ordersCount,
				distributors: r.distributors,
				lastUpdated: r.recordDate,
			})),
			regionContribution,
		};
	}

	async function getTrend(filters = {}) {
		const normalized = normalizeFiltersFromBody(filters);
		const query = buildTrendQuery(normalized);
		const rows = await DailyTrend.find(query).sort({ date: 1 }).lean();
		return {
			filters: normalized,
			trend: rows.map((r) => ({ date: r.date, value: r.value })),
		};
	}

	async function getFilterOptions() {
		const [stateDocs, managerDocs, reportTypeDocs] = await Promise.all([
			State.find({ isActive: true }).sort({ name: 1 }).lean(),
			Manager.find({ isActive: true }).sort({ name: 1 }).lean(),
			ReportType.find({ isActive: true }).sort({ name: 1 }).lean(),
		]);

		const stateRegionMap = Object.fromEntries(
			stateDocs.map((s) => [s.name, s.region])
		);

		const regions = [...new Set(stateDocs.map((s) => s.region))].sort();

		return {
			states: stateDocs.map((s) => s.name),
			regions,
			managers: managerDocs.map((m) => m.name),
			reportTypes: reportTypeDocs.map((r) => r.name),
			stateRegionMap,
			dateRanges: [
				{ value: "today", label: "Today" },
				{ value: "last7days", label: "Last 7 Days" },
				{ value: "last30days", label: "Last 30 Days" },
				{ value: "thisMonth", label: "This Month" },
			],
		};
	}

	async function getSummaryFromQuery(query = {}) {
		const filters = normalizeFiltersFromQuery(query);
		return getSummary(filters);
	}

	async function getTrendFromQuery(query = {}) {
		const filters = normalizeFiltersFromQuery(query);
		return getTrend(filters);
	}

	return {
		getSummary,
		getTrend,
		getFilterOptions,
		getSummaryFromQuery,
		getTrendFromQuery,
	};
};
