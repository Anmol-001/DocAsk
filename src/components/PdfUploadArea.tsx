"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, Loader2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { Document } from '@/components/DocumentList';

interface PdfUploadAreaProps {
  onPdfReady: (doc: Document) => void;
  onCancel?: () => void;
}

export function PdfUploadArea({ onPdfReady, onCancel }: PdfUploadAreaProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [pollingDocId, setPollingDocId] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string>('');

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (pollingDocId) {
      intervalId = setInterval(async () => {
        try {
          const doc = await apiClient.get<Document>(`/documents/${pollingDocId}`);
          setPollingStatus(doc.status);
          
          if (doc.status === 'READY') {
            clearInterval(intervalId);
            setPollingDocId(null);
            toast({ title: 'Processing Complete', description: 'Document is ready for QA.' });
            onPdfReady(doc);
          } else if (doc.status === 'PROCESSING_FAILED') {
            clearInterval(intervalId);
            setPollingDocId(null);
            toast({ title: 'Processing Failed', description: 'Could not process the document.', variant: 'destructive' });
            setIsUploading(false);
          }
        } catch (error) {
          console.error("Polling error", error);
        }
      }, 2000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollingDocId, onPdfReady, toast]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF file.",
          variant: "destructive",
        });
        return;
      }
      
      setIsUploading(true);
      setPollingStatus('UPLOADING');

      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post<{ documentId: string, status: string }>('/documents/upload', formData);
        
        toast({
          title: "Upload Successful",
          description: "Document is being ingested...",
        });
        
        setPollingDocId(response.documentId);
        setPollingStatus(response.status);
      } catch (error: any) {
        console.error('Upload Error:', error);
        toast({
          title: "Upload Error",
          description: error.message || "Failed to upload document.",
          variant: "destructive",
        });
        setIsUploading(false);
      }
    },
    [toast]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        handleFile(acceptedFiles[0]);
      }
    },
    [handleFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: isUploading || !!pollingDocId
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleFile(event.target.files[0]);
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-xl relative">
      {onCancel && !isUploading && !pollingDocId && (
        <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={onCancel}>
          <XCircle className="h-5 w-5 text-muted-foreground" />
        </Button>
      )}
      <CardHeader className="text-center">
        <CardTitle className="font-headline text-3xl">Upload Your PDF</CardTitle>
        <CardDescription>Drag & drop your PDF file here or click to select.</CardDescription>
      </CardHeader>
      <CardContent>
        {isUploading || pollingDocId ? (
          <div className="flex flex-col items-center justify-center space-y-4 p-8">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Status: <span className="font-semibold">{pollingStatus}</span></p>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70'}`}
          >
            <input {...getInputProps()} id="file-upload" className="hidden" onChange={handleFileChange} />
            <UploadCloud className={`h-16 w-16 mb-4 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className={`mb-2 text-center ${isDragActive ? 'text-primary' : 'text-foreground'}`}>
              {isDragActive ? "Drop the PDF here..." : "Drag 'n' drop a PDF file here, or click to select"}
            </p>
            <p className="text-xs text-muted-foreground">PDF files only, max 10MB</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => document.getElementById('file-upload')?.click()}>
              Select PDF
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
