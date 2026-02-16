import { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MessageInputProps {
    onSend: (e?: React.FormEvent) => void;
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}

export function MessageInput({ onSend, value, onChange, disabled }: MessageInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="p-3 bg-white border-t flex items-end gap-2">
            <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 flex items-center">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالة..."
                    className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 text-sm"
                    rows={1}
                    disabled={disabled}
                />
            </div>
            <button
                onClick={() => onSend()}
                disabled={!value.trim() || disabled}
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    value.trim() && !disabled
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
            >
                <Send className="w-5 h-5" />
            </button>
        </div>
    );
}
