import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import type { Message } from '../../hooks/useChatState';
import { useAuth } from '../../context/AuthContext';
import useLongPress from '../../hooks/useLongPress';
import { AudioPlayer } from './AudioPlayer';
import { useChatSettings } from '../../hooks/useChatSettings';

interface MessageBubbleProps {
    message: Message;
    isGroup?: boolean;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    onToggleSelection?: (id: string) => void;
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

export function MessageBubble({ message, isGroup, isSelected, isSelectionMode, onToggleSelection }: MessageBubbleProps) {
    const { user } = useAuth();
    const { settings } = useChatSettings();
    const isMe = message.sender_id === user?.id;
    const isVoice = !!message.audio_url;

    const onLongPress = () => {
        if (onToggleSelection) {
            onToggleSelection(message.id);
        }
    };

    const onClick = () => {
        if (isSelectionMode && onToggleSelection) {
            onToggleSelection(message.id);
        }
    };

    const longPressEvent = useLongPress(onLongPress, onClick, { delay: 500 });

    const fontSizesMap = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-lg',
        xl: 'text-2xl'
    };

    return (
        <div
            className={cn(
                "flex w-full mb-4 relative transition-colors duration-200",
                isMe ? "justify-start" : "justify-end",
                isSelected && "bg-emerald-50/50 -mx-4 px-4 py-1"
            )}
            {...longPressEvent}
        >
            <div
                className={cn(
                    "max-w-[70%] px-4 py-2 rounded-2xl relative shadow-sm transition-all duration-200",
                    isMe ? "rounded-br-none" : "rounded-bl-none border border-gray-100",
                    isSelected && "ring-2 ring-emerald-500 ring-offset-2"
                )}
                style={{ 
                    backgroundColor: isMe ? settings.bubbleColorMe : settings.bubbleColorOther,
                    color: isMe ? settings.textColorMe : settings.textColorOther
                }}
            >
                {/* Show sender name if it's a group chat and the message is NOT from me */}
                {isGroup && !isMe && message.sender?.full_name && (
                    <div 
                        className="text-[11px] font-bold mb-1" 
                        style={{ color: settings.bubbleColorMe }}
                    >
                        {message.sender.full_name}
                    </div>
                )}

                {/* Voice Message */}
                {isVoice && message.audio_url ? (
                    <AudioPlayer src={message.audio_url} isMe={isMe} />
                ) : (
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
                )}

                <div 
                    className={cn("text-[10px] mt-1 flex items-center gap-1 opacity-70")}
                    style={{ color: isMe ? settings.textColorMe : settings.textColorOther }}
                >
                    <span>
                        {format(new Date(message.created_at), 'p', { locale: ar })}
                    </span>
                    {isMe && (
                        <span>
                            {message.is_sending ? '🕒' : '✓'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
