import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useRouter } from 'next/navigation';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { showRecordingNotification } from '@/lib/recordingNotification';
import Analytics from '@/lib/analytics';
import { toast } from 'sonner';
import type { SelectedDevices } from '@/components/DeviceSelection';

interface UseRecordingOptions {
  selectedDevices: SelectedDevices;
  meetingTitle: string;
  setMeetingTitle: (title: string) => void;
  setIsMeetingActive: (active: boolean) => void;
  setSidebarIsRecording: (recording: boolean) => void;
  refetchMeetings: () => Promise<void>;
  setCurrentMeeting: (meeting: { id: string; title: string }) => void;
  setMeetings: (meetings: any[]) => void;
  meetings: any[];
}

export function useRecording({
  selectedDevices,
  meetingTitle,
  setMeetingTitle,
  setIsMeetingActive,
  setSidebarIsRecording,
  refetchMeetings,
  setCurrentMeeting,
  setMeetings,
  meetings,
}: UseRecordingOptions) {
  const [isRecording, setIsRecordingState] = useState(false);
  const [isRecordingDisabled, setIsRecordingDisabled] = useState(false);
  const [isProcessingTranscript, setIsProcessingTranscript] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [showChunkDropWarning, setShowChunkDropWarning] = useState(false);
  const [chunkDropMessage, setChunkDropMessage] = useState('');
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [modelSelectorMessage, setModelSelectorMessage] = useState('');

  const recordingState = useRecordingState();
  const router = useRouter();
  const { setCurrentMeeting: setSidebarCurrentMeeting } = useSidebar();

  // Compute effective recording state for UI
  const effectiveIsRecording = isProcessingTranscript ? false : recordingState.isRecording;

  // Update sidebar recording state when backend-synced recording state changes
  useEffect(() => {
    setSidebarIsRecording(recordingState.isRecording);
  }, [recordingState.isRecording, setSidebarIsRecording]);

  // Set up chunk drop warning listener
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupChunkDropListener = async () => {
      try {
        console.log('Setting up chunk-drop-warning listener...');
        unlistenFn = await listen<string>('chunk-drop-warning', (event) => {
          console.log('Chunk drop warning received:', event.payload);
          setChunkDropMessage(event.payload);
          setShowChunkDropWarning(true);
        });
        console.log('Chunk drop warning listener setup complete');
      } catch (error) {
        console.error('Failed to setup chunk drop warning listener:', error);
      }
    };

    setupChunkDropListener();

    return () => {
      console.log('Cleaning up chunk drop warning listener...');
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  // Set up transcription error listener
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupTranscriptionErrorListener = async () => {
      try {
        console.log('Setting up transcription-error listener...');
        unlistenFn = await listen<{ error: string, userMessage: string, actionable: boolean }>('transcription-error', (event) => {
          console.log('Transcription error received:', event.payload);
          const { userMessage, actionable } = event.payload;

          if (actionable) {
            setModelSelectorMessage(userMessage);
            setShowModelSelector(true);
          } else {
            setErrorMessage(userMessage);
            setShowErrorAlert(true);
          }
        });
        console.log('Transcription error listener setup complete');
      } catch (error) {
        console.error('Failed to setup transcription error listener:', error);
      }
    };

    setupTranscriptionErrorListener();

    return () => {
      console.log('Cleaning up transcription error listener...');
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  const handleRecordingStart = useCallback(async () => {
    try {
      console.log('handleRecordingStart called - setting up meeting title and state');

      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const randomTitle = `Meeting ${day}_${month}_${year}_${hours}_${minutes}_${seconds}`;
      setMeetingTitle(randomTitle);

      console.log('Setting isRecordingState to true');
      setIsRecordingState(true);
      setIsMeetingActive(true);
      Analytics.trackButtonClick('start_recording', 'home_page');

      await showRecordingNotification();
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Check console for details.');
      setIsRecordingState(false);
      Analytics.trackButtonClick('start_recording_error', 'home_page');
    }
  }, [setMeetingTitle, setIsMeetingActive]);

  const handleRecordingStop = useCallback(async (
    transcripts: any[],
    transcriptsRef: React.MutableRefObject<any[]>,
    finalFlushRef: React.MutableRefObject<(() => void) | null>,
    isCallApi: boolean
  ) => {
    setIsRecordingState(false);
    setIsRecordingDisabled(true);
    setIsProcessingTranscript(true);
    const stopStartTime = Date.now();

    try {
      console.log('Post-stop processing...', {
        stop_initiated_at: new Date(stopStartTime).toISOString(),
        current_transcript_count: transcripts.length
      });

      const { listen } = await import('@tauri-apps/api/event');

      setIsProcessingTranscript(true);
      console.log('Waiting for transcription to complete...');

      const MAX_WAIT_TIME = 60000;
      const POLL_INTERVAL = 500;
      let elapsedTime = 0;
      let transcriptionComplete = false;

      const unlistenComplete = await listen('transcription-complete', () => {
        console.log('Received transcription-complete event');
        transcriptionComplete = true;
      });

      while (elapsedTime < MAX_WAIT_TIME && !transcriptionComplete) {
        try {
          const status = await invoke<{ chunks_in_queue: number, is_processing: boolean, last_activity_ms: number }>('get_transcription_status');
          console.log('Transcription status:', status);

          if (!status.is_processing && status.chunks_in_queue === 0) {
            console.log('Transcription complete - no active processing and no chunks in queue');
            transcriptionComplete = true;
            break;
          }

          if (status.last_activity_ms > 8000 && status.chunks_in_queue === 0) {
            console.log('Transcription likely complete - no recent activity and empty queue');
            transcriptionComplete = true;
            break;
          }

          if (status.chunks_in_queue > 0) {
            console.log(`Processing ${status.chunks_in_queue} remaining audio chunks...`);
          }

          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
          elapsedTime += POLL_INTERVAL;
        } catch (error) {
          console.error('Error checking transcription status:', error);
          break;
        }
      }

      unlistenComplete();

      if (!transcriptionComplete && elapsedTime >= MAX_WAIT_TIME) {
        console.warn('⏰ Transcription wait timeout reached after', elapsedTime, 'ms');
      } else {
        console.log('✅ Transcription completed after', elapsedTime, 'ms');
        await new Promise(resolve => setTimeout(resolve, 4000));
      }

      const flushStartTime = Date.now();
      console.log('🔄 Final buffer flush...');
      if (finalFlushRef.current) {
        finalFlushRef.current();
        const flushEndTime = Date.now();
        console.log('✅ Final buffer flush completed', {
          flush_duration: flushEndTime - flushStartTime,
        });
      }

      setIsProcessingTranscript(false);
      setIsStopping(false);

      await new Promise(resolve => setTimeout(resolve, 500));

      if (isCallApi && transcriptionComplete) {
        setIsSavingTranscript(true);

        const freshTranscripts = [...transcriptsRef.current];
        const folderPath = sessionStorage.getItem('last_recording_folder_path');
        const savedMeetingName = sessionStorage.getItem('last_recording_meeting_name');

        console.log('💾 Saving COMPLETE transcripts to database...', {
          transcript_count: freshTranscripts.length,
          meeting_name: meetingTitle || savedMeetingName,
        });

        try {
          const responseData = await invoke('api_save_transcript', {
            meetingTitle: meetingTitle || savedMeetingName,
            transcripts: freshTranscripts,
            folderPath: folderPath,
          }) as any;

          const meetingId = responseData.meeting_id;
          if (!meetingId) {
            throw new Error('No meeting ID received from save operation');
          }

          console.log('✅ Successfully saved COMPLETE meeting with ID:', meetingId);

          sessionStorage.removeItem('last_recording_folder_path');
          sessionStorage.removeItem('last_recording_meeting_name');

          await refetchMeetings();

          try {
            const meetingData = await invoke('api_get_meeting', { meetingId }) as any;
            if (meetingData) {
              setCurrentMeeting({
                id: meetingId,
                title: meetingData.title
              });
              setSidebarCurrentMeeting({
                id: meetingId,
                title: meetingData.title
              });
            }
          } catch (error) {
            console.warn('Could not fetch meeting details:', error);
            setCurrentMeeting({ id: meetingId, title: meetingTitle || 'New Meeting' });
          }

          toast.success('Recording saved successfully!', {
            description: `${freshTranscripts.length} transcript segments saved.`,
            action: {
              label: 'View Meeting',
              onClick: () => {
                router.push(`/meeting-details?id=${meetingId}`);
                Analytics.trackButtonClick('view_meeting_from_toast', 'recording_complete');
              }
            },
            duration: 10000,
          });

          setTimeout(() => {
            router.push(`/meeting-details?id=${meetingId}`);
            Analytics.trackPageView('meeting_details');
          }, 2000);

          setMeetings([{ id: meetingId, title: meetingTitle || savedMeetingName || 'New Meeting' }, ...meetings]);

          try {
            let durationSeconds = 0;
            if (freshTranscripts.length > 0 && freshTranscripts[0].audio_start_time !== undefined) {
              const lastTranscript = freshTranscripts[freshTranscripts.length - 1];
              durationSeconds = lastTranscript.audio_end_time || lastTranscript.audio_start_time || 0;
            }

            const transcriptWordCount = freshTranscripts
              .map(t => t.text.split(/\s+/).length)
              .reduce((a, b) => a + b, 0);

            const wordsPerMinute = durationSeconds > 0 ? transcriptWordCount / (durationSeconds / 60) : 0;
            const meetingsToday = await Analytics.getMeetingsCountToday();

            await Analytics.trackMeetingCompleted(meetingId, {
              duration_seconds: durationSeconds,
              transcript_segments: freshTranscripts.length,
              transcript_word_count: transcriptWordCount,
              words_per_minute: wordsPerMinute,
              meetings_today: meetingsToday
            });

            await Analytics.updateMeetingCount();

            const { Store } = await import('@tauri-apps/plugin-store');
            const store = await Store.load('analytics.json');
            const totalMeetings = await store.get<number>('total_meetings');

            if (totalMeetings === 1) {
              const daysSinceInstall = await Analytics.calculateDaysSince('first_launch_date');
              await Analytics.track('user_activated', {
                meetings_count: '1',
                days_since_install: daysSinceInstall?.toString() || 'null',
                first_meeting_duration_seconds: durationSeconds.toString()
              });
            }
          } catch (analyticsError) {
            console.error('Failed to track meeting completion analytics:', analyticsError);
          }
        } catch (saveError) {
          console.error('Failed to save meeting to database:', saveError);
          toast.error('Failed to save meeting', {
            description: saveError instanceof Error ? saveError.message : 'Unknown error'
          });
          throw saveError;
        } finally {
          setIsSavingTranscript(false);
        }
      }

      setIsMeetingActive(false);
      setIsRecordingDisabled(false);
    } catch (error) {
      console.error('Error in handleRecordingStop:', error);
      setIsProcessingTranscript(false);
      setIsStopping(false);
      setIsSavingTranscript(false);
      setIsRecordingDisabled(false);
    }
  }, [meetingTitle, refetchMeetings, setCurrentMeeting, setMeetings, meetings, router, setSidebarCurrentMeeting]);

  return {
    isRecording,
    effectiveIsRecording,
    isRecordingDisabled,
    isProcessingTranscript,
    isStopping,
    isSavingTranscript,
    showChunkDropWarning,
    chunkDropMessage,
    showErrorAlert,
    errorMessage,
    showModelSelector,
    modelSelectorMessage,
    setIsRecordingState,
    setIsStopping,
    setShowChunkDropWarning,
    setShowErrorAlert,
    setShowModelSelector,
    handleRecordingStart,
    handleRecordingStop,
  };
}

