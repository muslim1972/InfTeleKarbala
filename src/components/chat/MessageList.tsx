import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../../hooks/useChatState';

interface MessageListProps {
    messages: Message[];
    loading: boolean;
    isGroup?: boolean;
    selectedMessages?: string[];
    onToggleSelection?: (id: string) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
}

export function MessageList({ 
    messages, 
    loading, 
    isGroup, 
    selectedMessages = [], 
    onToggleSelection,
    onToggleReaction 
}: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        bottomRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Track scroll height changes (for images loading, etc)
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(() => {
            // If near bottom, snap to bottom
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 400;
            if (isNearBottom) {
                scrollToBottom('auto');
            }
        });

        observer.observe(container.firstChild as Element || container);
        return () => observer.disconnect();
    }, []);

    // Extra scroll when images load to account for height changes
    const handleImageLoad = () => {
        scrollToBottom('auto');
    };

    const renderBackground = () => (
        <>
            {/* Watermark Base */}
            <div 
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: 'url(/watermark-512.png)',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: 'min(80%, 420px)',
                }}
            />
            {/* Smooth Overlay for Watermark effect (low opacity) */}
            <div className="absolute inset-0 bg-gray-50/90 z-[1] pointer-events-none" />
        </>
    );

    if (loading && messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden bg-gray-50">
                {renderBackground()}
                <div className="relative z-[2] flex flex-col items-center">
                    <span className="text-gray-400 text-sm font-medium">جاري تحميل الرسائل...</span>
                </div>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden bg-gray-50">
                {renderBackground()}
                <div className="relative z-[2] flex flex-col items-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 shadow-sm border border-emerald-100">
                        <span className="text-2xl">👋</span>
                    </div>
                    <p className="text-gray-500 font-bold text-lg">لا توجد رسائل بعد</p>
                    <p className="text-gray-400 text-sm mt-1">ابدأ المحادثة بإرسال رسالة ترحيب</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 relative overflow-hidden bg-gray-50 flex flex-col">
            {renderBackground()}
            
            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 py-8 relative scroll-smooth z-[2] custom-scrollbar flex flex-col"
            >
                <div className="mt-auto space-y-2 w-full flex flex-col">
                    {messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isGroup={isGroup}
                            isSelected={selectedMessages.includes(msg.id)}
                            isSelectionMode={selectedMessages.length > 0}
                            onToggleSelection={onToggleSelection}
                            onToggleReaction={onToggleReaction}
                            onImageLoad={handleImageLoad}
                        />
                    ))}
                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    );
}
