
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X } from 'lucide-react';
import { useAudio } from "../../context/AudioContext";
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const isChat = location.pathname.startsWith('/chat/');

    if (!currentTrack || hide || isQuranPlayerVisible) return null;

    const handlePlayerClick = (e: React.MouseEvent) => {
        // Prevent navigation if clicking buttons
        if ((e.target as HTMLElement).closest('button')) return;

        const isAdmin = user?.role === 'admin';
        const targetTab = isAdmin ? 'admin_audio' : 'audio';
        
        // Dispatch custom event for instant tab switching if already on dashboard
        window.dispatchEvent(new CustomEvent('switch_dashboard_tab', { 
            detail: { tab: targetTab } 
        }));

        // Also navigate to root with tab parameter for fallback/deep-linking
        navigate(`/?tab=${targetTab}`);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: isChat ? -20 : 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: isChat ? -20 : 20, opacity: 0 }}
                onClick={handlePlayerClick}
                className={cn(
                    "fixed z-[100] group transition-all duration-500 cursor-pointer",
                    isChat 
                        ? "top-[calc(10px+env(safe-area-inset-top))] left-14" 
                        : "bottom-[calc(1.8rem+env(safe-area-inset-bottom))] left-4",
                    className
                )}
            >
                <div className={cn(
                    "relative overflow-hidden rounded-lg border backdrop-blur-md shadow-lg transition-all duration-300",
                    isChat
                        ? "bg-emerald-50/80 border-emerald-200"
                        : theme === 'light' 
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
