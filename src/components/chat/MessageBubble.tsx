import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import type { Message } from '../../hooks/useChatState';
import { useAuth } from '../../context/AuthContext';
import useLongPress from '../../hooks/useLongPress';

interface MessageBubbleProps {
    message: Message;
    isGroup?: boolean;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    onToggleSelection?: (id: string) => void;
}

const renderMessageText = (text: string, isMe: boolean) => {
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
                        isMe ? "text-emerald-100 hover:text-white font-semibold" : "text-blue-600 hover:text-blue-800 font-semibold"
                    )}
                    // Prevents triggering selection on mobile longpress/clicks when clicking a link
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
    const isMe = message.sender_id === user?.id;

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

    return (
        <div
            className={cn(
                "flex w-full mb-4 relative transition-colors duration-200",
                isMe ? "justify-start" : "justify-end",
                isSelected && "bg-emerald-50/50 -mx-4 px-4 py-1" // Highlight container on select
            )}
            {...longPressEvent}
        >
            <div
                className={cn(
                    "max-w-[70%] px-4 py-2 rounded-2xl relative shadow-sm transition-all duration-200",
                    isMe
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-white text-gray-800 rounded-bl-none border border-gray-100",
                    isSelected && "ring-2 ring-emerald-500 ring-offset-2" // Ring effect
                )}
            >
                {/* Show sender name if it's a group chat and the message is NOT from me */}
                {isGroup && !isMe && message.sender?.full_name && (
                    <div className="text-[11px] font-bold text-emerald-600 mb-1">
                        {message.sender.full_name}
                    </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {renderMessageText(message.text, isMe)}
                </p>
                <div className={cn("text-[10px] mt-1 flex items-center gap-1", isMe ? "text-emerald-100/80" : "text-gray-400")}>
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
