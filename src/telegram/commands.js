import { sendMessage } from "./api.js";
import { createUser, getUser } from "../../database/users.js";
import { getMainKeyboard } from "./keyboards.js";
import { handleButton } from "./buttons.js";
import { sendMissionReminder } from "../services/notification.js";
import { handlePanelCommand } from "./groups.js";
import { getTelegramCommand } from "./command-parser.js";
import {
	GENERIC_ERROR_MESSAGE,
	GROUP_HELP_MESSAGE,
	PANEL_PERMISSION_MESSAGE,
	PRIVATE_HELP_MESSAGE,
	RESTART_MESSAGE,
	START_MESSAGE,
	UNKNOWN_COMMAND_MESSAGE,
} from "./messages.js";


export async function handleCommand(
	env,
	db,
	message,
	ctx
) {

	const chatId = message.chat.id;
	const text = message.text;
	const command = getTelegramCommand(text);
	try {
		const isButton = await handleButton(env, db, message);

		if (isButton) return true;


	if (command === "start") {
		// Read the existing record first so /start never resets a saved
		// reminder preference. New records inherit the database default (enabled).
		const existingUser = await getUser(db, message.from.id);

		const user = {
			id: message.from.id,
			username: message.from.username,
			first_name: message.from.first_name
		};


		await createUser(
			db,
			user
		);


		await sendMessage(
			env,
			chatId,
			START_MESSAGE,
			{
				reply_markup: getMainKeyboard(
					false,
					existingUser ? existingUser.reminder_enabled === 1 : true
				)
			}
		);


		return true;
	}

	
	if (command === "restart") {
		const existingUser = await getUser(db, message.from.id);
		await sendMessage(env, chatId, RESTART_MESSAGE, {
			reply_markup: getMainKeyboard(
				false,
				existingUser ? existingUser.reminder_enabled === 1 : true
			)
		});
		return true;
	}



	if (command === "help") {


		await sendMessage(
			env,
			chatId,
			message.chat.type === "private" ? PRIVATE_HELP_MESSAGE : GROUP_HELP_MESSAGE
		);


		return true;
	}

	if (message.chat.type === "group" || message.chat.type === "supergroup") {
		if (command === "panel") {
			const result = await handlePanelCommand(env, db, message, ctx);
			if (result.denied) {
				await sendMessage(env, chatId, PANEL_PERMISSION_MESSAGE, {
					reply_to_message_id: message.message_id,
				});
			}
			return true;
		}

		if (command === "vbuck") {
			await sendMissionReminder(chatId, env, db, {
				replyToMessageId: message.message_id,
			});
			return true;
		}

		if (command === "daily") {
			const result = await handlePanelCommand(env, db, message, ctx);
			if (result.denied) {
				await sendMessage(env, chatId, PANEL_PERMISSION_MESSAGE, {
					reply_to_message_id: message.message_id,
				});
			}
			return true;
		}
	}


		if (command) {
			await sendMessage(env, chatId, UNKNOWN_COMMAND_MESSAGE);
			return true;
		}

		return false;
	} catch (error) {
		console.error("Telegram interaction failed", { chatId, error: error.message });
		await sendMessage(env, chatId, GENERIC_ERROR_MESSAGE);
		return true;
	}

}
