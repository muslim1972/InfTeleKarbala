
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X } from 'lucide-react';
import { useAudio } from "../../context/AudioContext";
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';

interface FloatingAudioPlayerProps {
    className?: string;
    hide?: boolean;
}

export const FloatingAudioPlayer: React.FC<FloatingAudioPlayerProps> = ({ className, hide }) => {
    const { 
        isPlaying, 
        currentTrack, 
        progress, 
        togglePlay,
        stopAudio,
        isQuranPlayerVisible
    } = useAudio();
    const { theme } = useTheme();

    if (!currentTrack || hide || isQuranPlayerVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className={cn(
                    "fixed bottom-[6px] left-4 z-[100] group",
                    className
                )}
            >
                <div className={cn(
                    "relative overflow-hidden rounded-lg border backdrop-blur-md shadow-lg transition-all duration-300",
                    theme === 'light' 
                        ? "bg-white/90 border-gray-200" 
                        : "bg-slate-900/90 border-blue-500/30"
                )}>
                    {/* Progress Line */}
                    <motion.div 
                        className="absolute bottom-0 left-0 h-[2px] bg-brand-green"
                        style={{ width: `${progress}%` }}
                    />

                    <div className="px-3 py-1.5 flex items-center gap-3 min-w-[180px] max-w-[240px]">
                        {/* Play/Pause */}
                        <button 
                            onClick={togglePlay}
                            className="w-7 h-7 rounded-full bg-brand-green text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md"
                        >
                            {isPlaying ? <Pause size={12} fill="white" /> : <Play size={12} fill="white" className="ml-0.5" />}
                        </button>

                        {/* Track Info */}
                        <div className="flex-1 min-w-0">
                            <h4 className={cn(
                                "text-[10px] font-black truncate leading-tight",
                                theme === 'light' ? "text-gray-900" : "text-blue-100"
                            )}>
                                {currentTrack.title}
                            </h4>
                        </div>

                        {/* Close */}
                        <button 
                            onClick={stopAudio}
                            className={cn(
                                "p-1 rounded-full transition-colors",
                                theme === 'light' ? "hover:bg-gray-100 text-gray-400" : "hover:bg-white/10 text-white/40"
                            )}
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
