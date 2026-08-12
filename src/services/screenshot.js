export async function generateScreenshot(html, env, layout) {
  if (!layout?.width || !layout?.canvasHeight) {
    throw new Error("Screenshot layout is missing dimensions");
  }

  console.log("SCREENSHOTONE REQUEST", {
    width: layout.width,
    height: layout.canvasHeight,
    mode: layout.mode,
    missionCount: layout.missionCount,
  });
  const response = await fetch(
    "https://api.screenshotone.com/take",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_key: env.SCREENSHOTONE_ACCESS_KEY,

        html: html,

        format: "png",
        response_type: "by_format",

        viewport_width: layout.width,
        viewport_height: layout.canvasHeight,
        device_scale_factor: 1,

        wait_until: [
          "load"
        ],

        block_ads: true,
        block_cookie_banners: true
      }),
    }
  );


  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `ScreenshotOne failed: ${error}`
    );
  }


  return await response.arrayBuffer();
}
