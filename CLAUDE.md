# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Owner's rule: ask before changing the game

**Do not make any changes to the game without the owner's specific approval.** This covers the code (`game.js`, `style.css`, `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`), the GitHub branch, and the published claude.ai links.

- Suggesting ideas is welcome. Describe what you'd change and wait for a clear "yes" before editing anything.
- Answering questions and reading the code needs no approval.
- When a change is approved, do only that change.

## What the game is

PC Parts Tycoon is a top-down idle tycoon game for iPhone, written in plain HTML, CSS and JS with no build step. The player is a clerk in a PC parts store. They walk with a touch joystick (drag anywhere), carry boxes from the stockroom to the shelves, check out shoppers at the registers, unlock sections on floor pads, and hire staff.

Main systems, all in `game.js`:

- **Store layout ("Racetrack Loop"):** the stockroom is across the top, and the Service Station is below it. Accessories and PC Cases are on the side walls; Monitors and Graphics Cards are on a centre island with a walkable aisle between them. There are 2 checkout lanes, an entrance at bottom-left and an exit at bottom-right. An expansion wing (x 600–1000) holds CPUs, RAM & Storage and Gaming Chairs.
- **Sections:** these unlock in order (`SECTIONS` table: prices, unlock costs, shelf and crate positions). Leveling a section up raises its item price.
- **Staff:** two cashiers, a stocker and a tech, each with upgrades (`STAFF`, `STAFF_UPGRADES`). Staff can be hired on floor pads or in the Upgrades menu.
- **Stockroom:** stock is limited. A delivery truck refills the crates.
- **Cash piles:** staff sales stack up on the counters and the bench until the player collects them.
- **Service Station jobs:** Repair, Upgrade and Full Build (`JOBS`). Upgrades and builds need parts: standing in the work circle pulls them from stock (the shelf first, then the stockroom crate), or the player can bring boxes to the bench.
- **Rush events:** a timed event happens every few minutes (`EVENTS`).
- **Missions:** daily missions and achievements (`ACHIEVEMENTS`; an achievement gives a Star).
- **Franchise:** the prestige reset. It needs all 8 sections open, a Star to claim, and a fee of $2.5M that grows x4 per Franchise (`FRANCHISE_BASE`, `FRANCHISE_GROWTH`, `canFranchise`). Stars give +5% to prices, and each new store is a new themed location (`THEMES`).
- **Admin tools:** Settings → Admin tools, for testing only (unlimited money, game speed, shortcuts). They must be hidden or removed before an App Store release.

Monetization decided by the owner (not built yet): rewarded ads plus occasional full-screen ads (AdMob), and a $3.99 Remove Ads purchase that also grants rewarded bonuses without watching. See the launch plan.

## Architecture

- **Saved vs. temporary state.**
  - Everything saved lives on the global `state` object, created by `freshState(keep)`. `keep` carries what survives a Franchise.
  - Saved under the `localStorage` key `pcPartsTycoon_store_v2`, with nested objects merged with defaults in `load()`. A new saved field needs a default in `freshState()` and, if nested, merging in `load()`.
  - Temporary objects are rebuilt on every load: `customers`, `queues`, `fx`, `npcs`, `truck`, `rushEvent`, `buildProgress`. Reset (`confirmReset` in `handleAction`) and Franchise (`doFranchise`) must clear these and call `rebuildGrid()`.
- **The game loop.**
  - Each frame, `frame()` runs `update(dt, i === 0)` once per admin game-speed step; the player moves only on the first step.
  - Then `updateRate()` (the $/min average) and `adminTick()`.
  - Then `updateHud()`, which runs about 4 times a second and also handles hints, missions, red dots and the event banner.
  - Then `render()`.
- **World coordinates.**
  - The store is 1000×1020 world units (`W_FULL`, `H`), but only 600 wide until it's expanded (`worldW()`).
  - The delivery road sits above y = 0, and the camera's view always reaches it, behind the see-through top bar.
  - The camera follows the player, with zoom based on `VIEW_UNITS`.
