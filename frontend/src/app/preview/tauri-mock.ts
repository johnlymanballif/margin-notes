// Mock for @tauri-apps/api/core
export const invoke = async (cmd: string, args?: any) => {
  console.log('🔵 Mock Tauri invoke:', cmd, args);
  // Mock responses for common commands
  if (cmd === 'get_ollama_models') {
    return [
      { name: 'gemma2:2b', id: 'gemma2:2b', size: '1.5GB', modified: new Date().toISOString() }
    ];
  }
  return null;
};

