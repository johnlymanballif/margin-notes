// Mock setup for preview page
// This file sets up mocks for Tauri APIs and Analytics

// Mock @tauri-apps/api/core
const mockInvoke = async (cmd: string, args?: any) => {
  console.log('🔵 Mock Tauri invoke:', cmd, args);
  // Mock responses for common commands
  if (cmd === 'get_ollama_models') {
    return [
      { name: 'gemma2:2b', id: 'gemma2:2b', size: '1.5GB', modified: new Date().toISOString() }
    ];
  }
  return null;
};

// Mock Analytics
const mockAnalytics = {
  trackButtonClick: async (buttonName: string, location?: string) => {
    console.log('📊 Mock Analytics - Button clicked:', buttonName, location);
  },
  track: async () => {},
  init: async () => {},
  isEnabled: async () => false,
  identify: async () => {},
  trackPageView: async () => {},
  trackError: async () => {},
};

export { mockInvoke, mockAnalytics };

