'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface FloatingRecordingIndicatorProps {
  isRecording: boolean;
  isPaused?: boolean;
}

export function FloatingRecordingIndicator({ isRecording, isPaused = false }: FloatingRecordingIndicatorProps) {
  const [waveformHeights, setWaveformHeights] = useState([3, 5, 4, 6, 3, 5, 4]);

  useEffect(() => {
    if (!isRecording || isPaused) return;

    const interval = setInterval(() => {
      setWaveformHeights(prev => 
        prev.map(() => Math.random() * 3 + 2) // Random heights between 2-5px
      );
    }, 150); // Update every 150ms for smooth animation

    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  if (!isRecording) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed top-4 right-4 z-[9999] pointer-events-none"
      style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
    >
      <div className="bg-gray-800/98 backdrop-blur-md border border-gray-600/40 rounded-[10px] px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Header: "m|" indicator */}
        <div className="flex items-center justify-center mb-1.5">
          <span className="text-gray-300 text-[11px] font-medium tracking-tight leading-none">mn|</span>
        </div>
        
        {/* Waveform bars - horizontal dashes like Granola */}
        <div className="flex items-center justify-center gap-0.5 h-3">
          {waveformHeights.slice(0, 3).map((height, index) => (
            <motion.div
              key={index}
              className={`h-0.5 rounded-full ${
                isPaused ? 'bg-gray-500/60' : 'bg-green-500'
              }`}
              animate={{
                width: isPaused ? '8px' : `${Math.max(6, height * 2)}px`,
                opacity: isPaused ? 0.4 : 1,
              }}
              transition={{
                duration: 0.15,
                ease: 'easeOut',
              }}
              style={{
                minWidth: '6px',
                maxWidth: '12px',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

