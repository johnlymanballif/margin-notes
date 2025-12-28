'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import Sidebar from '@/components/Sidebar'
import { SidebarProvider } from '@/components/Sidebar/SidebarProvider'
import MainContent from '@/components/MainContent'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import { Toaster } from 'sonner'
import "sonner/dist/styles.css"
import { useState, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { LegacyDatabaseImport } from '@/components/DatabaseImport/LegacyDatabaseImport'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RecordingStateProvider, useRecordingState } from '@/contexts/RecordingStateContext'
import { OllamaDownloadProvider } from '@/contexts/OllamaDownloadContext'
import { FloatingRecordingIndicator } from '@/components/FloatingRecordingIndicator'
import { SpeakerProvider } from '@/contexts/SpeakerContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

// Wrapper component to access recording state
function FloatingIndicatorWrapper() {
  const recordingState = useRecordingState();
  return (
    <FloatingRecordingIndicator
      isRecording={recordingState.isRecording}
      isPaused={recordingState.isPaused}
    />
  );
}

// export { metadata } from './metadata'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [showImportDialog, setShowImportDialog] = useState(false)

  useEffect(() => {
    // Check first launch state immediately on mount (reliable)
    invoke<boolean>('check_first_launch')
      .then((isFirstLaunch) => {
        console.log('First launch check result:', isFirstLaunch)
        if (isFirstLaunch) {
          console.log('First launch detected - showing import dialog')
          setShowImportDialog(true)
        }
      })
      .catch((error) => {
        console.error('Failed to check first launch:', error)
      })

    // Also listen for events (fallback for hot reload and edge cases)
    const unlistenFirstLaunch = listen('first-launch-detected', () => {
      console.log('First launch event received - showing import dialog')
      setShowImportDialog(true)
    })

    // Listen for database initialized event
    const unlistenDbInit = listen('database-initialized', () => {
      console.log('Database initialized - hiding import dialog')
      setShowImportDialog(false)
    })

    return () => {
      unlistenFirstLaunch.then((fn) => fn())
      unlistenDbInit.then((fn) => fn())
    }
  }, [])

  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <AnalyticsProvider>
            <RecordingStateProvider>
              <SpeakerProvider>
                <OllamaDownloadProvider>
                  <ErrorBoundary>
                    <SidebarProvider>
                      <TooltipProvider>
                        {/* <div className="titlebar h-8 w-full fixed top-0 left-0 bg-transparent" /> */}
                        <div className="flex">
                          <ErrorBoundary>
                            <Sidebar />
                          </ErrorBoundary>
                          <ErrorBoundary>
                            <MainContent>{children}</MainContent>
                          </ErrorBoundary>
                        </div>
                        <FloatingIndicatorWrapper />
                      </TooltipProvider>
                    </SidebarProvider>
                  </ErrorBoundary>
                </OllamaDownloadProvider>
              </SpeakerProvider>
            </RecordingStateProvider>
          </AnalyticsProvider>
        </ErrorBoundary>
        <Toaster position="bottom-center" richColors closeButton />
        <LegacyDatabaseImport
          isOpen={showImportDialog}
          onComplete={() => setShowImportDialog(false)}
        />
      </body>
    </html>
  )
}
