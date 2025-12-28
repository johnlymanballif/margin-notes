'use client';

import { useState, useEffect } from 'react';
import { Save, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface MasterPromptSettingsProps {
  onSave?: (prompt: string) => void;
}

export function MasterPromptSettings({ onSave }: MasterPromptSettingsProps) {
  const [masterPrompt, setMasterPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadMasterPrompt();
  }, []);

  const loadMasterPrompt = async () => {
    try {
      setIsLoading(true);
      const prompt = await invoke<string>('get_master_prompt');
      setMasterPrompt(prompt || '');
    } catch (error) {
      console.error('Failed to load master prompt:', error);
      // If it doesn't exist, use default
      setMasterPrompt('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await invoke('save_master_prompt', { prompt: masterPrompt });
      toast.success('Master prompt saved', {
        description: 'This prompt will be used for all AI summary generations.',
      });
      onSave?.(masterPrompt);
    } catch (error) {
      console.error('Failed to save master prompt:', error);
      toast.error('Failed to save master prompt', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <Label htmlFor="master-prompt" className="text-sm font-semibold">
            Master Prompt for AI Summaries
          </Label>
        </div>
        <p className="text-xs text-gray-500">
          This prompt will be prepended to all AI summary generation requests. Use it to set default instructions,
          context, or formatting preferences for meeting notes.
        </p>
      </div>
      <Textarea
        id="master-prompt"
        value={masterPrompt}
        onChange={(e) => setMasterPrompt(e.target.value)}
        placeholder="Example: Generate a professional meeting summary with clear action items and decisions. Include participant names when mentioned..."
        className="min-h-[120px] text-sm font-mono"
      />
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="gap-2"
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Master Prompt
            </>
          )}
        </Button>
      </div>
    </div>
  );
}


