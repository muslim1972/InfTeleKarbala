import React from 'react';
import { cn } from '../../../lib/utils';
import { useChatSettings } from '../../../hooks/useChatSettings';
import type { Message } from '../../../hooks/useChatState';

interface TextMessageProps {
    message: Message;
    isMe: boolean;
}

const renderMessageText = (text: string, isMe: boolean, textColorMe: string, textColorOther: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={i}
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
        return <span key={i}>{part}</span>;
    });
};

export const TextMessage: React.FC<TextMessageProps> = ({ message, isMe }) => {
    const { settings } = useChatSettings();

    const fontSizesMap = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-lg',
        xl: 'text-2xl'
    };

    return (
        <p 
            className={cn(
                "leading-relaxed whitespace-pre-wrap break-words",
                fontSizesMap[settings.fontSize],
                settings.isBold && "font-bold"
            )}
            style={{ color: isMe ? settings.textColorMe : settings.textColorOther }}
        >
            {renderMessageText(message.text, isMe, settings.textColorMe, settings.textColorOther)}
        </p>
    );
};
