import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET_NAME = "quran";

// Surah Names List
const SURAH_NAMES = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس"
];

interface Track {
    id: string;
    title: string;
    index: number;
    url: string;
    type: 'app' | 'local';
}

export const AudioHub = () => {
    const [mode, setMode] = useState<'app' | 'local'>('app');
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0));
    const audioRef = useRef<HTMLAudioElement>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Audio Context & Analyser Setup
    useEffect(() => {
        if (!audioRef.current) return;
        
        const initAudio = () => {
            if (audioContextRef.current) return;
            
            try {
                const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
                const ctx = new AudioContextClass();
                const analyser = ctx.createAnalyser();
                const source = ctx.createMediaElementSource(audioRef.current!);
                
                source.connect(analyser);
                analyser.connect(ctx.destination);
                
                analyser.fftSize = 256;
                analyserRef.current = analyser;
                audioContextRef.current = ctx;
            } catch (err) {
                console.error("Audio API init failed:", err);
            }
        };

        const updateData = () => {
            if (analyserRef.current && isPlaying) {
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);
                setAudioData(dataArray);
            }
            animationRef.current = requestAnimationFrame(updateData);
        };

        if (isPlaying) {
            initAudio();
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
            updateData();
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPlaying]);

    // Generate tracks based on the user's naming pattern: sura (x).mp3
    const quranTracks = useMemo(() => {
        return SURAH_NAMES.map((name, i) => ({
            id: `sura-${i + 1}`,
            title: `سورة ${name}`,
            index: i + 1,
            url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/sura (${i + 1}).mp3`,
            type: 'app' as const
        }));
    }, []);

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

    const selectTrack = (track: Track) => {
        setCurrentTrack(track);
        setIsPlaying(true);
        if (audioRef.current) {
            audioRef.current.src = track.url;
            audioRef.current.play().catch(() => {});
        }
    };

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play().catch(() => {});
            setIsPlaying(!isPlaying);
        }
    };

    const playNext = () => {
        if (!currentTrack || currentTrack.type !== 'app') return;
        const idx = quranTracks.findIndex(t => t.id === currentTrack.id);
        if (idx < quranTracks.length - 1) selectTrack(quranTracks[idx + 1]);
    };

    const playPrev = () => {
        if (!currentTrack || currentTrack.type !== 'app') return;
        const idx = quranTracks.findIndex(t => t.id === currentTrack.id);
        if (idx > 0) selectTrack(quranTracks[idx - 1]);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration);
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
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
            selectTrack(newTrack);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "00:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate bars from audio data - Improved for full bar interaction
    const barsData = useMemo(() => {
        const numBars = 48; // Increased bar density
        if (audioData.length === 0) return [...Array(numBars)].map(() => 4);
        
        const bars = [];
        // Spread frequencies effectively across the bars
        const samplingRange = Math.floor(audioData.length * 0.75); 
        const step = samplingRange / numBars;

        for (let i = 0; i < numBars; i++) {
            const idx = Math.floor(i * step);
            const val = audioData[idx];
            // Apply a slight parabolic scaling to make it look "modern" and full
            const multiplier = 1 + Math.sin((i / numBars) * Math.PI) * 0.5;
            const height = Math.max(4, (val / 255) * 55 * multiplier);
            bars.push(height);
        }
        return bars;
    }, [audioData]);

    return (
        <div className="w-full max-w-4xl mx-auto space-y-3 pb-20 px-2">
            {/* High-End Interactive Player Card */}
            <GlassCard className="p-0 overflow-hidden border-2 border-brand-green/30 shadow-2xl bg-gradient-to-br from-brand-green/10 via-background to-brand-green/5 ring-1 ring-white/10">
                {/* Header Sub-tabs */}
                <div className="flex bg-slate-100/50 dark:bg-black/40 border-b border-white/5 p-1">
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
                    <div className="absolute top-0 right-0 w-80 h-80 bg-brand-green/10 rounded-full -mr-40 -mt-40 blur-3xl animate-pulse" />
                    
                    <div className="flex flex-col items-center gap-4 relative z-10 w-full">
                        {/* Audio Visualization Replacement - Horizontal Bars */}
                        <div className="w-full h-20 bg-white/5 dark:bg-black/20 rounded-2xl border border-white/10 flex items-center justify-center px-4 overflow-hidden group">
                            <div className="flex items-center gap-0.5 h-14 w-full justify-center">
                                {barsData.map((height, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ height: height }}
                                        transition={{ 
                                            type: "spring",
                                            bounce: 0.5,
                                            duration: 0.1
                                        }}
                                        className={cn(
                                            "w-1 min-w-[2px] rounded-full shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-colors",
                                            isPlaying ? "bg-brand-green" : "bg-slate-300 dark:bg-white/10"
                                        )}
                                    />
                                ))}
                                {!isPlaying && audioData.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <Music size={20} className="text-brand-green/20 animate-pulse" />
                                        <span className="text-[8px] font-black tracking-[0.2em] uppercase opacity-30 mr-2">بانتظار التشغيل</span>
                                    </div>
                                )}
                            </div>
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
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (audioRef.current) {
                                                audioRef.current.currentTime = (val / 100) * audioRef.current.duration;
                                                setProgress(val);
                                            }
                                        }} 
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
                                    <button onClick={playPrev} className="text-slate-400 hover:text-brand-green transition-all transform hover:scale-110"><SkipBack size={20} /></button>
                                    <button 
                                        onClick={togglePlay} 
                                        className="w-14 h-14 rounded-full bg-brand-green text-white flex items-center justify-center shadow-lg shadow-brand-green/30 hover:scale-105 active:scale-95 transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" className="ml-1" />}
                                    </button>
                                    <button onClick={playNext} className="text-slate-400 hover:text-brand-green transition-all transform hover:scale-110"><SkipForward size={20} /></button>
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
                                                if (audioRef.current) audioRef.current.volume = v;
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
                                            onClick={() => selectTrack(track)}
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

            <audio 
                ref={audioRef} 
                onTimeUpdate={handleTimeUpdate} 
                onEnded={() => { setIsPlaying(false); playNext(); }} 
                crossOrigin="anonymous"
            />
        </div>
    );
};
