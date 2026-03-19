import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useTransform, useMotionTemplate } from "framer-motion";
import { 
    Play, 
    Pause, 
    SkipBack, 
    SkipForward, 
    Volume2, 
    VolumeX,
    Music,
    Loader2,
    FolderOpen,
    BookOpen,
    Download,
    CheckCircle2,
    Search,
    Heart,
    Share2
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/utils";
import { useAudio, type Track } from "../../context/AudioContext";

export const AudioHub = () => {
    const {
        isPlaying,
        currentTrack,
        progress,
        duration,
        currentTime,
        volume,
        isMuted,
        glowIntensity,
        playTrack,
        togglePlay,
        playNext,
        playPrev,
        setVolume,
        setIsMuted,
        seek,
        setIsQuranPlayerVisible,
        quranTracks
    } = useAudio();

    const [mode, setMode] = useState<'app' | 'local'>('app');
    const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Visibility Management
    useEffect(() => {
        setIsQuranPlayerVisible(true);
        return () => setIsQuranPlayerVisible(false);
    }, [setIsQuranPlayerVisible]);

    // Reactive Transforms for best performance (No re-renders)
    const dynamicShadow = useTransform(
        glowIntensity, 
        [0, 45], 
        ["0px 0px 0px 0px rgba(34, 197, 94, 0)", "0px 0px 60px 12px rgba(34, 197, 94, 0.5)"]
    );

    const color1 = useTransform(glowIntensity, [0, 45], ["#22c55e", "#4ade80"]);
    const color2 = useTransform(glowIntensity, [0, 45], ["#16a34a", "#22c55e"]);
    const dynamicGradient = useMotionTemplate`linear-gradient(90deg, ${color1} 0%, ${color2} 50%, ${color1} 100%)`;

    // Glow visuals based on intensity
    const glowOpacity = useTransform(glowIntensity, [0, 50], [0.2, 0.9]);
    const glowScaleX = useTransform(glowIntensity, [0, 50], [0.95, 1.1]);
    const glowScaleY = useTransform(glowIntensity, [0, 50], [1, 5]);

    const filteredTracks = useMemo(() => {
        if (!searchQuery.trim()) return quranTracks;
        return quranTracks.filter(t => t.title.includes(searchQuery) || t.index.toString() === searchQuery);
    }, [quranTracks, searchQuery]);

    const checkCache = useCallback(async () => {
        if (!('caches' in window)) return;
        try {
            const cache = await caches.open('quran-audio-cache');
            const newCached = new Set<string>();
            for (const track of quranTracks) {
                const match = await cache.match(track.url);
                if (match) newCached.add(track.id);
            }
            setCachedIds(newCached);
        } catch (e) {
            console.error("Cache check failed", e);
        }
    }, [quranTracks]);

    useEffect(() => {
        checkCache();
    }, [checkCache]);

    const handleDownload = async (track: Track) => {
        if (!('caches' in window)) return;
        setIsDownloading(track.id);
        try {
            const cache = await caches.open('quran-audio-cache');
            await cache.add(track.url);
            setCachedIds(prev => new Set(prev).add(track.id));
        } catch (e) {
            console.error("Download failed", e);
        } finally {
            setIsDownloading(null);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const localUrl = URL.createObjectURL(file);
            const newTrack: Track = {
                id: `local-${Math.random()}`,
                title: file.name.replace(/\.[^/.]+$/, ""),
                index: 0,
                url: localUrl,
                type: 'local'
            };
            playTrack(newTrack);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "00:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-3 pb-20 px-2">
            {/* High-End Interactive Player Card */}
            <GlassCard className="p-0 overflow-hidden border-2 border-brand-green/30 shadow-2xl bg-gradient-to-br from-brand-green/10 via-background to-brand-green/5 ring-1 ring-white/10">
                {/* Header Sub-tabs */}
                <div className="flex bg-slate-100/50 dark:bg-black/40 border-b border-white/5 p-1 relative z-20">
                    <button 
                        onClick={() => setMode('app')} 
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-xs",
                            mode === 'app' 
                                ? "bg-brand-green text-white shadow-xl shadow-brand-green/20" 
                                : "text-slate-500 dark:text-white/40 hover:bg-white/10"
                        )}
                    >
                        <BookOpen size={16} />
                        <span>سور القرآن</span>
                    </button>
                    <button 
                        onClick={() => setMode('local')} 
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-xs",
                            mode === 'local' 
                                ? "bg-brand-green text-white shadow-xl shadow-brand-green/20" 
                                : "text-slate-500 dark:text-white/40 hover:bg-white/10"
                        )}
                    >
                        <FolderOpen size={16} />
                        <span>ملفات محلية</span>
                    </button>
                </div>

                <div className="p-4 md:p-6 relative">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-brand-green/10 rounded-full -mr-40 -mt-40 blur-3xl animate-pulse pointer-events-none" />
                    
                    <div className="flex flex-col items-center gap-4 relative z-10 w-full">
                        {/* Audio Visualization - Breathing Glow Effect */}
                        <div className="w-full h-16 bg-white/5 dark:bg-black/20 rounded-2xl border border-white/10 flex items-center justify-center px-12 overflow-hidden group">
                            <motion.div
                                style={{
                                    opacity: glowOpacity,
                                    scaleX: glowScaleX,
                                    scaleY: glowScaleY,
                                    boxShadow: dynamicShadow,
                                    background: dynamicGradient
                                }}
                                className="w-full h-1 bg-brand-green rounded-full shadow-[0_0_20px_rgba(34,197,94,0.3)] relative"
                            >
                                {/* Immersive Pulse Glow */}
                                <motion.div 
                                    style={{ 
                                        opacity: glowOpacity,
                                        boxShadow: dynamicShadow,
                                        scaleY: 1.5
                                    }}
                                    className="absolute inset-0 bg-white/10 rounded-full blur-[2px]"
                                />
                            </motion.div>
                            {!isPlaying && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <Music size={14} className="text-brand-green/20 animate-pulse" />
                                    <span className="text-[7px] font-black tracking-[0.2em] uppercase opacity-30 mr-2">جاهز للتلاوة</span>
                                </div>
                            )}
                        </div>

                        {/* Player Context & Controls */}
                        <div className="w-full space-y-3">
                            <div className="text-center space-y-0.5">
                                <motion.h2 
                                    key={currentTrack?.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight"
                                >
                                    {currentTrack?.title || "القرآن الكريم"}
                                </motion.h2>
                                <div className="flex items-center justify-center gap-3 text-brand-green font-bold text-xs opacity-80">
                                    <span>الشيخ ميثم التمار</span>
                                    <div className="w-1.5 h-1.5 bg-brand-green rounded-full" />
                                    <span>رواية حفص</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 max-w-2xl mx-auto">
                                <div className="relative group h-4 flex items-center">
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={progress || 0} 
                                        onChange={(e) => seek(parseFloat(e.target.value))} 
                                        className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-brand-green hover:h-1.5 transition-all"
                                    />
                                </div>
                                <div className="flex justify-between text-[9px] font-mono font-black text-slate-500 dark:text-white/40 tracking-widest">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-4">
                                <div className="flex items-center gap-6">
                                    <button onClick={playNext} className="text-slate-400 hover:text-brand-green transition-all transform hover:scale-110"><SkipForward size={20} /></button>
                                    <button 
                                        onClick={togglePlay} 
                                        className="w-14 h-14 rounded-full bg-brand-green text-white flex items-center justify-center shadow-lg shadow-brand-green/30 hover:scale-105 active:scale-95 transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" className="ml-1" />}
                                    </button>
                                    <button onClick={playPrev} className="text-slate-400 hover:text-brand-green transition-all transform hover:scale-110"><SkipBack size={20} /></button>
                                </div>

                                <div className="flex items-center gap-4 border-r border-white/10 pr-4">
                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg">
                                        <button onClick={() => setIsMuted(!isMuted)} className="text-slate-500 dark:text-white/50 hover:text-brand-green transition-colors">
                                            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                        </button>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="1" 
                                            step="0.01" 
                                            value={isMuted ? 0 : volume} 
                                            onChange={(e) => {
                                                const v = parseFloat(e.target.value);
                                                setVolume(v);
                                                setIsMuted(v === 0);
                                            }} 
                                            className="w-16 h-0.5 accent-brand-green" 
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="text-slate-400 hover:text-red-500 transition-all hover:scale-110"><Heart size={18} /></button>
                                        <button className="text-slate-400 hover:text-brand-green transition-all hover:scale-110"><Share2 size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </GlassCard>

            {/* Compact Scrollable Surah Selector */}
            <AnimatePresence mode="wait">
                <motion.div 
                    key={mode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                >
                    {mode === 'app' ? (
                        <>
                            {/* Search Surah */}
                            <div className="relative group">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-green transition-colors" size={14} />
                                <input 
                                    type="text" 
                                    placeholder="ابحث عن سورة..." 
                                    className="w-full bg-white/50 dark:bg-black/20 border border-slate-100 dark:border-white/5 focus:border-brand-green/30 focus:bg-white dark:focus:bg-black/40 rounded-lg py-2.5 pr-10 pl-4 text-[11px] font-bold transition-all outline-none"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Dense Scrollable Grid - Fixed for 3 rows approximately */}
                            <div 
                                ref={scrollContainerRef}
                                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-[148px] overflow-y-auto pr-1.5 custom-scrollbar pb-6"
                            >
                                {filteredTracks.map((track) => {
                                    const isSelected = currentTrack?.id === track.id;
                                    const isCached = cachedIds.has(track.id);
                                    const downloading = isDownloading === track.id;

                                    return (
                                        <motion.div 
                                            key={track.id}
                                            whileHover={{ y: -1 }}
                                            onClick={() => playTrack(track)}
                                            className={cn(
                                                "p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2 group relative overflow-hidden",
                                                isSelected 
                                                    ? "bg-brand-green border-brand-green shadow-md shadow-brand-green/10 text-white" 
                                                    : "bg-white dark:bg-black/20 border-slate-50 dark:border-white/5 hover:border-brand-green/20 text-slate-700 dark:text-white/70"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-6 h-6 rounded-md flex items-center justify-center font-black text-[9px] shrink-0 transition-colors",
                                                isSelected ? "bg-white/20" : "bg-slate-100 dark:bg-white/10"
                                            )}>
                                                {track.index}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-[10px] leading-tight truncate">{track.title}</p>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {isCached ? (
                                                    <div className="text-brand-green bg-brand-green/10 rounded-full group-hover:bg-white group-hover:text-brand-green transition-colors">
                                                        <CheckCircle2 size={10} />
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(track); }}
                                                        disabled={downloading}
                                                        className={cn(
                                                            "p-1 rounded-full transition-all",
                                                            isSelected ? "bg-white/10 hover:bg-white/30" : "bg-slate-100 dark:bg-white/10 hover:bg-brand-green hover:text-white",
                                                            downloading && "animate-spin"
                                                        )}
                                                    >
                                                        {downloading ? <Loader2 size={10} /> : <Download size={10} />}
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                                
                                {filteredTracks.length === 0 && (
                                    <div className="col-span-full py-6 text-center text-slate-500 opacity-60 font-bold text-[10px]">
                                        لم يتم العثور على نتائج
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="col-span-full space-y-2">
                             <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-8 bg-white/50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl flex flex-col items-center gap-2 hover:border-brand-green hover:bg-brand-green/5 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                                    <FolderOpen size={20} className="text-slate-400 group-hover:text-brand-green transition-colors" />
                                </div>
                                <div className="text-center space-y-0.5">
                                    <div className="font-black text-sm">افتح ملفاً صوتياً</div>
                                    <p className="text-[9px] text-slate-500 font-bold opacity-60">تطبيقات محلية</p>
                                </div>
                            </button>
                            <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" />
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
