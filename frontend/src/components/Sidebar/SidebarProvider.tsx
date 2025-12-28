'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Analytics from '@/lib/analytics';
import { invoke } from '@tauri-apps/api/core';
import { meetingListCache } from '@/lib/cache';


interface SidebarItem {
  id: string;
  title: string;
  type: 'folder' | 'file';
  children?: SidebarItem[];
}

export interface CurrentMeeting {
  id: string;
  title: string;
  folder_id?: string | null;
}

// Search result type for transcript search
interface TranscriptSearchResult {
  id: string;
  title: string;
  matchContext: string;
  timestamp: string;
};

interface SidebarContextType {
  currentMeeting: CurrentMeeting | null;
  setCurrentMeeting: (meeting: CurrentMeeting | null) => void;
  sidebarItems: SidebarItem[];
  isCollapsed: boolean;
  toggleCollapse: () => void;
  meetings: CurrentMeeting[];
  setMeetings: (meetings: CurrentMeeting[]) => void;
  isMeetingActive: boolean;
  setIsMeetingActive: (active: boolean) => void;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  handleRecordingToggle: () => void;
  searchTranscripts: (query: string) => Promise<void>;
  searchResults: TranscriptSearchResult[];
  isSearching: boolean;
  setServerAddress: (address: string) => void;
  serverAddress: string;
  transcriptServerAddress: string;
  setTranscriptServerAddress: (address: string) => void;
  // Summary polling management
  activeSummaryPolls: Map<string, NodeJS.Timeout>;
  startSummaryPolling: (meetingId: string, processId: string, onUpdate: (result: any) => void) => void;
  stopSummaryPolling: (meetingId: string) => void;
  // Refetch meetings from backend
  refetchMeetings: () => Promise<void>;

}

