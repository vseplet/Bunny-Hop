# Bunny Hop

3D platformer game built with Three.js and Bun for Poki.com

## Features

- 🎮 **3D Platformer Gameplay**
  - Physics-based movement with Cannon-es
  - Third-person camera
  - Jump between platforms

- 🕹️ **Controls**
  - Desktop: WASD/Arrow Keys + Space to jump
  - Mobile: Virtual joystick + Jump button

- ⚡ **Tech Stack**
  - [Bun](https://bun.sh) for fast development
  - Three.js for 3D graphics
  - Cannon-es for physics (~100KB)
  - Poki SDK integration

- 🔥 **Development**
  - Hot reload in development mode
  - Optimized production builds
  - Biome for linting and formatting
  - Git hooks with Lefthook

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0

### Installation

```bash
bun install
```

### Development

Start development server with hot reload:

```bash
bun dev
```

Open http://localhost:8000

### Production Build

```bash
bun run prod
```

### Preview Production Build

```bash
bun run preview
```

### Create Bundle

Create a zip archive for deployment:

```bash
bun run bundle
```

## Project Structure

```
bunny-hop/
├── assets/          # Game assets
│   ├── models/      # 3D models
│   ├── textures/    # Textures
│   └── fonts/       # Fonts
├── config/          # Build configuration
├── keys/            # Auto-generated constants
├── scripts/         # Build scripts
│   ├── build/       # Build system
│   └── cli.ts       # CLI entry point
├── source/          # Source code
│   └── main.ts      # Entry point
└── target/          # Build output
```

## Scripts

- `bun dev` - Development server with hot reload
- `bun run prod` - Production build
- `bun run preview` - Build and preview production
- `bun run bundle` - Create deployment bundle
- `bun run lint` - Lint code
- `bun run format` - Format code
- `bun run check` - Check code quality
- `bun run fix` - Fix code issues

## Poki SDK Integration

The game includes full Poki SDK integration:

### Basic Usage

```typescript
import { poki } from "./poki.ts";

// Initialize SDK (done automatically on game start)
await poki.init();

// Signal loading finished
poki.gameLoadingFinished();

// Start gameplay
poki.gameplayStart();

// Stop gameplay
poki.gameplayStop();
```

### Commercial Breaks

```typescript
import { showCommercialBreak } from "./helpers.ts";

// Show ad before level start
await showCommercialBreak({
  muteAudio: () => audioManager.mute(),
  unmuteAudio: () => audioManager.unmute(),
  disableInput: () => inputManager.disable(),
  enableInput: () => inputManager.enable(),
});

poki.gameplayStart();
```

### Rewarded Breaks

```typescript
import { showRewardedBreak } from "./helpers.ts";

// Show rewarded ad
const watched = await showRewardedBreak({
  size: "medium", // small, medium, or large
  muteAudio: () => audioManager.mute(),
  unmuteAudio: () => audioManager.unmute(),
});

if (watched) {
  // Give player reward
  player.addCoins(100);
}
```

### Game Flow Example

```typescript
// Game start (click to play)
poki.gameplayStart();

// Level complete
poki.gameplayStop();
await showCommercialBreak();
poki.gameplayStart();

// Game over
poki.gameplayStop();
```

## CI/CD

The project includes GitHub Actions workflows:

### Workflows

- **CI** - Runs on every push/PR
  - Lints code with Biome
  - Type checks with TypeScript
  - Builds production bundle
  - No setup required!

- **Deploy** - Deploys to Vercel on push to master
  - Requires: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

- **Release** - Creates releases on version tags
  - Generates changelog
  - Uploads bundle to GitHub Releases
  - Optionally uploads to Poki.com
  - Requires: `POKI_UPLOAD_TOKEN` (optional)

### Creating a Release

```bash
# Create and push a version tag
git tag v0.1.0
git push origin v0.1.0
```

See [.github/SETUP.md](.github/SETUP.md) for detailed setup instructions.

## License

MIT
