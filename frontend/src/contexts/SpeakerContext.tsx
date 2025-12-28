'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Speaker, Company } from '@/types';

interface SpeakerContextType {
  speakers: Speaker[];
  companies: Company[];
  isLoading: boolean;
  refreshSpeakers: () => Promise<void>;
  refreshCompanies: () => Promise<void>;
  getSpeakerById: (id: string) => Speaker | undefined;
  getSpeakersByIds: (ids: string[]) => Speaker[];
}

const SpeakerContext = createContext<SpeakerContextType | null>(null);

export const useSpeakers = () => {
  const context = useContext(SpeakerContext);
  if (!context) {
    throw new Error('useSpeakers must be used within a SpeakerProvider');
  }
  return context;
};

export function SpeakerProvider({ children }: { children: React.ReactNode }) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cacheTimestampRef = useRef<number>(0);
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const refreshSpeakers = useCallback(async () => {
    try {
      const data = await invoke<Speaker[]>('get_speakers', { meetingId: null });
      setSpeakers(data || []);
      cacheTimestampRef.current = Date.now();
    } catch (error) {
      console.error('Failed to load speakers:', error);
    }
  }, []);

  const refreshCompanies = useCallback(async () => {
    try {
      const data = await invoke<Company[]>('get_companies');
      setCompanies(data || []);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  }, []);

  // Load speakers and companies on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([refreshSpeakers(), refreshCompanies()]);
      setIsLoading(false);
    };
    loadData();
  }, [refreshSpeakers, refreshCompanies]);

  // Auto-refresh cache if stale
  useEffect(() => {
    const checkCache = () => {
      const now = Date.now();
      if (now - cacheTimestampRef.current > CACHE_TTL) {
        refreshSpeakers();
      }
    };

    const interval = setInterval(checkCache, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [refreshSpeakers]);

  const getSpeakerById = useCallback((id: string): Speaker | undefined => {
    return speakers.find(s => s.id === id);
  }, [speakers]);

  const getSpeakersByIds = useCallback((ids: string[]): Speaker[] => {
    return speakers.filter(s => ids.includes(s.id));
  }, [speakers]);

  return (
    <SpeakerContext.Provider
      value={{
        speakers,
        companies,
        isLoading,
        refreshSpeakers,
        refreshCompanies,
        getSpeakerById,
        getSpeakersByIds,
      }}
    >
      {children}
    </SpeakerContext.Provider>
  );
}


