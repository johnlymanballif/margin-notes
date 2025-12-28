"use client";

import { Transcript } from '@/types';
import { TranscriptView } from '@/components/TranscriptView';
import { TranscriptButtonGroup } from './TranscriptButtonGroup';
import { SpeakerManager } from '@/components/SpeakerManager';
import { TagManager } from '@/components/TagManager';
import { FolderManager } from '@/components/FolderManager';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Tag, Folder } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Tag as TagType, Folder as FolderType } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface TranscriptPanelProps {
  transcripts: Transcript[];
  meetingId?: string;
  customPrompt: string;
  onPromptChange: (value: string) => void;
  onCopyTranscript: () => void;
  onOpenMeetingFolder: () => Promise<void>;
  isRecording: boolean;
  onTranscriptUpdate?: (transcriptId: string, updates: Partial<Transcript>) => void;
}

export function TranscriptPanel({
  transcripts,
  meetingId,
  customPrompt,
  onPromptChange,
  onCopyTranscript,
  onOpenMeetingFolder,
  isRecording,
  onTranscriptUpdate
}: TranscriptPanelProps) {
  const [isSpeakerSheetOpen, setIsSpeakerSheetOpen] = useState(false);
  const [isTagSheetOpen, setIsTagSheetOpen] = useState(false);
  const [isFolderSheetOpen, setIsFolderSheetOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (meetingId) {
      loadMeetingTags();
      loadMeetingFolder();
    }
  }, [meetingId]);

  const loadMeetingTags = async () => {
    if (!meetingId) return;
    try {
      const tags = await invoke<TagType[]>('get_meeting_tags', { meetingId });
      setSelectedTagIds(tags.map(t => t.id));
    } catch (error) {
      console.error('Failed to load meeting tags:', error);
    }
  };

  const loadMeetingFolder = async () => {
    if (!meetingId) return;
    try {
      const meeting = await invoke<any>('api_get_meeting', { meetingId });
      setSelectedFolderId(meeting.folder_id || null);
    } catch (error) {
      console.error('Failed to load meeting folder:', error);
    }
  };

  return (
    <div className="hidden md:flex md:w-1/4 lg:w-1/3 min-w-0 border-r border-gray-200 bg-white flex-col relative shrink-0">
      {/* Title area */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <TranscriptButtonGroup
            transcriptCount={transcripts?.length || 0}
            onCopyTranscript={onCopyTranscript}
            onOpenMeetingFolder={onOpenMeetingFolder}
          />
          {meetingId && !isRecording && (
            <div className="flex gap-2">
              <Sheet open={isSpeakerSheetOpen} onOpenChange={setIsSpeakerSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden lg:inline">Speakers</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                  <SheetHeader>
                    <SheetTitle>Manage Speakers & Companies</SheetTitle>
                    <SheetDescription>
                      Create and manage speakers, assign them to companies, and assign speakers to transcript segments.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    {meetingId && (
                      <SpeakerManager meetingId={meetingId} />
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              
              <Sheet open={isTagSheetOpen} onOpenChange={setIsTagSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Tag className="h-4 w-4" />
                    <span className="hidden lg:inline">Tags</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                  <SheetHeader>
                    <SheetTitle>Manage Tags</SheetTitle>
                    <SheetDescription>
                      Create tags and assign them to this meeting for better organization.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    {meetingId && (
                      <TagManager
                        meetingId={meetingId}
                        selectedTagIds={selectedTagIds}
                        onTagsChange={setSelectedTagIds}
                      />
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              <Sheet open={isFolderSheetOpen} onOpenChange={setIsFolderSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Folder className="h-4 w-4" />
                    <span className="hidden lg:inline">Folder</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                  <SheetHeader>
                    <SheetTitle>Manage Folders</SheetTitle>
                    <SheetDescription>
                      Organize meetings into folders for better structure and navigation.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    {meetingId && (
                      <FolderManager
                        meetingId={meetingId}
                        selectedFolderId={selectedFolderId}
                        onFolderChange={(folderId) => {
                          setSelectedFolderId(folderId);
                          loadMeetingFolder();
                        }}
                      />
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-y-auto pb-4">
        <TranscriptView 
          transcripts={transcripts} 
          meetingId={meetingId}
          onTranscriptUpdate={onTranscriptUpdate}
        />
      </div>

      {/* Custom prompt input at bottom of transcript section */}
      {!isRecording && transcripts.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            AI Context (Optional)
          </label>
          <textarea
            placeholder="Add context for AI summary. For example: people involved, meeting overview, objective, key topics..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm min-h-[80px] resize-y placeholder:text-gray-400"
            value={customPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1.5">
            This context helps the AI generate more accurate summaries
          </p>
        </div>
      )}
    </div>
  );
}
