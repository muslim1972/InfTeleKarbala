import React, { useRef, useEffect, useState } from 'react';
import { Send, Mic, Paperclip, Image as ImageIcon, FileText, BellRing } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useChatSettings } from '../../../hooks/useChatSettings';
import type { ParticipantProfile } from '../../../hooks/useConversationDetails';

interface TextInputProps {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    onMicClick: () => void;
    onImageSelect: (file: File) => void;
    onFileSelect: (file: File) => void;
    onSendBuzz: () => void;
    disabled?: boolean;
    members?: ParticipantProfile[];
}

export const TextInput: React.FC<TextInputProps> = ({
    value,
    onChange,
    onSend,
    onMicClick,
    onImageSelect,
    onFileSelect,
    onSendBuzz,
    disabled = false,
    members = [],
}) => {
    const { settings } = useChatSettings();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
    
    // Mentions State
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    const filteredMembers = members?.filter(m => m.full_name?.toLowerCase().includes(mentionSearch.toLowerCase())) || [];

    const insertMention = (memberName: string) => {
        if (!textareaRef.current) return;
        const cursorPosition = textareaRef.current.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const textAfterCursor = value.substring(cursorPosition);
        
        // Find the start of the mention before cursor
        const match = textBeforeCursor.match(/@([a-zA-Z\u0600-\u06FF\s_]*)$/);
        if (match) {
            const beforeMention = textBeforeCursor.substring(0, match.index);
            const newValue = beforeMention + '@' + memberName + ' ' + textAfterCursor;
            onChange(newValue);
            setShowMentions(false);
            
            // Focus back and set cursor
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    const newPos = beforeMention.length + memberName.length + 2; // +2 for @ and space
                    textareaRef.current.setSelectionRange(newPos, newPos);
                }
            }, 0);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        onChange(val);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = val.substring(0, cursorPosition);
        const match = textBeforeCursor.match(/@([a-zA-Z\u0600-\u06FF\s_]*)$/);

        if (match) {
            setShowMentions(true);
            setMentionSearch(match[1]);
            setMentionIndex(0);
        } else {
            setShowMentions(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Try to unlock audio on first interaction
        const silentAudio = new Audio();
        silentAudio.play().catch(() => {});

        // Mentions Navigation
        if (showMentions && filteredMembers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredMembers.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                insertMention(filteredMembers[mentionIndex].full_name);
                return;
            }
            if (e.key === 'Escape') {
                setShowMentions(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
            const cursorPosition = e.currentTarget.selectionStart;
            const text = e.currentTarget.value;

            // Find current line bounds
            const lastNewLine = text.lastIndexOf('\n', cursorPosition - 1);
            const nextNewLine = text.indexOf('\n', cursorPosition);

            const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
            const lineEnd = nextNewLine === -1 ? text.length : nextNewLine;

            const currentLine = text.substring(lineStart, lineEnd);

            if (currentLine.trim() === '') {
                e.preventDefault();
                if (value.trim()) {
                    onSend();
                }
            }
        }
    };

    // Click outside handler for dropdowns
    useEffect(() => {
        const handleClickOutside = (e: globalThis.MouseEvent) => {
            const target = e.target as Element;
            if (isAttachmentOpen && !target.closest('.attachment-dropdown-container')) {
                setIsAttachmentOpen(false);
            }
            if (showMentions && !target.closest('.mentions-dropdown-container')) {
                setShowMentions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isAttachmentOpen, showMentions]);

    const handleInputClick = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (type === 'image') onImageSelect(file);
        else onFileSelect(file);
        
        // Reset input
        e.target.value = '';
        setIsAttachmentOpen(false);
    };

    return (
        <div className="p-3 bg-white border-t flex items-end gap-2 relative">
            {/* Mentions Dropdown */}
            {showMentions && filteredMembers.length > 0 && (
                <div className="absolute bottom-full mb-2 right-4 w-64 mentions-dropdown-container bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden z-[60] animate-in slide-in-from-bottom-2 fade-in duration-200">
                    <div className="p-2 border-b bg-gray-50 text-xs font-bold text-gray-500">
                        إشارة إلى...
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-none flex flex-col p-1">
                        {filteredMembers.map((member, idx) => (
                            <button
                                key={member.id}
                                onClick={() => insertMention(member.full_name)}
                                className={cn(
                                    "px-3 py-2 flex items-center gap-3 w-full text-right rounded-xl transition-colors",
                                    idx === mentionIndex ? "bg-emerald-50 text-emerald-700" : "hover:bg-gray-50 text-gray-700"
                                )}
                            >
                                {member.avatar ? (
                                    <img src={member.avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                                        {member.full_name.substring(0, 2)}
                                    </div>
                                )}
                                <span className={cn("text-sm font-medium", idx === mentionIndex && "font-bold")}>
                                    {member.full_name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Hidden inputs */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleInputClick(e, 'image')}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="hidden"
                onChange={(e) => handleInputClick(e, 'file')}
            />

            {/* Attachment Dropdown Button */}
            <div className="relative attachment-dropdown-container">
                <button
                    onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
                    disabled={disabled}
                    className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0",
                        isAttachmentOpen && "bg-violet-100 ring-2 ring-violet-300",
                        disabled
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-violet-50 text-violet-500 hover:bg-violet-100 border border-violet-200"
                    )}
                    title="مرفقات"
                >
                    <Paperclip className="w-5 h-5" />
                </button>

                {/* Dropdown Menu */}
                {isAttachmentOpen && (
                    <div className="absolute bottom-12 right-0 bg-white border border-gray-100 shadow-xl rounded-2xl p-2 flex flex-col gap-1 w-48 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <button
                            onClick={() => imageInputRef.current?.click()}
                            className="flex items-center gap-3 px-3 py-2.5 w-full text-right rounded-xl hover:bg-gray-50 text-gray-700 transition-colors"
                        >
                            <div className="bg-blue-50 text-blue-500 p-2 rounded-full">
                                <ImageIcon className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-sm">إدراج صورة</span>
                        </button>
                        
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-3 px-3 py-2.5 w-full text-right rounded-xl hover:bg-gray-50 text-gray-700 transition-colors"
                        >
                            <div className="bg-rose-50 text-rose-500 p-2 rounded-full">
                                <FileText className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-sm">إدراج ملف</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 flex items-center">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالة..."
                    className={cn(
                        "w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 text-gray-900 placeholder:text-gray-500 transition-all",
                        settings.fontSize === 'sm' && "text-[12px]",
                        settings.fontSize === 'md' && "text-[14px]",
                        settings.fontSize === 'lg' && "text-[18px]",
                        settings.fontSize === 'xl' && "text-[24px]",
                        settings.isBold && "font-extrabold",
                        disabled && "opacity-60"
                    )}
                    rows={1}
                    autoFocus
                />
            </div>

            {/* Show Mic when text is empty, Send when text exists */}
            {value.trim() ? (
                <button
                    onClick={() => {
                        onSend();
                        textareaRef.current?.focus();
                    }}
                    disabled={!value.trim() || disabled}
                    className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        value.trim() && !disabled
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    )}
                >
                    <Send className="w-5 h-5" />
                </button>
            ) : (
                <>
                    <button
                        onClick={onMicClick}
                        disabled={disabled}
                        className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90",
                            disabled
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200"
                        )}
                        title="تسجيل رسالة صوتية"
                    >
                        <Mic className="w-5 h-5" />
                    </button>

                    <button
                        onClick={onSendBuzz}
                        disabled={disabled}
                        className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 group",
                            disabled
                                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                : "bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200 shadow-sm"
                        )}
                        title="تنبيه عاجل (Buzz)"
                    >
                        <BellRing className="w-5 h-5 group-hover:animate-bounce" />
                    </button>
                </>
            )}
        </div>
    );
};
