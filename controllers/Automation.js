const mongoose = require("mongoose");
const PhotoScheduler = require("../models/PhotoScheduler");
const WhatsAppGroup = require("../models/WhatsAppGroup");
const SendLog = require("../models/SendLog");
const { logger } = require("../utils");
const { parseScheduleId, scheduleNotFoundResponse } = require("../utils/parseScheduleId");
const { parseGroupId, validateScheduleIdList } = require("../utils/parseGroupId");
const { screenshotFromRequest, assertValidScreenshot } = require("../utils/screenshotPayload");

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

		"POST /target-groups": {
			handler: async function (req, res) {
				try {
					const {
						name,
						chatId,
						isActive = true,
						state = "",
						region = "",
						manager = "",
						reportTypes = ["Productivity Report"],
					} = req.body;

					if (!name || !chatId) {
						return res.status(400).json({ ok: false, message: "name and chatId are required" });
					}

					const group = await WhatsAppGroup.create({
						name,
						chatId,
						isActive,
						state,
						region,
						manager,
						reportTypes,
					});

					res.status(201).json({ ok: true, group });
				} catch (e) {
					logger.error(e);
					if (e.code === 11000) {
						return res.status(409).json({ ok: false, message: "A group with this chatId already exists" });
					}
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"PUT /target-groups/:groupId": {
			handler: async function (req, res) {
				try {
					const parsed = parseGroupId(req.params.groupId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const { name, chatId, isActive, state, region, manager, reportTypes } = req.body;
					const updates = {};
					if (name !== undefined) updates.name = name;
					if (chatId !== undefined) updates.chatId = chatId;
					if (isActive !== undefined) updates.isActive = isActive;
					if (state !== undefined) updates.state = state;
					if (region !== undefined) updates.region = region;
					if (manager !== undefined) updates.manager = manager;
					if (reportTypes !== undefined) updates.reportTypes = reportTypes;

					const group = await WhatsAppGroup.findByIdAndUpdate(
						parsed.groupId,
						{ $set: updates },
						{ new: true, runValidators: true }
					);

					if (!group) {
						return res.status(404).json({ ok: false, message: "Group not found" });
					}

					res.json({ ok: true, group });
				} catch (e) {
					logger.error(e);
					if (e.code === 11000) {
						return res.status(409).json({ ok: false, message: "A group with this chatId already exists" });
					}
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"DELETE /target-groups/:groupId": {
			handler: async function (req, res) {
				try {
					const parsed = parseGroupId(req.params.groupId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const group = await WhatsAppGroup.findByIdAndDelete(parsed.groupId);
					if (!group) {
						return res.status(404).json({ ok: false, message: "Group not found" });
					}

					res.json({ ok: true, message: "Group deleted", group });
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
								? "Open WhatsApp Web in the wa:server Chrome window and click each group once to load chats, then call this again."
								: undefined,
					});
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /whatsapp/contacts": {
			handler: async function (req, res) {
				try {
					if (!Services.Whatsapp.isReady()) {
						return res.status(503).json({ ok: false, message: "WhatsApp client is not ready" });
					}
					const q = req.query.q != null ? String(req.query.q) : "";
					const contacts = await Services.Whatsapp.listContacts(q);
					res.json({ ok: true, count: contacts.length, contacts });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /whatsapp/groups": {
			handler: async function (req, res) {
				try {
					if (!Services.Whatsapp.isReady()) {
						return res.status(503).json({ ok: false, message: "WhatsApp client is not ready" });
					}
					const { name, participantIds } = req.body || {};
					if (!name || !Array.isArray(participantIds) || !participantIds.length) {
						return res.status(400).json({
							ok: false,
							message: "name and a non-empty participantIds array are required",
						});
					}
					const created = await Services.Whatsapp.createWAGroup(name, participantIds);
					res.status(201).json({
						ok: true,
						chatId: created.chatId,
						name: created.name,
						participantCount: created.participantCount,
					});
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"GET /whatsapp/group-members": {
			handler: async function (req, res) {
				try {
					if (!Services.Whatsapp.isReady()) {
						return res.status(503).json({ ok: false, message: "WhatsApp client is not ready" });
					}
					const chatId = req.query.chatId != null ? String(req.query.chatId).trim() : "";
					if (!chatId) {
						return res.status(400).json({ ok: false, message: "chatId query parameter is required" });
					}
					const members = await Services.Whatsapp.getGroupMembers(chatId);
					res.json({ ok: true, chatId, count: members.length, members });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /whatsapp/group-members/add": {
			handler: async function (req, res) {
				try {
					if (!Services.Whatsapp.isReady()) {
						return res.status(503).json({ ok: false, message: "WhatsApp client is not ready" });
					}
					const { chatId, participantIds } = req.body || {};
					if (!chatId || !Array.isArray(participantIds) || !participantIds.length) {
						return res.status(400).json({
							ok: false,
							message: "chatId and a non-empty participantIds array are required",
						});
					}
					const result = await Services.Whatsapp.addGroupMembers(chatId, participantIds);
					const members = await Services.Whatsapp.getGroupMembersAfterChange(chatId, {
						addedIds: participantIds,
					});
					res.json({
						ok: true,
						chatId: String(chatId).trim(),
						...result,
						count: members.length,
						members,
					});
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /whatsapp/group-members/remove": {
			handler: async function (req, res) {
				try {
					if (!Services.Whatsapp.isReady()) {
						return res.status(503).json({ ok: false, message: "WhatsApp client is not ready" });
					}
					const { chatId, participantIds } = req.body || {};
					if (!chatId || !Array.isArray(participantIds) || !participantIds.length) {
						return res.status(400).json({
							ok: false,
							message: "chatId and a non-empty participantIds array are required",
						});
					}
					const result = await Services.Whatsapp.removeGroupMembers(chatId, participantIds);
					const members = await Services.Whatsapp.getGroupMembersAfterChange(chatId, {
						removedIds: participantIds,
					});
					res.json({
						ok: true,
						chatId: String(chatId).trim(),
						...result,
						count: members.length,
						members,
					});
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /screenshots/dispatch": {
			handler: async function (req, res) {
				try {
					const image = screenshotFromRequest(req);
					const imageCheck = image
						? assertValidScreenshot(image)
						: { ok: false, reason: "missing_screenshot" };
					if (!imageCheck.ok) {
						const { messageForReason } = require("../utils/dispatchMessages");
						const reason = imageCheck.reason || "missing_screenshot";
						return res.status(400).json({
							ok: false,
							message: messageForReason(reason) || reason,
							result: { reason },
						});
					}

					const { scheduleId, groupId, caption, manual } = req.body || {};
					const isManual =
						manual === true ||
						manual === "true" ||
						manual === 1 ||
						manual === "1";

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

					const { messageForReason } = require("../utils/dispatchMessages");

					logger.info(
						`POST /screenshots/dispatch — ${image.buffer.length} bytes, manual=${isManual}, scheduleId=${scheduleId || "(none)"}, waReady=${Services.Whatsapp.isReady()}`
					);

					const result = await Services.Scheduler.dispatchScreenshot(image, {
						scheduleId: scheduleId ? String(scheduleId).trim() : undefined,
						groupId: groupId ? String(groupId).trim() : undefined,
						caption,
						manual: isManual,
					});

					if (!result.ok) {
						const status =
							result.reason === "scheduler_not_found" || result.reason === "group_not_found"
								? 404
								: result.reason === "whatsapp_not_ready"
									? 503
									: 400;
						const message = messageForReason(result.reason);
						SendLog.create({
							scheduleName: isManual ? "Manual dispatch" : "Scheduled dispatch",
							groupCount: 0,
							status: "failed",
							errorMessage: message,
							sentAt: new Date(),
						}).catch((e) => logger.error("SendLog write failed:", e));
						return res.status(status).json({ ok: false, message, result });
					}

					const firstResult = result.results?.[0];
					SendLog.create({
						scheduleId: firstResult?.scheduleId || undefined,
						scheduleName: firstResult?.scheduleName || "Manual dispatch",
						groupIds: (result.results || []).map((r) => r.groupId),
						groupCount: result.sent || 0,
						status: "success",
						sentAt: new Date(),
					}).catch((e) => logger.error("SendLog write failed:", e));

					logger.info(
						`Dispatch complete — sent=${result.sent}, targets=${(result.results || []).length}`
					);
					res.json({ ok: true, result });
				} catch (e) {
					logger.error("POST /screenshots/dispatch failed:", e);
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
						.populate("groups", "name chatId isActive")
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

					const schedule = await PhotoScheduler.findById(parsed.scheduleId)
						.populate("group", "name chatId isActive")
						.populate("groups", "name chatId isActive");
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
						groupIds,
						cron = config.scheduler.cron,
						timezone = config.scheduler.timezone,
						caption = "",
						start = false,
						isActive = true,
					} = req.body;

					let primaryGroupId = groupId;
					const allGroupIds = Array.isArray(groupIds) ? groupIds : [];
					if (!primaryGroupId && allGroupIds.length > 0) {
						primaryGroupId = allGroupIds[0];
					}

					if (!name || !primaryGroupId) {
						return res.status(400).json({
							ok: false,
							message: "name and at least one group (groupId or groupIds[0]) are required",
						});
					}

					const group = await WhatsAppGroup.findById(primaryGroupId);
					if (!group) {
						return res.status(404).json({ ok: false, message: "Target group not found" });
					}

					const schedule = await PhotoScheduler.create({
						name,
						group: primaryGroupId,
						groups: allGroupIds,
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

					const populated = await PhotoScheduler.findById(schedule._id)
						.populate("group", "name chatId isActive")
						.populate("groups", "name chatId isActive");

					res.status(201).json({ ok: true, schedule: populated, activateResult });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"PUT /screenshot-dispatch-schedules/:scheduleId": {
			handler: async function (req, res) {
				try {
					const parsed = parseScheduleId(req.params.scheduleId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const { name, groupId, groupIds, cron, timezone, caption, isActive } = req.body;
					const updates = {};
					if (name !== undefined) updates.name = name;
					if (cron !== undefined) updates.cron = cron;
					if (timezone !== undefined) updates.timezone = timezone;
					if (caption !== undefined) updates.caption = caption;
					if (isActive !== undefined) updates.isActive = isActive;

					if (groupId !== undefined) {
						const g = await WhatsAppGroup.findById(groupId);
						if (!g) {
							return res.status(404).json({ ok: false, message: "Target group not found" });
						}
						updates.group = groupId;
					}

					if (groupIds !== undefined) {
						updates.groups = groupIds;
						if (!updates.group && groupIds.length > 0) {
							updates.group = groupIds[0];
						}
					}

					const schedule = await PhotoScheduler.findByIdAndUpdate(
						parsed.scheduleId,
						{ $set: updates },
						{ new: true, runValidators: true }
					)
						.populate("group", "name chatId isActive")
						.populate("groups", "name chatId isActive");

					if (!schedule) {
						const notFound = scheduleNotFoundResponse(parsed.scheduleId);
						return res.status(notFound.status).json(notFound.body);
					}

					if (
						schedule.isRunning &&
						Services.ScreenshotCron?.refresh &&
						(cron !== undefined || timezone !== undefined)
					) {
						await Services.ScreenshotCron.refresh();
					}

					res.json({ ok: true, schedule });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},

		"POST /screenshot-dispatch-schedules/:scheduleId/dispatch-now": {
			handler: async function (req, res) {
				try {
					const parsed = parseScheduleId(req.params.scheduleId);
					if (!parsed.ok) {
						return res.status(parsed.status).json(parsed.body);
					}

					const result = await Services.ScreenshotCron.triggerNow(parsed.scheduleId);
					if (!result.ok) {
						const status = result.reason === "scheduler_not_found" ? 404 : 400;
						return res.status(status).json({ ok: false, ...result });
					}

					res.json({
						ok: true,
						message:
							"Capture requested via Socket.IO — ensure ReportFlow UI is open, then it will POST /screenshots/dispatch",
						result,
					});
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

		"GET /send-logs": {
			handler: async function (req, res) {
				try {
					const limit = Math.min(parseInt(req.query.limit) || 10, 100);
					const logs = await SendLog.find().sort({ sentAt: -1 }).limit(limit);
					res.json({ ok: true, count: logs.length, logs });
				} catch (e) {
					logger.error(e);
					res.status(500).json({ ok: false, message: e.message });
				}
			},
		},
	};
};
