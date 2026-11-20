# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Owner's rule: ask before changing the game

**Do not make any changes to the game without the owner's specific approval.** This covers the code (`game.js`, `style.css`, `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`), the GitHub branch, and the published claude.ai links.

- Suggesting ideas is welcome. Describe what you'd change and wait for a clear "yes" before editing anything.
- Answering questions and reading the code needs no approval.
- When a change is approved, do only that change.

## Shipping an approved change

1. Edit the code and check it (`node --check game.js`, then a Playwright run; see below).
2. Bump the cache name in `sw.js` and update this file if anything it describes changed.
3. Commit and push to `claude/amazing-cerf-3ne0f7`.
4. Rebuild the preview (`python3 tools/build-preview.py <scratchpad>/preview.html`) and republish it to the preview link.
5. Update the main game link and `main` only when the owner asks.

## What the game is

PC Parts Tycoon is a top-down idle tycoon game for iPhone, written in plain HTML, CSS and JS with no build step. The player is a clerk in a PC parts store. They walk with a touch joystick (drag anywhere), carry boxes from the stockroom to the shelves, check out shoppers at the registers, unlock sections on floor pads, and hire staff.

Main systems, all in `game.js`:

- **Store layouts:** each store tier has its own floor plan (`LAYOUTS`, applied by `applyLayout` from `rebuildGrid` whenever the tier changes): The Loop (Small Store), Twin Aisles (Strip Mall), Wall Displays (Shopping Mall), Long Rows (Megastore) and Build Bar Centre (Flagship and later). All of them share the stockroom across the top, its doors, 2 checkout lanes, the entrance (bottom-left) and exit (bottom-right). The Service Station stays in the main room because it unlocks before the expansion wing (x 600–1000), which holds CPUs, RAM & Storage and Gaming Chairs.
- **Sections:** these unlock in order (`SECTIONS` table: prices, unlock costs, shelf and crate positions). Leveling a section up raises its item price.
- **Staff:** two cashiers, a stocker and a tech, each with upgrades (`STAFF`, `STAFF_UPGRADES`). Staff can be hired on floor pads or in the Upgrades menu.
- **Stockroom:** stock is limited. A delivery truck refills the crates. Crates sit at `CRATE_Y`, near the back wall, leaving a marked walkway in front of them where nothing is picked up; you pick up by stepping onto a crate.
- **Cash piles:** staff sales stack up on the counters and the bench until the player collects them.
- **Service Station jobs:** Repair, Upgrade and Full Build (`JOBS`). Upgrades and builds need parts: standing in the work circle pulls them from stock (the shelf first, then the stockroom crate), or the player can bring boxes to the bench. The bench (`benchBody`) has a charcoal frame and light grey top (black with the store's neon edge in the Flagship), and gains gear at the section's milestones (`benchGear`): an anti-static mat at Lv 10, a magnifier lamp at Lv 50 and a test-bench PC at Lv 100. The sign is drawn last so the lamp sits behind it.
- **Store-name rug:** a woven navy rug with a gold diamond border, fringe and a monitor badge (`drawStoreRug`, drawn into the floor image at the layout's `rug` spot). Players rename their store in the "Your store's name" section at the top of Settings (14 characters max, with a live count), and the name shrinks to fit the rug.
- **Decorations:** a "gamer showroom" set (`DECOR_ITEMS`, drawn by `DECOR_DRAW`). The RGB wall strips, welcome mat and planters are there from the start; the rest appear at milestones (unlocks, hires, expanding, Store upgrades, every section at Lv 10) with a toast and confetti (`checkDecor`, saved in `decorSeen`, reset per store). Solid ones have a `rect`: all rects are in `FURNITURE` for pathfinding, and only the ones that are out block the player (`decorRectsOn`).
- **Staff Break Room:** after expanding, a $60K pad by the wing's bottom-right corner builds a walled room (`BREAK_ROOM`, `buildBreakRoom`). The Upgrades menu's Store group upgrades it to Lv 5 ($50K doubling, `upgradeBreakRoom`); each level adds furniture (`BREAK_FURNITURE`, drawn by `drawBreakRoom` and `drawBreakFurniture`, with off-duty staff in `BREAK_LOUNGERS`) and makes all staff 5% faster (`staffBoost`, applied in `cashierScanTime`, `stockerSpeed`, `stockerHandTime` and `techBuildTime`). The CPU rug, sim rig and trophy case are decorations inside it. Saved per store (`breakRoom`, `breakPaid`), so it resets on Franchise. The room's rect is always in `FURNITURE`; its walls and furniture block the player only once built.
- **Tutorial and tips:** a brand-new player gets a welcome card (name the store, then "Open my store!" or "Skip the tutorial", `showWelcome`). The tutorial is a 6-step checklist card under the top-left buttons (`TUT_STEPS`, `updateTutorial`), with the objective arrow pointing at each step's `target`, small cash rewards (`tutAdvance`), and steps finished by a `check` or by an `event` passed through `track()` / the level-up action (`tutEvent`). The last step makes the Upgrades button glow with a speech bubble. While it runs, the card replaces the hint line and toasts sit lower (`body.tut-on`). Afterwards, one-time tips (`TIPS`, `checkTips`) explain each system the first time it appears, one at a time and never over another menu. Saved as `tut` (step; -1 before the welcome, 99 skipped) and `tipsSeen`, both kept through Franchise. Saves from before the tutorial count as finished, and tips for things a player already has are marked seen without showing.
- **Rush events:** a timed event happens every few minutes (`EVENTS`).
- **Missions:** daily missions and achievements (`ACHIEVEMENTS`; an achievement gives a Star).
- **Store upgrades and Store goals:** after expanding, the Upgrades menu offers Advertising, Premium Displays and Pro Repair Kits (`STORE_UPGRADES`, 5 levels each). The Missions panel has Store goals with cash rewards (`GOALS`, scaled by `goalReward`). Both are per-store (`storeUp`, `goalsDone`, `goalsClaimed`, `storeServed`, `storeBuilt`) and reset on Franchise.
- **Franchise:** the prestige reset. It needs all 8 sections open, a Star to claim, and a fee of $1.5M that grows x4 per Franchise (`FRANCHISE_BASE`, `FRANCHISE_GROWTH`, `canFranchise`). Each Star held gives +5% to prices (`starMult`); Stars can also be spent on permanent perks in the Star Shop (`STAR_PERKS`, `showStarShop`), which lowers that bonus. Each new store is a visible step up (`THEMES`, read through `themeFor(n)`) with its own layout: Small Store → Strip Mall → Shopping Mall → Megastore → Flagship Store. The floor (`drawFloorSurface`), walls (`drawWallFace`, `wallTrim`), shelves (`shelfBody`) and checkout counters (`counterBody`) change style per tier; stores after the Flagship keep its look with a new neon colour (`FLAGSHIP_ACCENTS`).
- **Admin tools:** Settings → Admin tools, for testing only (unlimited money, game speed, shortcuts). They must be hidden or removed before an App Store release.

Monetization decided by the owner (not built yet): rewarded ads plus occasional full-screen ads (AdMob), and a $3.99 Remove Ads purchase that also grants rewarded bonuses without watching. See the launch plan.

## Architecture

- **Saved vs. temporary state.**
  - Everything saved lives on the global `state` object, created by `freshState(keep)`. `keep` carries what survives a Franchise.
  - Saved under the `localStorage` key `pcPartsTycoon_store_v2`, with nested objects merged with defaults in `mergeSave()`. A new saved field needs a default in `freshState()` and, if nested, merging in `mergeSave()`.
  - Save protection:
    - `save()` only writes a save that passes `parseSave()`.
    - It refreshes a backup (`_backup` key) once a minute and on Franchise, reset and `pagehide`.
    - `load()` uses whichever of the main save and the backup is newer, and keeps a save that won't load under `_damaged` instead of overwriting it.
    - In the Capacitor app, every save is also mirrored to the Preferences plugin, and `restoreFromNative()` brings it back if the web view's storage was cleared. Install `@capacitor/preferences` when wrapping the app.
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
- **Layouts.**
  - A layout lists each shelf's rect and `faces` (the sides people stand at; the first is where the stocker restocks and the unlock pad goes, unless `pads` gives a spot), plus the Service Station bench, checkout, cashier pad, expansion pad, middle-wall openings, rug, checkout floor, shopper `loop` and decoration moves.
  - `applyLayout` changes the shared objects in place (`SECTIONS` shelves, `COUNTERS`, `REG`, `LANE_X`, `PILE_SPOTS`, `HIRE_PADS`, `DIVIDER_OPEN`, `LOOP`, `WANDER_SPOTS`, decoration spots) and derives the rest: stock spots, pads, the Service Station's work circle and customer spot, and shopper stops (`makeStop` uses `faceSpot`). Layouts without a `wander` list get one from `autoWander`.
  - When adding a layout, check that every shelf side, queue slot and pad is reachable and clear of furniture, and that queue slots (which run 220 units up from the registers) don't hit a shelf.
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
  - Panels are HTML strings built by `showUpgrades`, `showMissions`, `showAdmin` and `showSettings`, then passed to `showModal`. Refreshing an open panel keeps its scroll position. Modal cards scroll when they're taller than the screen.
  - Buttons carry `data-act` and `data-id` and are handled in one `handleAction()` switch.
  - Actions listed in `HOLD_ACTS` repeat while held.
  - `data-cost` buttons enable and disable themselves in `updateHud()`.
- **Rendering.**
  - Everything is drawn on one canvas, in a fixed order inside `render()`, with characters sorted by y.
  - The floor, walls and lighting are drawn once into an image (`buildFloor()`), rebuilt only when the store name, theme, expansion or zoom change. Furniture shadows are drawn live on top in `drawFloor`, so unlocks don't rebuild the image.
  - Emoji are pre-drawn and cached (`emojiSprite`); `warmEmoji` pre-draws the common ones at load and after a resize so they don't cost a frame mid-game.
  - Sound starts on the first touch (`unlockAudio`), not on the first sound.
  - Pop-ups use a plain dark tint, not `backdrop-filter: blur`, which is slow on iOS over the moving canvas.
  - Performance (profiled in headless Chromium at 4x CPU slowdown): the game's own update and drawing cost under 1 ms a frame, and real frames hold 60 fps. The start-up stutter fixes above were checked in headless Chromium only; check performance changes on a real iPhone, since headless runs can't measure its GPU cost. When timing `render()` in a loop without `requestAnimationFrame`, expect a fake ~450 ms spike every ~65 calls: the canvas queues its drawing until it is shown.
  - Colours on the canvas are hard-coded, with no theme tokens.

## Ideas for later (not approved to build)

The owner noted these as possible future features. Don't build them without the owner's go-ahead.

- **Sorting tube system:** a buildable tube the player can drop any carried boxes into. The boxes travel through the tubes and get sorted back into their proper stockroom crates, so the player doesn't have to walk each box back to its own crate.

## Running and testing

- Run it locally: `python3 -m http.server 8000`, then open http://localhost:8000 in the browser's iPhone device mode.
- Check syntax: `node --check game.js`.
- There is no test suite. Changes have been verified by driving the page in headless Chromium with Playwright, emulating an iPhone 14:
  - `game.js` is a plain script, so `page.evaluate` can call its functions and read `state` directly.
  - To simulate a stretch of play quickly, call `update(1 / 60)` in a loop, setting `input.x`/`input.y` or `state.player` to move the player.
  - Clear `localStorage` before each run. The page saves on `pagehide`, so a reload re-saves the current state.

## Preview build and offline cache

- **Font:** Fredoka is bundled in `fonts/` (Latin and Latin Extended subsets, `woff2`) under the SIL Open Font License; keep `fonts/OFL.txt` with it. The game loads no outside files.

- **Preview link:** a single HTML file built by `python3 tools/build-preview.py OUTPUT.html [--title NAME]` from `index.html`. `style.css` and `game.js` are copied into the page, the bundled font files in `fonts/` are embedded in the CSS as `data:` URLs (the font preload link is dropped), and the service-worker registration at the end of `game.js` is removed. Previews and the main link each keep their own save.
- **Service worker:** `sw.js` serves cached files and refreshes them in the background. Change its cache name (currently `pc-tycoon-v19`) when shipping changed files, so the installed app picks them up.

## Where things are

- **README.md** is the player-facing guide. When it and this file disagree, trust this file and the code.

- **Branches:** work happens on `claude/amazing-cerf-3ne0f7`. `main` matches the main game link and is only updated when the owner approves.
- **Preview (current version):** https://claude.ai/artifact/VCpMSXLkPFAvrSx7KqK6fn
- **Main game link (matches the preview as of the tutorial update):** https://claude.ai/artifact/Lqefw1KYjppWho31g2y6Tw. Only update it when the owner approves.
- **App Store launch plan (tasks marked "once you approve" need the owner's go-ahead):** https://claude.ai/artifact/8k6aLNkRvTT4W5Qehh69A9
