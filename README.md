# Bunny Hop

3D platformer game built with Three.js and Bun for Poki.com. Quake-style bhop/defrag gameplay where you jump across procedurally generated platforms.

## Gameplay

- Jump across 100+ procedurally generated platforms
- Track your maximum distance
- Watch rewarded ads to continue from the nearest platform after falling
- Platforms vary in height and position for challenging gameplay

## Architecture

### Tech Stack

- **Runtime**: [Bun](https://bun.sh) >= 1.0
- **3D Graphics**: Three.js
- **Physics**: Custom AABB collision detection (no physics engine)
- **Monetization**: Poki SDK (rewarded ads)
- **Linting**: Biome
- **Git Hooks**: Lefthook

### Source Files

```
source/
├── main.ts      # Entry point, game initialization, start screen
├── game.ts      # Game class with physics, rendering, platforms
├── controls.ts  # Virtual joystick for mobile
├── poki.ts      # Poki SDK wrapper
└── poki.d.ts    # TypeScript definitions for PokiSDK
```

### Game Class (`game.ts`)

The main game logic:

**Physics System**
- Custom AABB (Axis-Aligned Bounding Box) collision detection
- Simple velocity-based movement without physics engine overhead
- Constants: `GRAVITY = 30`, `MOVE_SPEED = 10`, `JUMP_FORCE = 12`

**Platform Generation**
- 100 platforms generated procedurally going forward (-Z direction)
- Gap between platforms: 4-7 units (within jump range)
- Height variation: -1 to +2 units per platform
- Color gradient from green to blue as you progress
- Golden finish platform at the end

**Shadows**
- Directional light follows player for consistent shadows
- Platforms cast shadows on each other
- Shadow map: 2048x2048

**Update Loop**
```
1. Process input (WASD/arrows or mobile joystick)
2. Apply horizontal velocity
3. Apply gravity (if not grounded)
4. Handle jump (if grounded + space/button pressed)
5. Move player by velocity * deltaTime
6. Detect and resolve collisions with platforms
7. Track max distance
8. Update camera position (lerp follow)
9. Update sun position for shadows
10. Render
```

### Controls (`controls.ts`)

**Desktop**
- WASD or Arrow Keys to move
- Space to jump

**Mobile** (VirtualJoystick class)
- Left side: Virtual joystick for movement
- Right side: Jump button
- Touch detection via `ontouchstart` and `navigator.maxTouchPoints`
- Controls hidden until game starts

### Overlay System

All overlays are created dynamically with inline CSS:

**Start Screen** (`main.ts: showStartScreen`)
- Full-screen dark overlay (rgba 0,0,0,0.8)
- Title: "Bunny Hop" with emoji
- Platform-specific instructions (mobile vs desktop)
- "START GAME" button
- Removed on click, triggers `startGame()`

**Fall Prompt** (`game.ts: showFallPrompt`)
- Appears when player falls below Y = -20
- Shows distance reached
- Two options:
  - "Watch Ad to Continue" → calls `poki.rewardedBreak()`
  - "Restart from Beginning" → respawns at start
- If ad watched successfully, respawns on nearest platform

**Distance UI** (`game.ts: createUI`)
- Fixed position top-left
- Shows "Distance: Xm"
- Updates only when max distance increases
- Resets to 0 on restart

### Poki SDK Integration (`poki.ts`)

Wrapper with safe fallbacks when SDK unavailable:

```typescript
poki.init()              // Initialize SDK
poki.gameLoadingFinished() // Loading complete
poki.gameplayStart()     // Player started playing
poki.gameplayStop()      // Player stopped (menu, ad, etc)
poki.rewardedBreak()     // Show rewarded video ad
poki.commercialBreak()   // Show interstitial ad
```

**Game Flow**
```
DOMContentLoaded
  → poki.init()
  → Create Game instance
  → Create VirtualJoystick (hidden)
  → poki.gameLoadingFinished()
  → Show start screen

Click "START GAME"
  → Show mobile controls (if touch device)
  → game.start()
  → poki.gameplayStart()

Player falls
  → game.stop()
  → poki.gameplayStop()
  → Show fall prompt
  → If watch ad: poki.rewardedBreak() → respawn on platform
  → Else: respawn at start
  → game.start()
  → poki.gameplayStart()

Tab hidden (visibility change)
  → game.stop()
  → poki.gameplayStop()

Tab visible
  → game.start()
  → poki.gameplayStart()
```

## Getting Started

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

Create a zip archive for Poki deployment:

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

## CI/CD

### Workflows

- **CI** - Runs on every push/PR
  - Lints code with Biome
  - Type checks with TypeScript
  - Builds production bundle

- **Deploy** - Deploys to Vercel on push to master
  - Requires: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

- **Release** - Creates releases on version tags
  - Generates changelog
  - Uploads bundle to GitHub Releases
  - Optionally uploads to Poki.com
  - Requires: `POKI_UPLOAD_TOKEN` (optional)

### Creating a Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

See [.github/SETUP.md](.github/SETUP.md) for detailed setup instructions.

## License

MIT
