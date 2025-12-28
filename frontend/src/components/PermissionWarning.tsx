import React from 'react';
import { AlertTriangle, Mic, Speaker, RefreshCw, ChevronRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface PermissionWarningProps {
  hasMicrophone: boolean;
  hasSystemAudio: boolean;
  onRecheck: () => void;
  isRechecking?: boolean;
}

export function PermissionWarning({
  hasMicrophone,
  hasSystemAudio,
  onRecheck,
  isRechecking = false
}: PermissionWarningProps) {
  // Don't show if both permissions are granted
  if (hasMicrophone && hasSystemAudio) {
    return null;
  }

  const isMacOS = navigator.userAgent.includes('Mac');

  const openMicrophoneSettings = async () => {
    if (isMacOS) {
      try {
        await invoke('open_system_settings', { preferencePane: 'Privacy_Microphone' });
      } catch (error) {
        console.error('Failed to open microphone settings:', error);
      }
    }
  };

  const openScreenRecordingSettings = async () => {
    if (isMacOS) {
      try {
        await invoke('open_system_settings', { preferencePane: 'Privacy_ScreenCapture' });
      } catch (error) {
        console.error('Failed to open screen recording settings:', error);
      }
    }
  };

  return (
    <div className="max-w-lg mb-6">
      <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#e5e5e5] bg-[#fafafa]">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded-full bg-[#fef3c7] flex items-center justify-center">
                <AlertTriangle className="h-3 w-3 text-[#d97706]" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {!hasMicrophone && (
                  <div className="w-4 h-4 rounded bg-[#e5e5e5] flex items-center justify-center">
                    <Mic className="h-2.5 w-2.5 text-[#737373]" />
                  </div>
                )}
                {!hasSystemAudio && (
                  <div className="w-4 h-4 rounded bg-[#e5e5e5] flex items-center justify-center">
                    <Speaker className="h-2.5 w-2.5 text-[#737373]" />
                  </div>
                )}
                <h3 className="text-[15px] font-semibold text-[#171717]">
                  {!hasMicrophone && !hasSystemAudio 
                    ? 'Permissions Required' 
                    : !hasMicrophone 
                    ? 'Microphone Permission Required' 
                    : 'System Audio Permission Required'}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Microphone Warning */}
          {!hasMicrophone && (
            <div className="space-y-3">
              <p className="text-[14px] text-[#525252] leading-relaxed">
                Margin Notes needs access to your microphone to record meetings. No microphone devices were detected.
              </p>
              <div className="space-y-2">
                <p className="text-[13px] font-medium text-[#171717]">Please check:</p>
                <ul className="space-y-1.5 ml-1">
                  <li className="text-[13px] text-[#525252] flex items-start gap-2">
                    <span className="text-[#a3a3a3] mt-1.5">•</span>
                    <span>Your microphone is connected and powered on</span>
                  </li>
                  <li className="text-[13px] text-[#525252] flex items-start gap-2">
                    <span className="text-[#a3a3a3] mt-1.5">•</span>
                    <span>Microphone permission is granted in System Settings</span>
                  </li>
                  <li className="text-[13px] text-[#525252] flex items-start gap-2">
                    <span className="text-[#a3a3a3] mt-1.5">•</span>
                    <span>No other app is exclusively using the microphone</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* System Audio Warning */}
          {!hasSystemAudio && (
            <div className="space-y-3">
              <p className="text-[14px] text-[#525252] leading-relaxed">
                {hasMicrophone
                  ? 'System audio capture is not available. You can still record with your microphone, but computer audio won\'t be captured.'
                  : 'System audio capture is also not available.'}
              </p>
              {isMacOS && (
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-[#171717]">To enable system audio on macOS:</p>
                  <ul className="space-y-1.5 ml-1">
                    <li className="text-[13px] text-[#525252] flex items-start gap-2">
                      <span className="text-[#a3a3a3] mt-1.5">•</span>
                      <span>Install a virtual audio device (e.g., BlackHole 2ch)</span>
                    </li>
                    <li className="text-[13px] text-[#525252] flex items-start gap-2">
                      <span className="text-[#a3a3a3] mt-1.5">•</span>
                      <span>Grant Screen Recording permission to Margin Notes</span>
                    </li>
                    <li className="text-[13px] text-[#525252] flex items-start gap-2">
                      <span className="text-[#a3a3a3] mt-1.5">•</span>
                      <span>Configure your audio routing in Audio MIDI Setup</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            {isMacOS && !hasMicrophone && (
              <button
                onClick={openMicrophoneSettings}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] font-medium text-white bg-[#171717] hover:bg-[#262626] rounded-md transition-all duration-150 shadow-sm hover:shadow"
              >
                <div className="flex items-center gap-2.5">
                  <Mic className="h-4 w-4" />
                  <span>Open Microphone Settings</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-60" />
              </button>
            )}
            {isMacOS && !hasSystemAudio && (
              <button
                onClick={openScreenRecordingSettings}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] font-medium text-white bg-[#171717] hover:bg-[#262626] rounded-md transition-all duration-150 shadow-sm hover:shadow"
              >
                <div className="flex items-center gap-2.5">
                  <Speaker className="h-4 w-4" />
                  <span>Open Screen Recording Settings</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-60" />
              </button>
            )}
            <button
              onClick={onRecheck}
              disabled={isRechecking}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[#525252] bg-white border border-[#e5e5e5] hover:bg-[#fafafa] hover:border-[#d4d4d4] rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRechecking ? 'animate-spin' : ''}`} />
              <span>Recheck</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
