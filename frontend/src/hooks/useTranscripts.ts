import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Transcript, TranscriptUpdate } from '@/types';
import { useRecordingState } from '@/contexts/RecordingStateContext';

interface UseTranscriptsOptions {
  meetingTitle: string;
  setMeetingTitle: (title: string) => void;
}

export function useTranscripts({ meetingTitle, setMeetingTitle }: UseTranscriptsOptions) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isProcessingTranscript, setIsProcessingTranscript] = useState(false);
  
  const recordingState = useRecordingState();
  const transcriptsRef = useRef<Transcript[]>(transcripts);
  const finalFlushRef = useRef<(() => void) | null>(null);

  // Keep ref updated with current transcripts
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  // Memoize sorted transcripts to avoid re-sorting on every render
  const sortedTranscripts = useMemo(() => {
    return [...transcripts].sort((a, b) => {
      const chunkTimeDiff = (a.chunk_start_time || 0) - (b.chunk_start_time || 0);
      if (chunkTimeDiff !== 0) return chunkTimeDiff;
      return (a.sequence_id || 0) - (b.sequence_id || 0);
    });
  }, [transcripts]);

  // Set up transcript listener with buffering
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let transcriptCounter = 0;
    let transcriptBuffer = new Map<number, Transcript>();
    let lastProcessedSequence = 0;
    let processingTimer: NodeJS.Timeout | undefined;

    const processBufferedTranscripts = (forceFlush = false) => {
      const sortedTranscripts: Transcript[] = [];

      // Process all available sequential transcripts
      let nextSequence = lastProcessedSequence + 1;
      while (transcriptBuffer.has(nextSequence)) {
        const bufferedTranscript = transcriptBuffer.get(nextSequence)!;
        sortedTranscripts.push(bufferedTranscript);
        transcriptBuffer.delete(nextSequence);
        lastProcessedSequence = nextSequence;
        nextSequence++;
      }

      // Add any buffered transcripts that might be out of order
      const now = Date.now();
      const staleThreshold = 100;
      const recentThreshold = 0;
      const staleTranscripts: Transcript[] = [];
      const recentTranscripts: Transcript[] = [];
      const forceFlushTranscripts: Transcript[] = [];

      for (const [sequenceId, transcript] of transcriptBuffer.entries()) {
        if (forceFlush) {
          forceFlushTranscripts.push(transcript);
          transcriptBuffer.delete(sequenceId);
          console.log(`Force flush: processing transcript with sequence_id ${sequenceId}`);
        } else {
          const transcriptAge = now - parseInt(transcript.id.split('-')[0]);
          if (transcriptAge > staleThreshold) {
            staleTranscripts.push(transcript);
            transcriptBuffer.delete(sequenceId);
          } else if (transcriptAge >= recentThreshold) {
            recentTranscripts.push(transcript);
            transcriptBuffer.delete(sequenceId);
          }
        }
      }

      const sortTranscripts = (transcripts: Transcript[]) => {
        return transcripts.sort((a, b) => {
          const chunkTimeDiff = (a.chunk_start_time || 0) - (b.chunk_start_time || 0);
          if (chunkTimeDiff !== 0) return chunkTimeDiff;
          return (a.sequence_id || 0) - (b.sequence_id || 0);
        });
      };

      const sortedStaleTranscripts = sortTranscripts(staleTranscripts);
      const sortedRecentTranscripts = sortTranscripts(recentTranscripts);
      const sortedForceFlushTranscripts = sortTranscripts(forceFlushTranscripts);

      const allNewTranscripts = [...sortedTranscripts, ...sortedRecentTranscripts, ...sortedStaleTranscripts, ...sortedForceFlushTranscripts];

      if (allNewTranscripts.length > 0) {
        setTranscripts(prev => {
          const existingSequenceIds = new Set(prev.map(t => t.sequence_id).filter(id => id !== undefined));
          const uniqueNewTranscripts = allNewTranscripts.filter(transcript =>
            transcript.sequence_id !== undefined && !existingSequenceIds.has(transcript.sequence_id)
          );

          if (uniqueNewTranscripts.length === 0) {
            return prev;
          }

          const combined = [...prev, ...uniqueNewTranscripts];
          return combined.sort((a, b) => {
            const chunkTimeDiff = (a.chunk_start_time || 0) - (b.chunk_start_time || 0);
            if (chunkTimeDiff !== 0) return chunkTimeDiff;
            return (a.sequence_id || 0) - (b.sequence_id || 0);
          });
        });
      }
    };

    finalFlushRef.current = () => processBufferedTranscripts(true);

    const setupListener = async () => {
      try {
        console.log('🔥 Setting up transcript listener...');
        unlistenFn = await listen<TranscriptUpdate>('transcript-update', (event) => {
          const now = Date.now();

          if (transcriptBuffer.has(event.payload.sequence_id)) {
            console.log('🚫 Duplicate sequence_id, skipping:', event.payload.sequence_id);
            return;
          }

          const newTranscript: Transcript = {
            id: `${Date.now()}-${transcriptCounter++}`,
            text: event.payload.text,
            timestamp: event.payload.timestamp,
            sequence_id: event.payload.sequence_id,
            chunk_start_time: event.payload.chunk_start_time,
            is_partial: event.payload.is_partial,
            confidence: event.payload.confidence,
            audio_start_time: event.payload.audio_start_time,
            audio_end_time: event.payload.audio_end_time,
            duration: event.payload.duration,
          };

          transcriptBuffer.set(event.payload.sequence_id, newTranscript);

          if (processingTimer) {
            clearTimeout(processingTimer);
          }

          processingTimer = setTimeout(processBufferedTranscripts, 10);
        });
        console.log('✅ Transcript listener setup complete');
      } catch (error) {
        console.error('❌ Failed to setup transcript listener:', error);
      }
    };

    setupListener();

    return () => {
      console.log('🧹 CLEANUP: Cleaning up transcript listener...');
      if (processingTimer) {
        clearTimeout(processingTimer);
      }
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  // Sync transcript history from backend on reload
  useEffect(() => {
    const syncFromBackend = async () => {
      if (recordingState.isRecording && transcripts.length === 0) {
        try {
          console.log('[Reload Sync] Recording active after reload, syncing transcript history...');
          const history = await invoke<any[]>('get_transcript_history');
          console.log(`[Reload Sync] Retrieved ${history.length} transcript segments from backend`);

          const formattedTranscripts: Transcript[] = history.map((segment: any) => ({
            id: segment.id,
            text: segment.text,
            timestamp: segment.display_time,
            sequence_id: segment.sequence_id,
            chunk_start_time: segment.audio_start_time,
            is_partial: false,
            confidence: segment.confidence,
            audio_start_time: segment.audio_start_time,
            audio_end_time: segment.audio_end_time,
            duration: segment.duration,
          }));

          setTranscripts(formattedTranscripts);
          console.log('[Reload Sync] ✅ Transcript history synced successfully');

          const meetingName = await invoke<string | null>('get_recording_meeting_name');
          if (meetingName) {
            console.log('[Reload Sync] Retrieved meeting name:', meetingName);
            setMeetingTitle(meetingName);
          }
        } catch (error) {
          console.error('[Reload Sync] Failed to sync from backend:', error);
        }
      }
    };

    syncFromBackend();
  }, [recordingState.isRecording, transcripts.length, setMeetingTitle]);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    // Clear refs to help GC
    transcriptsRef.current = [];
  }, []);

  // Memory monitoring: log transcript count periodically
  useEffect(() => {
    if (transcripts.length === 0) return;

    const interval = setInterval(() => {
      const transcriptCount = transcripts.length;
      const estimatedMemoryMB = (transcripts.reduce((acc, t) => acc + t.text.length, 0) * 2) / (1024 * 1024);
      
      if (transcriptCount > 1000) {
        console.log(`📊 Memory usage: ${transcriptCount} transcripts, ~${estimatedMemoryMB.toFixed(2)}MB`);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [transcripts.length]);

  // Auto-cleanup: Keep only last 5000 transcripts in memory during active recording
  // Older transcripts are already saved to database
  useEffect(() => {
    if (transcripts.length > 5000 && !recordingState.isRecording) {
      console.log(`🧹 Cleaning up old transcripts: keeping last 5000 of ${transcripts.length}`);
      const recentTranscripts = transcripts.slice(-5000);
      setTranscripts(recentTranscripts);
    }
  }, [transcripts.length, recordingState.isRecording]);

  return {
    transcripts: sortedTranscripts,
    transcriptsRef,
    finalFlushRef,
    isProcessingTranscript,
    setIsProcessingTranscript,
    clearTranscripts,
  };
}

