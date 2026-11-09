# PC Parts Tycoon 🖥️💰

An idle tycoon game for iPhone. You own a PC parts superstore: sell parts, unlock new departments, level them up, hire managers, and build custom PCs for customers.

## How to play

| Section | Unlocks at | Sells |
|---|---|---|
| 🖱️ Accessories | Start | USB cables → mice → keyboards → headsets → … |
| 🗄️ PC Cases | $250 | Budget towers → mid towers → glass RGB → … |
| 🖥️ Monitors | $5,000 | 1080p → 1440p → ultrawide → 4K → OLED … |
| 🎮 Graphics Cards | $75,000 | Entry → mainstream → enthusiast → flagship … |
| 🛠️ Service Station | $1,000,000 | Repairs and PC builds, plus the **Custom Build Desk** |

- **Tap a section's icon** to make a sale. When the green bar fills, you get paid.
- **Level Up** raises the sale price. Hold the button to keep buying. The yellow button in the top right switches between buying x1, x10, x100 and MAX.
- **Milestones** at levels 10, 25, 50, 100, 150, 200, … double profit. Levels 25, 50, 100 and 200 also double speed. Some milestones upgrade the product you sell, for example Mid Towers to Glass RGB Cases.
- **Managers** run a section for you, even while the app is closed. You collect up to 8 hours of offline earnings.
- **Upgrades** multiply a section's profit (x3, x5, x9).
- **Custom Build Desk**: once you own the Service Station, customers ask for a specific PC. Tap the right case, GPU, monitor and accessory from the shelf. Each wrong part lowers the reward.
- **Franchise** (prestige): after $1B in lifetime earnings, sell your store and start over with ⭐ Stars. Each Star gives +2% profit permanently.

Progress saves automatically on the device.

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
- `style.css`: idle-game look (chunky cards, gold buttons, progress bars, animations)
- `game.js`: all game data (sections, prices, managers, upgrades) and logic. Tune balance in the `SECTIONS` and `UPGRADES` tables at the top.
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and the home-screen icon
