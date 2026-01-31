# Bunny Hop - Development Guide

3D game for Poki.com built with Three.js and Bun.

## Project Overview

This is a 3D browser game built with:
- **Three.js** for 3D rendering
- **Bun** for blazing fast builds and development
- **Poki SDK** for ads and analytics
- **TypeScript** for type safety
- **Biome** for linting and formatting

## Project Structure

```
bunny-hop/
├── source/           # Game source code
│   ├── main.ts      # Entry point
│   ├── poki.ts      # Poki SDK wrapper
│   ├── poki.d.ts    # Poki SDK types
│   └── helpers.ts   # Game helpers (ads, etc.)
├── config/          # Build configurations
│   ├── base.config.ts
│   ├── dev.config.ts
│   └── prod.config.ts
├── scripts/         # Build system
│   ├── build/       # Build tasks and pipeline
│   │   ├── tasks/   # Individual build tasks
│   │   ├── utils/   # Build utilities
│   │   ├── logger.ts
│   │   └── pipeline.ts
│   ├── cli.ts       # Main CLI
│   └── serve.ts     # Dev server
├── keys/            # Auto-generated constants
├── assets/          # Game assets
│   ├── models/      # 3D models
│   ├── textures/    # Textures
│   └── fonts/       # Fonts
└── target/          # Build output (gitignored)
```

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Build for production
bun run prod

# Preview production build
bun run preview

# Create deployment bundle
bun run bundle
```

## Development Workflow

### 1. Development Mode

```bash
bun dev
```

This starts:
- Development server on http://localhost:8000
- File watcher with hot reload
- Source maps for debugging

### 2. Making Changes

The build system automatically rebuilds on file changes in:
- `source/` - Game code
- `config/` - Build configuration
- `keys/` - Constants (auto-generated)
- `assets/` - Assets (models, textures, fonts)

### 3. Build Tasks

The build pipeline runs these tasks in order:
1. **Clean** - Clears target directory
2. **Copy** - Copies assets
3. **Source** - Compiles TypeScript with Bun.build
4. **HTML** - Generates index.html with Poki SDK
5. **CSS** - Generates styles

### 4. Production Build

```bash
bun run prod
```

Creates optimized build in `target/`:
- Minified JavaScript (~475KB)
- Optimized HTML with Poki SDK script
- Minified CSS

## Poki SDK Integration

### Initialization

SDK is initialized automatically in `source/main.ts`:

```typescript
await poki.init();
poki.gameLoadingFinished();
```

### Gameplay Events

```typescript
// Start gameplay (level start, unpause)
poki.gameplayStart();

// Stop gameplay (level end, pause, game over)
poki.gameplayStop();
```

### Commercial Breaks

Show ads at natural break points:

```typescript
import { showCommercialBreak } from "./helpers.ts";

// After level complete or game over
await showCommercialBreak({
  muteAudio: () => audioManager.mute(),
  unmuteAudio: () => audioManager.unmute(),
  disableInput: () => inputManager.disable(),
  enableInput: () => inputManager.enable(),
});

poki.gameplayStart();
```

### Rewarded Breaks

Give players rewards for watching ads:

```typescript
import { showRewardedBreak } from "./helpers.ts";

const watched = await showRewardedBreak({
  size: "medium", // small, medium, large
  muteAudio: () => audioManager.mute(),
  unmuteAudio: () => audioManager.unmute(),
});

if (watched) {
  // Give reward
  player.addCoins(100);
}
```

## Configuration

Edit `config/base.config.ts` to change:
- Build settings (paths, minification, source maps)
- Game settings (camera, renderer, Poki integration)
- Asset paths

Development and production configs extend the base config.

## Code Quality

```bash
# Lint code
bun run lint

# Format code
bun run format

# Check and fix
bun run check
bun run fix
```

## Git Hooks

Lefthook runs automatically on commit:
- Lints changed files
- Type checks TypeScript
- Prevents commits with errors

## Path Aliases

TypeScript paths are configured in `tsconfig.json`:
- `@/config` → `./config/mod.ts`
- `@/keys` → `./keys/mod.ts`
- `$/` → `./source/`
- `#/` → `./scripts/`

## Adding New Features

1. Create files in `source/`
2. Import using path aliases
3. Test with `bun dev`
4. Build with `bun run prod`

## Deployment

1. Create bundle:
   ```bash
   bun run bundle
   ```

2. Upload `bundles/YYYY-MM-DD_HH-MM-SS.zip` to Poki

3. Bundle includes:
   - Optimized game.js
   - index.html with Poki SDK
   - style.css
   - All assets

## Tips

- Use `console.log` for debugging (visible in browser console)
- Poki SDK calls are safe - they do nothing if SDK is unavailable
- Test commercial/rewarded breaks on Poki.com (they don't work locally)
- Keep bundle size under 10MB for best performance
- Use `poki.gameplayStart()` before each level/round
- Use `poki.gameplayStop()` on pause, game over, menu

## Common Issues

**Build fails**: Check TypeScript errors with `bun x tsc --noEmit`

**Hot reload not working**: Restart dev server

**Poki SDK not loading**: Check browser console, SDK only works on Poki.com

**Assets not copying**: Check paths in `config/base.config.ts`
