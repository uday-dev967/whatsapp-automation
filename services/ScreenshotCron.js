const cron = require("node-cron");
const PhotoScheduler = require("../models/PhotoScheduler");
const { logger } = require("../utils");

module.exports = async function ({ config, Services }) {
	let io = null;
	const tasks = new Map();

	function setIo(socketIo) {
		io = socketIo;
	}

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

	async function emitCapture(schedule) {
		const payload = {
			scheduleId: String(schedule._id),
			scheduleName: schedule.name,
			caption: schedule.caption || "",
			cron: schedule.cron,
		};

		if (!io) {
			logger.warn(
				`Cron tick for "${schedule.name}" but no Socket.IO server — open ReportFlow UI`
			);
			return { ok: false, reason: "socket_not_ready" };
		}

		const connected = io.engine?.clientsCount ?? 0;
		if (connected === 0) {
			logger.warn(
				`Cron tick for "${schedule.name}" but no ReportFlow UI connected — open the app in a browser tab`
			);
		}

		io.emit("screenshot:capture", payload);
		console.log(
			`Cron tick → screenshot:capture "${schedule.name}" (${connected} UI client(s) connected)`
		);
		return { ok: true, emitted: true, clientsConnected: connected };
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
					emitCapture(schedule).catch((err) => logger.error(err));
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
		return emitCapture(schedule);
	}

	return {
		setIo,
		refresh,
		triggerNow,
		stopAllJobs,
	};
};
