/**
 * CallOverlay.tsx
 * 
 * الواجهة المحدثة للمكالمات - تصميم Premium
 * تدعم التحكم في الصوت، كتم الميكروفون، ومؤقت المكالمة.
 */

import React, { useEffect, useRef, useState, memo } from 'react';
import { useCall } from '../../context/CallContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Volume2, User, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

// مؤقت المكالمة المحسن
const CallTimer = memo(({ status }: { status: string }) => {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (status === 'active') {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (status !== 'active') return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 shadow-lg shadow-emerald-500/5"
    >
      <Clock className="w-4 h-4" />
      <span className="font-mono text-lg font-bold tracking-widest">
        {formatTime(elapsed)}
      </span>
    </motion.div>
  );
});

export const CallOverlay: React.FC = () => {
  const { 
    status, isIncoming, remotePeer, remoteStream, 
    acceptCall, endCall, toggleMute, isMuted,
    isSpeakerPhone, toggleSpeaker 
  } = useCall();
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // ربط الصوت البعيد
  useEffect(() => {
    if (remoteStream && audioRef.current) {
      console.log('🔊 Connecting remote stream to audio element');
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(err => {
        console.warn('⚠️ Audio autoplay blocked:', err);
      });
    }
  }, [remoteStream]);

  // التحكم في مخرج الصوت (الهواتف الذكية)
  useEffect(() => {
    const audioToggle = (window as any).AudioToggle;
    if (audioToggle && status === 'active') {
      try {
        if (isSpeakerPhone) {
          audioToggle.setAudioMode(audioToggle.SPEAKER);
          toast.success('تم تشغيل مكبر الصوت');
        } else {
          audioToggle.setAudioMode(audioToggle.EARPIECE);
          toast.success('تم التحويل لسماعة الهاتف');
        }
      } catch (err) {
        console.error('Failed to toggle audio mode:', err);
      }
    }
  }, [isSpeakerPhone, status]);

  if (status === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex flex-col items-center justify-between text-white p-12 overflow-hidden"
        style={{
          background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)'
        }}
      >
        <audio ref={audioRef} autoPlay playsInline />

        {/* تأثيرات خلفية حركية */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 180, 270, 360],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[100px]"
          />
        </div>

        {/* رأس الصفحة */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="bg-white/5 backdrop-blur-md px-4 py-1 rounded-full border border-white/10 text-xs font-medium tracking-widest uppercase text-slate-400">
            {status === 'active' ? 'اتصال صوتي مشفر' : 'مكالمة واردة'}
          </div>
          <CallTimer status={status} />
        </div>

        {/* المحتوى المركزي (صورة المستخدم) */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            {status === 'ringing' && (
              <motion.div
                animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-emerald-500/20"
              />
            )}
            
            <motion.div 
              layoutId="avatar"
              className="w-40 h-40 rounded-full bg-slate-800 border-4 border-slate-700/50 flex items-center justify-center overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)]"
            >
              {remotePeer?.avatar ? (
                <img src={remotePeer.avatar} alt={remotePeer.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-20 h-20 text-slate-500" />
              )}
            </motion.div>
          </div>
          
          <h2 className="text-3xl font-bold mt-8 mb-2 tracking-tight">{remotePeer?.name || 'زميل'}</h2>
          
          <AnimatePresence mode="wait">
            {status === 'ringing' ? (
              <motion.p 
                key="ringing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-emerald-400 font-medium text-lg animate-pulse"
              >
                {isIncoming ? 'يتصل بك...' : 'جاري الاتصال...'}
              </motion.p>
            ) : (
              <motion.p 
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-slate-400 font-medium"
              >
                متصل الآن
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* أزرار التحكم السفلى */}
        <div className="relative z-10 w-full max-w-sm flex items-center justify-around pb-10">
          
          {/* كتم الصوت */}
          <button
            onClick={toggleMute}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${
              isMuted 
                ? 'bg-red-500 text-white shadow-red-500/20' 
                : 'bg-white/5 backdrop-blur-xl border border-white/10 text-white hover:bg-white/10'
            }`}
          >
            {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>

          {/* زر الرد أو إنهاء المكالمة الرئيسي */}
          {status === 'ringing' && isIncoming ? (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={acceptCall}
              className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]"
            >
              <Phone className="w-9 h-9 text-white" />
            </motion.button>
          ) : (
             <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={endCall}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)]"
            >
              <PhoneOff className="w-9 h-9 text-white" />
            </motion.button>
          )}

          {/* مكبر الصوت */}
          <button
            onClick={toggleSpeaker}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${
              isSpeakerPhone 
                ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                : 'bg-white/5 backdrop-blur-xl border border-white/10 text-white hover:bg-white/10'
            }`}
          >
            <Volume2 className="w-7 h-7" />
          </button>
        </div>

      </motion.div>
    </AnimatePresence>
  );
};
