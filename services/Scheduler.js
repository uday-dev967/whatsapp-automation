const PhotoScheduler = require("../models/PhotoScheduler");
const WhatsAppGroup = require("../models/WhatsAppGroup");
const { logger } = require("../utils");

module.exports = async function ({ config, Services }) {
	async function loadScheduler(schedulerId) {
		return PhotoScheduler.findById(schedulerId).populate("group");
	}

	async function resolveTargetSchedules({ scheduleId, groupId }) {
		if (scheduleId) {
			const schedule = await loadScheduler(scheduleId);
			if (!schedule) {
				return { ok: false, reason: "scheduler_not_found" };
			}
			if (!schedule.isActive) {
				return { ok: false, reason: "scheduler_inactive" };
			}
			if (!schedule.isRunning) {
				return { ok: false, reason: "scheduler_not_running" };
			}
			return { ok: true, schedules: [schedule] };
		}

		const filter = { isRunning: true, isActive: true };
		if (groupId) {
			const group = await WhatsAppGroup.findById(groupId);
			if (!group) {
				return { ok: false, reason: "group_not_found" };
			}
			filter.group = groupId;
		}

		const schedules = await PhotoScheduler.find(filter).populate("group");
		return { ok: true, schedules };
	}

	async function dispatchScreenshot(image, options = {}) {
		const { scheduleId, groupId, caption: captionOverride } = options;

		if (!image?.buffer?.length) {
			return { ok: false, reason: "missing_screenshot" };
		}
		if (!Services.Whatsapp?.isReady?.()) {
			return { ok: false, reason: "whatsapp_not_ready" };
		}

		const resolved = await resolveTargetSchedules({ scheduleId, groupId });
		if (!resolved.ok) {
			return resolved;
		}

		if (!resolved.schedules.length) {
			return { ok: false, reason: "no_running_schedules" };
		}

		const targetsByChatId = new Map();
		for (const schedule of resolved.schedules) {
			const group = schedule.group;
			if (!group?.isActive || !group?.chatId) {
				continue;
			}
			targetsByChatId.set(String(group.chatId), { schedule, group });
		}

		if (!targetsByChatId.size) {
			return { ok: false, reason: "no_active_target_groups" };
		}

		const results = [];
		for (const { schedule, group } of targetsByChatId.values()) {
			const caption = captionOverride || schedule.caption || schedule.name || "";
			await Services.Whatsapp.sendImageBuffer(
				group.chatId,
				image.buffer,
				image.mimetype,
				caption,
				image.filename
			);
			results.push({
				ok: true,
				scheduleId: schedule._id,
				scheduleName: schedule.name,
				groupId: group._id,
				groupName: group.name,
				chatId: group.chatId,
			});
			console.log(
				`Screenshot sent → "${group.name}" [schedule: ${schedule.name}]`
			);
		}

		return {
			ok: true,
			sent: results.length,
			results,
		};
	}

	async function startScheduler(schedulerId) {
		const scheduler = await loadScheduler(schedulerId);
		if (!scheduler) {
			return { ok: false, reason: "scheduler_not_found" };
		}
		if (!scheduler.isActive) {
			return { ok: false, reason: "scheduler_inactive" };
		}
		if (!scheduler.group) {
			return { ok: false, reason: "group_not_found" };
		}
		if (!scheduler.group.isActive) {
			return { ok: false, reason: "group_inactive" };
		}

		if (scheduler.isRunning) {
			return { ok: true, alreadyRunning: true, scheduler: formatScheduler(scheduler) };
		}

		scheduler.isRunning = true;
		await scheduler.save();

		console.log(
			`Schedule enabled: "${scheduler.name}" (${scheduler._id}) — frontend should capture & POST screenshot every: ${scheduler.cron}`
		);
		return { ok: true, started: true, scheduler: formatScheduler(scheduler) };
	}

	async function stopScheduler(schedulerId) {
		const scheduler = await PhotoScheduler.findById(schedulerId).populate("group");
		if (!scheduler) {
			return { ok: false, reason: "scheduler_not_found" };
		}

		scheduler.isRunning = false;
		await scheduler.save();

		console.log(`Schedule disabled: "${scheduler.name}" (${scheduler._id})`);
		return { ok: true, stopped: true, scheduler: formatScheduler(scheduler) };
	}

	function formatScheduler(scheduler) {
		return {
			id: scheduler._id,
			name: scheduler.name,
			groupId: scheduler.group?._id || scheduler.group,
			groupName: scheduler.group?.name,
			chatId: scheduler.group?.chatId,
			cron: scheduler.cron,
			timezone: scheduler.timezone,
			caption: scheduler.caption,
			isRunning: scheduler.isRunning,
			isActive: scheduler.isActive,
		};
	}

	async function getStatus() {
		const schedulers = await PhotoScheduler.find()
			.populate("group", "name chatId isActive")
			.sort({ createdAt: 1 });

		return {
			globalEnabled: config.scheduler.enabled !== false,
			defaultCron: config.scheduler.cron,
			defaultTimezone: config.scheduler.timezone,
			dispatchMode: "frontend_screenshot",
			hint: "Frontend captures screenshots on each schedule cron interval and POSTs to /screenshots/dispatch",
			schedulers: schedulers.map((s) => formatScheduler(s)),
		};
	}

	async function getSchedulesForGroup(groupId) {
		const group = await WhatsAppGroup.findById(groupId);
		if (!group) {
			return { ok: false, reason: "group_not_found" };
		}
		const schedules = await PhotoScheduler.find({ group: groupId });
		return { ok: true, group, schedules };
	}

	async function activateSchedulesForGroup(groupId) {
		const found = await getSchedulesForGroup(groupId);
		if (!found.ok) {
			return found;
		}

		const results = [];
		for (const schedule of found.schedules) {
			const result = await startScheduler(schedule._id);
			results.push({
				scheduleId: schedule._id,
				name: schedule.name,
				...result,
			});
		}

		const activated = results.filter((r) => r.started || r.alreadyRunning).length;

		console.log(
			`Group activate-all: ${found.group.name} (${groupId}) — ${activated}/${results.length} enabled`
		);

		return {
			ok: true,
			groupId,
			groupName: found.group.name,
			total: results.length,
			activated,
			failed: results.length - activated,
			results,
		};
	}

	async function deactivateSchedulesForGroup(groupId) {
		const found = await getSchedulesForGroup(groupId);
		if (!found.ok) {
			return found;
		}

		const results = [];
		for (const schedule of found.schedules) {
			const result = await stopScheduler(schedule._id);
			results.push({
				scheduleId: schedule._id,
				name: schedule.name,
				...result,
			});
		}

		const deactivated = results.filter((r) => r.stopped).length;

		console.log(
			`Group deactivate-all: ${found.group.name} (${groupId}) — ${deactivated}/${results.length} disabled`
		);

		return {
			ok: true,
			groupId,
			groupName: found.group.name,
			total: results.length,
			deactivated,
			results,
		};
	}

	async function deleteSchedules({ scheduleIds, groupId }) {
		const hasScheduleIds = Array.isArray(scheduleIds) && scheduleIds.length > 0;
		const hasGroupId = Boolean(groupId);

		if (hasScheduleIds === hasGroupId) {
			return {
				ok: false,
				reason: "invalid_delete_filter",
				message: "Provide exactly one of scheduleIds (array) or groupId in the request body",
			};
		}

		let filter;
		if (hasGroupId) {
			const group = await WhatsAppGroup.findById(groupId);
			if (!group) {
				return { ok: false, reason: "group_not_found" };
			}
			filter = { group: groupId };
		} else {
			filter = { _id: { $in: scheduleIds } };
		}

		const schedules = await PhotoScheduler.find(filter).select("_id name group");
		const deleteResult = await PhotoScheduler.deleteMany({
			_id: { $in: schedules.map((s) => s._id) },
		});

		console.log(`Deleted ${deleteResult.deletedCount} screenshot dispatch schedule(s)`);

		return {
			ok: true,
			deletedCount: deleteResult.deletedCount,
			deleted: schedules.map((s) => ({
				scheduleId: s._id,
				name: s.name,
				groupId: s.group,
			})),
		};
	}

	async function restoreRunningSchedulers() {
		const running = await PhotoScheduler.countDocuments({ isRunning: true, isActive: true });
		console.log(
			`${running} enabled screenshot schedule(s) — waiting for frontend POST /screenshots/dispatch`
		);
	}

	await restoreRunningSchedulers();

	return {
		getStatus,
		startScheduler,
		stopScheduler,
		dispatchScreenshot,
		activateSchedulesForGroup,
		deactivateSchedulesForGroup,
		deleteSchedules,
	};
};
