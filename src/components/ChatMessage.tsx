"use client";

import React from 'react';
import { Bot, User, AlertTriangle, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  text: string;
  isAnswerable?: boolean;
  reason?: string;
  isLoading?: boolean;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';

  const AvatarIcon = isUser ? User : (isSystem ? AlertTriangle : Bot);
  const avatarBg = isUser ? 'bg-accent' : (isSystem ? 'bg-destructive' : 'bg-primary');
  const avatarFg = isUser ? 'text-accent-foreground' : (isSystem ? 'text-destructive-foreground' : 'text-primary-foreground');

  return (
    <div className={cn("flex items-start space-x-3 py-3", isUser ? "justify-end" : "")}>
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className={cn(avatarBg, avatarFg)}>
            <AvatarIcon size={18} />
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("max-w-[75%]", isUser ? "order-1 items-end" : "order-2 items-start")}>
        <Card
          className={cn(
            "rounded-xl shadow-md",
            isUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
            isSystem && "bg-destructive/10 border-destructive/30 text-destructive-foreground"
          )}
        >
          <CardContent className="p-3 text-sm">
            {message.isLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            ) : (
              <>
                {message.type === 'ai' && message.isAnswerable === false && (
                  <div className="mb-2 p-2 border-l-4 border-destructive/50 bg-destructive/10 rounded">
                    <p className="font-semibold text-sm text-destructive-foreground">Could not answer:</p>
                    <p className="text-xs text-destructive-foreground/80">{message.reason}</p>
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                  <ReactMarkdown
                    components={{
                      p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                </div>
              </>
            )}
          </CardContent>
        </Card>
         <p className={cn("text-xs text-muted-foreground mt-1", isUser ? "text-right" : "text-left")}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className={cn(avatarBg, avatarFg)}>
            <AvatarIcon size={18} />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
