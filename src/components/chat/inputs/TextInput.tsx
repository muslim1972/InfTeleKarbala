import React, { useRef, useEffect, useState } from 'react';
import { Send, Mic, Paperclip, Image as ImageIcon, FileText, BellRing } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useChatSettings } from '../../../hooks/useChatSettings';

interface TextInputProps {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    onMicClick: () => void;
    onImageSelect: (file: File) => void;
    onFileSelect: (file: File) => void;
    onSendBuzz: () => void;
    disabled?: boolean;
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
}) => {
    const { settings } = useChatSettings();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
    
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Try to unlock audio on first interaction
        const silentAudio = new Audio();
        silentAudio.play().catch(() => {});

        if (e.key === 'Enter' && !e.shiftKey) {
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

    // Click outside handler for dropdown
    useEffect(() => {
        const handleClickOutside = (e: globalThis.MouseEvent) => {
            if (isAttachmentOpen && !(e.target as Element).closest('.attachment-dropdown-container')) {
                setIsAttachmentOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isAttachmentOpen]);

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
        <div className="p-3 bg-white border-t flex items-end gap-2">
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
                    onChange={(e) => onChange(e.target.value)}
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
