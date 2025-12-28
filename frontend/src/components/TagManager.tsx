'use client';

import React, { useState, useEffect } from 'react';
import { Tag as TagIcon, Plus, Edit, Trash2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Tag } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface TagManagerProps {
  meetingId?: string;
  selectedTagIds?: string[];
  onTagsChange?: (tagIds: string[]) => void;
}

// Predefined color palette for tags
const TAG_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Gray', value: '#6B7280' },
];

export function TagManager({ meetingId, selectedTagIds = [], onTagsChange }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0].value);

  useEffect(() => {
    loadTags();
    if (meetingId) {
      loadMeetingTags();
    }
  }, [meetingId]);

  const loadTags = async () => {
    try {
      setIsLoading(true);
      const allTags = await invoke<Tag[]>('get_all_tags');
      setTags(allTags || []);
    } catch (error) {
      console.error('Failed to load tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeetingTags = async () => {
    if (!meetingId) return;
    try {
      const meetingTags = await invoke<Tag[]>('get_meeting_tags', { meetingId });
      if (onTagsChange) {
        onTagsChange(meetingTags.map(t => t.id));
      }
    } catch (error) {
      console.error('Failed to load meeting tags:', error);
    }
  };

  const handleCreateTag = async () => {
    if (!tagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      await invoke<Tag>('create_tag', {
        name: tagName.trim(),
        color: tagColor,
      });
      await loadTags();
      resetForm();
      setIsDialogOpen(false);
      toast.success('Tag created successfully');
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error('Failed to create tag');
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !tagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      await invoke<Tag>('update_tag', {
        id: editingTag.id,
        name: tagName.trim(),
        color: tagColor,
      });
      await loadTags();
      resetForm();
      setIsDialogOpen(false);
      toast.success('Tag updated successfully');
    } catch (error) {
      console.error('Failed to update tag:', error);
      toast.error('Failed to update tag');
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tag? It will be removed from all meetings.')) {
      return;
    }

    try {
      await invoke('delete_tag', { id });
      await loadTags();
      toast.success('Tag deleted successfully');
    } catch (error) {
      console.error('Failed to delete tag:', error);
      toast.error('Failed to delete tag');
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!meetingId || !onTagsChange) return;

    const isSelected = selectedTagIds.includes(tagId);
    try {
      if (isSelected) {
        await invoke('remove_tag_from_meeting', {
          meetingId,
          tagId,
        });
      } else {
        await invoke('add_tag_to_meeting', {
          meetingId,
          tagId,
        });
      }
      await loadMeetingTags();
    } catch (error) {
      console.error('Failed to toggle tag:', error);
      toast.error('Failed to update tag assignment');
    }
  };

  const resetForm = () => {
    setTagName('');
    setTagColor(TAG_COLORS[0].value);
    setEditingTag(null);
  };

  const openEditDialog = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color || TAG_COLORS[0].value);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading tags...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Tag Selection (for meetings) */}
      {meetingId && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tags</Label>
          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border border-gray-200 rounded-md">
            {tags.length === 0 ? (
              <span className="text-sm text-gray-400">No tags available. Create one below.</span>
            ) : (
              tags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleToggleTag(tag.id)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                    }`}
                    style={
                      isSelected && tag.color
                        ? {
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                            borderColor: tag.color,
                          }
                        : {}
                    }
                  >
                    <TagIcon className="h-3 w-3" />
                    <span>{tag.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tag Management */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Manage Tags</Label>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Create Tag
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingTag ? 'Edit Tag' : 'Create New Tag'}</DialogTitle>
                <DialogDescription>
                  {editingTag ? 'Edit the tag details.' : 'Create a new tag to organize your meetings.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tagName" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="tagName"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., Important, Follow-up"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Color</Label>
                  <div className="col-span-3 flex flex-wrap gap-2">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setTagColor(color.value)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          tagColor === color.value
                            ? 'border-gray-800 scale-110'
                            : 'border-gray-300 hover:border-gray-500'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editingTag ? handleUpdateTag : handleCreateTag}>
                  {editingTag ? 'Save Changes' : 'Create Tag'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="h-[200px] w-full rounded-md border p-4">
          {tags.length === 0 ? (
            <p className="text-sm text-gray-500">No tags created yet.</p>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color || TAG_COLORS[0].value }}
                    />
                    <span className="text-sm font-medium">{tag.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(tag)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDeleteTag(tag.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}


