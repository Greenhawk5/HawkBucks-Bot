# HawkBucks mission image template

Static HTML + CSS template rendered to a **1080 × 1620** PNG by the Cloudflare Worker.
No JS, no frameworks, no external requests at render time.

## Files

- `mission-template.html` — full page, sample data (5 missions)
- `styles.css` — all styling; the card component is its own block
- `icons/` — PNG assets (see below)
- `fonts/` — bundled Sora + Inter variable `.ttf` files (no network at render time)

## JSON shape

```json
{
  "date": "July 26, 2026",
  "totalVbucks": 100,
  "resetTimer": "15:25:13",
  "missions": [
    {
      "type": "Storm Shield Defense",
      "iconKey": "storm-shield-defense",
      "zone": "Twine Peaks",
      "biome": "Ghost Town",
      "vbucks": 50,
      "powerLevel": 132
    }
  ]
}
```

## Rendering rules

1. Replace the header date, total badge value and footer timer.
2. Repeat the block between `<!-- CARD COMPONENT -->` markers once per mission —
   nothing else changes. Cards are flex, no absolute positioning.
3. If `missions.length >= 8`, add `class="count-dense"` to `<body>`.
   That is the only layout switch; 2–10 missions all fit the fixed canvas.
4. Screenshot `.canvas` at viewport 1080 × 1620, `deviceScaleFactor: 1`.

## Icon paths (reserved slots, drop-in)

| Slot          | Path                                | Rendered size |
| ------------- | ----------------------------------- | ------------- |
| Logo          | `icons/logo.png`                    | 96 × 96       |
| Mission type  | `icons/missions/<iconKey>.png`      | 64 × 64       |
| V-Bucks       | `icons/vbucks.png`                  | 34 × 34 / 30  |
| Power level   | `icons/power.png`                   | 22 × 22       |

`iconKey` is the mission type lowercased and hyphenated. Icons are `object-fit: contain`
inside their box, so square transparent PNGs (recommended 128 px source) drop in cleanly.

> The uploaded `Mission_Icons.zip` arrived empty, so these paths are placeholders.
> Re-upload the pack and the filenames can be mapped exactly.

## Tokens

| Token           | Value     |
| --------------- | --------- |
| Background      | `#111315` |
| Card            | `#1B1E22` |
| Border          | `#262A2F` |
| Primary accent  | `#36D97E` |
| Secondary accent| `#6DD5FA` |
| Text            | `#FFFFFF` |
| Secondary text  | `#A8B0B8` |
| Safe padding    | `80px`    |
| Card radius     | `20px`    |
