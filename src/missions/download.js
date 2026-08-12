export async function downloadPage(url) {

    const response = await fetch(url, {
        headers: {
            "User-Agent": "HawkBucksBot/1.0"
        }
    });

    if (!response.ok) {
        throw new Error(
            `Unable to download ${url}`
        );
    }

    return await response.text();

}