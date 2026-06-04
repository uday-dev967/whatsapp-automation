const mongoose = require("mongoose");
const Photo = require("../models/Photo");
const PhotoScheduler = require("../models/PhotoScheduler");
const WhatsAppGroup = require("../models/WhatsAppGroup");
const { logger } = require("../utils");
const { parseScheduleId, scheduleNotFoundResponse } = require("../utils/parseScheduleId");
const { parseGroupId, validateScheduleIdList } = require("../utils/parseGroupId");

async function listRegisteredGroups(req, res) {
	const groups = await WhatsAppGroup.find().populate("photos").sort({ createdAt: 1 });
	const groupIds = groups.map((g) => g._id);

	const scheduleStats = await PhotoScheduler.aggregate([
		{ $match: { group: { $in: groupIds } } },
		{
			$group: {
				_id: "$group",
				scheduleCount: { $sum: 1 },
				runningScheduleCount: {
					$sum: { $cond: [{ $eq: ["$isRunning", true] }, 1, 0] },
				},
			},
		},
	]);

	const statsByGroupId = Object.fromEntries(
		scheduleStats.map((row) => [
			String(row._id),
			{
				scheduleCount: row.scheduleCount,
				runningScheduleCount: row.runningScheduleCount,
			},
		])
	);

	const enrichedGroups = groups.map((group) => {
		const stats = statsByGroupId[String(group._id)] || {
			scheduleCount: 0,
			runningScheduleCount: 0,
		};
		return {
			...group.toObject(),
			...stats,
		};
	});

	res.json({
		ok: true,
		count: enrichedGroups.length,
		groups: enrichedGroups,
	});
}

