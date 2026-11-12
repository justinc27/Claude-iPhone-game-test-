# PC Parts Tycoon 🖥️💰

A store tycoon game for iPhone. You run a PC parts store as a character on the shop floor: restock the shelves, check out shoppers, unlock new sections, level them up and hire staff.

## How to play

You play a store clerk on the shop floor. **Drag anywhere on the screen** to walk; your character moves in the direction you drag. On a computer, the arrow keys or WASD also work.

- **The store (Racetrack Loop layout):** stockroom across the top, Service Station below it, Accessories and PC Cases on the side walls, Monitors and Graphics Cards back to back on a center island. There's a walkable aisle between the two island shelves. Shoppers come in at the entrance (bottom-left), wander the floor and stop to browse on the way to the shelves they want, then check out at one of 2 lanes and leave by the exit (bottom-right).
- **Restock shelves.** Walk onto a crate in the **stockroom** (top of the store) to pick up boxes. Walk next to the matching shelf to stock it. Shoppers can't buy from an empty shelf, and they leave unhappy if they wait too long.
- **Check people out.** Shoppers stop at the shelves for the items in their thought bubble, then line up at the **checkout**. Stand on the yellow circle next to a counter to scan their items and get paid. Lane 1 is yours; once you hire a cashier they run Lane 2, and if you walk away from Lane 1 the people waiting there move to the cashier's lane.
- **Unlock new sections.** Stand on a yellow **UNLOCK** pad and your cash flows into it.

| Section | Unlock price | Starting item price |
|---|---|---|
| 🖱️ Accessories | Start | $8 |
| 🗄️ PC Cases | $120 | $25 |
| 🖥️ Monitors | $600 | $60 |
| 🎮 Graphics Cards | $2,500 | $140 |
| 🛠️ Service Station | $10,000 | jobs (see below) |
| 🧱 *Expand the store* | $25,000 | opens a new wing to the right |
| 🧠 CPUs | $30,000 | $220 |
| 💾 RAM & Storage | $75,000 | $350 |
| 🪑 Gaming Chairs | $150,000 | $600 |

- **Cash piles:** when a cashier or the tech makes a sale, the cash stacks up on their counter or bench. Walk over to collect it. Sales you make yourself go straight into your pocket.
- **Delivery truck:** stockroom crates hold a limited number of boxes. A truck pulls up to the loading dock (top of the store) and refills them every 40 seconds. Upgrade with **Bigger Deliveries** and **Faster Trucks** in the Upgrades menu.
- **Service Station jobs:** customers bring a **Repair** (no parts), an **Upgrade** (one part, like a GPU) or a **Full Build** (case + GPU, plus CPU and RAM once unlocked). Carry the parts to the bench, then stand on the pink circle to work. The tech takes parts off the shelves on their own.
- **Rush events:** every few minutes (once Monitors are unlocked): *GPU Launch Day*, *Black Friday* (double prices), *Build Season* (jobs pay double) or *Back to School*.
- **Missions (📋 button):** 3 daily missions with cash rewards that reset at midnight, plus achievements that each give a ⭐ Star.
- **Franchise:** in the Upgrades menu, sell your store for ⭐ Stars (based on lifetime earnings). Every Star adds 5% to all prices forever. You restart in a new location: Strip Mall → Shopping Mall → Warehouse → Flagship Store.
- **Upgrades (⬆️ button):** tap to buy once, or **hold** a Level Up or Buy button to keep buying (it speeds up the longer you hold). Level up a section to raise its item price (x2 at levels 10, 25, 50 and 100, and bigger shelves). Hire staff: a **cashier** runs Lane 2, a **second cashier** ($3,000, after the first) runs Lane 1, a **stocker** refills shelves, and a **tech** works the Service Station. Buy faster shoes and a bigger carrying stack for yourself.
- **Staff upgrades:** once someone is hired, their upgrades appear under their name in the Upgrades menu: **Faster Scanning** (both cashiers), **Stocker Shoes** and **Hand Truck** (stocker), and **Power Tools** (tech).
- **Hiring on the floor:** the blue **HIRE CASHIER** pad (beside the checkout; it turns into **HIRE CASHIER 2** once the first cashier is hired) and **HIRE STOCKER** pad (in the stockroom) work like unlock pads. If you pay part on the floor, the Upgrades menu only charges the rest.
- A yellow arrow and hint point to what to do next while you're learning.
- All money is in whole dollars. Progress saves automatically. With a cashier and a stocker hired, the store keeps earning while the app is closed (up to 2 hours).

## Admin tools (for testing)

Open **⚙️ Settings → 🛠️ Admin tools**:

- **Unlimited money:** your balance stays topped up and floor pads complete instantly. Turning it off restores your real balance, plus anything you really earned meanwhile. Admin money never counts toward lifetime earnings, Stars or achievements.
- **Game speed:** 1x / 2x / 5x / 10x for shoppers, staff, trucks and timers (your character keeps normal speed).
- **Shortcuts:** unlock everything, hire all staff, fill shelves & crates, call the truck, start a rush event, add $1M lifetime earnings (to test Franchise), finish today's missions.

While admin tools are active, the store name at the top shows **🛠️ ADMIN**.

## Play it on an iPhone

The game is a Progressive Web App (plain HTML/CSS/JS, nothing to build).

1. Host the folder on any static host. For example, in GitHub go to **Settings → Pages**, deploy from this branch, folder `/ (root)`.
2. Open the URL in **Safari** on the iPhone.
3. Tap **Share → Add to Home Screen**. It then launches full-screen with its own icon and works offline.

To try it locally, run `python3 -m http.server 8000` and open http://localhost:8000. Use the iPhone device mode in your browser's dev tools.

## Shipping to the App Store (later)

Wrap it with [Capacitor](https://capacitorjs.com/):

```bash
npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "PC Parts Tycoon" com.example.pctycoon --web-dir .
npx cap add ios && npx cap open ios   # requires a Mac with Xcode
```

## Files

- `index.html`: page shell, top bar, tab bar
- `style.css`: top bar, joystick, upgrade panel and pop-ups
- `game.js`: the store layout, shoppers, staff, controls and drawing. Tune prices and unlock costs in the `SECTIONS` table at the top, and staff in `STAFF`.
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and the home-screen icon
