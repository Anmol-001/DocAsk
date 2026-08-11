import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileUp, LogOut, FileText } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthDialog } from '@/components/auth/AuthDialog';

interface AppHeaderProps {
  pdfName?: string | null;
  onUploadNew?: () => void;
  onGoToDocuments?: () => void;
  isPdfLoaded?: boolean;
}

export function AppHeader({ pdfName, onUploadNew, onGoToDocuments, isPdfLoaded }: AppHeaderProps) {
  const { isAuthenticated, logout } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <a href="/" className="mr-6 flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="h-6 w-6 text-accent">
              <rect width="256" height="256" fill="none"></rect>
              <path d="M208,80H168V48a16,16,0,0,0-16-16H64A16,16,0,0,0,48,48V176a16,16,0,0,0,16,16H88v32a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,176V128a8,8,0,0,1,8-8h48v56Zm0-64h40V56a8,8,0,0,1,8-8h40v40H168a16,16,0,0,0-16,16v40H104a16,16,0,0,0-16,16v24H64V48h88v16a8,8,0,0,1-8,8H96V48a8,8,0,0,1-8-8,8,8,0,0,1,0-16h0Z" fill="currentColor"></path>
            </svg>
            <span className="font-headline text-xl font-bold text-accent">DocAsk</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {isAuthenticated ? (
            <>
              <Button variant="ghost" asChild onClick={onGoToDocuments}>
                <a href="#your-documents">
                  <FileText className="mr-2 h-4 w-4" />
                  Your Documents
                </a>
              </Button>
              {isPdfLoaded && onUploadNew && (
                <>
                  {pdfName && <span className="text-sm text-muted-foreground hidden md:block truncate max-w-xs" title={pdfName}>{pdfName}</span>}
                  <Button variant="outline" onClick={onUploadNew}>
                    <FileUp className="mr-2 h-4 w-4" />
                    Upload New
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={() => setAuthDialogOpen(true)}>
              Sign In
            </Button>
          )}
        </div>
      </div>
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </header>
  );
}
