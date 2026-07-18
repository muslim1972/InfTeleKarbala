import React, { useEffect, useRef, useState, memo } from 'react';
import { useCall } from '../../context/CallContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VideoOff, Video, User, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLocalParticipant, useTracks, VideoTrack, AudioTrack, RoomAudioRenderer } from '@livekit/components-react';
import { Track } from 'livekit-client';

// مؤقت المكالمة
const CallTimer = memo(() => {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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

const ActiveCallUI = () => {
  const { endCall, remotePeer, isVideoCall } = useCall();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: false }
    ],
    { onlySubscribed: true }
  );

  const toggleMute = () => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const toggleVideo = () => {
    localParticipant.setCameraEnabled(!isCameraEnabled);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-between text-white p-12 overflow-hidden bg-slate-900"
    >
      {/* LiveKit Audio Engine */}
      <RoomAudioRenderer />

      {/* مسارات الفيديو */}
      <div className="absolute inset-0 z-0">
        {tracks.filter(t => t.publication.kind === Track.Kind.Video).map((trackReference) => (
          <VideoTrack 
            key={trackReference.publication.trackSid} 
            trackRef={trackReference} 
            className="w-full h-full object-cover" 
          />
        ))}
        {/* تأثيرات في حالة عدم وجود فيديو (مكالمة صوتية) */}
        {!isVideoCall && (
            <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#0f172a_100%)]">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 180, 270, 360], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[100px]"
              />
            </div>
        )}
      </div>

      {/* رأس الصفحة والمؤقت */}
      <div className="relative z-10 flex flex-col items-center gap-2 mt-4">
        <div className="bg-black/40 backdrop-blur-md px-4 py-1 rounded-full border border-white/10 text-xs font-medium tracking-widest uppercase text-slate-300 shadow-lg">
          {isVideoCall ? 'مكالمة فيديو مشفرة' : 'اتصال صوتي مشفر'}
        </div>
        <CallTimer />
      </div>

      {/* معلومات المتصل (تظهر في حالة المكالمة الصوتية) */}
      {!isVideoCall && (
        <div className="relative z-10 flex flex-col items-center mt-12">
          <div className="w-40 h-40 rounded-full bg-slate-800 border-4 border-slate-700/50 flex items-center justify-center overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)]">
            {remotePeer?.avatar ? (
              <img src={remotePeer.avatar} alt={remotePeer.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-20 h-20 text-slate-500" />
            )}
          </div>
          <h2 className="text-3xl font-bold mt-8 mb-2 tracking-tight drop-shadow-md">{remotePeer?.name || 'زميل'}</h2>
        </div>
      )}

      {/* أزرار التحكم السفلية */}
      <div className="relative z-10 w-full max-w-lg flex items-center justify-around pb-10 mt-auto bg-gradient-to-t from-black/80 to-transparent pt-12">
        {isVideoCall && (
            <button
              onClick={toggleVideo}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${
                !isCameraEnabled ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20'
              }`}
            >
              {isCameraEnabled ? <Video className="w-7 h-7" /> : <VideoOff className="w-7 h-7" />}
            </button>
        )}

        <button
          onClick={toggleMute}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${
            !isMicrophoneEnabled ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20'
          }`}
        >
          {isMicrophoneEnabled ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
        </button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={endCall}
          className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.5)]"
        >
          <PhoneOff className="w-9 h-9 text-white" />
        </motion.button>
      </div>
    </motion.div>
  );
};

const RingingCallUI = () => {
  const { isIncoming, isVideoCall, remotePeer, acceptCall, endCall } = useCall();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-between text-white p-12 overflow-hidden"
      style={{ background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 180, 270, 360], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[100px]"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2 mt-4">
        <div className="bg-white/5 backdrop-blur-md px-4 py-1 rounded-full border border-white/10 text-xs font-medium tracking-widest uppercase text-slate-400">
          مكالمة {isVideoCall ? 'فيديو' : 'صوتية'} واردة
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center mt-12">
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-emerald-500/20"
          />
          <div className="w-40 h-40 rounded-full bg-slate-800 border-4 border-slate-700/50 flex items-center justify-center overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)] relative z-10">
            {remotePeer?.avatar ? (
              <img src={remotePeer.avatar} alt={remotePeer.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-20 h-20 text-slate-500" />
            )}
          </div>
        </div>
        
        <h2 className="text-3xl font-bold mt-8 mb-2 tracking-tight">{remotePeer?.name || 'زميل'}</h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-emerald-400 font-medium text-lg animate-pulse"
        >
          {isIncoming ? 'يتصل بك...' : 'جاري الاتصال...'}
        </motion.p>
      </div>

      <div className="relative z-10 w-full max-w-sm flex items-center justify-around pb-10">
        {isIncoming && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={acceptCall}
            className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]"
          >
            {isVideoCall ? <Video className="w-9 h-9 text-white" /> : <Phone className="w-9 h-9 text-white" />}
          </motion.button>
        )}
        
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={endCall}
          className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)]"
        >
          <PhoneOff className="w-9 h-9 text-white" />
        </motion.button>
      </div>
    </motion.div>
  );
};

export const CallOverlay: React.FC = () => {
  const { status } = useCall();
  
  if (status === 'idle') return null;

  return (
    <AnimatePresence>
      {status === 'active' ? <ActiveCallUI key="active" /> : <RingingCallUI key="ringing" />}
    </AnimatePresence>
  );
};
