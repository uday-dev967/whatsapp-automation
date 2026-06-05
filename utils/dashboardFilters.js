function parseArrayParam(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.map(String).filter(Boolean);
	return String(value)
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function getDateRangeBounds(dateRange, startDate, endDate) {
	const now = new Date();
	const end = endDate ? new Date(endDate) : new Date(now);
	end.setHours(23, 59, 59, 999);

	let start;
	if (startDate) {
		start = new Date(startDate);
	} else {
		start = new Date(now);
		switch (dateRange) {
			case "last7days":
				start.setDate(start.getDate() - 6);
				break;
			case "last30days":
				start.setDate(start.getDate() - 29);
				break;
			case "thisMonth":
				start = new Date(now.getFullYear(), now.getMonth(), 1);
				break;
			case "today":
			default:
				start.setHours(0, 0, 0, 0);
				break;
		}
	}
	start.setHours(0, 0, 0, 0);
	return { start, end };
}

function buildSalesQuery(filters = {}) {
	const {
		states = [],
		regions = [],
		managers = [],
		reportType,
		dateRange = "today",
		startDate,
		endDate,
	} = filters;

	const query = {};

	const stateList = parseArrayParam(states);
	const regionList = parseArrayParam(regions);
	const managerList = parseArrayParam(managers);

	if (stateList.length) query.state = { $in: stateList };
	if (regionList.length) query.region = { $in: regionList };
	if (managerList.length) query.manager = { $in: managerList };
	if (reportType) query.reportType = reportType;

	const { start, end } = getDateRangeBounds(dateRange, startDate, endDate);
	query.recordDate = { $gte: start, $lte: end };

	return query;
}

function buildTrendQuery(filters = {}) {
	const { dateRange = "last30days", startDate, endDate } = filters;
	const { start, end } = getDateRangeBounds(dateRange, startDate, endDate);

	const startStr = start.toISOString().split("T")[0];
	const endStr = end.toISOString().split("T")[0];

	return {
		date: { $gte: startStr, $lte: endStr },
	};
}

function computeKpis(rows) {
	if (!rows.length) {
		return {
			totalTarget: 0,
			totalAchievement: 0,
			avgAchievementPct: 0,
			topState: null,
			bottomState: null,
			stateCount: 0,
		};
	}

	const totalTarget = rows.reduce((sum, r) => sum + r.target, 0);
	const totalAchievement = rows.reduce((sum, r) => sum + r.achievement, 0);
	const avgAchievementPct =
		Math.round((rows.reduce((sum, r) => sum + r.achievementPct, 0) / rows.length) * 10) / 10;

	const sorted = [...rows].sort((a, b) => b.achievementPct - a.achievementPct);
	const topState = sorted[0];
	const bottomState = sorted[sorted.length - 1];

	return {
		totalTarget: Math.round(totalTarget * 10) / 10,
		totalAchievement: Math.round(totalAchievement * 10) / 10,
		avgAchievementPct,
		topState: topState
			? { state: topState.state, achievementPct: topState.achievementPct }
			: null,
		bottomState: bottomState
			? { state: bottomState.state, achievementPct: bottomState.achievementPct }
			: null,
		stateCount: rows.length,
	};
}

function computeRegionContribution(rows) {
	const byRegion = {};
	for (const row of rows) {
		if (!byRegion[row.region]) {
			byRegion[row.region] = { region: row.region, achievement: 0, target: 0 };
		}
		byRegion[row.region].achievement += row.achievement;
		byRegion[row.region].target += row.target;
	}
	return Object.values(byRegion).map((r) => ({
		region: r.region,
		achievement: Math.round(r.achievement * 10) / 10,
		target: Math.round(r.target * 10) / 10,
		contributionPct:
			rows.length > 0
				? Math.round(
						(r.achievement / rows.reduce((s, x) => s + x.achievement, 0)) * 1000
					) / 10
				: 0,
	}));
}

function normalizeFiltersFromQuery(query = {}) {
	return {
		states: parseArrayParam(query.states),
		regions: parseArrayParam(query.regions),
		managers: parseArrayParam(query.managers),
		reportType: query.reportType || "Productivity Report",
		dateRange: query.dateRange || "today",
		startDate: query.startDate || undefined,
		endDate: query.endDate || undefined,
	};
}

function normalizeFiltersFromBody(filters = {}) {
	return {
		states: Array.isArray(filters.states) ? filters.states : [],
		regions: Array.isArray(filters.regions) ? filters.regions : [],
		managers: Array.isArray(filters.managers) ? filters.managers : [],
		reportType: filters.reportType || "Productivity Report",
		dateRange: filters.dateRange || "last30days",
		startDate: filters.startDate || undefined,
		endDate: filters.endDate || undefined,
	};
}

function normalizeScheduleFilters(filters = {}) {
	return {
		states: Array.isArray(filters.states) ? filters.states : [],
		regions: Array.isArray(filters.regions) ? filters.regions : [],
		managers: Array.isArray(filters.managers) ? filters.managers : [],
		reportType: filters.reportType || "Productivity Report",
		dateRange: filters.dateRange || "last30days",
		startDate: filters.startDate ? String(filters.startDate).trim() : "",
		endDate: filters.endDate ? String(filters.endDate).trim() : "",
	};
}

module.exports = {
	parseArrayParam,
	buildSalesQuery,
	buildTrendQuery,
	computeKpis,
	computeRegionContribution,
	normalizeFiltersFromQuery,
	normalizeFiltersFromBody,
	normalizeScheduleFilters,
	getDateRangeBounds,
};
