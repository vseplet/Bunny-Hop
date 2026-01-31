# GitHub Actions Setup

This project uses GitHub Actions for CI/CD automation.

## Workflows

### 1. CI (Continuous Integration)
**Trigger**: Push or PR to `master`/`main` branch

**What it does**:
- ✅ Runs Biome checks (linting + formatting)
- ✅ Runs TypeScript type checking
- ✅ Builds production bundle
- ✅ Uploads build artifacts

**No secrets required** - works out of the box!

### 2. Deploy to Vercel
**Trigger**: Push to `master`/`main` branch

**What it does**:
- Builds production bundle
- Deploys to Vercel

**Required secrets**:
- `VERCEL_TOKEN` - Your Vercel token
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

### 3. Release
**Trigger**: Push a tag like `v1.0.0`

**What it does**:
- ✅ Runs checks (Biome + TypeScript)
- ✅ Generates changelog from commits
- ✅ Creates production bundle
- ✅ Creates GitHub Release with bundle attached
- 🎯 Uploads to Poki.com (if token is set)

**Required secrets for Poki upload**:
- `POKI_UPLOAD_TOKEN` - Your Poki upload token

## Setting up Secrets

### GitHub Repository Secrets

Go to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

#### For Vercel Deployment:

1. **VERCEL_TOKEN**
   - Get from: https://vercel.com/account/tokens
   - Create a new token with appropriate permissions

2. **VERCEL_ORG_ID**
   - Get from: `.vercel/project.json` after running `vercel link`
   - Or from Vercel project settings

3. **VERCEL_PROJECT_ID**
   - Get from: `.vercel/project.json` after running `vercel link`
   - Or from Vercel project settings

#### For Poki Upload (Optional):

4. **POKI_UPLOAD_TOKEN**
   - Get from: Poki Developer Dashboard
   - Navigate to your game settings
   - Generate an upload token

## Usage

### Running CI
Simply push to `master` or create a pull request:
```bash
git add .
git commit -m "feat: add new feature"
git push origin master
```

### Creating a Release
Create and push a version tag:
```bash
# Create a tag
git tag v0.1.0

# Push the tag
git push origin v0.1.0
```

### Tag Naming Convention
- `v1.0.0` - Stable release (uploads to Poki)
- `v1.0.0-alpha.1` - Alpha release (no Poki upload)
- `v1.0.0-beta.1` - Beta release (no Poki upload)
- `v1.0.0-rc.1` - Release candidate (no Poki upload)

### Commit Message Convention
For better changelogs, use conventional commits:

- `feat: add new feature` - New features
- `fix: resolve bug` - Bug fixes
- `docs: update readme` - Documentation
- `refactor: improve code` - Code refactoring
- `chore: update deps` - Maintenance

## Vercel Setup (Optional)

If you want to deploy to Vercel for testing:

1. Install Vercel CLI:
   ```bash
   bun add -g vercel
   ```

2. Link your project:
   ```bash
   vercel link
   ```

3. Get your project IDs from `.vercel/project.json`

4. Add the secrets to GitHub

5. Create `vercel.json` in project root:
   ```json
   {
     "buildCommand": "bun run prod",
     "outputDirectory": "target",
     "installCommand": "bun install"
   }
   ```

## Poki Upload Setup (Optional)

1. Go to [Poki Developer Dashboard](https://developers.poki.com/)
2. Navigate to your game
3. Go to "Upload" settings
4. Generate an upload token
5. Add `POKI_UPLOAD_TOKEN` secret to GitHub

## Testing Workflows Locally

You can test builds locally before pushing:

```bash
# Run checks (same as CI)
bun run check
bun x tsc --noEmit

# Build production
bun run prod

# Create release bundle
bun run bundle
```

## Troubleshooting

### CI fails on type check
- Run `bun x tsc --noEmit` locally to see errors
- Fix TypeScript errors and commit

### CI fails on Biome check
- Run `bun run check` locally
- Run `bun run fix` to auto-fix issues

### Vercel deployment fails
- Check that secrets are set correctly
- Verify `vercel.json` is properly configured
- Check Vercel dashboard for deployment logs

### Poki upload fails
- Verify `POKI_UPLOAD_TOKEN` is set
- Check that bundle size is under Poki limits (usually 50MB)
- Ensure tag is not a pre-release (no `-alpha`, `-beta`, `-rc`)
