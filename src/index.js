import { handleCommand } from "./telegram/commands.js";
import { generateScreenshot } from "./services/screenshot.js";
import { handleMyChatMember, handlePanelCallback } from "./telegram/groups.js";
import { handleAdminCallback } from "./telegram/admin-panel.js";
import { runDailyReminder } from "./jobs/dailyReminder.js";
import { DAILY_REMINDER_DELAY_MS } from "./config/reminders.js";


export default {

	/**
	 * Cloudflare Cron Trigger entry point (daily reminder).
	 *
	 * Timing model (Cloudflare cron runs in UTC with minute granularity):
	 *   00:00:00 UTC  — `0 0 * * *` cron fires (declared in wrangler.jsonc)
	 *   +15 seconds   — DAILY_REMINDER_DELAY_MS deliberate sub-minute offset
	 *   ~00:00:15 UTC — runDailyReminder() starts
	 *
	 * Lifecycle: per the official Scheduled Handler documentation, the runtime
	 * waits for the Promise returned by scheduled() to resolve (up to the
	 * 15-minute duration limit), so a single critical task must be awaited
	 * directly instead of being registered fire-and-forget via ctx.waitUntil().
	 * Awaiting keeps the invocation open for the whole reminder pipeline and
	 * makes the recorded invocation outcome (ok / exception) reflect the real
	 * result of the job.
	 *
	 * Structured log lifecycle (in order):
	 *   CRON_TRIGGER_RECEIVED { cron, scheduledTime, actualTime, schedulerDelayMs }
	 *   CRON_DELAY_STARTED    { delayMs, delayTarget }
	 *   CRON_DELAY_FINISHED   { delayMs, waitedMs }
	 *   CRON_REMINDER_*       (pipeline logs, see src/jobs/dailyReminder.js)
	 *   CRON_TASK_COMPLETED   { totalDurationMs, schedulerDelayMs, result }
	 *   CRON_TASK_FAILED      { totalDurationMs, schedulerDelayMs, error }
	 *
	 * schedulerDelayMs = actual start − scheduledTime isolates Cloudflare-side
	 * lateness from our own intentional 15-second delay. A canceled invocation
	 * never reaches its terminal CRON_TASK_* event, so the last CRON_* event
	 * present in Workers Logs identifies exactly which phase was interrupted.
	 */
	async scheduled(event, env, ctx) {
		const actualTimeMs = Date.now();
		const scheduledTimeMs = Number.isFinite(event?.scheduledTime)
			? event.scheduledTime
			: actualTimeMs;
		const schedulerDelayMs = Math.max(0, actualTimeMs - scheduledTimeMs);
		const invocationStartMs = actualTimeMs;

		console.log("CRON_TRIGGER_RECEIVED", {
			cron: event.cron,
			scheduledTime: new Date(scheduledTimeMs).toISOString(),
			actualTime: new Date(actualTimeMs).toISOString(),
			schedulerDelayMs,
		});

		try {
			if (DAILY_REMINDER_DELAY_MS > 0) {
				const delayStartMs = Date.now();
				console.log("CRON_DELAY_STARTED", {
					delayMs: DAILY_REMINDER_DELAY_MS,
					delayTarget: new Date(delayStartMs + DAILY_REMINDER_DELAY_MS).toISOString(),
				});
				// scheduler.wait() is the Workers-native await-able delay API
				// (an alternative to setTimeout that needs no callback).
				await scheduler.wait(DAILY_REMINDER_DELAY_MS);
				console.log("CRON_DELAY_FINISHED", {
					delayMs: DAILY_REMINDER_DELAY_MS,
					waitedMs: Date.now() - delayStartMs,
				});
			}

			const result = await runDailyReminder(env);

			console.log("CRON_TASK_COMPLETED", {
				totalDurationMs: Date.now() - invocationStartMs,
				schedulerDelayMs,
				result,
			});
		} catch (error) {
			console.error("CRON_TASK_FAILED", {
				totalDurationMs: Date.now() - invocationStartMs,
				schedulerDelayMs,
				error: error?.message || String(error),
			});
			// Propagate so the Cron invocation outcome records the failure
			// (exception) instead of a misleading success or cancel status.
			throw error;
		}
	},

	async fetch(request, env, ctx) {


		// Test ScreenshotOne API
		if (
			request.method === "GET" &&
			new URL(request.url).pathname === "/test-image"
		) {

			const html = `
			<html>
			<body style="
				width:1080px;
				height:1620px;
				background:#111315;
				color:white;
				display:flex;
				align-items:center;
				justify-content:center;
				font-size:60px;
				font-family:Arial;
			">
				HawkBucks Screenshot Test
			</body>
			</html>
			`;


			const image = await generateScreenshot(
				html,
				env
			);


			return new Response(
				image,
				{
					headers:{
						"Content-Type":"image/png"
					}
				}
			);

		}



		// Health check
		if (request.method === "GET") {

			return new Response(
				"HawkBucks Telegram Bot is alive 🚀"
			);

		}




		// Telegram webhook handler
		if (request.method === "POST") {


			try {


				const update = await request.json();


				console.log(
					"Telegram update received:",
					JSON.stringify(update)
				);



				if (update.message) {


					await handleCommand(
						env,
						env.hawkbucks_db,
						update.message,
						ctx
					);


				}

				if (update.my_chat_member) {
					await handleMyChatMember(env, update);
				}

				if (update.callback_query) {
					const callbackData = update.callback_query?.data || "";

					if (callbackData.startsWith("admin:")) {
						// Admin Panel router (verifies the sender itself, fails closed).
						await handleAdminCallback(env, env.hawkbucks_db, update.callback_query, ctx);
					} else {
						// Existing group panel router (group_panel:*).
						await handlePanelCallback(env, env.hawkbucks_db, update.callback_query, ctx);
					}
				}



				return new Response(
					"OK"
				);



			} catch (error) {


				console.error(
					"Webhook error:",
					error
				);



				return new Response(
					"HawkBucks could not process that update.",
					{
						status:500
					}
				);

			}


		}



		return new Response(
			"Method Not Allowed",
			{
				status:405
			}
		);


	}

};
