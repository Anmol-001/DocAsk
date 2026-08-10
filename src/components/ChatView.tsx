"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, Loader2, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { Document } from '@/components/DocumentList';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  citations?: Citation[];
}

interface Citation {
  text: string;
  pageStart: number;
  pageEnd: number;
}

interface ChatViewProps {
  document: Document;
}

export function ChatView({ document }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const convs = await apiClient.get<any[]>(`/qa/conversations/${document._id}`);
        if (convs && convs.length > 0) {
          const mostRecentConv = convs[0];
          setConversationId(mostRecentConv._id);
          
          const msgs = await apiClient.get<any[]>(`/qa/conversations/${mostRecentConv._id}/messages`);
          
          const formattedMsgs: ChatMessage[] = msgs.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            text: m.content,
            citations: m.citations
          }));
          
          setMessages(formattedMsgs);
        } else {
          // Initial welcome message if no history
          setMessages([
            {
              role: 'model',
              text: `Hi! I've read "${document.fileName}". What would you like to know about it?`
            }
          ]);
        }
      } catch (err) {
        console.error("Failed to load conversation history", err);
        setMessages([
          {
            role: 'model',
            text: `Hi! I've read "${document.fileName}". What would you like to know about it?`
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHistory();
  }, [document._id, document.fileName]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userQuery = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userQuery }]);
    setIsLoading(true);

    try {
      const response = await apiClient.post<{ 
        answer: string, 
        citations?: Citation[],
        conversationId: string 
      }>('/qa/ask', {
        documentId: document._id,
        question: userQuery,
        conversationId
      });

      if (response.conversationId) {
        setConversationId(response.conversationId);
      }

      setMessages(prev => [...prev, { 
        role: 'model', 
        text: response.answer,
        citations: response.citations
      }]);

    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: `Error: ${error.message || 'Could not get an answer. Please try again.'}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl h-[calc(100vh-140px)] flex flex-col shadow-xl border-border/50">
      <div className="p-4 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
        <h2 className="font-semibold text-lg truncate" title={document.fileName}>{document.fileName}</h2>
      </div>
      
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary text-primary-foreground ml-3' : 'bg-secondary text-secondary-foreground mr-3'}`}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className="flex flex-col gap-2">
                  <div className={`p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-card text-card-foreground border border-border shadow-sm rounded-tl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                  
                  {/* Citations UI */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      <TooltipProvider>
                        {msg.citations.map((cite, i) => (
                          <Tooltip key={i} delayDuration={300}>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-full border border-border cursor-help hover:bg-secondary/80 transition-colors">
                                <Info size={12} />
                                {cite.pageStart === cite.pageEnd ? `Page ${cite.pageStart}` : `Pages ${cite.pageStart}-${cite.pageEnd}`}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start" className="max-w-xs max-h-60 overflow-y-auto">
                              <p className="text-xs text-muted-foreground mb-1">Snippet from {cite.pageStart === cite.pageEnd ? `Page ${cite.pageStart}` : `Pages ${cite.pageStart}-${cite.pageEnd}`}:</p>
                              <p className="text-sm italic">&ldquo;{cite.text}&rdquo;</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
              <div className="flex max-w-[80%] flex-row">
                <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground mr-3">
                  <Bot size={20} />
                </div>
                <div className="p-4 rounded-2xl bg-card text-card-foreground border border-border shadow-sm rounded-tl-sm flex items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-border/50 bg-background">
        <form onSubmit={handleSend} className="flex space-x-2">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about this document..." 
            className="flex-grow shadow-sm"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="shadow-sm">
            <Send size={18} className="mr-2" />
            Send
          </Button>
        </form>
      </div>
    </Card>
  );
}
