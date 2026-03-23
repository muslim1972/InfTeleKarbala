import React from 'react';
import { Send, X, Square } from 'lucide-react';

interface VoiceRecorderInputProps {
    formattedDuration: string;
    waveformData: number[];
    isSendingVoice: boolean;
    onCancel: () => void;
    onSendVoice: () => void;
}

export const VoiceRecorderInput: React.FC<VoiceRecorderInputProps> = ({
    formattedDuration,
    waveformData,
    isSendingVoice,
    onCancel,
    onSendVoice,
}) => {
    return (
        <div className="p-3 bg-white border-t">
            <div className="flex items-center gap-2 bg-gradient-to-l from-red-50 to-rose-50 rounded-2xl px-4 py-2.5 border border-red-100 animate-in slide-in-from-bottom-2 duration-300">
                {/* Cancel Button */}
                <button
                    onClick={onCancel}
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
                    onClick={onSendVoice}
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
};