module.exports.routes = function ({ Services, config }) {
	return {
		"GET /photo-library": {
			handler: async function (req, res) {
				try {
					const photos = await Photo.find().sort({ createdAt: 1 });
					res.json({ ok: true, photos });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /registered-groups": {
			handler: async function (req, res) {
				try {
					await listRegisteredGroups(req, res);
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /target-groups": {
			handler: async function (req, res) {
				try {
					await listRegisteredGroups(req, res);
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /target-groups/:groupId/activate-schedules": {
			handler: async function (req, res) {
				try {
					const parsed = parseGroupId(req.params.groupId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const result = await Services.Scheduler.activateSchedulesForGroup(parsed.groupId);
					if (!result.ok) {
						const status = result.reason === "group_not_found" ? 404 : 400;
						return res.status(status).json({ ok: false, ...result });
					}
					res.json({ ok: true, result });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /target-groups/:groupId/deactivate-schedules": {
			handler: async function (req, res) {
				try {
					const parsed = parseGroupId(req.params.groupId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const result = await Services.Scheduler.deactivateSchedulesForGroup(parsed.groupId);
					if (!result.ok) {
						const status = result.reason === "group_not_found" ? 404 : 400;
						return res.status(status).json({ ok: false, ...result });
					}
					res.json({ ok: true, result });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /target-groups": {
			handler: async function (req, res) {
				try {
					const { name, chatId, photoIds = [], isActive = true } = req.body;
					if (!name || !chatId) {
						return res.status(400).json({ ok: false, message: "name and chatId are required" });
					}

					if (photoIds.length) {
						const found = await Photo.countDocuments({ _id: { $in: photoIds } });
						if (found !== photoIds.length) {
							return res.status(400).json({
								ok: false,
								message: "One or more photoIds do not exist in the photo library",
							});
						}
					}

					const group = await WhatsAppGroup.create({
						name,
						chatId,
						photos: photoIds,
						isActive,
					});

					const populated = await WhatsAppGroup.findById(group._id).populate("photos");
					res.status(201).json({ ok: true, group: populated });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /whatsapp/connection-status": {
			handler: async function (req, res) {
				const ready = Services.Whatsapp.isReady();
				res.json({
					ok: true,
					ready,
					mode: "remote",
					serverUrl: config.whatsapp.serverUrl,
					hint: ready
						? "WhatsApp is connected"
						: "Terminal 1: npm run wa:server → wait for 'Client is ready'. Terminal 2: npm run dev (or nodemon rs)",
				});
			},
		},

		"GET /whatsapp/available-groups": {
			handler: async function (req, res) {
				try {
					if (!Services.Whatsapp.isReady()) {
						return res.status(503).json({ ok: false, message: "WhatsApp client is not ready" });
					}
					const groups = await Services.Whatsapp.listGroups();
					res.json({
						ok: true,
						count: groups.length,
						groups,
						hint:
							groups.length === 0
								? "Open WhatsApp Web in the wa:server Chrome window and click each group once to load chats, then call this again. Or register a target with POST /target-groups using chatId from a group invite link."
								: undefined,
					});
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /photo-dispatch-schedules": {
			handler: async function (req, res) {
				try {
					const filter = {};
					if (req.query.groupId) {
						if (!mongoose.Types.ObjectId.isValid(req.query.groupId)) {
							return res.status(400).json({
								ok: false,
								message: "groupId query must be a valid MongoDB ObjectId",
							});
						}
						filter.group = req.query.groupId;
					}

					const schedules = await PhotoScheduler.find(filter)
						.populate("group", "name chatId isActive")
						.populate("photos", "title url isActive")
						.sort({ createdAt: 1 });
					res.json({ ok: true, count: schedules.length, schedules });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /photo-dispatch-schedules/status": {
			handler: async function (req, res) {
				try {
					const status = await Services.Scheduler.getStatus();
					res.json({ ok: true, ...status });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /photo-dispatch-schedules/:scheduleId": {
			handler: async function (req, res) {
				try {
					const parsed = parseScheduleId(req.params.scheduleId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const schedule = await PhotoScheduler.findById(parsed.scheduleId)
						.populate("group", "name chatId isActive")
						.populate("photos", "title url isActive");
					if (!schedule) {
						const notFound = scheduleNotFoundResponse(parsed.scheduleId);
						return res.status(notFound.status).json(notFound.body);
					}
					res.json({ ok: true, schedule });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"DELETE /photo-dispatch-schedules": {
			handler: async function (req, res) {
				try {
					const { scheduleIds, groupId } = req.body || {};

					if (groupId) {
						const parsed = parseGroupId(groupId);
						if (!parsed.ok) {
							return res.status(parsed.status).json(parsed.body);
						}

						const result = await Services.Scheduler.deleteSchedules({
							groupId: parsed.groupId,
						});
						if (!result.ok) {
							const status = result.reason === "group_not_found" ? 404 : 400;
							return res.status(status).json({ ok: false, ...result });
						}
						return res.json({ ok: true, result });
					}

					const validated = validateScheduleIdList(scheduleIds);
					if (!validated.ok) {
						return res.status(400).json(validated.body);
					}

					const result = await Services.Scheduler.deleteSchedules({
						scheduleIds: validated.scheduleIds,
					});
					if (!result.ok) {
						return res.status(400).json({ ok: false, ...result });
					}
					res.json({ ok: true, result });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /photo-dispatch-schedules": {
			handler: async function (req, res) {
				try {
					const {
						name,
						groupId,
						photoIds = [],
						cron = config.scheduler.cron,
						timezone = config.scheduler.timezone,
						start = false,
						isActive = true,
					} = req.body;

					if (!name || !groupId) {
						return res.status(400).json({
							ok: false,
							message: "name and groupId are required",
						});
					}
					if (!photoIds.length) {
						return res.status(400).json({
							ok: false,
							message: "photoIds must include at least one photo from the photo library",
						});
					}

					const group = await WhatsAppGroup.findById(groupId);
					if (!group) {
						return res.status(404).json({ ok: false, message: "Target group not found" });
					}

					const foundPhotos = await Photo.countDocuments({ _id: { $in: photoIds } });
					if (foundPhotos !== photoIds.length) {
						return res.status(400).json({
							ok: false,
							message: "One or more photoIds do not exist in the photo library",
						});
					}

					const schedule = await PhotoScheduler.create({
						name,
						group: groupId,
						photos: photoIds,
						cron,
						timezone,
						isActive,
						isRunning: false,
					});

					let activateResult = null;
					if (start) {
						activateResult = await Services.Scheduler.startScheduler(schedule._id);
					}

					const populated = await PhotoScheduler.findById(schedule._id)
						.populate("group", "name chatId isActive")
						.populate("photos", "title url isActive");

					res.status(201).json({ ok: true, schedule: populated, activateResult });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /photo-dispatch-schedules/:scheduleId/activate": {
			handler: async function (req, res) {
				try {
					const result = await Services.Scheduler.startScheduler(req.params.scheduleId);
					if (!result.ok) {
						const status = result.reason === "scheduler_not_found" ? 404 : 400;
						return res.status(status).json({ ok: false, ...result });
					}
					res.json({ ok: true, result });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /photo-dispatch-schedules/:scheduleId/deactivate": {
			handler: async function (req, res) {
				try {
					const result = await Services.Scheduler.stopScheduler(req.params.scheduleId);
					if (!result.ok) {
						return res.status(404).json({ ok: false, ...result });
					}
					res.json({ ok: true, result });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /photo-dispatch-schedules/:scheduleId/dispatch-now": {
			handler: async function (req, res) {
				try {
					const result = await Services.Scheduler.runNow(req.params.scheduleId);
					if (!result.ok) {
						const status = result.reason === "scheduler_not_found" ? 404 : 503;
						return res.status(status).json({ ok: false, result });
					}
					res.json({ ok: true, result });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},
	};
};
