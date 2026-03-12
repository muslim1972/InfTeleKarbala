import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../../hooks/useChatState';

interface MessageListProps {
    messages: Message[];
    loading: boolean;
    isGroup?: boolean;
    selectedMessages?: string[];
    onToggleSelection?: (id: string) => void;
}

export function MessageList({ messages, loading, isGroup, selectedMessages = [], onToggleSelection }: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (loading && messages.length === 0) {
        return (
            <div
                className="flex-1 flex flex-col items-center justify-center p-4 text-center relative"
                style={{
                    backgroundImage: 'url(/icon-512.png)',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: '420px',
                }}
            >
                <div className="absolute inset-0 bg-gray-50/90 pointer-events-none" />
                <div className="relative z-[1] flex flex-col items-center">
                <span className="text-gray-400 text-sm">جاري تحميل الرسائل...</span>
                </div>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div
                className="flex-1 flex flex-col items-center justify-center p-4 text-center relative"
                style={{
                    backgroundImage: 'url(/icon-512.png)',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: '420px',
                }}
            >
                <div className="absolute inset-0 bg-gray-50/90 pointer-events-none" />
                <div className="relative z-[1] flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">👋</span>
                </div>
                <p className="text-gray-500 font-medium">لا توجد رسائل بعد</p>
                <p className="text-gray-400 text-sm">ابدأ المحادثة بإرسال رسالة ترحيب</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex-1 overflow-y-auto p-4 space-y-2 relative"
            style={{
                backgroundImage: 'url(/icon-512.png)',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: '420px',
                backgroundAttachment: 'local',
            }}
        >
            {/* Watermark overlay to control opacity */}
            <div className="absolute inset-0 bg-gray-50/90 pointer-events-none" />
            <div className="relative z-[1]">
            {messages.map((msg) => (
                <MessageBubble
                    key={msg.id}
                    message={msg}
                    isGroup={isGroup}
                    isSelected={selectedMessages.includes(msg.id)}
                    isSelectionMode={selectedMessages.length > 0}
                    onToggleSelection={onToggleSelection}
                />
            ))}
            <div ref={bottomRef} />
            </div>
        </div>
    );
}
