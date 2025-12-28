# Build and Release Guide

This guide shows you how to build and release Margin Notes for distribution.

## Quick Release Process

### Option 1: Automated Script (Recommended)

```bash
./publish-to-github.sh
```

This script will:
1. Initialize git repository
2. Ask for your GitHub username and repository name
3. Add and commit all files
4. Push to GitHub
5. Give you next steps for creating a release

### Option 2: Manual Process

#### Step 1: Build the App

```bash
cd frontend

# Install dependencies (first time only)
pnpm install

# Set environment variables to prevent macOS resource fork issues
export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

# Build the app
pnpm build
pnpm tauri build
```

The built app will be in:
- `frontend/src-tauri/target/release/bundle/dmg/` - DMG installer
- `frontend/src-tauri/target/release/bundle/macos/` - App bundle

#### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `margin-notes`
3. Make it **Public** (so users can download)
4. Don't initialize with README
5. Click "Create repository"

#### Step 3: Push to GitHub

```bash
# Initialize git (if not already done)
git init
git branch -M main

# Add all files
git add .

# Commit
git commit -m "Initial commit - Margin Notes v0.1.1"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/margin-notes.git

# Push
git push -u origin main
```

#### Step 4: Create a Release

1. Go to your repository on GitHub
2. Click "Releases" (right sidebar)
3. Click "Create a new release"
4. Fill in:
   - **Tag:** `v0.1.1` (must match version in tauri.conf.json)
   - **Title:** `Margin Notes v0.1.1`
   - **Description:** 
     ```markdown
     ## 🎉 First Release
     
     Privacy-first AI meeting assistant for macOS.
     
     ### Features
     - 🎙️ Audio recording
     - 📝 AI transcription (Whisper)
     - 🤖 AI summaries
     - 🏷️ Tags and folders
     - 🔍 Advanced search
     
     ### Installation
     1. Download the DMG file below
     2. Open it and drag to Applications
     3. Right-click → Open (first time only)
     
     ### System Requirements
     - macOS 11.0 or later
     - Apple Silicon (M1/M2/M3) or Intel Mac
     ```
5. Upload the DMG file from `frontend/src-tauri/target/release/bundle/dmg/`
6. Click "Publish release"

#### Step 5: Share the Download Link

Your app is now available at:
```
https://github.com/YOUR_USERNAME/margin-notes/releases
```

## Using GitHub Actions (Advanced)

Your project already has GitHub Actions workflows that can build automatically.

### For Testing

1. Push your code to GitHub
2. Go to Actions tab
3. Select "Build and Test - macOS"
4. Click "Run workflow"
5. Choose options:
   - Build type: **release**
   - Sign build: **No** (unless you have Apple Developer certificates)
   - Upload artifacts: **Yes**
6. Wait for build to complete
7. Download artifacts from the workflow run

### For Production Release

1. Push your code to GitHub
2. Go to Actions tab
3. Select "Release" workflow
4. Click "Run workflow"
5. Wait for build to complete
6. Go to Releases tab
7. Find the draft release
8. Edit if needed
9. Click "Publish release"

## Troubleshooting

### Build fails with "resource fork" errors

Clean up macOS resource fork files:
```bash
find . -type f -name '._*' -delete
export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1
```

### "Permission denied" when pushing to GitHub

You need to authenticate:

**Option 1: Personal Access Token (Recommended)**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (all)
4. Generate and copy the token
5. Use it as your password when pushing

**Option 2: SSH Key**
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub: Settings → SSH and GPG keys → New SSH key

# Change remote to SSH
git remote set-url origin git@github.com:YOUR_USERNAME/margin-notes.git
```

### App won't open on user's Mac

This is expected for unsigned apps. Users need to:
1. Right-click the app
2. Select "Open"
3. Click "Open" in the dialog

Or go to: System Settings → Privacy & Security → "Open Anyway"

### Version mismatch errors

Make sure the version is consistent in:
- `frontend/package.json`
- `frontend/src-tauri/Cargo.toml`
- `frontend/src-tauri/tauri.conf.json`

## Updating for New Releases

1. Update version in all three files above
2. Build the app
3. Create a new git tag:
   ```bash
   git tag -a v0.1.2 -m "Release v0.1.2"
   git push origin v0.1.2
   ```
4. Create a new GitHub release with the new tag
5. Upload the new build

## Code Signing (Optional)

To remove the "unidentified developer" warning:

1. **Enroll in Apple Developer Program** ($99/year)
   - https://developer.apple.com/programs/

2. **Create Developer ID Certificate**
   - Xcode → Settings → Accounts → Manage Certificates
   - Create "Developer ID Application" certificate

3. **Export certificate**
   ```bash
   # Export from Keychain
   # File → Export Items → .p12 format
   ```

4. **Add to GitHub Secrets** (for GitHub Actions)
   - Repository → Settings → Secrets → Actions
   - Add:
     - `APPLE_CERTIFICATE` (base64 encoded .p12)
     - `APPLE_CERTIFICATE_PASSWORD`
     - `APPLE_ID`
     - `APPLE_PASSWORD` (app-specific password)
     - `APPLE_TEAM_ID`

5. **Enable signing in workflows**
   - Check "Sign build" when running workflows

## Support

For more help:
- See `GITHUB_SETUP.md` for GitHub-specific help
- See `docs/BUILDING.md` for build troubleshooting
- See `.github/workflows/WORKFLOWS_OVERVIEW.md` for GitHub Actions help

