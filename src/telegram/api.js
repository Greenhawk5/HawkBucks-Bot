const TELEGRAM_API = "https://api.telegram.org";


export async function sendMessage(
	env,
	chatId,
	text,
	options = {}
) {

	const url =
		`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;


	const response = await fetch(url, {

		method: "POST",

		headers:{
			"Content-Type":"application/json"
		},

		body: JSON.stringify({

			chat_id: chatId,
			text: text,
			parse_mode: options.parse_mode || "MarkdownV2",
			...(options.reply_to_message_id ? { reply_to_message_id: options.reply_to_message_id } : {}),
			reply_markup: options.reply_markup

		})

	});
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
        throw new Error(`Telegram sendMessage failed: ${payload.description || response.status}`);
    }
    return payload.result;

}

export async function sendPhoto(
    env,
    chatId,
    image,
    caption = "",
    options = {}
) {


    const form =
        new FormData();


    form.append(
        "chat_id",
        chatId
    );


    form.append(
        "caption",
        caption
    );

    form.append("parse_mode", options.parse_mode || "MarkdownV2");
    if (options.reply_to_message_id) {
        form.append("reply_to_message_id", String(options.reply_to_message_id));
    }


    if (typeof image === "string") {
        form.append("photo", image);
    } else {
        form.append(
            "photo",
            new Blob(
                [image],
                {
                    type:"image/png"
                }
            ),
            "missions.png"
        );
    }



    const response = await fetch(
        `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
        {
            method:"POST",
            body:form
        }
    );

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
        throw new Error(`Telegram sendPhoto failed: ${payload.description || response.status}`);
    }

    return payload.result;

}

export async function deleteMessage(env, chatId, messageId) {
    const response = await fetch(
        `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
        }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
        throw new Error(`Telegram deleteMessage failed: ${payload.description || response.status}`);
    }
    return payload.result;
}

export async function getChatMember(env, chatId, userId) {
    const response = await fetch(
        `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(userId)}`
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
        throw new Error(`Telegram getChatMember failed: ${payload.description || response.status}`);
    }
    return payload.result;
}

export async function answerCallbackQuery(env, callbackQueryId, options = {}) {
    const response = await fetch(
        `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                ...(options.text ? { text: options.text } : {}),
                ...(options.show_alert ? { show_alert: true } : {}),
            }),
        }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
        throw new Error(`Telegram answerCallbackQuery failed: ${payload.description || response.status}`);
    }
    return payload;
}

export async function editMessageReplyMarkup(env, chatId, messageId, replyMarkup) {
    const response = await fetch(
        `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                reply_markup: replyMarkup,
            }),
        }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
        throw new Error(`Telegram editMessageReplyMarkup failed: ${payload.description || response.status}`);
    }
    return payload.result;
}

export async function editMessageText(env, chatId, messageId, text, options = {}) {
    const response = await fetch(
        `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text,
                parse_mode: options.parse_mode || "MarkdownV2",
                ...(options.reply_markup ? { reply_markup: options.reply_markup } : {}),
            }),
        }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
        throw new Error(`Telegram editMessageText failed: ${payload.description || response.status}`);
    }
    return payload.result;
}
