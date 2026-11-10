# PC Parts Tycoon 🖥️💰

A store tycoon game for iPhone. You run a PC parts store as a character on the shop floor: restock the shelves, check out shoppers, unlock new sections, level them up and hire staff.

## How to play

You play a store clerk on the shop floor. **Drag anywhere on the screen** to walk; your character moves in the direction you drag. On a computer, the arrow keys or WASD also work.

- **Restock shelves.** Walk onto a crate in the **stockroom** (top of the store) to pick up boxes. Walk next to the matching shelf to stock it. Shoppers can't buy from an empty shelf, and they leave unhappy if they wait too long.
- **Check people out.** Shoppers roam the aisles for the items in their thought bubble, then line up at the **checkout**. Stand on the yellow circle behind the counter to scan their items and get paid.
- **Unlock new sections.** Stand on a yellow **UNLOCK** pad and your cash flows into it.

| Section | Unlock price | Starting item price |
|---|---|---|
| 🖱️ Accessories | Start | $8 |
| 🗄️ PC Cases | $120 | $25 |
| 🖥️ Monitors | $600 | $60 |
| 🎮 Graphics Cards | $2,500 | $140 |
| 🛠️ Service Station | $10,000 | $400 per build |

- **Service Station:** some customers want a custom PC. Stand on the pink circle in front of the bench to assemble it, then they pay you.
- **Upgrades (⬆️ button):** level up a section to raise its item price (x2 at levels 10, 25, 50 and 100, and bigger shelves). Hire staff: a **cashier** runs the register, a **stocker** refills shelves, and a **tech** builds PCs.
- **Hiring on the floor:** the blue **HIRE CASHIER** pad (beside the checkout) and **HIRE STOCKER** pad (in the stockroom) work like unlock pads: stand on one and your cash pays for the hire. If you pay part on the floor, the Upgrades menu only charges the rest. You can also buy faster shoes and a bigger carrying stack.
- A yellow arrow and hint point to what to do next while you're learning.
- Progress saves automatically. With a cashier and a stocker hired, the store keeps earning while the app is closed (up to 2 hours).

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
