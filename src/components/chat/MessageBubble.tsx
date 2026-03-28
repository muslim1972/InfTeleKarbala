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
import { Copy, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConversationDetails } from '../../hooks/useConversationDetails';

interface MessageBubbleProps {
    message: Message;
    isGroup?: boolean;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    selectedCount?: number;
    onToggleSelection?: (id: string) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
    onImageLoad?: () => void;
}

const REACTION_EMOJIS = ['❤️', '👍', '🌹', '😂', '😢'];

export const MessageBubble = React.memo(({ message, isGroup, isSelected, isSelectionMode, selectedCount = 0, onToggleSelection, onToggleReaction, onImageLoad }: MessageBubbleProps) => {
    const { user } = useAuth();
    const { settings } = useChatSettings();
    const { details } = useConversationDetails(message.conversation_id);
    const [showReactions, setShowReactions] = React.useState(false);
    const [showReactionDetails, setShowReactionDetails] = React.useState(false);
    const [popoverPosition, setPopoverPosition] = React.useState<'top' | 'bottom'>('top');
    const bubbleRef = React.useRef<HTMLDivElement>(null);
    
    const isMe = message.sender_id === user?.id;
    const isVoice = !!message.audio_url;
    const isImage = !!message.image_url;
    const isFile = !!message.file_url || (message.file_name && message.is_sending);
    const isText = !isVoice && !isImage && !isFile;

    // Close reactions if message is deselected or multiple are selected
    React.useEffect(() => {
        if (!isSelected || selectedCount > 1) {
            setShowReactions(false);
        }
    }, [isSelected, selectedCount]);

    React.useEffect(() => {
        const handleClickOutside = () => setShowReactionDetails(false);
        if (showReactionDetails) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showReactionDetails]);

    const onLongPress = () => {
        if (!isSelectionMode) {
            if (bubbleRef.current) {
                const rect = bubbleRef.current.getBoundingClientRect();
                // If message is too close to top (e.g. under SelectionHeader), render popover at bottom
                setPopoverPosition(rect.top < 120 ? 'bottom' : 'top');
            }
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
            ref={bubbleRef}
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

                {/* Reaction Picker & Actions Popover */}
                {showReactions && (
                    <div 
                        className={cn(
                            "absolute z-[50] flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-2 rounded-full shadow-2xl border border-gray-100 animate-in fade-in duration-200",
                            popoverPosition === 'top' ? "-top-16 zoom-in slide-in-from-bottom-2" : "top-full mt-2 slide-in-from-top-2",
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
                                    onToggleSelection?.(message.id);
                                }}
                                className="hover:scale-150 active:scale-95 transition-transform px-1.5 text-xl"
                            >
                                {emoji}
                            </button>
                        ))}
                        
                        {isText && (
                            <>
                                <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(message.text);
                                        toast.success('تم نسخ النص');
                                        setShowReactions(false);
                                        onToggleSelection?.(message.id);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors group"
                                    title="نسخ النص"
                                >
                                    <Copy size={16} className="group-hover:scale-110 transition-transform" />
                                </button>
                            </>
                        )}

                        <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowReactions(false);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            title="إغلاق التفاعلات"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Reactions Display Badge */}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowReactionDetails(true);
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

                {/* Reaction Details Popup */}
                {showReactionDetails && message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div 
                        className={cn(
                            "absolute top-full mt-2 z-[60] min-w-[150px] bg-white rounded-xl shadow-xl border border-gray-100 p-2 animate-in fade-in slide-in-from-top-2 duration-200",
                            isMe ? "right-0" : "left-0"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-xs font-bold text-gray-500 mb-2 px-1 border-b pb-1">المتفاعلون</div>
                        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar">
                            {Object.entries(message.reactions).map(([userId, emoji]) => {
                                const profile = details?.member_profiles?.find(p => p.id === userId);
                                const isCurrentUser = userId === user?.id;
                                const displayName = isCurrentUser ? 'أنت' : profile?.full_name || 'مستخدم';
                                return (
                                    <div key={userId} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded-lg group">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg leading-none">{emoji}</span>
                                            <span className="text-sm font-medium text-gray-700 truncate max-w-[100px]">{displayName}</span>
                                        </div>
                                        {isCurrentUser && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleReaction?.(message.id, emoji);
                                                    setShowReactionDetails(false);
                                                }}
                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all focus:opacity-100"
                                                title="إزالة تفاعلي"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
