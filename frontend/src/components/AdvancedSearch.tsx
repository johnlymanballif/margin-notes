'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Calendar, User, Building2, Filter, SortAsc, SortDesc } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { useSpeakers } from '@/contexts/SpeakerContext';
import { invoke } from '@tauri-apps/api/core';

export interface SearchFilters {
  query: string;
  dateFrom: string;
  dateTo: string;
  speakerId: string | null;
  companyId: string | null;
  sortBy: 'date' | 'title' | 'duration';
  sortOrder: 'asc' | 'desc';
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
  isSearching?: boolean;
  resultCount?: number;
}

export function AdvancedSearch({ onSearch, onClear, isSearching = false, resultCount }: AdvancedSearchProps) {
  const { speakers, companies } = useSpeakers();
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    dateFrom: '',
    dateTo: '',
    speakerId: null,
    companyId: null,
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Check if any filters are active
  useEffect(() => {
    const active = 
      filters.query.trim() !== '' ||
      filters.dateFrom !== '' ||
      filters.dateTo !== '' ||
      filters.speakerId !== null ||
      filters.companyId !== null;
    setHasActiveFilters(active);
  }, [filters]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.query.trim() !== '' || hasActiveFilters) {
        onSearch(filters);
      } else {
        onClear();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [filters, hasActiveFilters, onSearch, onClear]);

  const handleQueryChange = (value: string) => {
    setFilters(prev => ({ ...prev, query: value }));
  };

  const handleDateFromChange = (value: string) => {
    setFilters(prev => ({ ...prev, dateFrom: value }));
  };

  const handleDateToChange = (value: string) => {
    setFilters(prev => ({ ...prev, dateTo: value }));
  };

  const handleSpeakerChange = (value: string) => {
    setFilters(prev => ({ ...prev, speakerId: value === 'all' ? null : value }));
  };

  const handleCompanyChange = (value: string) => {
    setFilters(prev => ({ ...prev, companyId: value === 'all' ? null : value }));
  };

  const handleSortByChange = (value: 'date' | 'title' | 'duration') => {
    setFilters(prev => ({ ...prev, sortBy: value }));
  };

  const handleSortOrderChange = (value: 'asc' | 'desc') => {
    setFilters(prev => ({ ...prev, sortOrder: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      query: '',
      dateFrom: '',
      dateTo: '',
      speakerId: null,
      companyId: null,
      sortBy: 'date',
      sortOrder: 'desc',
    });
    onClear();
  };

  const selectedSpeaker = speakers.find(s => s.id === filters.speakerId);
  const selectedCompany = companies.find(c => c.id === filters.companyId);

  return (
    <div className="space-y-2">
      {/* Main Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search transcripts, meetings..."
          value={filters.query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="pl-9 pr-20"
        />
        {filters.query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => handleQueryChange('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter Button */}
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="sm"
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                  {[
                    filters.dateFrom && 'Date',
                    filters.dateTo && 'Date',
                    filters.speakerId && 'Speaker',
                    filters.companyId && 'Company',
                  ].filter(Boolean).length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="dateFrom" className="text-xs text-gray-500">
                      From
                    </Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => handleDateFromChange(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateTo" className="text-xs text-gray-500">
                      To
                    </Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => handleDateToChange(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Speaker</Label>
                <Select
                  value={filters.speakerId || 'all'}
                  onValueChange={handleSpeakerChange}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All speakers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All speakers</SelectItem>
                    {speakers.map((speaker) => (
                      <SelectItem key={speaker.id} value={speaker.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          <span>{speaker.name}</span>
                          {speaker.company_name && (
                            <span className="text-xs text-gray-500">
                              ({speaker.company_name})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Company</Label>
                <Select
                  value={filters.companyId || 'all'}
                  onValueChange={handleCompanyChange}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All companies</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          <span>{company.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="flex-1"
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort Options */}
        <Select
          value={filters.sortBy}
          onValueChange={(value: 'date' | 'title' | 'duration') => handleSortByChange(value)}
        >
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="duration">Duration</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSortOrderChange(filters.sortOrder === 'asc' ? 'desc' : 'asc')}
          className="h-8 w-8 p-0"
        >
          {filters.sortOrder === 'asc' ? (
            <SortAsc className="h-4 w-4" />
          ) : (
            <SortDesc className="h-4 w-4" />
          )}
        </Button>

        {/* Active Filter Tags */}
        {(selectedSpeaker || selectedCompany || filters.dateFrom || filters.dateTo) && (
          <div className="flex items-center gap-1 flex-wrap">
            {selectedSpeaker && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                <User className="h-3 w-3" />
                {selectedSpeaker.name}
                <button
                  onClick={() => handleSpeakerChange('all')}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedCompany && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                <Building2 className="h-3 w-3" />
                {selectedCompany.name}
                <button
                  onClick={() => handleCompanyChange('all')}
                  className="ml-1 hover:text-green-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(filters.dateFrom || filters.dateTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                <Calendar className="h-3 w-3" />
                {filters.dateFrom || '...'} - {filters.dateTo || '...'}
                <button
                  onClick={() => {
                    handleDateFromChange('');
                    handleDateToChange('');
                  }}
                  className="ml-1 hover:text-purple-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Search Status */}
      {isSearching && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <div className="h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Searching...
        </div>
      )}
      {!isSearching && resultCount !== undefined && filters.query.trim() !== '' && (
        <div className="text-xs text-gray-500">
          Found {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </div>
      )}
    </div>
  );
}