- **Movement and pathfinding.**
  - The player collides only with `obstacles()`, which is unlocked furniture.
  - Shoppers and staff use `route(from, to)`: a straight line unless `segmentBlocked`, otherwise a grid search (`gridPath`) over `FURNITURE`, with corners straightened.
  - Call `rebuildGrid()` whenever walls or furniture change, such as an expansion, reset or franchise.
  - Shoppers visit their sections' spots (`makeStop`) in rough clockwise order, sometimes stopping at `WANDER_SPOTS`, then join the shorter open lane (`joinQueue`).
- **How money flows.**
  - `earn()` counts toward $/min and goes into the player's pocket.
  - `bank()` goes into the pocket and lifetime earnings only.
  - Staff sales go to `state.piles` or `state.benchPile`: they count toward $/min when they happen and are banked by `collectPile()` when the player walks over.
  - Prices and costs are rounded to whole dollars, and pads take whole dollars.
  - With unlimited money on, `adminTick()` keeps the balance topped up and `bank()` puts real earnings in `state.admin.savedMoney`. Admin money never counts toward lifetime earnings.
- **Shared hooks.**
  - `track(kind, id, n)` feeds daily missions and lifetime stats.
  - `eventPriceMult()`, `eventBuildChance()` and `eventBuildPay()` apply rush-event effects.
  - `starMult()` applies Franchise Stars to `price()`.
- **Menus and buttons.**
  - Panels are HTML strings built by `showUpgrades`, `showMissions`, `showAdmin` and `showSettings`, then passed to `showModal`. Refreshing an open panel keeps its scroll position.
  - Buttons carry `data-act` and `data-id` and are handled in one `handleAction()` switch.
  - Actions listed in `HOLD_ACTS` repeat while held.
  - `data-cost` buttons enable and disable themselves in `updateHud()`.
- **Rendering.**
  - Everything is drawn on one canvas, in a fixed order inside `render()`, with characters sorted by y.
  - The floor, walls, lighting and furniture shadows are drawn once into an image (`buildFloor()`), rebuilt only when the theme, expansion, unlocks or zoom change.
  - Emoji are pre-drawn and cached (`drawEmoji`).
  - Colours on the canvas are hard-coded, with no theme tokens.

## Running and testing

- Run it locally: `python3 -m http.server 8000`, then open http://localhost:8000 in the browser's iPhone device mode.
- Check syntax: `node --check game.js`.
- There is no test suite. Changes have been verified by driving the page in headless Chromium with Playwright, emulating an iPhone 14:
  - `game.js` is a plain script, so `page.evaluate` can call its functions and read `state` directly.
  - To simulate a stretch of play quickly, call `update(1 / 60)` in a loop, setting `input.x`/`input.y` or `state.player` to move the player.
  - Clear `localStorage` before each run. The page saves on `pagehide`, so a reload re-saves the current state.

## Preview build and offline cache

- **Font:** Fredoka is bundled in `fonts/` (Latin and Latin Extended subsets, `woff2`) under the SIL Open Font License; keep `fonts/OFL.txt` with it. The game loads no outside files.

- **Preview link:** a single HTML file. `style.css` and `game.js` are copied into the page, the bundled font files in `fonts/` are embedded in the CSS as `data:` URLs (the font preload link is dropped), and the service-worker registration at the end of `game.js` is removed. Previews and the main link each keep their own save.
- **Service worker:** `sw.js` serves cached files and refreshes them in the background. Change its cache name (currently `pc-tycoon-v4`) when shipping changed files, so the installed app picks them up.

## Where things are

- **Branches:** work happens on `claude/amazing-cerf-3ne0f7`. `main` matches the main game link and is only updated when the owner approves.
- **Preview (current version):** https://claude.ai/artifact/VCpMSXLkPFAvrSx7KqK6fn
- **Main game link (one version behind the preview: no auto parts or Franchise price yet):** https://claude.ai/artifact/Lqefw1KYjppWho31g2y6Tw. Only update it when the owner approves.
- **App Store launch plan (tasks marked "once you approve" need the owner's go-ahead):** https://claude.ai/artifact/8k6aLNkRvTT4W5Qehh69A9
