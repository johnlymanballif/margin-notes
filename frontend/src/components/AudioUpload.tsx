'use client';

import { useState, useRef } from 'react';
import { Upload, FileAudio, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface AudioUploadProps {
  onUploadComplete?: (meetingId: string) => void;
  disabled?: boolean;
}

export function AudioUpload({ onUploadComplete, disabled = false }: AudioUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac'];
    const validExtensions = ['.mp3', '.wav', '.m4a', '.aac'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      toast.error('Invalid file type', {
        description: 'Please upload an MP3, WAV, M4A, or AAC audio file.',
      });
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      toast.error('File too large', {
        description: 'Please upload a file smaller than 500MB.',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      toast.info('Uploading audio file...', {
        description: 'This may take a moment for large files.',
      });

      // Call backend to process the audio file
      const result = await invoke<{ meeting_id: string; message: string }>('process_uploaded_audio', {
        fileName: file.name,
        audioData: Array.from(uint8Array),
      });

      setUploadProgress(100);
      toast.success('Audio uploaded successfully!', {
        description: 'Transcription is being processed.',
      });

      if (onUploadComplete && result.meeting_id) {
        onUploadComplete(result.meeting_id);
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
      toast.error('Failed to upload audio', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : disabled || isUploading
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
          : 'border-gray-300 bg-white hover:border-gray-400 cursor-pointer'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/aac,.mp3,.wav,.m4a,.aac"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div className="flex flex-col items-center justify-center text-center space-y-4">
        {isUploading ? (
          <>
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Processing audio...</p>
              {uploadProgress > 0 && (
                <div className="w-64 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <FileAudio className={`h-8 w-8 ${isDragging ? 'text-blue-600' : 'text-gray-600'}`} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">
                {isDragging ? 'Drop audio file here' : 'Upload audio recording'}
              </p>
              <p className="text-xs text-gray-500">
                Drag and drop an MP3, WAV, M4A, or AAC file, or click to browse
              </p>
              <p className="text-xs text-gray-400">Maximum file size: 500MB</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select File
            </Button>
          </>
        )}
      </div>
    </div>
  );
}


