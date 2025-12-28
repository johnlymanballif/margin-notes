# GitHub Setup Guide for Margin Notes

This guide will help you publish your app to GitHub so users can easily download it.

## Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Name it: `margin-notes` (or your preferred name)
4. Choose: **Public** (so users can download)
5. **Don't** initialize with README (we already have files)
6. Click "Create repository"

## Step 2: Connect Your Local Project to GitHub

After creating the repository, GitHub will show you commands. Run these in your terminal:

```bash
# Make sure you're in the project directory
cd /Volumes/LYMANATOR/margin-notes-main

# Add all files
git add .

# Create first commit
git commit -m "Initial commit - Margin Notes app"

# Rename branch to main (if needed)
git branch -M main

# Add your GitHub repository as remote
# Replace YOUR_USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR_USERNAME/margin-notes.git

# Push to GitHub
git push -u origin main
```

## Step 3: Create a Simple Release (Without GitHub Actions)

If you want to quickly share a downloadable version without setting up the full CI/CD:

### Option A: Manual Release (Easiest)

1. Build the app locally:
   ```bash
   cd frontend
   export COPYFILE_DISABLE=1
   export COPY_EXTENDED_ATTRIBUTES_DISABLE=1
   pnpm install
   pnpm build
   pnpm tauri build
   ```

2. Find your built app:
   - Location: `frontend/src-tauri/target/release/bundle/`
   - Look for the `.dmg` file in the `dmg` folder

3. Create a GitHub Release:
   - Go to your GitHub repository
   - Click "Releases" (right sidebar)
   - Click "Create a new release"
   - Tag: `v0.1.1` (matches version in tauri.conf.json)
   - Title: `Margin Notes v0.1.1`
   - Description: Describe what your app does
   - Upload the `.dmg` file
   - Click "Publish release"

### Option B: Use GitHub Actions (Automated)

Your project already has comprehensive GitHub Actions workflows! To use them:

1. **Push your code to GitHub** (see Step 2 above)

2. **Go to your repository → Actions tab**

3. **For a quick test build:**
   - Select "Build and Test - macOS" workflow
   - Click "Run workflow"
   - Choose "release" for build type
   - Uncheck "Sign the build" (unless you have Apple Developer certificates)
   - Click "Run workflow"

4. **For a full release:**
   - Select "Release" workflow
   - Click "Run workflow"
   - Wait for it to complete (creates a draft release)
   - Go to Releases and publish it

## Step 4: Share Your App

Once you have a release published, users can download it from:

```
https://github.com/YOUR_USERNAME/margin-notes/releases
```

### Installation Instructions for Users

Add this to your README.md:

```markdown
## Download

Download the latest version from the [Releases page](https://github.com/YOUR_USERNAME/margin-notes/releases).

### macOS Installation

1. Download `margin-notes_0.1.1_aarch64.dmg` (for Apple Silicon) or `margin-notes_0.1.1_x64.dmg` (for Intel)
2. Open the DMG file
3. Drag the app to your Applications folder
4. Right-click the app and select "Open" (first time only, due to macOS security)
5. Click "Open" in the security dialog

### Note for macOS Users

Since the app is not signed with an Apple Developer certificate, you'll need to:
- Right-click → Open (don't double-click)
- Or go to System Settings → Privacy & Security → Allow anyway
```

## Step 5: Update Your README

Update your main README.md to include:

```markdown
## 🚀 Quick Start

### Download Pre-built App

Download the latest release from the [Releases page](https://github.com/YOUR_USERNAME/margin-notes/releases).

### Build from Source

See [BUILDING.md](docs/BUILDING.md) for detailed build instructions.
```

## Troubleshooting

### "Permission denied" when pushing to GitHub

You may need to set up authentication:

**Option 1: Personal Access Token (Recommended)**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use the token as your password when pushing

**Option 2: SSH Key**
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add to GitHub: Settings → SSH and GPG keys → New SSH key
3. Change remote URL: `git remote set-url origin git@github.com:YOUR_USERNAME/margin-notes.git`

### Build fails on GitHub Actions

If you're using the automated workflows without signing:
- Make sure to **uncheck "Sign the build"** option when running workflows
- Or remove signing-related environment variables from the workflow files

### App won't open on macOS

Users need to right-click → Open (first time only) because the app isn't signed with an Apple Developer certificate.

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Create a release (manual or automated)
3. ✅ Update README with download links
4. ✅ Share the release URL with users

## Advanced: Code Signing (Optional)

To avoid the "unidentified developer" warning:

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Create a Developer ID Application certificate
3. Add secrets to GitHub repository:
   - `APPLE_CERTIFICATE`
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_ID`
   - `APPLE_PASSWORD`
   - `APPLE_TEAM_ID`
4. Enable signing in workflows

This makes installation smoother for users but is not required for the app to work.

