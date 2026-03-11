import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AudioPlayerProps {
    src: string;
    isMe: boolean;
}

export function AudioPlayer({ src, isMe }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const progressBarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onLoadedMetadata = () => setDuration(audio.duration);
        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };
        const onEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        };

        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    }, [isPlaying]);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        const bar = progressBarRef.current;
        if (!audio || !bar || !duration) return;

        const rect = bar.getBoundingClientRect();
        // RTL-aware: calculate from right
        const clickX = rect.right - e.clientX;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        audio.currentTime = ratio * duration;
    }, [duration]);

    const formatTime = (t: number) => {
        if (!t || isNaN(t)) return '0:00';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Generate static waveform bars for visual effect
    const bars = Array.from({ length: 28 }, (_, i) => {
        const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
        return 0.15 + (seed - Math.floor(seed)) * 0.85;
    });

    return (
        <div className="flex items-center gap-2 min-w-[200px] max-w-[280px]" dir="ltr">
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Play/Pause Button */}
            <button
                onClick={togglePlay}
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 active:scale-90",
                    isMe
                        ? "bg-white/20 hover:bg-white/30 text-white"
                        : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
                )}
            >
                {isPlaying
                    ? <Pause className="w-4 h-4" />
                    : <Play className="w-4 h-4 ml-0.5" />
                }
            </button>

            {/* Waveform + Progress */}
            <div className="flex-1 flex flex-col gap-1">
                <div
                    ref={progressBarRef}
                    className="h-8 flex items-center gap-[2px] cursor-pointer relative"
                    onClick={handleSeek}
                >
                    {bars.map((height, i) => {
                        const barProgress = (i / bars.length) * 100;
                        const isActive = barProgress <= progress;
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "w-[3px] rounded-full transition-all duration-150",
                                    isActive
                                        ? isMe ? "bg-white" : "bg-emerald-500"
                                        : isMe ? "bg-white/30" : "bg-gray-300"
                                )}
                                style={{
                                    height: `${Math.max(4, height * 28)}px`,
                                }}
                            />
                        );
                    })}
                </div>

                {/* Duration */}
                <div className={cn(
                    "text-[10px] font-mono tabular-nums",
                    isMe ? "text-emerald-100/70" : "text-gray-400"
                )}>
                    {formatTime(isPlaying ? currentTime : duration)}
                </div>
            </div>
        </div>
    );
}
