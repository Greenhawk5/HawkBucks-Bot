export async function createUser(db, user) {

	const query = `
		INSERT INTO users (
			telegram_id,
			username,
			first_name
		)
		VALUES (?, ?, ?)
		ON CONFLICT(telegram_id)
		DO UPDATE SET
			username = excluded.username,
			first_name = excluded.first_name,
			last_seen = CURRENT_TIMESTAMP;
	`;


	await db
		.prepare(query)
		.bind(
			String(user.id),
			user.username || null,
			user.first_name || null
		)
		.run();

}



export async function getUser(db, telegramId) {

	const result = await db
		.prepare(
			"SELECT * FROM users WHERE telegram_id = ?"
		)
		.bind(String(telegramId))
		.first();


	return result;

}


export async function toggleReminder(db, telegramId) {


	const user = await getUser(
		db,
		telegramId
	);


	if (!user) {
		return null;
	}


	const newStatus =
		user.reminder_enabled === 1
			? 0
			: 1;



	await db
		.prepare(
			`
			UPDATE users
			SET reminder_enabled = ?
			WHERE telegram_id = ?
			`
		)
		.bind(
			newStatus,
			String(telegramId)
		)
		.run();



	return newStatus;

}