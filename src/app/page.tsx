"use client";

import React, { useState, useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { PdfUploadArea } from '@/components/PdfUploadArea';
import { ChatView } from '@/components/ChatView';
import { DocumentList, Document } from '@/components/DocumentList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, HelpCircle, Search, Upload } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

import { AuthDialog } from '@/components/auth/AuthDialog';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [currentDoc, setCurrentDoc] = useState<Document | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogTab, setAuthDialogTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleDocumentSelect = (doc: Document) => {
    setCurrentDoc(doc);
    setShowUpload(false);
  };

  const handleUploadNew = () => {
    setCurrentDoc(null);
    setShowUpload(true);
  };

  const handleGoToDocuments = () => {
    setCurrentDoc(null);
    setShowUpload(false);
    setTimeout(() => {
      document.getElementById('your-documents')?.scrollIntoView({ behavior: 'smooth' });
    }, 10);
  };

  if (!isClient) {
    return null; 
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-secondary/30">
      <AppHeader 
        pdfName={currentDoc?.fileName} 
        onUploadNew={handleUploadNew}
        onGoToDocuments={handleGoToDocuments}
        isPdfLoaded={!!currentDoc}
      />
      <main className="flex-grow container mx-auto p-4 flex flex-col items-center justify-center">
        {!isAuthenticated ? (
          <div className="w-full max-w-4xl text-center">
            <h1 className="font-headline text-5xl md:text-6xl font-bold mb-6 text-accent">
              Welcome to DocAsk
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Unlock insights from your PDF documents. Upload a file and start asking questions in seconds.
            </p>
            <div className="grid md:grid-cols-2 gap-8 items-stretch">
              <Card className="shadow-xl h-full flex flex-col">
                <CardHeader>
                   <CardTitle className="font-headline text-3xl">Get Started</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-left flex-grow flex flex-col justify-center">
                  <p className="text-muted-foreground text-center">Please sign in or register to upload and query your documents.</p>
                  
                  <div className="space-y-4 pt-4">
                    <div className="text-center space-y-3">
                      <div>
                        <h4 className="font-medium">Welcome back</h4>
                        <p className="text-sm text-muted-foreground">Sign in to continue to your account</p>
                      </div>
                      <Button className="w-full" onClick={() => { setAuthDialogTab('login'); setAuthDialogOpen(true); }}>Sign In</Button>
                    </div>
                    
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">or</span>
                      </div>
                    </div>

                    <div className="text-center space-y-3">
                      <div>
                        <h4 className="font-medium">New to DocAsk?</h4>
                      </div>
                      <Button variant="outline" className="w-full" onClick={() => { setAuthDialogTab('register'); setAuthDialogOpen(true); }}>Create an Account</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="text-left shadow-xl h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="font-headline text-3xl">How it Works</CardTitle>
                  <CardDescription>Simple steps to get answers from your documents.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex-grow flex flex-col justify-center">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 bg-primary/10 text-primary rounded-full p-2">
                      <Upload size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold">1. Upload PDF</h3>
                      <p className="text-sm text-muted-foreground">Drag & drop or select your PDF file.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 bg-primary/10 text-primary rounded-full p-2">
                      <HelpCircle size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold">2. Ask Questions</h3>
                      <p className="text-sm text-muted-foreground">Type your questions related to the document content.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 bg-primary/10 text-primary rounded-full p-2">
                     <Search size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold">3. Get Answers</h3>
                      <p className="text-sm text-muted-foreground">Our AI analyzes the document and provides answers.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} defaultTab={authDialogTab} />
          </div>
        ) : currentDoc ? (
          <ChatView document={currentDoc} />
        ) : showUpload ? (
          <div className="w-full max-w-4xl text-center flex flex-col items-center">
            <h1 className="font-headline text-4xl font-bold mb-6 text-accent">Upload a New Document</h1>
            <PdfUploadArea onPdfReady={handleDocumentSelect} onCancel={() => setShowUpload(false)} />
          </div>
        ) : (
          <DocumentList onSelectDocument={handleDocumentSelect} onUploadNew={handleUploadNew} />
        )}
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} DocAsk. All rights reserved.
      </footer>
    </div>
  );
}
