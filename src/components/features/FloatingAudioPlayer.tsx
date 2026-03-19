
import React from 'react';
import { motion, AnimatePresence, useTransform, useMotionTemplate } from 'framer-motion';
import { Play, Pause, X, Music } from 'lucide-react';
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
        glowIntensity,
        togglePlay,
        stopAudio,
        isQuranPlayerVisible
    } = useAudio();
    const { theme } = useTheme();

    if (!currentTrack || !isPlaying || hide || isQuranPlayerVisible) return null;

    const glowOpacity = useTransform(glowIntensity, [0, 50], [0.1, 0.4]);
    const glowScaleY = useTransform(glowIntensity, [0, 50], [1, 2.5]);
    const color1 = useTransform(glowIntensity, [0, 45], ["#22c55e", "#4ade80"]);
    const color2 = useTransform(glowIntensity, [0, 45], ["#16a34a", "#22c55e"]);
    const dynamicGradient = useMotionTemplate`linear-gradient(90deg, ${color1} 0%, ${color2} 50%, ${color1} 100%)`;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className={cn(
                    "fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-80 z-[100] group",
                    className
                )}
            >
                <div className={cn(
                    "relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300",
                    theme === 'light' 
                        ? "bg-white/80 border-gray-200 shadow-gray-200/50" 
                        : "bg-black/60 border-white/10 shadow-black/50"
                )}>
                    {/* Progress Bar Background */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 dark:bg-white/5" />
                    {/* Progress Bar Fill */}
                    <motion.div 
                        className="absolute top-0 left-0 h-1 bg-brand-green shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                        style={{ width: `${progress}%` }}
                    />

                    <div className="p-3 flex items-center gap-3">
                        {/* Mini Visualizer / Icon */}
                        <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center">
                            <motion.div 
                                style={{ 
                                    opacity: glowOpacity,
                                    scaleY: glowScaleY,
                                    background: dynamicGradient
                                }}
                                className="absolute inset-0 rounded-lg blur-[4px]"
                            />
                            <div className="relative z-10 w-8 h-8 rounded-lg bg-brand-green/20 flex items-center justify-center text-brand-green">
                                <Music size={16} className={cn(isPlaying && "animate-pulse")} />
                            </div>
                        </div>

                        {/* Track Info */}
                        <div className="flex-1 min-w-0">
                            <h4 className={cn(
                                "text-xs font-black truncate leading-tight",
                                theme === 'light' ? "text-gray-900" : "text-white"
                            )}>
                                {currentTrack.title}
                            </h4>
                            <p className="text-[10px] text-brand-green font-bold opacity-80">
                                الشيخ ميثم التمار
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={togglePlay}
                                className="w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-brand-green/20"
                            >
                                {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" className="ml-0.5" />}
                            </button>
                            <button 
                                onClick={stopAudio}
                                className={cn(
                                    "p-1.5 rounded-full transition-colors",
                                    theme === 'light' ? "hover:bg-gray-100 text-gray-400" : "hover:bg-white/10 text-white/40"
                                )}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
