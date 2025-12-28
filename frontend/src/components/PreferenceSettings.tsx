"use client"

import { useEffect, useState } from "react"
import { Switch } from "./ui/switch"
import { Button } from "./ui/button"
import { FolderOpen, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { check, Update } from "@tauri-apps/plugin-updater"
import { getVersion } from "@tauri-apps/api/app"
import Analytics from "@/lib/analytics"
import AnalyticsConsentSwitch from "./AnalyticsConsentSwitch"
import { MasterPromptSettings } from "./MasterPromptSettings"
import { toast } from "sonner"

interface StorageLocations {
  database: string
  models: string
  recordings: string
}

interface NotificationSettings {
  recording_notifications: boolean
  time_based_reminders: boolean
  meeting_reminders: boolean
  respect_do_not_disturb: boolean
  notification_sound: boolean
  system_permission_granted: boolean
  consent_given: boolean
  manual_dnd_mode: boolean
  notification_preferences: {
    show_recording_started: boolean
    show_recording_stopped: boolean
    show_recording_paused: boolean
    show_recording_resumed: boolean
    show_transcription_complete: boolean
    show_meeting_reminders: boolean
    show_system_errors: boolean
    meeting_reminder_minutes: number[]
  }
}


export function PreferenceSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [storageLocations, setStorageLocations] = useState<StorageLocations | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [previousNotificationsEnabled, setPreviousNotificationsEnabled] = useState<boolean | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; body: string | null } | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Load notification settings from backend
        let settings: NotificationSettings | null = null;
        try {
          settings = await invoke<NotificationSettings>('get_notification_settings');
          setNotificationSettings(settings);
          // Notification enabled means both started and stopped notifications are enabled
          setNotificationsEnabled(
            settings.notification_preferences.show_recording_started &&
            settings.notification_preferences.show_recording_stopped
          );
        } catch (notifError) {
          console.error('Failed to load notification settings, using defaults:', notifError);
          // Use default values if notification settings fail to load
          setNotificationsEnabled(true);
        }

        // Load storage locations
        const [dbDir, modelsDir, recordingsDir] = await Promise.all([
          invoke<string>('get_database_directory'),
          invoke<string>('whisper_get_models_directory'),
          invoke<string>('get_default_recordings_folder_path')
        ]);

        setStorageLocations({
          database: dbDir,
          models: modelsDir,
          recordings: recordingsDir
        });

        // Track preferences page view
        await Analytics.track('preferences_viewed', {
          notifications_enabled: settings?.notification_preferences.show_recording_started ? 'true' : 'false'
        });

        // Load current app version
        const version = await getVersion();
        setCurrentVersion(version);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };

    loadPreferences();
  }, [])

  useEffect(() => {
    // Skip update on initial load or if value hasn't actually changed
    if (isInitialLoad || notificationsEnabled === null || notificationsEnabled === previousNotificationsEnabled) return;
    if (!notificationSettings) return;

    const updateNotificationSettings = async () => {
      console.log("Updating notification settings to:", notificationsEnabled);

      try {
        // Update the notification preferences
        const updatedSettings: NotificationSettings = {
          ...notificationSettings,
          notification_preferences: {
            ...notificationSettings.notification_preferences,
            show_recording_started: notificationsEnabled,
            show_recording_stopped: notificationsEnabled,
          }
        };

        console.log("Calling set_notification_settings with:", updatedSettings);
        await invoke('set_notification_settings', { settings: updatedSettings });
        setNotificationSettings(updatedSettings);
        setPreviousNotificationsEnabled(notificationsEnabled);
        console.log("Successfully updated notification settings to:", notificationsEnabled);

        // Track notification preference change - only fires when user manually toggles
        await Analytics.track('notification_settings_changed', {
          notifications_enabled: notificationsEnabled.toString()
        });
      } catch (error) {
        console.error('Failed to update notification settings:', error);
      }
    };

    updateNotificationSettings();
  }, [notificationsEnabled])

  const handleOpenFolder = async (folderType: 'database' | 'models' | 'recordings') => {
    try {
      switch (folderType) {
        case 'database':
          await invoke('open_database_folder');
          break;
        case 'models':
          await invoke('open_models_folder');
          break;
        case 'recordings':
          await invoke('open_recordings_folder');
          break;
      }

      // Track storage folder access
      await Analytics.track('storage_folder_opened', {
        folder_type: folderType
      });
    } catch (error) {
      console.error(`Failed to open ${folderType} folder:`, error);
    }
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateAvailable(null);
    setUpdateError(null);
    
    try {
      const updater = await check();
      
      if (updater) {
        setUpdateAvailable({
          version: updater.version,
          body: updater.body || null
        });
        toast.success(`Update available: ${updater.version}`);
        
        await Analytics.track('update_check_performed', {
          update_available: 'true',
          current_version: currentVersion,
          new_version: updater.version
        });
      } else {
        toast.info('You are running the latest version');
        await Analytics.track('update_check_performed', {
          update_available: 'false',
          current_version: currentVersion,
          new_version: 'none'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check for updates';
      console.error('Failed to check for updates:', error);
      setUpdateError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateAvailable) {
      return;
    }
    
    setIsInstallingUpdate(true);
    
    try {
      toast.info('Downloading and installing update...');
      const updater = await check();
      
      if (!updater) {
        toast.error('No update available');
        setIsInstallingUpdate(false);
        return;
      }
      
      // Download and install the update
      await updater.downloadAndInstall((event) => {
        if (event.event === 'Progress' && event.data.chunkLength) {
          // Could show progress here if needed
          console.log('Download progress:', event.data.chunkLength);
        }
      });
      
      // Note: The app will restart automatically after installation
      toast.success('Update installed. The app will restart shortly...');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to install update';
      console.error('Failed to install update:', error);
      toast.error(errorMessage);
      setIsInstallingUpdate(false);
    }
  };

  if (loading || notificationsEnabled === null) {
    return <div className="max-w-2xl mx-auto p-6">Loading Preferences...</div>
  }

  return (
    <div className="space-y-6">
      {/* Notifications Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Notifications</h3>
            <p className="text-sm text-gray-600">Enable or disable notifications of start and end of meeting</p>
          </div>
          <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
        </div>
      </div>

      {/* Data Storage Locations Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Storage Locations</h3>
        <p className="text-sm text-gray-600 mb-6">
          View and access where Margin Notes stores your data
        </p>

        <div className="space-y-4">
          {/* Database Location */}
          {/* <div className="p-4 border rounded-lg bg-gray-50">
            <div className="font-medium mb-2">Database</div>
            <div className="text-sm text-gray-600 mb-3 break-all font-mono text-xs">
              {storageLocations?.database || 'Loading...'}
            </div>
            <button
              onClick={() => handleOpenFolder('database')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
          </div> */}

          {/* Models Location */}
          {/* <div className="p-4 border rounded-lg bg-gray-50">
            <div className="font-medium mb-2">Whisper Models</div>
            <div className="text-sm text-gray-600 mb-3 break-all font-mono text-xs">
              {storageLocations?.models || 'Loading...'}
            </div>
            <button
              onClick={() => handleOpenFolder('models')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
          </div> */}

          {/* Recordings Location */}
          <div className="p-4 border rounded-lg bg-gray-50">
            <div className="font-medium mb-2">Meeting Recordings</div>
            <div className="text-sm text-gray-600 mb-3 break-all font-mono text-xs">
              {storageLocations?.recordings || 'Loading...'}
            </div>
            <button
              onClick={() => handleOpenFolder('recordings')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Database and models are stored together in your application data directory for unified management.
          </p>
        </div>
      </div>

      {/* Master Prompt Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <MasterPromptSettings />
      </div>

      {/* Analytics Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <AnalyticsConsentSwitch />
      </div>

      {/* Updates Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Application Updates</h3>
        <p className="text-sm text-gray-600 mb-4">
          Check for and install the latest version of Margin Notes. Your preferences and data will be preserved.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleCheckForUpdates}
              disabled={isCheckingUpdate || isInstallingUpdate}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isCheckingUpdate ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Check for Updates
                </>
              )}
            </Button>
            
            {updateAvailable && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">
                  Update available: <strong>{updateAvailable.version}</strong>
                </span>
              </div>
            )}
            {updateError && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600">{updateError}</span>
              </div>
            )}
            {!updateAvailable && !updateError && currentVersion && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">
                  You're running the latest version ({currentVersion})
                </span>
              </div>
            )}
          </div>

          {updateAvailable && (
            <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-1">
                    Version {updateAvailable.version} is available
                  </h4>
                  {updateAvailable.body && (
                    <p className="text-sm text-blue-800 mb-3 whitespace-pre-wrap">
                      {updateAvailable.body}
                    </p>
                  )}
                  <p className="text-xs text-blue-700">
                    Current version: {currentVersion}
                  </p>
                </div>
                <Button
                  onClick={handleInstallUpdate}
                  disabled={isInstallingUpdate}
                  variant="default"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {isInstallingUpdate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Install Update
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
