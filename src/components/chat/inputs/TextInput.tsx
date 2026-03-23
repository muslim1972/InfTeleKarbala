import React, { useRef, useEffect } from 'react';
import { Send, Mic, ImagePlus } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useChatSettings } from '../../../hooks/useChatSettings';

interface TextInputProps {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    onMicClick: () => void;
    onImageClick: () => void;
    disabled?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
    value,
    onChange,
    onSend,
    onMicClick,
    onImageClick,
    disabled = false,
}) => {
    const { settings } = useChatSettings();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

    return (
        <div className="p-3 bg-white border-t flex items-end gap-2">
            {/* Image picker button */}
            <button
                onClick={onImageClick}
                disabled={disabled}
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0",
                    disabled
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-violet-50 text-violet-500 hover:bg-violet-100 border border-violet-200"
                )}
                title="إرسال صورة"
            >
                <ImagePlus className="w-5 h-5" />
            </button>

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
            )}
        </div>
    );
};
