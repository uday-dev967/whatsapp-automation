const mongoose = require("mongoose");
const PhotoScheduler = require("../models/PhotoScheduler");
const WhatsAppGroup = require("../models/WhatsAppGroup");
const { logger } = require("../utils");
const { parseScheduleId, scheduleNotFoundResponse } = require("../utils/parseScheduleId");
const { parseGroupId, validateScheduleIdList } = require("../utils/parseGroupId");
const { screenshotFromRequest } = require("../utils/screenshotPayload");

async function listRegisteredGroups(req, res) {
	const groups = await WhatsAppGroup.find().sort({ createdAt: 1 });
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
					const { name, chatId, isActive = true } = req.body;
					if (!name || !chatId) {
						return res.status(400).json({ ok: false, message: "name and chatId are required" });
					}

					const group = await WhatsAppGroup.create({
						name,
						chatId,
						isActive,
					});

					res.status(201).json({ ok: true, group });
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

		"POST /screenshots/dispatch": {
			localMiddlewares: ["screenshotUpload"],
			handler: async function (req, res) {
				try {
					const image = screenshotFromRequest(req);
					if (!image) {
						return res.status(400).json({
							ok: false,
							message:
								"Screenshot required: multipart field 'image' or JSON body 'imageBase64' (+ optional mimeType)",
						});
					}

					const { scheduleId, groupId, caption } = req.body || {};

					if (scheduleId) {
						const parsed = parseScheduleId(scheduleId);
						if (!parsed.ok) {
							return res.status(parsed.status).json(parsed.body);
						}
					}
					if (groupId) {
						const parsed = parseGroupId(groupId);
						if (!parsed.ok) {
							return res.status(parsed.status).json(parsed.body);
						}
					}

					const result = await Services.Scheduler.dispatchScreenshot(image, {
						scheduleId: scheduleId ? String(scheduleId).trim() : undefined,
						groupId: groupId ? String(groupId).trim() : undefined,
						caption,
					});

					if (!result.ok) {
						const status =
							result.reason === "scheduler_not_found" || result.reason === "group_not_found"
								? 404
								: result.reason === "whatsapp_not_ready"
									? 503
									: 400;
						return res.status(status).json({ ok: false, result });
					}

					res.json({ ok: true, result });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /screenshot-dispatch-schedules": {
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
					if (req.query.running === "true") {
						filter.isRunning = true;
					}

					const schedules = await PhotoScheduler.find(filter)
						.populate("group", "name chatId isActive")
						.sort({ createdAt: 1 });
					res.json({ ok: true, count: schedules.length, schedules });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /screenshot-dispatch-schedules/status": {
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

		"GET /screenshot-dispatch-schedules/:scheduleId": {
			handler: async function (req, res) {
				try {
					const parsed = parseScheduleId(req.params.scheduleId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const schedule = await PhotoScheduler.findById(parsed.scheduleId).populate(
						"group",
						"name chatId isActive"
					);
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

		"DELETE /screenshot-dispatch-schedules": {
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

		"POST /screenshot-dispatch-schedules": {
			handler: async function (req, res) {
				try {
					const {
						name,
						groupId,
						cron = config.scheduler.cron,
						timezone = config.scheduler.timezone,
						caption = "",
						start = false,
						isActive = true,
					} = req.body;

					if (!name || !groupId) {
						return res.status(400).json({
							ok: false,
							message: "name and groupId are required",
						});
					}

					const group = await WhatsAppGroup.findById(groupId);
					if (!group) {
						return res.status(404).json({ ok: false, message: "Target group not found" });
					}

					const schedule = await PhotoScheduler.create({
						name,
						group: groupId,
						cron,
						timezone,
						caption,
						isActive,
						isRunning: false,
					});

					let activateResult = null;
					if (start) {
						activateResult = await Services.Scheduler.startScheduler(schedule._id);
					}

					const populated = await PhotoScheduler.findById(schedule._id).populate(
						"group",
						"name chatId isActive"
					);

					res.status(201).json({ ok: true, schedule: populated, activateResult });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /screenshot-dispatch-schedules/:scheduleId/activate": {
			handler: async function (req, res) {
				try {
					const parsed = parseScheduleId(req.params.scheduleId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const result = await Services.Scheduler.startScheduler(parsed.scheduleId);
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

		"POST /screenshot-dispatch-schedules/:scheduleId/deactivate": {
			handler: async function (req, res) {
				try {
					const parsed = parseScheduleId(req.params.scheduleId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const result = await Services.Scheduler.stopScheduler(parsed.scheduleId);
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
	};
};
