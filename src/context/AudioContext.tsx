
import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMotionValue } from 'framer-motion';

export interface Track {
    id: string;
    title: string;
    index: number;
    url: string;
    type: 'app' | 'local';
}

interface AudioContextType {
    isPlaying: boolean;
    currentTrack: Track | null;
    progress: number;
    duration: number;
    currentTime: number;
    volume: number;
    isMuted: boolean;
    glowIntensity: any; // MotionValue<number>
    isQuranPlayerVisible: boolean;
    setIsQuranPlayerVisible: (v: boolean) => void;
    playTrack: (track: Track) => void;
    togglePlay: () => void;
    stopAudio: () => void;
    playNext: () => void;
    playPrev: () => void;
    setVolume: (v: number) => void;
    setIsMuted: (m: boolean) => void;
    seek: (percent: number) => void;
    quranTracks: Track[];
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET_NAME = "quran";
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

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isQuranPlayerVisible, setIsQuranPlayerVisible] = useState(false);

    const glowIntensity = useMotionValue(0);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationRef = useRef<number | null>(null);

    // Initial quran tracks
    const quranTracks = useMemo(() => {
        return SURAH_NAMES.map((name, i) => ({
            id: `sura-${i + 1}`,
            title: `سورة ${name}`,
            index: i + 1,
            url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/sura (${i + 1}).mp3`,
            type: 'app' as const
        }));
    }, []);

    const initAudioContext = useCallback(() => {
        if (!audioRef.current || audioContextRef.current) return;
        
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
            console.error("Global Audio API init failed:", err);
        }
    }, []);

    const updateVisualizer = useCallback(() => {
        if (analyserRef.current && isPlaying) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);

            const startBin = 5;
            const endBin = 45;
            let sum = 0;
            for (let i = startBin; i < endBin; i++) {
                sum += dataArray[i];
            }
            const avg = sum / (endBin - startBin);
            const normalized = Math.min(1, Math.pow(avg / 150, 0.6));
            glowIntensity.set(normalized * 50);
        } else if (!isPlaying) {
            glowIntensity.set(0);
        }
        animationRef.current = requestAnimationFrame(updateVisualizer);
    }, [isPlaying, glowIntensity]);

    useEffect(() => {
        if (isPlaying) {
            initAudioContext();
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
            updateVisualizer();
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPlaying, initAudioContext, updateVisualizer]);
    
    // Sync volume and muted state
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
            audioRef.current.muted = isMuted;
        }
    }, [volume, isMuted]);

    const playTrack = (track: Track) => {
        setCurrentTrack(track);
        setIsPlaying(true);
        if (audioRef.current) {
            audioRef.current.src = track.url;
            audioRef.current.play().catch(() => {});
        }
    };

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play().catch(() => {});
                setIsPlaying(true);
            }
        }
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
            setCurrentTrack(null);
            setProgress(0);
        }
    };

    const playNext = () => {
        if (!currentTrack || currentTrack.type !== 'app') return;
        const idx = quranTracks.findIndex(t => t.id === currentTrack.id);
        if (idx < quranTracks.length - 1) playTrack(quranTracks[idx + 1]);
    };

    const playPrev = () => {
        if (!currentTrack || currentTrack.type !== 'app') return;
        const idx = quranTracks.findIndex(t => t.id === currentTrack.id);
        if (idx > 0) playTrack(quranTracks[idx - 1]);
    };

    const seek = (percent: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = (percent / 100) * audioRef.current.duration;
            setProgress(percent);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration);
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
    };

    return (
        <AudioContext.Provider value={{
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
            stopAudio,
            playNext,
            playPrev,
            setVolume,
            setIsMuted,
            seek,
            isQuranPlayerVisible,
            setIsQuranPlayerVisible,
            quranTracks
        }}>
            {children}
            <audio 
                ref={audioRef} 
                onTimeUpdate={handleTimeUpdate} 
                onEnded={playNext} 
                crossOrigin="anonymous"
            />
        </AudioContext.Provider>
    );
};

export const useAudio = () => {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
};
