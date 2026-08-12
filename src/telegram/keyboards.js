export function getMainKeyboard(isOwner = false, reminderEnabled = true) {

	const reminderStatus = reminderEnabled
		? "🟢 Daily Reminder"
		: "🔴 Daily Reminder";


	const keyboard = [
		[
			{
				text: "💰 V-Bucks Missions"
			},
			{
				text: reminderStatus
			}
		],
		[
			{
				text: "➕ Add to Group"
			}
		],
		[
			{
				text: "💚 Support"
			}
		]
	];


	if (isOwner) {

		keyboard.push([
			{
				text: "👑 Owner Panel"
			}
		]);

	}


	return {
		keyboard,
		resize_keyboard: true,
		persistent_keyboard: true
	};

}
