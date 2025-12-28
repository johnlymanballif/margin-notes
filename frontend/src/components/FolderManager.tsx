'use client';

import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, Plus, Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Folder as FolderType } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface FolderManagerProps {
  meetingId?: string;
  selectedFolderId?: string | null;
  onFolderChange?: (folderId: string | null) => void;
}

// Predefined color palette for folders
const FOLDER_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Gray', value: '#6B7280' },
];

export function FolderManager({ meetingId, selectedFolderId, onFolderChange }: FolderManagerProps) {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0].value);
  const [parentId, setParentId] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setIsLoading(true);
      const allFolders = await invoke<FolderType[]>('get_all_folders');
      setFolders(allFolders || []);
    } catch (error) {
      console.error('Failed to load folders:', error);
      toast.error('Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    try {
      await invoke<FolderType>('create_folder', {
        name: folderName.trim(),
        color: folderColor,
        parentId: parentId || null,
      });
      await loadFolders();
      resetForm();
      setIsDialogOpen(false);
      toast.success('Folder created successfully');
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !folderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    try {
      await invoke<FolderType>('update_folder', {
        id: editingFolder.id,
        name: folderName.trim(),
        color: folderColor,
        parentId: parentId || null,
      });
      await loadFolders();
      resetForm();
      setIsDialogOpen(false);
      toast.success('Folder updated successfully');
    } catch (error) {
      console.error('Failed to update folder:', error);
      toast.error('Failed to update folder');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this folder? Meetings in this folder will be moved to "No Folder".')) {
      return;
    }

    try {
      await invoke('delete_folder', { id });
      await loadFolders();
      toast.success('Folder deleted successfully');
    } catch (error) {
      console.error('Failed to delete folder:', error);
      toast.error('Failed to delete folder');
    }
  };

  const handleFolderSelect = async (folderId: string | null) => {
    if (!meetingId || !onFolderChange) return;

    try {
      await invoke('update_meeting_folder', {
        meetingId,
        folderId,
      });
      onFolderChange(folderId);
      toast.success('Folder updated');
    } catch (error) {
      console.error('Failed to update folder:', error);
      toast.error('Failed to update folder');
    }
  };

  const resetForm = () => {
    setFolderName('');
    setFolderColor(FOLDER_COLORS[0].value);
    setParentId('');
    setEditingFolder(null);
  };

  const openEditDialog = (folder: FolderType) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderColor(folder.color || FOLDER_COLORS[0].value);
    setParentId(folder.parent_id || '');
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getRootFolders = () => folders.filter(f => !f.parent_id);
  const getChildFolders = (parentId: string) => folders.filter(f => f.parent_id === parentId);

  const renderFolderTree = (folder: FolderType, depth: number = 0): React.ReactNode => {
    const children = getChildFolders(folder.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 ${
            selectedFolderId === folder.id ? 'bg-blue-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleFolder(folder.id)}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: folder.color || FOLDER_COLORS[0].value }}
          />
          <span className="text-sm flex-1">{folder.name}</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => openEditDialog(folder)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleDeleteFolder(folder.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderFolderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading folders...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Folder Selection (for meetings) */}
      {meetingId && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Folder</Label>
          <Select
            value={selectedFolderId || 'none'}
            onValueChange={(value) => handleFolderSelect(value === 'none' ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Folder</SelectItem>
              {getRootFolders().map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: folder.color || FOLDER_COLORS[0].value }}
                    />
                    <span>{folder.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Folder Management */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Manage Folders</Label>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Create Folder
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingFolder ? 'Edit Folder' : 'Create New Folder'}</DialogTitle>
                <DialogDescription>
                  {editingFolder ? 'Edit the folder details.' : 'Create a new folder to organize your meetings.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="folderName" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="folderName"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., Project Alpha, Team Meetings"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Color</Label>
                  <div className="col-span-3 flex flex-wrap gap-2">
                    {FOLDER_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFolderColor(color.value)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          folderColor === color.value
                            ? 'border-gray-800 scale-110'
                            : 'border-gray-300 hover:border-gray-500'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
                {!editingFolder && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="parentFolder" className="text-right">
                      Parent
                    </Label>
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger id="parentFolder" className="col-span-3">
                        <SelectValue placeholder="None (root folder)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (root folder)</SelectItem>
                        {getRootFolders().map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}>
                  {editingFolder ? 'Save Changes' : 'Create Folder'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="h-[300px] w-full rounded-md border p-4">
          {folders.length === 0 ? (
            <p className="text-sm text-gray-500">No folders created yet.</p>
          ) : (
            <div className="space-y-1">
              {getRootFolders().map(folder => renderFolderTree(folder))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}


