import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Search, 
    Upload, 
    Play, 
    Pause, 
    SkipBack, 
    SkipForward, 
    Volume2, 
    VolumeX,
    Music,
    Loader2,
    Globe,
    FolderOpen,
    Disc,
    Link2,
    Sparkles
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/utils";

interface Track {
    id: string;
    title: string;
    artist: string;
    url: string;
    type: 'online' | 'local' | 'youtube';
    cover?: string;
    duration?: number;
    isFindingFull?: boolean; // AI state
}

// Deezer API fetch - local proxy (Vite/Vercel) with CORS-proxy fallback
const deezerFetch = async (path: string): Promise<any> => {
    try {
        const res = await fetch(`/deezer-api${path}`);
        if (res.ok) return await res.json();
    } catch { /* proxy unavailable */ }

    const deezerUrl = `https://api.deezer.com${path}`;
    const corsUrl = `https://corsproxy.io/?${encodeURIComponent(deezerUrl)}`;
    const res = await fetch(corsUrl);
    if (res.ok) return await res.json();
    
    throw new Error("\u0641\u0634\u0644 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u062e\u0627\u062f\u0645 \u0627\u0644\u0628\u062d\u062b.");
};

// --- AI Discovery Logic: Find YouTube Video ID automatically ---
const discoverYouTubeId = async (query: string): Promise<string | null> => {
    try {
        // 1) Try local proxy if in development (faster and avoids extra API calls)
        const searchPath = `/youtube-search/results?search_query=${encodeURIComponent(query + " official audio")}&sp=EgIQAQ%253D%253D`;
        const res = await fetch(searchPath);
        if (res.ok) {
            const html = await res.text();
            const match = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
            if (match && match[1]) return match[1];
        }
    } catch { /* ignore and try API fallback */ }

    try {
        // 2) Try our custom Vercel API (works in production)
        const res = await fetch(`/api/yt-search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
            const data = await res.json();
            return data.videoId || null;
        }
    } catch { /* ignore */ }

    return null;
};



const extractYouTubeId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
};

export const AudioHub = () => {
    const [mode, setMode] = useState<'online' | 'local'>('online');
    const [searchQuery, setSearchQuery] = useState("");
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [discoveryLoading, setDiscoveryLoading] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ytPlayer = useRef<any>(null);

    useEffect(() => {
        if (document.getElementById('yt-iframe-api')) return;
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    }, []);

    const playYouTubeVideo = (videoId: string, title: string, artist?: string) => {
        setAudioError(null);
        
        const initPlayer = () => {
            if (ytPlayer.current) {
                ytPlayer.current.loadVideoById(videoId);
                ytPlayer.current.setVolume(volume * 100);
            } else {
                ytPlayer.current = new (window as any).YT.Player('yt-audio-player', {
                    height: '1',
                    width: '1',
                    videoId: videoId,
                    playerVars: { autoplay: 1, controls: 0, modestbranding: 1 },
                    events: {
                        onReady: (e: any) => {
                            e.target.setVolume(volume * 100);
                            e.target.playVideo();
                        },
                        onStateChange: (e: any) => {
                            const YT = (window as any).YT;
                            if (e.data === YT.PlayerState.PLAYING) setIsPlaying(true);
                            if (e.data === YT.PlayerState.PAUSED) setIsPlaying(false);
                            if (e.data === YT.PlayerState.ENDED) { setIsPlaying(false); playNext(); }
                        },
                        onError: () => {
                            setAudioError("\u062a\u0639\u0630\u0631 \u062a\u0634\u063a\u064a\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0642\u0637\u0639 \u0645\u0646 YouTube. \u062c\u0631\u0628 \u0631\u0627\u0628\u0637\u0627\u064b \u0622\u062e\u0631.");
                        }
                    }
                });
            }
        };

        const track: Track = {
            id: videoId,
            title: title,
            artist: artist || 'YouTube',
            url: `youtube:${videoId}`,
            type: 'youtube',
            cover: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        };
        setCurrentTrack(track);

        if (!(window as any).YT?.Player) {
            const check = setInterval(() => {
                if ((window as any).YT?.Player) { clearInterval(check); initPlayer(); }
            }, 200);
        } else {
            initPlayer();
        }
    };

    const handleAutoDiscover = async (track: Track) => {
        setDiscoveryLoading(track.id);
        const videoId = await discoverYouTubeId(`${track.artist} ${track.title}`);
        setDiscoveryLoading(null);
        
        if (videoId) {
            if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
            playYouTubeVideo(videoId, track.title, track.artist);
        } else {
            alert("\u0644\u0645 \u064a\u062a\u0645\u0643\u0646 \u0627\u0644\u0630\u0643اء \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0645\u0646 \u0625\u064a\u062c\u0627\u062f \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u0643\u0627\u0645\u0644\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b. \u064a\u0645\u0643\u0646\u0643 \u0644\u0635\u0642 \u0627\u0644\u0631\u0627\u0628\u0637 \u064a\u062f\u0648\u064a\u0627\u064b.");
        }
    };

    const handleYouTubePaste = () => {
        const videoId = extractYouTubeId(youtubeUrl);
        if (!videoId) {
            alert("\u0631\u0627\u0628\u0637 YouTube \u063a\u064a\u0631 \u0635\u0627\u0644\u062d.");
            return;
        }
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
        playYouTubeVideo(videoId, "\u0641\u064a\u062f\u064a\u0648 YouTube...");
        setYoutubeUrl("");
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setAudioError(null);
        try {
            const data = await deezerFetch(`/search?q=${encodeURIComponent(searchQuery)}&limit=15`);
            const results = data.data || [];

            if (results.length === 0) {
                alert("\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0646\u062a\u0627\u0626\u062c.");
                return;
            }

            setTracks(results.filter((item: any) => item.preview).map((item: any) => ({
                id: item.id.toString(),
                title: item.title,
                artist: item.artist?.name,
                url: item.preview,
                cover: item.album?.cover_medium,
                duration: item.duration,
                type: 'online',
            })));
        } catch (err: any) {
            alert("\u062d\u062f\u062b \u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u0628\u062d\u062b.");
        } finally {
            setLoading(false);
        }
    };

    const selectTrack = (track: Track) => {
        setAudioError(null);
        if (ytPlayer.current && track.type !== 'youtube') try { ytPlayer.current.stopVideo(); } catch {}
        if (track.type === 'youtube' && audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
        setCurrentTrack(track);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const localUrl = URL.createObjectURL(file);
            const newTrack: Track = {
                id: Math.random().toString(),
                title: file.name.split('.').slice(0, -1).join('.'),
                artist: "ملف محلي",
                url: localUrl,
                type: 'local'
            };
            setTracks(prev => [newTrack, ...prev]);
            selectTrack(newTrack);
        }
    };

    const togglePlay = () => {
        if (currentTrack?.type === 'youtube' && ytPlayer.current) {
            if (isPlaying) ytPlayer.current.pauseVideo(); else ytPlayer.current.playVideo();
            setIsPlaying(!isPlaying);
            return;
        }
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const playNext = () => {
        const list = tracks.filter(t => t.type === (currentTrack?.type === 'youtube' ? 'online' : currentTrack?.type || mode));
        const idx = list.findIndex(t => t.id === currentTrack?.id);
        if (idx >= 0 && idx < list.length - 1) selectTrack(list[idx + 1]);
    };

    const playPrev = () => {
        const list = tracks.filter(t => t.type === (currentTrack?.type === 'youtube' ? 'online' : currentTrack?.type || mode));
        const idx = list.findIndex(t => t.id === currentTrack?.id);
        if (idx > 0) selectTrack(list[idx - 1]);
    };

    useEffect(() => {
        if (currentTrack?.type !== 'youtube' && audioRef.current) {
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
        }
    }, [currentTrack]);

    useEffect(() => {
        if (currentTrack?.type !== 'youtube') return;
        const interval = setInterval(() => {
            if (ytPlayer.current?.getCurrentTime && ytPlayer.current?.getDuration) {
                const curr = ytPlayer.current.getCurrentTime();
                const dur = ytPlayer.current.getDuration();
                if (dur > 0) setProgress((curr / dur) * 100);
            }
        }, 500);
        return () => clearInterval(interval);
    }, [currentTrack]);

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
            setProgress(isNaN(p) ? 0 : p);
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 pb-12 px-2 md:px-0">
            <GlassCard className="p-0 relative overflow-hidden group border-2 border-brand-green/20">
                <div className="flex bg-slate-100/50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 p-1">
                    <button onClick={() => setMode('online')} className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold text-xs md:text-sm", mode === 'online' ? "bg-white dark:bg-white/10 text-brand-green shadow-sm" : "text-slate-500 dark:text-white/40")}>
                        <Globe size={18} /><span>بحث أونلاين</span>
                    </button>
                    <button onClick={() => setMode('local')} className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold text-xs md:text-sm", mode === 'local' ? "bg-white dark:bg-white/10 text-brand-green shadow-sm" : "text-slate-500 dark:text-white/40")}>
                        <FolderOpen size={18} /><span>ملفات محلية</span>
                    </button>
                </div>

                <div className="p-6 md:p-8 relative z-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="relative">
                            <motion.div animate={{ rotate: isPlaying ? 360 : 0 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="w-48 h-48 rounded-full shadow-2xl relative overflow-hidden bg-slate-900 border-8 border-slate-800">
                                {currentTrack?.cover ? <img src={currentTrack.cover} alt="" className="w-full h-full object-cover rounded-full" /> : <div className="w-full h-full flex items-center justify-center text-white/10"><Disc size={64} /></div>}
                                <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 rounded-full bg-black/60 border-2 border-white/10" /></div>
                            </motion.div>
                        </div>

                        <div className="flex-1 text-center md:text-right w-full">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{currentTrack?.title || "\u0648\u0627\u062d\u0629 \u0627\u0644\u0646\u063a\u0645"}</h2>
                            <p className="text-slate-500 dark:text-white/60 mb-6">{currentTrack?.artist || "\u0627\u062e\u062a\u0631 \u0645\u0642\u0637\u0639\u0627\u064b \u0644\u0628\u062f\u0621 \u0627\u0644\u0627\u0633\u062a\u0645\u0627\u0639"}</p>
                            {audioError && <p className="text-red-500 text-xs mb-4">{audioError}</p>}

                            <div className="space-y-2 mb-6">
                                <input type="range" min="0" max="100" value={progress} onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (currentTrack?.type === 'youtube' && typeof ytPlayer.current?.seekTo === 'function' && typeof ytPlayer.current?.getDuration === 'function') 
                                        ytPlayer.current.seekTo((val / 100) * ytPlayer.current.getDuration(), true);
                                    else if (audioRef.current) audioRef.current.currentTime = (val / 100) * audioRef.current.duration;
                                    setProgress(val);
                                }} className="w-full h-1.5 bg-slate-200 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-brand-green" />
                                <div className="flex justify-between text-[10px] text-slate-400 dark:text-white/40">
                                    <span>{currentTrack?.type === 'youtube' && typeof ytPlayer.current?.getDuration === 'function' ? formatTime(ytPlayer.current.getDuration()) : audioRef.current ? formatTime(audioRef.current.duration) : "00:00"}</span>
                                    <span>{currentTrack?.type === 'youtube' && typeof ytPlayer.current?.getCurrentTime === 'function' ? formatTime(ytPlayer.current.getCurrentTime()) : audioRef.current ? formatTime(audioRef.current.currentTime) : "00:00"}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-center md:justify-end gap-6">
                                <button onClick={playPrev} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><SkipBack size={24} /></button>
                                <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-brand-green text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all">
                                    {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                                </button>
                                <button onClick={playNext} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><SkipForward size={24} /></button>
                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-2 px-4 rounded-2xl">
                                    <button onClick={() => setIsMuted(!isMuted)} className="text-slate-500 dark:text-white/60">
                                        {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                    </button>
                                    <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setVolume(v); setIsMuted(v === 0);
                                        if (audioRef.current) audioRef.current.volume = v;
                                        if (ytPlayer.current?.setVolume) ytPlayer.current.setVolume(v * 100);
                                    }} className="w-20 h-1 accent-brand-green" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </GlassCard>

            <AnimatePresence mode="wait">
                <motion.div key={mode} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {mode === 'online' ? (
                        <div className="space-y-4">
                            <div className="relative group">
                                <Link2 className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400" size={20} />
                                <input type="text" placeholder="الصق رابط YouTube يدوياً هنا للتشغيل الكامل..." className="w-full bg-white dark:bg-white/5 border border-red-200 dark:border-red-500/20 rounded-2xl py-3 pr-12 pl-4 text-sm" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleYouTubePaste()} />
                                <button onClick={handleYouTubePaste} className="absolute left-2 top-1.5 bottom-1.5 px-4 bg-red-500 text-white rounded-xl text-xs font-bold">تشغيل رابط</button>
                            </div>

                            <div className="relative group">
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input type="text" placeholder="ابحث عن أي شيء..." className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pr-12 pl-4" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                                <button onClick={handleSearch} disabled={loading} className="absolute left-2 top-2 bottom-2 px-6 bg-brand-green text-white rounded-xl font-bold">
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : "بحث"}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {tracks.map(track => (
                                    <div key={track.id} className={cn("p-3 rounded-2xl border flex items-center gap-4 group cursor-pointer", currentTrack?.id === track.id ? "bg-brand-green/10 border-brand-green" : "bg-white dark:bg-white/5 border-slate-100 dark:border-white/5")}>
                                        <div onClick={() => selectTrack(track)} className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                                            {track.cover ? <img src={track.cover} alt="" className="w-full h-full object-cover" /> : <Music size={20} />}
                                        </div>
                                        <div onClick={() => selectTrack(track)} className="flex-1 overflow-hidden">
                                            <p className="font-bold text-sm truncate">{track.title}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{track.artist}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleAutoDiscover(track); }}
                                            disabled={discoveryLoading === track.id}
                                            className="px-3 py-2 bg-brand-green/10 hover:bg-brand-green text-brand-green hover:text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 shrink-0"
                                        >
                                            {discoveryLoading === track.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            <span>تشغيل كامل AI</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                       <div className="space-y-4">
                            <button onClick={() => fileInputRef.current?.click()} className="w-full py-12 bg-white dark:bg-white/5 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center gap-4 hover:border-brand-green transition-all">
                                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center"><Upload size={32} className="text-slate-400" /></div>
                                <div className="text-center font-bold text-lg">ارفع ملفاً من جهازك</div>
                            </button>
                            <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {tracks.filter(t => t.type === 'local').map(track => (
                                    <div key={track.id} onClick={() => selectTrack(track)} className={cn("p-3 rounded-2xl border flex items-center gap-4 cursor-pointer", currentTrack?.id === track.id ? "bg-brand-green/10 border-brand-green" : "bg-white dark:bg-white/5 border-slate-100 dark:border-white/5")}>
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><FolderOpen size={20} className="text-brand-green" /></div>
                                        <div className="flex-1 overflow-hidden"><p className="font-bold text-sm truncate">{track.title}</p></div>
                                    </div>
                                ))}
                            </div>
                       </div>
                    )}
                </motion.div>
            </AnimatePresence>

            <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}><div id="yt-audio-player" /></div>
            <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={() => { setIsPlaying(false); playNext(); }} />
        </div>
    );
};
