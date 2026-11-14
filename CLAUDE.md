# PC Parts Tycoon

## Owner's rule: ask before changing the game

**Do not make any changes to the game without the owner's specific approval.** This covers the code (`game.js`, `style.css`, `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`), the GitHub branch, and the published claude.ai links.

- Suggesting ideas is welcome. Describe what you'd change and wait for a clear "yes" before editing anything.
- Answering questions and reading the code needs no approval.
- When a change is approved, do only that change.

## What the game is

A top-down idle tycoon game for iPhone. The player is a clerk in a PC parts store. They walk with a touch joystick (drag anywhere), carry boxes from the stockroom to the shelves, check out shoppers at the registers, unlock sections on floor pads, and hire staff.

Main systems, all in `game.js`:

- **Store layout ("Racetrack Loop"):** the stockroom is across the top, and the Service Station is below it. Accessories and PC Cases are on the side walls; Monitors and Graphics Cards are on a centre island with a walkable aisle between them. There are 2 checkout lanes, an entrance at bottom-left and an exit at bottom-right. An expansion wing (x 600–1000) holds CPUs, RAM & Storage and Gaming Chairs.
- **Sections:** these unlock in order (`SECTIONS` table: prices and unlock costs). Leveling a section up raises its item price.
- **Staff:** two cashiers, a stocker and a tech, each with upgrades. Staff can be hired on floor pads or in the Upgrades menu.
- **Stockroom:** stock is limited. A delivery truck refills the crates.
- **Cash piles:** staff sales stack up on the counters and the bench until the player collects them.
- **Service Station jobs:** Repair, Upgrade and Full Build. Upgrades and builds need parts brought to the bench.
- **Rush events:** a timed event happens every few minutes.
- **Missions:** daily missions and achievements (an achievement gives a Star).
- **Franchise:** the prestige reset. Stars give +5% to prices, and each new store is a new themed location.
- **Admin tools:** Settings → Admin tools, for testing only (unlimited money, game speed, shortcuts). They must be hidden or removed before an App Store release.

Conventions:

- All money is in whole dollars. Prices and costs are rounded, and pads take whole dollars.
- Saves are in `localStorage` under `pcPartsTycoon_store_v2`. New fields need defaults in `freshState()` and merging in `load()`.

## Files

- `index.html`: page shell (top bar, canvas, modals)
- `style.css`: UI styles (top bar, panels, buttons, banners)
- `game.js`: all game data, logic and canvas drawing
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA offline support and the home-screen icon
- `README.md`: how to play, and how to put it on an iPhone

## Running and testing

- Run it locally: `python3 -m http.server 8000`, then open http://localhost:8000, using the browser's iPhone device mode.
- Plain HTML/CSS/JS, with no build step. Check syntax with `node --check game.js`.

## Where things are

- **Branch:** `claude/amazing-cerf-3ne0f7`.
- **Preview (current version):** https://claude.ai/artifact/VCpMSXLkPFAvrSx7KqK6fn. This is the whole game in one HTML file, without the service worker.
- **Main game link (older version):** https://claude.ai/artifact/Lqefw1KYjppWho31g2y6Tw. Only update it when the owner approves.
- **App Store launch plan:** https://claude.ai/artifact/8k6aLNkRvTT4W5Qehh69A9
