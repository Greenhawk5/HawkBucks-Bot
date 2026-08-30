export function getMainKeyboard(isAdminUser = false, reminderEnabled = true) {

	const reminderStatus = reminderEnabled
		? "🟢 Daily Reminder"
		: "🔴 Daily Reminder";

	const keyboard = [];

	// Admin-only row: never rendered for normal users.
	if (isAdminUser) {
		keyboard.push([
			{
				text: "👑 Admin"
			}
		]);
	}

	keyboard.push(
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
	);

	return {
		keyboard,
		resize_keyboard: true,
		persistent_keyboard: true
	};

}