const SidebarContext = createContext<SidebarContextType | null>(null);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [currentMeeting, setCurrentMeeting] = useState<CurrentMeeting | null>({ id: 'intro-call', title: '+ New Call' });
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [meetings, setMeetings] = useState<CurrentMeeting[]>([]);
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [serverAddress, setServerAddress] = useState('');
  const [transcriptServerAddress, setTranscriptServerAddress] = useState('');
  const [activeSummaryPolls, setActiveSummaryPolls] = useState<Map<string, NodeJS.Timeout>>(new Map());


  const pathname = usePathname();
  const router = useRouter();

  // Extract fetchMeetings as a reusable function with caching
  const fetchMeetings = React.useCallback(async () => {
    if (serverAddress) {
      try {
        // Check cache first
        const cacheKey = 'meeting-list';
        const cached = meetingListCache.get(cacheKey);
        if (cached) {
          console.log('📦 Using cached meeting list');
          setMeetings(cached);
          return;
        }

        const meetings = await invoke('api_get_meetings') as Array<{id: string, title: string, folder_id?: string | null}>;
        const transformedMeetings = meetings.map((meeting: any) => ({
          id: meeting.id,
          title: meeting.title,
          folder_id: meeting.folder_id || null
        }));
        
        // Cache the result (5 minute TTL)
        meetingListCache.set(cacheKey, transformedMeetings, 5 * 60 * 1000);
        
        setMeetings(transformedMeetings);
        Analytics.trackBackendConnection(true);
      } catch (error) {
        console.error('Error fetching meetings:', error);
        setMeetings([]);
        Analytics.trackBackendConnection(false, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }, [serverAddress]);

  useEffect(() => {
    fetchMeetings();
  }, [serverAddress, fetchMeetings]);

  useEffect(() => {
    const fetchSettings = async () => {
        
        setServerAddress('http://localhost:5167');
        setTranscriptServerAddress('http://127.0.0.1:8178/stream');
        
      
    };
    fetchSettings();
  }, []);

  // State for folders
  const [folders, setFolders] = useState<any[]>([]);

  // Load folders
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const allFolders = await invoke<any[]>('get_all_folders');
        setFolders(allFolders || []);
      } catch (error) {
        console.error('Failed to load folders:', error);
      }
    };
    loadFolders();
  }, []);

  // Organize meetings by folders
  const baseItems: SidebarItem[] = React.useMemo(() => {
    const rootFolders = folders.filter(f => !f.parent_id);
    
    // Group meetings by folder
    const meetingsByFolder = new Map<string, SidebarItem[]>();
    const meetingsWithoutFolder: SidebarItem[] = [];
    
    meetings.forEach(meeting => {
      const meetingItem: SidebarItem = {
        id: meeting.id,
        title: meeting.title,
        type: 'file' as const
      };
      
      if (meeting.folder_id) {
        if (!meetingsByFolder.has(meeting.folder_id)) {
          meetingsByFolder.set(meeting.folder_id, []);
        }
        meetingsByFolder.get(meeting.folder_id)!.push(meetingItem);
      } else {
        meetingsWithoutFolder.push(meetingItem);
      }
    });
    
    // Create folder items
    const folderItems: SidebarItem[] = rootFolders.map(folder => ({
      id: folder.id,
      title: folder.name,
      type: 'folder' as const,
      children: meetingsByFolder.get(folder.id) || []
    }));
    
    // Combine: folders first, then meetings without folder
    return [
      {
        id: 'meetings',
        title: 'Meeting Notes',
        type: 'folder' as const,
        children: [
          ...folderItems,
          ...meetingsWithoutFolder
        ]
      }
    ];
  }, [meetings, folders]);

 

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Update current meeting when on home page
  useEffect(() => {
    if (pathname === '/') {
      setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
    }
    setSidebarItems(baseItems);
  }, [pathname]);

  // Update sidebar items when meetings change
  useEffect(() => {
    setSidebarItems(baseItems);
  }, [meetings]);

  // Function to handle recording toggle from sidebar
  const handleRecordingToggle = () => {
    if (!isRecording) {
      // If not recording, navigate to home page and set flag to start recording automatically
      sessionStorage.setItem('autoStartRecording', 'true');
      router.push('/');
      
      // Track recording initiation from sidebar
      Analytics.trackButtonClick('start_recording', 'sidebar');
    }
    // The actual recording start/stop is handled in the Home component
  };
  
  // Function to search through meeting transcripts
  const searchTranscripts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);


      const results = await invoke('api_search_transcripts', { query }) as TranscriptSearchResult[];
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching transcripts:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Summary polling management with exponential backoff
  const startSummaryPolling = React.useCallback((
    meetingId: string,
    processId: string,
    onUpdate: (result: any) => void
  ) => {
    // Stop existing poll for this meeting if any (cleanup handled by the polling function)
    if (activeSummaryPolls.has(meetingId)) {
      // The old polling will be cleaned up when new one starts
    }

    console.log(`📊 Starting polling for meeting ${meetingId}, process ${processId}`);

    let pollCount = 0;
    const MAX_POLLS = 120; // 10 minutes maximum
    let currentDelay = 1000; // Start with 1 second
    const MAX_DELAY = 8000; // Max 8 seconds
    let timeoutId: NodeJS.Timeout | null = null;
    let isTabVisible = true;

    // Detect tab visibility to pause polling when tab is inactive
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (!isTabVisible) {
        console.log(`⏸️ Tab hidden, pausing polling for ${meetingId}`);
      } else {
        console.log(`▶️ Tab visible, resuming polling for ${meetingId}`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const poll = async () => {
      // Skip polling if tab is not visible
      if (!isTabVisible) {
        timeoutId = setTimeout(poll, currentDelay);
        return;
      }

      pollCount++;

      // Timeout safety: Stop after 10 minutes
      if (pollCount >= MAX_POLLS) {
        console.warn(`⏱️ Polling timeout for ${meetingId} after ${MAX_POLLS} iterations`);
        if (timeoutId) clearTimeout(timeoutId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        setActiveSummaryPolls(prev => {
          const next = new Map(prev);
          next.delete(meetingId);
          return next;
        });
        onUpdate({
          status: 'error',
          error: 'Summary generation timed out after 10 minutes. Please try again or check your model configuration.'
        });
        return;
      }
      try {
        const result = await invoke('api_get_summary', {
          meetingId: meetingId,
        }) as any;

        console.log(`📊 Polling update for ${meetingId}:`, result.status);

        // Call the update callback with result
        onUpdate(result);

        // Stop polling if completed, error, failed, or idle (after initial processing)
        if (result.status === 'completed' || result.status === 'error' || result.status === 'failed') {
          console.log(`✅ Polling completed for ${meetingId}, status: ${result.status}`);
          if (timeoutId) clearTimeout(timeoutId);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          setActiveSummaryPolls(prev => {
            const next = new Map(prev);
            next.delete(meetingId);
            return next;
          });
          return;
        } else if (result.status === 'idle' && pollCount > 1) {
          // If we get 'idle' after polling started, process completed/disappeared
          console.log(`✅ Process completed or not found for ${meetingId}, stopping poll`);
          if (timeoutId) clearTimeout(timeoutId);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          setActiveSummaryPolls(prev => {
            const next = new Map(prev);
            next.delete(meetingId);
            return next;
          });
          return;
        }

        // Exponential backoff: increase delay gradually
        // Start fast (1s), then slow down to max (8s) after 10 polls
        if (pollCount < 10) {
          currentDelay = Math.min(1000 + (pollCount * 200), MAX_DELAY);
        } else {
          currentDelay = MAX_DELAY;
        }
      } catch (error) {
        console.error(`❌ Polling error for ${meetingId}:`, error);
        // Report error to callback
        onUpdate({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        if (timeoutId) clearTimeout(timeoutId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        setActiveSummaryPolls(prev => {
          const next = new Map(prev);
          next.delete(meetingId);
          return next;
        });
        return;
      }

      // Schedule next poll with exponential backoff
      timeoutId = setTimeout(poll, currentDelay);
    };

    // Start polling immediately
    poll();

    setActiveSummaryPolls(prev => new Map(prev).set(meetingId, null as any));
  }, [activeSummaryPolls]);

  const stopSummaryPolling = React.useCallback((meetingId: string) => {
    if (activeSummaryPolls.has(meetingId)) {
      console.log(`⏹️ Stopping polling for meeting ${meetingId}`);
      // Note: With setTimeout-based polling, cleanup is handled by the polling function
      // Removing from map will prevent further scheduling
      setActiveSummaryPolls(prev => {
        const next = new Map(prev);
        next.delete(meetingId);
        return next;
      });
    }
  }, [activeSummaryPolls]);

  // Cleanup all polling on unmount (timeouts are cleaned up by their own cleanup functions)
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up all summary polling');
      // Polling cleanup is handled by individual cleanup functions
      setActiveSummaryPolls(new Map());
    };
  }, []);



  return (
    <SidebarContext.Provider value={{
      currentMeeting,
      setCurrentMeeting,
      sidebarItems,
      isCollapsed,
      toggleCollapse,
      meetings,
      setMeetings,
      isMeetingActive,
      setIsMeetingActive,
      isRecording,
      setIsRecording,
      handleRecordingToggle,
      searchTranscripts,
      searchResults,
      isSearching,
      setServerAddress,
      serverAddress,
      transcriptServerAddress,
      setTranscriptServerAddress,
      activeSummaryPolls,
      startSummaryPolling,
      stopSummaryPolling,
      refetchMeetings: async () => {
        // Invalidate cache before fetching
        meetingListCache.delete('meeting-list');
        await fetchMeetings();
      },

    }}>
      {children}
    </SidebarContext.Provider>
  );
}
