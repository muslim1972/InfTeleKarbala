import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import type { Message } from '../../hooks/useChatState';
import { useAuth } from '../../context/AuthContext';
import useLongPress from '../../hooks/useLongPress';

interface MessageBubbleProps {
    message: Message;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    onToggleSelection?: (id: string) => void;
}

export function MessageBubble({ message, isSelected, isSelectionMode, onToggleSelection }: MessageBubbleProps) {
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
                isMe ? "justify-end" : "justify-start",
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
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
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
