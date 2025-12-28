'use client';

import { useState, useEffect } from 'react';
import { Speaker, Company } from '@/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Plus, User, Building2, X, Edit2, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useSpeakers } from '@/contexts/SpeakerContext';
import { toast } from 'sonner';

interface SpeakerManagerProps {
  meetingId: string;
  onSpeakerSelect?: (speakerId: string | null) => void;
  selectedSpeakerId?: string | null;
}

export function SpeakerManager({ meetingId, onSpeakerSelect, selectedSpeakerId }: SpeakerManagerProps) {
  const { speakers, companies, isLoading, refreshSpeakers, refreshCompanies } = useSpeakers();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  
  // Form states
  const [speakerName, setSpeakerName] = useState('');
  const [speakerEmail, setSpeakerEmail] = useState('');
  const [speakerCompanyId, setSpeakerCompanyId] = useState<string>('');
  const [companyName, setCompanyName] = useState('');

  const handleCreateSpeaker = async () => {
    try {
      const speaker = await invoke<Speaker>('create_speaker', {
        name: speakerName,
        email: speakerEmail || null,
        companyId: speakerCompanyId || null,
      });
      await refreshSpeakers();
      resetSpeakerForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to create speaker:', error);
      toast.error('Failed to create speaker', {
        description: error instanceof Error ? error.message : 'Please try again.',
        action: {
          label: 'Retry',
          onClick: handleCreateSpeaker,
        },
      });
    }
  };

  const handleUpdateSpeaker = async () => {
    if (!editingSpeaker) return;
    try {
      await invoke<Speaker>('update_speaker', {
        id: editingSpeaker.id,
        name: speakerName,
        email: speakerEmail || null,
        companyId: speakerCompanyId || null,
      });
      await refreshSpeakers();
      resetSpeakerForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to update speaker:', error);
      toast.error('Failed to update speaker', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleDeleteSpeaker = async (id: string) => {
    if (!confirm('Are you sure you want to delete this speaker?')) return;
    try {
      await invoke('delete_speaker', { id });
      await refreshSpeakers();
      if (selectedSpeakerId === id && onSpeakerSelect) {
        onSpeakerSelect(null);
      }
    } catch (error) {
      console.error('Failed to delete speaker:', error);
      toast.error('Failed to delete speaker', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleCreateCompany = async () => {
    try {
      await invoke<Company>('create_company', {
        name: companyName,
      });
      await refreshCompanies();
      setCompanyName('');
      setIsCompanyDialogOpen(false);
    } catch (error) {
      console.error('Failed to create company:', error);
      toast.error('Failed to create company', {
        description: error instanceof Error ? error.message : 'Please try again.',
        action: {
          label: 'Retry',
          onClick: handleCreateCompany,
        },
      });
    }
  };

  const handleUpdateCompany = async () => {
    if (!editingCompany) return;
    try {
      await invoke<Company>('update_company', {
        id: editingCompany.id,
        name: companyName,
      });
      await refreshCompanies();
      await refreshSpeakers(); // Refresh speakers to update company references
      setCompanyName('');
      setIsCompanyDialogOpen(false);
      setEditingCompany(null);
    } catch (error) {
      console.error('Failed to update company:', error);
      toast.error('Failed to update company', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Are you sure you want to delete this company? Speakers assigned to it will be unassigned.')) return;
    try {
      await invoke('delete_company', { id });
      await refreshCompanies();
      await refreshSpeakers(); // Refresh speakers to update company references
    } catch (error) {
      console.error('Failed to delete company:', error);
      toast.error('Failed to delete company', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const resetSpeakerForm = () => {
    setSpeakerName('');
    setSpeakerEmail('');
    setSpeakerCompanyId('');
    setEditingSpeaker(null);
  };

  const openEditSpeaker = (speaker: Speaker) => {
    setEditingSpeaker(speaker);
    setSpeakerName(speaker.name);
    setSpeakerEmail(speaker.email || '');
    setSpeakerCompanyId(speaker.company_id || '');
    setIsDialogOpen(true);
  };

  const openEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyName(company.name);
    setIsCompanyDialogOpen(true);
  };

  const openCreateSpeaker = () => {
    resetSpeakerForm();
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading speakers...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Speaker Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Assign Speaker</Label>
        <div className="flex gap-2">
          <Select
            value={selectedSpeakerId || undefined}
            onValueChange={(value) => onSpeakerSelect?.(value === 'none' ? null : value)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select or create speaker" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Speaker</SelectItem>
              {speakers.map((speaker) => (
                <SelectItem key={speaker.id} value={speaker.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{speaker.name}</span>
                    {speaker.company_name && (
                      <span className="text-xs text-gray-500">({speaker.company_name})</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" onClick={openCreateSpeaker}>
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSpeaker ? 'Edit Speaker' : 'Create New Speaker'}</DialogTitle>
                <DialogDescription>
                  Add a speaker to assign to transcript segments
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="speaker-name">Name *</Label>
                  <Input
                    id="speaker-name"
                    value={speakerName}
                    onChange={(e) => setSpeakerName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="speaker-email">Email</Label>
                  <Input
                    id="speaker-email"
                    type="email"
                    value={speakerEmail}
                    onChange={(e) => setSpeakerEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="speaker-company">Company</Label>
                    <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setEditingCompany(null)}>
                          <Plus className="h-3 w-3 mr-1" />
                          New Company
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{editingCompany ? 'Edit Company' : 'Create New Company'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="company-name">Company Name *</Label>
                            <Input
                              id="company-name"
                              value={companyName}
                              onChange={(e) => setCompanyName(e.target.value)}
                              placeholder="Acme Corp"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsCompanyDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={editingCompany ? handleUpdateCompany : handleCreateCompany}
                            disabled={!companyName.trim()}
                          >
                            {editingCompany ? 'Update' : 'Create'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Select value={speakerCompanyId} onValueChange={setSpeakerCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Company</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={editingSpeaker ? handleUpdateSpeaker : handleCreateSpeaker}
                  disabled={!speakerName.trim()}
                >
                  {editingSpeaker ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Speakers List */}
      {speakers.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Manage Speakers</Label>
          <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
            {speakers.map((speaker) => (
              <div
                key={speaker.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{speaker.name}</div>
                    {speaker.company_name && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {speaker.company_name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEditSpeaker(speaker)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteSpeaker(speaker.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Companies List */}
      {companies.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Manage Companies</Label>
          <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{company.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEditCompany(company)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteCompany(company.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

