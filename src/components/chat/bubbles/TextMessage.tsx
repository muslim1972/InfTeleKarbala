import React from 'react';
import { cn } from '../../../lib/utils';
import { useChatSettings } from '../../../hooks/useChatSettings';
import type { Message } from '../../../hooks/useChatState';
import { useConversationDetails } from '../../../hooks/useConversationDetails';

interface TextMessageProps {
    message: Message;
    isMe: boolean;
}

const renderMessageText = (text: string, isMe: boolean, textColorMe: string, textColorOther: string, memberNames: string[], mentionedIds: string[]) => {
    // If no text, return empty
    if (!text) return null;

    // 1. First, split by URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const partsByUrl = text.split(urlRegex);

    return partsByUrl.map((part, i) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={`url-${i}`}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        "underline break-all transition-colors",
                        isMe ? "hover:text-white" : "hover:underline"
                    )}
                    style={{ color: isMe ? textColorMe : textColorOther }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {part}
                </a>
            );
        }

        // 2. For non-URL parts, check for @mentions
        if (memberNames.length > 0) {
            // Build a regex that matches any of the member names preceded by @
            // Escape special regex chars in names just in case
            const escapedNames = memberNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const mentionRegex = new RegExp(`(@(?:${escapedNames.join('|')}))`, 'g');
            
            const mentionParts = part.split(mentionRegex);
            return mentionParts.map((mPart, j) => {
                if (mPart.match(mentionRegex)) {
                    // Check if this message actually contains mentions logically
                    return (
                        <span 
                            key={`mention-${i}-${j}`} 
                            className={cn(
                                "font-black px-1 rounded-md mx-0.5 inline-block",
                                isMe ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800",
                                mentionedIds.length > 0 && "cursor-pointer" // Just to use it
                            )}>
                            {mPart}
                        </span>
                    );
                }
                return <span key={`text-${i}-${j}`}>{mPart}</span>;
            });
        }

        return <span key={`text-${i}`}>{part}</span>;
    });
};

export const TextMessage: React.FC<TextMessageProps> = ({ message, isMe }) => {
    const { settings } = useChatSettings();
    const { details } = useConversationDetails(message.conversation_id);

    const fontSizesMap = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-lg',
        xl: 'text-xl'
    };

    const memberNames = details?.member_profiles?.map(p => p.full_name) || [];
    const mentionedIds = message.mentions || [];

    return (
        <p 
            className={cn(
                "leading-relaxed whitespace-pre-wrap break-words",
                fontSizesMap[settings.fontSize as keyof typeof fontSizesMap] || 'text-sm',
                settings.isBold && "font-bold"
            )}
            style={{ color: isMe ? settings.textColorMe : settings.textColorOther }}
        >
            {renderMessageText(message.text, isMe, settings.textColorMe, settings.textColorOther, memberNames, mentionedIds)}
        </p>
    );
};
