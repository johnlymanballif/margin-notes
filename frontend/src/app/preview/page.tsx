"use client";

import { useState, useEffect } from 'react';
import { SummaryGeneratorButtonGroup } from '@/components/MeetingDetails/SummaryGeneratorButtonGroup';
import { ModelConfig } from '@/components/ModelSettingsModal';
import { Toaster } from 'sonner';
import "sonner/dist/styles.css";

export default function PreviewPage() {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'ollama',
    model: 'gemma2:2b',
    whisperModel: 'base',
    ollamaEndpoint: 'http://localhost:11434'
  });

  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error'>('idle');
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [isMounted, setIsMounted] = useState(false);

  const availableTemplates = [
    { id: 'default', name: 'Default Template', description: 'Standard summary format' },
    { id: 'detailed', name: 'Detailed Template', description: 'More comprehensive summary' },
    { id: 'brief', name: 'Brief Template', description: 'Concise summary format' }
  ];

  // Set up mocks on mount
  useEffect(() => {
    setIsMounted(true);
    
    // Mock Tauri invoke - create a global mock that components can use
    if (typeof window !== 'undefined') {
      // Create mock invoke function
      const mockInvoke = async (cmd: string, args?: any) => {
        console.log('🔵 Mock Tauri invoke:', cmd, args);
        if (cmd === 'get_ollama_models') {
          return [
            { name: 'gemma2:2b', id: 'gemma2:2b', size: '1.5GB', modified: new Date().toISOString() }
          ];
        }
        return null;
      };

      // Try to mock the actual module
      try {
        // Use dynamic import to avoid SSR issues
        import('@tauri-apps/api/core').then((tauriCore) => {
          if (tauriCore && tauriCore.invoke) {
            // Wrap the original invoke
            const originalInvoke = tauriCore.invoke;
            (tauriCore as any).invoke = async (cmd: string, args?: any) => {
              console.log('🔵 Mock Tauri invoke:', cmd, args);
              if (cmd === 'get_ollama_models') {
                return [
                  { name: 'gemma2:2b', id: 'gemma2:2b', size: '1.5GB', modified: new Date().toISOString() }
                ];
              }
              try {
                return await originalInvoke(cmd, args);
              } catch {
                return null;
              }
            };
          }
        }).catch(() => {
          // Module not available, store mock globally
          (window as any).__TAURI_MOCK_INVOKE__ = mockInvoke;
        });
      } catch (e) {
        // Store mock globally as fallback
        (window as any).__TAURI_MOCK_INVOKE__ = mockInvoke;
      }

      // Mock Analytics
      import('@/lib/analytics').then((analyticsModule) => {
        const Analytics = analyticsModule.default;
        if (Analytics && Analytics.trackButtonClick) {
          const originalTrackButtonClick = Analytics.trackButtonClick;
          Analytics.trackButtonClick = async (buttonName: string, location?: string) => {
            console.log('📊 Mock Analytics - Button clicked:', buttonName, location);
            try {
              if (originalTrackButtonClick) {
                await originalTrackButtonClick(buttonName, location);
              }
            } catch {
              // Ignore errors in preview mode
            }
          };
        }
      }).catch(() => {
        // Analytics module not available, that's fine
        console.log('Analytics module not available in preview mode');
      });
    }
  }, []);

  const handleGenerateSummary = async (customPrompt: string) => {
    console.log('Generate summary called with prompt:', customPrompt);
    setSummaryStatus('processing');
    // Simulate processing
    setTimeout(() => {
      setSummaryStatus('completed');
    }, 2000);
  };

  const handleSaveModelConfig = async (config?: ModelConfig) => {
    console.log('Save model config:', config || modelConfig);
    if (config) {
      setModelConfig(config);
    }
  };

  const handleTemplateSelect = (templateId: string, templateName: string) => {
    console.log('Template selected:', templateId, templateName);
    setSelectedTemplate(templateId);
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-[#737373] text-sm font-medium">Loading preview...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      <div className="max-w-5xl mx-auto px-8 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-[32px] font-semibold text-[#171717] mb-2 tracking-tight">Component Preview</h1>
          <p className="text-[15px] text-[#737373] leading-relaxed">
            Interactive preview for the SummaryGeneratorButtonGroup component
          </p>
        </div>

        {/* Status Controls - Premium Style */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[13px] font-medium text-[#525252] uppercase tracking-wider">Status Controls</h2>
            <div className="h-px flex-1 bg-[#e5e5e5]"></div>
          </div>
          <div className="flex gap-2">
            {(['idle', 'processing', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setSummaryStatus(status)}
                className={`px-4 py-2 text-[13px] font-medium rounded-md transition-all duration-150 ${
                  summaryStatus === status
                    ? 'bg-[#171717] text-white shadow-sm'
                    : 'bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#fafafa] hover:border-[#d4d4d4]'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Component Preview */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[13px] font-medium text-[#525252] uppercase tracking-wider">Component</h2>
            <div className="h-px flex-1 bg-[#e5e5e5]"></div>
          </div>
          <div className="bg-white border border-[#e5e5e5] rounded-lg p-8 shadow-sm">
            <div className="flex justify-center">
              <SummaryGeneratorButtonGroup
                modelConfig={modelConfig}
                setModelConfig={setModelConfig}
                onSaveModelConfig={handleSaveModelConfig}
                onGenerateSummary={handleGenerateSummary}
                customPrompt=""
                summaryStatus={summaryStatus}
                availableTemplates={availableTemplates}
                selectedTemplate={selectedTemplate}
                onTemplateSelect={handleTemplateSelect}
                hasTranscripts={true}
                isModelConfigLoading={false}
              />
            </div>
          </div>
        </div>

        {/* State Display */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[13px] font-medium text-[#525252] uppercase tracking-wider">Current State</h2>
            <div className="h-px flex-1 bg-[#e5e5e5]"></div>
          </div>
          <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 shadow-sm">
            <pre className="text-[12px] text-[#525252] font-mono leading-relaxed overflow-auto">
              {JSON.stringify({
                summaryStatus,
                selectedTemplate,
                modelConfig
              }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
      <Toaster position="bottom-center" richColors closeButton />
    </div>
  );
}
