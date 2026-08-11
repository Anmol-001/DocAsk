"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Calendar } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';

export interface Document {
  _id: string;
  fileName: string;
  status: 'UPLOADED' | 'EXTRACTING' | 'CHUNKING' | 'EMBEDDING' | 'READY' | 'PROCESSING_FAILED';
  createdAt: string;
}

interface DocumentListProps {
  onSelectDocument: (doc: Document) => void;
  onUploadNew: () => void;
}

export function DocumentList({ onSelectDocument, onUploadNew }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchDocuments = async () => {
      try {
        const data = await apiClient.get<Document[]>('/documents');
        setDocuments(data);
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast({
          title: 'Error loading documents',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [isAuthenticated, toast]);

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your documents...</p>
      </div>
    );
  }

  return (
    <Card id="your-documents" className="w-full max-w-4xl shadow-xl scroll-mt-20">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-headline text-3xl">Your Documents</CardTitle>
          <CardDescription>Select a document to ask questions or upload a new one.</CardDescription>
        </div>
        <Button onClick={onUploadNew}>Upload New PDF</Button>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center p-8 border-2 border-dashed rounded-lg">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No documents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload a PDF to get started.</p>
            <Button variant="outline" onClick={onUploadNew}>Upload PDF</Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map(doc => (
              <Card key={doc._id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelectDocument(doc)}>
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <FileText className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                      <h4 className="font-semibold truncate" title={doc.fileName}>{doc.fileName}</h4>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mt-auto flex justify-between items-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      doc.status === 'READY' ? 'bg-green-100 text-green-800' :
                      doc.status === 'PROCESSING_FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {doc.status}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                      onClick={(e) => {
                        e.stopPropagation(); // prevent clicking the card
                        if (confirm(`Are you sure you want to delete ${doc.fileName}? This will remove all associated conversations and data.`)) {
                          apiClient.delete(`/documents/${doc._id}`).then(() => {
                            setDocuments(prev => prev.filter(d => d._id !== doc._id));
                            toast({ title: 'Document deleted' });
                          }).catch((err: any) => {
                            console.error(err);
                            toast({ title: 'Failed to delete document', variant: 'destructive' });
                          });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
