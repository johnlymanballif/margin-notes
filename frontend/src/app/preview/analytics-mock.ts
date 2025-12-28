// Mock for Analytics
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

export default mockAnalytics;

