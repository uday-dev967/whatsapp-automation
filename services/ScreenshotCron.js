const cron = require("node-cron");
const PhotoScheduler = require("../models/PhotoScheduler");
const SendLog = require("../models/SendLog");
const { logger } = require("../utils");

module.exports = async function ({ config, Services }) {
	const tasks = new Map();

	function stopJob(scheduleId) {
		const id = String(scheduleId);
		const task = tasks.get(id);
		if (task) {
			task.stop();
			tasks.delete(id);
		}
	}

	function stopAllJobs() {
		for (const id of [...tasks.keys()]) {
			stopJob(id);
		}
	}

	async function generateAndSend(schedule) {
		const scheduleId = String(schedule._id);
		const filters = schedule.filters || {};

		try {
			logger.info(`Cron tick → generating report for "${schedule.name}"`);

			const image = await Services.ReportImageService.generate(filters);
			const result = await Services.Scheduler.dispatchScreenshot(image, {
				scheduleId,
				caption: schedule.caption || undefined,
			});

			if (!result.ok) {
				const { messageForReason } = require("../utils/dispatchMessages");
				const message = messageForReason(result.reason) || result.reason;
				await SendLog.create({
					scheduleId: schedule._id,
					scheduleName: schedule.name,
					groupCount: 0,
					status: "failed",
					errorMessage: message,
					sentAt: new Date(),
				}).catch((e) => logger.error("SendLog write failed:", e));
				logger.warn(`Cron send failed for "${schedule.name}": ${message}`);
				return { ok: false, reason: result.reason, result };
			}

			const firstResult = result.results?.[0];
			await SendLog.create({
				scheduleId: firstResult?.scheduleId || schedule._id,
				scheduleName: firstResult?.scheduleName || schedule.name,
				groupIds: (result.results || []).map((r) => r.groupId),
				groupCount: result.sent || 0,
				status: "success",
				sentAt: new Date(),
			}).catch((e) => logger.error("SendLog write failed:", e));

			console.log(
				`Cron tick → report sent for "${schedule.name}" (${result.sent} group(s))`
			);
			return { ok: true, sent: result.sent, result };
		} catch (err) {
			logger.error(`Cron generate/send failed for "${schedule.name}":`, err.message);
			await SendLog.create({
				scheduleId: schedule._id,
				scheduleName: schedule.name,
				groupCount: 0,
				status: "failed",
				errorMessage: err.message,
				sentAt: new Date(),
			}).catch((e) => logger.error("SendLog write failed:", e));
			return { ok: false, reason: "report_generation_failed", error: err.message };
		}
	}

	async function refresh() {
		if (config.scheduler?.enabled === false) {
			stopAllJobs();
			return { ok: true, registered: 0 };
		}

		stopAllJobs();

		const schedules = await PhotoScheduler.find({
			isRunning: true,
			isActive: true,
		});

		let registered = 0;
		for (const schedule of schedules) {
			const id = String(schedule._id);
			if (!cron.validate(schedule.cron)) {
				logger.warn(`Invalid cron "${schedule.cron}" on schedule "${schedule.name}"`);
				continue;
			}

			const task = cron.schedule(
				schedule.cron,
				() => {
					generateAndSend(schedule).catch((err) => logger.error(err));
				},
				{ timezone: schedule.timezone || config.scheduler.timezone }
			);
			tasks.set(id, task);
			registered += 1;
			console.log(
				`Backend cron registered: "${schedule.name}" (${schedule.cron}, ${schedule.timezone || config.scheduler.timezone})`
			);
		}

		return { ok: true, registered };
	}

	async function triggerNow(scheduleId) {
		const schedule = await PhotoScheduler.findById(scheduleId);
		if (!schedule) {
			return { ok: false, reason: "scheduler_not_found" };
		}
		if (!schedule.isActive) {
			return { ok: false, reason: "scheduler_inactive" };
		}
		return generateAndSend(schedule);
	}

	return {
		refresh,
		triggerNow,
		stopAllJobs,
		generateAndSend,
	};
};
