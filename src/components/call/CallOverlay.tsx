/**
 * CallOverlay.tsx
 * 
 * الواجهة الرسومية للمكالمة.
 * تظهر فوق كل شيء عند وجود رنين أو مكالمة نشطة.
 */

import React, { useEffect, useRef } from 'react';
import { useCall } from '../../context/CallContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, Volume2, User } from 'lucide-react';

export const CallOverlay: React.FC = () => {
  const { status, isIncoming, remotePeer, remoteStream, acceptCall, endCall } = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);

  // ربط الصوت القادم بمحرك الـ Audio للمتصفح
  useEffect(() => {
    if (remoteStream && audioRef.current) {
      audioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (status === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-white p-6"
      >
        {/* صوت الطرف الآخر (مخفي) */}
        <audio ref={audioRef} autoPlay playsInline />

        {/* معلومات الطرف الآخر */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-emerald-500/30 flex items-center justify-center overflow-hidden mb-4 shadow-2xl shadow-emerald-500/10">
            {remotePeer?.avatar ? (
              <img src={remotePeer.avatar} alt={remotePeer.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-slate-500" />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2">{remotePeer?.name || 'مستخدم'}</h2>
          <p className="text-emerald-500 animate-pulse font-medium">
            {status === 'ringing' ? (isIncoming ? 'يكلمك الآن...' : 'جاري الاتصال...') : 'مكالمة نشطة'}
          </p>
        </div>

        {/* أزرار التحكم */}
        <div className="flex items-center gap-8">
          {status === 'ringing' && isIncoming && (
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-transform active:scale-90"
            >
              <Phone className="w-8 h-8 text-white" />
            </button>
          )}

          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20 transition-transform active:scale-90"
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </button>
        </div>

        {/* أدوات إضافية (تظهر أثناء المكالمة فقط) */}
        {status === 'active' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 flex gap-4"
          >
            <button className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300">
              <Mic className="w-6 h-6" />
            </button>
            <button className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300">
              <Volume2 className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
