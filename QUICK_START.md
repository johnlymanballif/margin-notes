# Quick Start Guide

## For Users: Download and Install

### Download the App

Go to the [Releases page](https://github.com/YOUR_USERNAME/margin-notes/releases) and download the latest version.

### macOS Installation

1. Download the `.dmg` file for your Mac:
   - Apple Silicon (M1/M2/M3): `margin-notes_0.1.1_aarch64.dmg`
   - Intel Mac: `margin-notes_0.1.1_x64.dmg`

2. Open the downloaded DMG file

3. Drag "Margin Notes" to your Applications folder

4. **First time opening:**
   - Right-click the app in Applications
   - Select "Open" from the menu
   - Click "Open" in the security dialog
   - (This is needed because the app isn't signed with an Apple Developer certificate)

5. The app will now open normally!

### What is Margin Notes?

Margin Notes is an AI-powered meeting assistant that:
- 🎙️ Records audio from meetings
- 📝 Transcribes speech to text automatically
- 🤖 Generates AI summaries of your meetings
- 🏷️ Organizes meetings with tags and folders
- 🔍 Searches through transcripts
- 💾 Stores everything locally on your computer

### System Requirements

- **macOS:** 11.0 (Big Sur) or later
- **Processor:** Apple Silicon (M1/M2/M3) or Intel
- **RAM:** 8GB minimum, 16GB recommended
- **Storage:** 500MB for app + space for recordings

### Features

- ✅ Local-first: All data stays on your computer
- ✅ AI-powered transcription (Whisper)
- ✅ AI summaries (OpenAI, Ollama, or OpenRouter)
- ✅ Speaker identification
- ✅ Tag and folder organization
- ✅ Advanced search
- ✅ Audio playback with transcript sync
- ✅ Export transcripts and summaries

### Getting Started

1. **First Launch:**
   - Grant microphone permissions when prompted
   - Configure AI settings in Settings (choose OpenAI, Ollama, or OpenRouter)

2. **Record a Meeting:**
   - Click the red record button
   - Select your microphone
   - Start your meeting
   - Click stop when done

3. **View Transcript:**
   - Processing happens automatically
   - View real-time transcript as it's generated
   - Edit speaker names
   - Add tags and organize into folders

4. **Generate Summary:**
   - Click "Generate Summary"
   - Choose summary type (brief, detailed, action items, etc.)
   - AI will create a formatted summary

### Need Help?

- 📖 [Full Documentation](docs/)
- 🐛 [Report Issues](https://github.com/YOUR_USERNAME/margin-notes/issues)
- 💬 [Discussions](https://github.com/YOUR_USERNAME/margin-notes/discussions)

---

## For Developers: Build from Source

See [BUILDING.md](docs/BUILDING.md) for detailed build instructions.

### Quick Build

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/margin-notes.git
cd margin-notes

# Install dependencies
cd frontend
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

