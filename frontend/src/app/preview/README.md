# Component Preview Page

This is a quick preview page for testing UI components without needing the full Tauri desktop app.

## Usage

1. Start the Next.js dev server:
   ```bash
   cd frontend
   npm run dev
   # or
   pnpm dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3118/preview
   ```

## Features

- **Live Component Preview**: See the `SummaryGeneratorButtonGroup` component in action
- **Interactive Controls**: Change component state to test different UI states
- **Mocked Dependencies**: Tauri APIs and Analytics are automatically mocked
- **Hot Reload**: Changes to the component will automatically refresh in the browser

## What's Mocked

- **Tauri `invoke` function**: Returns mock data for `get_ollama_models` command
- **Analytics**: Logs events to console instead of tracking

## Testing Different States

Use the status controls on the preview page to test:
- **Idle**: Component in default state
- **Processing**: Component showing loading state
- **Completed**: Component after successful operation

## Notes

- This preview page is only for UI development
- Backend functionality (like actual summary generation) won't work
- Tauri-specific features are mocked and won't have real functionality

