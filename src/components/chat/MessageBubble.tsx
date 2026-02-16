import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import type { Message } from '../../hooks/useChatState';
import { useAuth } from '../../context/AuthContext';

interface MessageBubbleProps {
    message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const { user } = useAuth();
    const isMe = message.sender_id === user?.id;

    return (
        <div className={cn("flex w-full mb-4", isMe ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[70%] px-4 py-2 rounded-2xl relative shadow-sm",
                    isMe
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-white text-gray-800 rounded-bl-none border border-gray-100"
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
