import React from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import type { Message } from '../../hooks/useChatState';
import { useAuth } from '../../context/AuthContext';
import useLongPress from '../../hooks/useLongPress';
import { AudioPlayer } from './AudioPlayer';
import { useChatSettings } from '../../hooks/useChatSettings';
import { ImageMessage } from './bubbles/ImageMessage';
import { TextMessage } from './bubbles/TextMessage';
import { FileMessage } from './bubbles/FileMessage';

interface MessageBubbleProps {
    message: Message;
    isGroup?: boolean;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    onToggleSelection?: (id: string) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
    onImageLoad?: () => void;
}

const REACTION_EMOJIS = ['❤️', '👍', '🌹', '😂', '😢'];

export const MessageBubble = React.memo(({ message, isGroup, isSelected, isSelectionMode, onToggleSelection, onToggleReaction, onImageLoad }: MessageBubbleProps) => {
    const { user } = useAuth();
    const { settings } = useChatSettings();
    const [showReactions, setShowReactions] = React.useState(false);
    
    const isMe = message.sender_id === user?.id;
    const isVoice = !!message.audio_url;
    const isImage = !!message.image_url;
    const isFile = !!message.file_url || (message.file_name && message.is_sending);

    // Close reactions if message is deselected
    React.useEffect(() => {
        if (!isSelected) {
            setShowReactions(false);
        }
    }, [isSelected]);

    const onLongPress = () => {
        if (!isSelectionMode) {
            setShowReactions(true);
        }
        if (onToggleSelection) {
            onToggleSelection(message.id);
        }
    };

    const onClick = () => {
        if (isSelectionMode && onToggleSelection) {
            onToggleSelection(message.id);
        }
    };

    const longPressEvent = useLongPress(onLongPress, onClick, { delay: 800 });

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
                {/* Buzz Counter Badge */}
                {message.buzz_count && message.buzz_count > 1 && (
                    <div className={cn(
                        "absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-2xl border-2 border-white animate-bounce z-[100]",
                        !isMe && "right-auto -left-2"
                    )}>
                        {message.buzz_count}
                    </div>
                )}
                {/* Show sender name if it's a group chat and the message is NOT from me */}
                {isGroup && !isMe && message.sender?.full_name && (
                    <div 
                        className="text-[11px] font-bold mb-1" 
                        style={{ color: settings.bubbleColorMe }}
                    >
                        {message.sender.full_name}
                    </div>
                )}

                {/* Voice, Image, File, or Text */}
                {isVoice && message.audio_url ? (
                    <AudioPlayer src={message.audio_url} isMe={isMe} />
                ) : isImage && message.image_url ? (
                    <ImageMessage message={message} onImageLoad={onImageLoad} />
                ) : isFile ? (
                    <FileMessage message={message} isMe={isMe} />
                ) : (
                    <TextMessage message={message} isMe={isMe} />
                )}

                <div 
                    className={cn("text-[10px] mt-1 flex items-center gap-1.5 opacity-80")}
                    style={{ color: isMe ? settings.textColorMe : settings.textColorOther }}
                >
                    <span>
                        {format(new Date(message.created_at), 'p', { locale: ar })}
                    </span>
                    {isMe && (
                        <div className="flex items-center">
                            {message.is_sending ? (
                                <div 
                                    className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse ring-1 ring-amber-600/30 shadow-[0_0_5px_rgba(251,191,36,0.5)]" 
                                    title="جاري الإرسال"
                                />
                            ) : (message.read_by && message.read_by.filter(id => id !== user?.id).length > 0) ? (
                                <div 
                                    className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-emerald-700/30 shadow-[0_0_8px_rgba(16,185,129,0.6)]" 
                                    title="تمت القراءة"
                                />
                            ) : (
                                <div 
                                    className="w-2.5 h-2.5 rounded-full bg-white ring-1 ring-gray-300 shadow-sm" 
                                    title="تم التسليم"
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Reaction Picker Popover */}
                {showReactions && (
                    <div 
                        className={cn(
                            "absolute -top-16 z-[50] flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-2 rounded-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200",
                            isMe ? "right-0" : "left-0"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {REACTION_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleReaction?.(message.id, emoji);
                                    setShowReactions(false);
                                }}
                                className="hover:scale-150 active:scale-95 transition-transform px-1.5 text-xl"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                {/* Reactions Display */}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowReactions(true);
                        }}
                        className={cn(
                            "absolute -bottom-3 flex items-center gap-0.5 bg-white rounded-full px-2 py-0.5 shadow-md border border-gray-100 text-[12px] cursor-pointer hover:bg-gray-50 transition-all z-[5] hover:scale-105",
                            isMe ? "right-2" : "left-2"
                        )}
                    >
                        {Object.values(message.reactions).map((emoji, idx) => (
                            <span key={idx} className="leading-none">{emoji}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});
