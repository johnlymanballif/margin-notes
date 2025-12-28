'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';

interface AudioLevelEvent {
  level: number;
  confidence: number;
}

export default function FloatingIndicatorPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [waveformHeights, setWaveformHeights] = useState([0.3, 0.5, 0.4, 0.6]);

  useEffect(() => {
    // Listen for recording state changes
    const unlistenRecordingStarted = listen('recording-started', () => {
      setIsRecording(true);
      setIsPaused(false);
    });

    const unlistenRecordingStopped = listen('recording-stopped', () => {
      setIsRecording(false);
      setIsPaused(false);
    });

    const unlistenRecordingPaused = listen('recording-paused', () => {
      setIsPaused(true);
    });

    const unlistenRecordingResumed = listen('recording-resumed', () => {
      setIsPaused(false);
    });

    // Listen for audio level updates
    const unlistenAudioLevel = listen<AudioLevelEvent>('audio-level-update', (event) => {
      setAudioLevel(event.payload.level);
      setConfidence(event.payload.confidence);
    });

    return () => {
      unlistenRecordingStarted.then(fn => fn());
      unlistenRecordingStopped.then(fn => fn());
      unlistenRecordingPaused.then(fn => fn());
      unlistenRecordingResumed.then(fn => fn());
      unlistenAudioLevel.then(fn => fn());
    };
  }, []);

  // Animate waveform based on audio level
  useEffect(() => {
    if (!isRecording || isPaused) {
      setWaveformHeights([0.3, 0.3, 0.3, 0.3]);
      return;
    }

    const interval = setInterval(() => {
      // Use audio level to influence waveform heights
      const baseHeight = Math.max(0.2, audioLevel);
      setWaveformHeights([
        baseHeight * (0.7 + Math.random() * 0.6),
        baseHeight * (0.8 + Math.random() * 0.7),
        baseHeight * (0.6 + Math.random() * 0.8),
        baseHeight * (0.9 + Math.random() * 0.5),
      ]);
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording, isPaused, audioLevel]);

  if (!isRecording) return null;

  return (
    <div 
      className="w-full h-full flex items-center justify-center"
      style={{ 
        WebkitAppRegion: 'drag' as any,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif'
      }}
    >
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="relative"
        >
          {/* Pill container */}
          <div className="bg-white/95 backdrop-blur-xl rounded-full px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-200/50 flex items-center gap-3">
            {/* M Logo */}
            <div className="flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text
                  x="50%"
                  y="50%"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill="#6B7280"
                  fontSize="18"
                  fontWeight="600"
                  fontFamily="var(--font-inter), Inter, system-ui, sans-serif"
                >
                  M
                </text>
              </svg>
            </div>

            {/* Waveform bars */}
            <div className="flex items-center gap-1 h-6">
              {waveformHeights.map((height, index) => (
                <motion.div
                  key={index}
                  className={`w-1 rounded-full ${
                    isPaused ? 'bg-gray-400' : 'bg-green-500'
                  }`}
                  animate={{
                    height: isPaused ? '4px' : `${height * 24}px`,
                  }}
                  transition={{
                    duration: 0.1,
                    ease: 'easeOut',
                  }}
                  style={{
                    minHeight: '4px',
                  }}
                />
              ))}
            </div>

            {/* Confidence indicator (optional - subtle dot) */}
            {confidence > 0.7 && !isPaused && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-1.5 h-1.5 rounded-full bg-green-500"
              />
            )}
          </div>

          {/* Subtle glow effect when recording */}
          {!isPaused && (
            <motion.div
              className="absolute inset-0 rounded-full bg-green-500/20 blur-xl -z-10"
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

