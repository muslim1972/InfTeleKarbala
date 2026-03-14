import { useRef, useEffect, useState } from 'react';
import { Send, Mic, X, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useChatSettings } from '../../hooks/useChatSettings';

interface MessageInputProps {
    onSend: (e?: React.FormEvent) => void;
    onSendVoice?: (blob: Blob) => void;
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}

export function MessageInput({ onSend, onSendVoice, value, onChange, disabled }: MessageInputProps) {
    const { settings } = useChatSettings();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isSendingVoice, setIsSendingVoice] = useState(false);

    const {
        isRecording,
        formattedDuration,
        waveformData,
        error,
        startRecording,
        stopRecording,
        cancelRecording,
    } = useVoiceRecorder();

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

            // Logic: If current line is empty (or whitespace), send the message.
            // If current line has content, allow default behavior (new line).
            if (currentLine.trim() === '') {
                e.preventDefault();
                if (value.trim()) {
                    onSend();
                }
            }
        }
    };

    const handleMicClick = async () => {
        if (isRecording) return;
        await startRecording();
    };

    const handleSendVoice = async () => {
        if (!isRecording || !onSendVoice) return;
        setIsSendingVoice(true);
        try {
            const blob = await stopRecording();
            if (blob && blob.size > 0) {
                await onSendVoice(blob);
            }
        } finally {
            setIsSendingVoice(false);
        }
    };

    const handleCancel = () => {
        cancelRecording();
    };

    // Show error toast
    useEffect(() => {
        if (error) {
            alert(error);
        }
    }, [error]);

    // ─── Recording Mode ───
    if (isRecording) {
        return (
            <div className="p-3 bg-white border-t">
                <div className="flex items-center gap-2 bg-gradient-to-l from-red-50 to-rose-50 rounded-2xl px-4 py-2.5 border border-red-100 animate-in slide-in-from-bottom-2 duration-300">

                    {/* Cancel Button */}
                    <button
                        onClick={handleCancel}
                        className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-all active:scale-90 shrink-0 shadow-sm"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>

                    {/* Live Waveform */}
                    <div className="flex-1 flex items-center gap-[2px] h-8 px-2 overflow-hidden">
                        {waveformData.length > 0
                            ? waveformData.map((v, i) => {
                                // amplify the normalized value so quiet sounds register visibly
                                const height = Math.max(3, v * 100); // adjust multiplier for sensitivity
                                return (
                                    <div
                                        key={i}
                                        className="w-[3px] rounded-full bg-red-400 transition-all duration-100 ease-out"
                                        style={{ height: `${height}px` }}
                                    />
                                );
                            })
                            : Array.from({ length: 32 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="w-[3px] h-1 rounded-full bg-red-200 animate-pulse"
                                    style={{ animationDelay: `${i * 50}ms` }}
                                />
                            ))
                        }
                    </div>

                    {/* Recording Timer */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-mono font-bold text-red-600 tabular-nums min-w-[36px]">
                            {formattedDuration}
                        </span>
                    </div>

                    {/* Send Voice Button */}
                    <button
                        onClick={handleSendVoice}
                        disabled={isSendingVoice}
                        className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-all active:scale-90 shrink-0 shadow-lg shadow-emerald-200 disabled:opacity-50"
                    >
                        {isSendingVoice
                            ? <Square className="w-4 h-4 animate-pulse" />
                            : <Send className="w-5 h-5" />
                        }
                    </button>
                </div>
            </div>
        );
    }

    // ─── Normal Text Mode ───
    return (
        <div className="p-3 bg-white border-t flex items-end gap-2">
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
                    readOnly={disabled}
                    autoFocus
                />
            </div>

            {/* Show Mic when text is empty, Send when text exists */}
            {value.trim() ? (
                <button
                    onClick={() => onSend()}
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
                    onClick={handleMicClick}
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
}
