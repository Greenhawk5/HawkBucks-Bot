import { handleCommand } from "./telegram/commands.js";
import { generateScreenshot } from "./services/screenshot.js";
import { handleMyChatMember, handlePanelCallback } from "./telegram/groups.js";
import { runDailyReminder } from "./jobs/dailyReminder.js";


export default {

	async scheduled(event, env, ctx) {
		console.log("CRON_TRIGGER_RECEIVED", { cron: event.cron });
		ctx.waitUntil(runDailyReminder(env));
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
					await handlePanelCallback(env, env.hawkbucks_db, update.callback_query, ctx);
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
