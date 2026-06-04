const cron = require("node-cron");
const PhotoScheduler = require("../models/PhotoScheduler");
const WhatsAppGroup = require("../models/WhatsAppGroup");
const { logger } = require("../utils");

module.exports = async function ({ config, Services }) {
	const cronTasks = new Map();

	async function loadScheduler(schedulerId) {
		return PhotoScheduler.findById(schedulerId).populate("group").populate("photos");
	}

	async function dispatchScheduler(scheduler) {
		if (!scheduler?.isActive) {
			return { ok: false, reason: "scheduler_inactive" };
		}
		if (!Services.Whatsapp?.isReady?.()) {
			console.log(`Scheduler "${scheduler.name}" skipped — WhatsApp is not ready`);
			return { ok: false, reason: "whatsapp_not_ready" };
		}

		const group = scheduler.group;
		if (!group || !group.isActive) {
			console.log(`Scheduler "${scheduler.name}" skipped — group missing or inactive`);
			return { ok: false, reason: "group_inactive" };
		}

		const photos = (scheduler.photos || []).filter((photo) => photo && photo.isActive);
		if (!photos.length) {
			console.log(`Scheduler "${scheduler.name}" skipped — no active photos`);
			return { ok: false, reason: "no_photos" };
		}

		let sent = 0;
		for (const photo of photos) {
			await Services.Whatsapp.sendImageFromUrl(
				group.chatId,
				photo.url,
				photo.caption || photo.title
			);
			sent += 1;
			console.log(
				`Sent "${photo.title}" → group "${group.name}" [scheduler: ${scheduler.name}]`
			);
		}

		return { ok: true, sent, schedulerId: scheduler._id, schedulerName: scheduler.name };
	}

	function registerCronTask(scheduler) {
		if (!cron.validate(scheduler.cron)) {
			throw new Error(`Invalid cron for scheduler "${scheduler.name}": ${scheduler.cron}`);
		}

		const task = cron.schedule(
			scheduler.cron,
			async () => {
				const fresh = await loadScheduler(scheduler._id);
				if (!fresh?.isRunning) {
					return;
				}
				await dispatchScheduler(fresh);
			},
			{ timezone: scheduler.timezone || config.scheduler.timezone }
		);

		cronTasks.set(String(scheduler._id), task);
	}

	function unregisterCronTask(schedulerId) {
		const key = String(schedulerId);
		const task = cronTasks.get(key);
		if (task) {
			task.stop();
			cronTasks.delete(key);
		}
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
		if (!scheduler.photos?.length) {
			return { ok: false, reason: "no_photos_linked" };
		}

		const activePhotos = scheduler.photos.filter((p) => p && p.isActive);
		if (!activePhotos.length) {
			return { ok: false, reason: "no_active_photos" };
		}

		if (config.scheduler.enabled === false) {
			return { ok: false, reason: "scheduler_disabled_globally" };
		}

		if (scheduler.isRunning && cronTasks.has(String(scheduler._id))) {
			return { ok: true, alreadyRunning: true, scheduler: formatScheduler(scheduler) };
		}

		unregisterCronTask(scheduler._id);
		registerCronTask(scheduler);

		scheduler.isRunning = true;
		await scheduler.save();

		console.log(`Scheduler started: "${scheduler.name}" (${scheduler._id}) — ${scheduler.cron}`);
		return { ok: true, started: true, scheduler: formatScheduler(scheduler) };
	}

	async function stopScheduler(schedulerId) {
		const scheduler = await PhotoScheduler.findById(schedulerId).populate("group");
		if (!scheduler) {
			return { ok: false, reason: "scheduler_not_found" };
		}

		unregisterCronTask(scheduler._id);
		scheduler.isRunning = false;
		await scheduler.save();

		console.log(`Scheduler stopped: "${scheduler.name}" (${scheduler._id})`);
		return { ok: true, stopped: true, scheduler: formatScheduler(scheduler) };
	}

	async function runNow(schedulerId) {
		const scheduler = await loadScheduler(schedulerId);
		if (!scheduler) {
			return { ok: false, reason: "scheduler_not_found" };
		}
		return dispatchScheduler(scheduler);
	}

	function formatScheduler(scheduler) {
		return {
			id: scheduler._id,
			name: scheduler.name,
			groupId: scheduler.group?._id || scheduler.group,
			groupName: scheduler.group?.name,
			chatId: scheduler.group?.chatId,
			photoIds: (scheduler.photos || []).map((p) => p._id || p),
			cron: scheduler.cron,
			timezone: scheduler.timezone,
			isRunning: scheduler.isRunning,
			isActive: scheduler.isActive,
		};
	}

	async function getStatus() {
		const schedulers = await PhotoScheduler.find()
			.populate("group", "name chatId isActive")
			.populate("photos", "title isActive")
			.sort({ createdAt: 1 });

		return {
			globalEnabled: config.scheduler.enabled !== false,
			defaultCron: config.scheduler.cron,
			defaultTimezone: config.scheduler.timezone,
			schedulers: schedulers.map((s) => ({
				...formatScheduler(s),
				cronRegistered: cronTasks.has(String(s._id)),
			})),
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
		const failed = results.length - activated;

		console.log(
			`Group activate-all: ${found.group.name} (${groupId}) — ${activated}/${results.length} activated`
		);

		return {
			ok: true,
			groupId,
			groupName: found.group.name,
			total: results.length,
			activated,
			failed,
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

		const deactivated = results.filter((r) => r.stopped || r.alreadyStopped).length;

		console.log(
			`Group deactivate-all: ${found.group.name} (${groupId}) — ${deactivated}/${results.length} deactivated`
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
		for (const schedule of schedules) {
			unregisterCronTask(schedule._id);
		}

		const deleteResult = await PhotoScheduler.deleteMany({
			_id: { $in: schedules.map((s) => s._id) },
		});

		console.log(`Deleted ${deleteResult.deletedCount} photo dispatch schedule(s)`);

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
		if (config.scheduler.enabled === false) {
			console.log("Scheduler engine disabled (SCHEDULER_ENABLED=false)");
			return;
		}

		const running = await PhotoScheduler.find({ isRunning: true, isActive: true });
		for (const scheduler of running) {
			try {
				await startScheduler(scheduler._id);
			} catch (err) {
				logger.error(`Failed to restore scheduler ${scheduler._id}: ${err.message}`);
				await PhotoScheduler.findByIdAndUpdate(scheduler._id, { isRunning: false });
			}
		}
		console.log(`Restored ${running.length} running scheduler(s)`);
	}

	await restoreRunningSchedulers();

	return {
		getStatus,
		startScheduler,
		stopScheduler,
		runNow,
		activateSchedulesForGroup,
		deactivateSchedulesForGroup,
		deleteSchedules,
	};
};
