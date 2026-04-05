/**
 * CallOverlay.tsx
 * 
 * الواجهة الرسومية للمكالمة.
 * تظهر فوق كل شيء عند وجود رنين أو مكالمة نشطة.
 * تتضمن: مؤقت المكالمة، كتم الميكروفون، مكبر الصوت
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCall } from '../../context/CallContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Volume2, User, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const CallOverlay: React.FC = () => {
  const { 
    status, isIncoming, remotePeer, remoteStream, 
    acceptCall, endCall, toggleMute, isMuted,
    isSpeakerPhone, toggleSpeaker 
  } = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  // ربط الصوت القادم بمحرك الـ Audio للمتصفح
  useEffect(() => {
    if (remoteStream && audioRef.current) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(err => {
        console.warn('Audio autoplay blocked:', err);
      });
    }
  }, [remoteStream]);

  // التحكم في مخرج الصوت (Speaker vs Earpiece)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateOutputDevice = async () => {
      // التحقق من دعم المتصفح
      if (!('setSinkId' in audio)) {
        console.warn('setSinkId is not supported by this browser');
        return;
      }

      try {
        // ننتظر قليلاً للتأكد من أن الأجهزة محملة
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');

        if (isSpeakerPhone) {
          // محاولة البحث عن مكبر الصوت (Speaker) بكلمات مفتاحية متعددة
          const speaker = outputs.find(d => 
            d.label.toLowerCase().includes('speaker') || 
            d.label.toLowerCase().includes('loud') || 
            d.label.toLowerCase().includes('مكبر') ||
            d.label.toLowerCase().includes('خارجي')
          );
          
          if (speaker) {
            await (audio as any).setSinkId(speaker.deviceId);
            toast.success(`تم تحويل الصوت إلى: ${speaker.label}`);
          } else if (outputs.length > 1) {
            // إذا لم نجد التسمية (labels قد تكون فارغة) ولكن يوجد أكثر من جهاز
            // نجرب الجهاز الثاني الذي غالباً ما يكون هو الـ Loudspeaker في الأندرويد
            await (audio as any).setSinkId(outputs[1].deviceId);
            toast.success('تم التحويل لمخرج الصوت البديل (مكبر)');
          } else {
            // محاولة فرض السبيكر عبر AudioContext إذا لزم الأمر مستقبلاً
            toast.error('لم نجد مكبر صوت خارجي، قد يكون جهازك لا يسمح بالتبديل');
          }
        } else {
          // العودة للسماعة الافتراضية (Earpiece)
          const earpiece = outputs.find(d => 
            d.label.toLowerCase().includes('earpiece') || 
            d.label.toLowerCase().includes('receiver') || 
            d.label.toLowerCase().includes('handset') ||
            d.label.toLowerCase().includes('internal') ||
            d.label.toLowerCase().includes('سماعة الهاتف') ||
            d.label.toLowerCase().includes('داخلية')
          );

          if (earpiece) {
            await (audio as any).setSinkId(earpiece.deviceId);
            toast.success(`تم تحويل الصوت لسماعة الهاتف: ${earpiece.label}`);
          } else {
            // العودة للوضع الافتراضي للنظام
            await (audio as any).setSinkId('');
            toast.success('تم العودة لسماعة الهاتف الافتراضية');
          }
        }
      } catch (err: any) {
        console.error('Error switching audio output:', err);
        toast.error(`تعذر التبديل: ${err.message}`);
      }
    };

    // نقوم بالتحديث فقط عند نشاط المكالمة
    if (status === 'active') {
      updateOutputDevice();
    }
  }, [isSpeakerPhone, status]);

  // مؤقت المكالمة
  useEffect(() => {
    if (status === 'active') {
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  // تنسيق الوقت
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  if (status === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-white p-6"
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
        }}
      >
        {/* صوت الطرف الآخر (مخفي) */}
        <audio ref={audioRef} autoPlay playsInline />

        {/* تأثير خلفي متحرك */}
        {status === 'ringing' && (
          <>
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.05, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute w-60 h-60 rounded-full border-2 border-emerald-500/20"
            />
            <motion.div
              animate={{ scale: [1, 1.8, 1], opacity: [0.08, 0.03, 0.08] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.3 }}
              className="absolute w-60 h-60 rounded-full border-2 border-emerald-500/10"
            />
          </>
        )}

        {status === 'active' && (
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.15, 0.08, 0.15] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute w-48 h-48 rounded-full bg-emerald-500/10"
          />
        )}

        {/* معلومات الطرف الآخر */}
        <div className="flex flex-col items-center mb-10 relative z-10">
          <motion.div 
            animate={status === 'ringing' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-28 h-28 rounded-full bg-slate-800/80 border-2 flex items-center justify-center overflow-hidden mb-5 shadow-2xl"
            style={{
              borderColor: status === 'active' ? '#10b981' : '#10b98140'
            }}
          >
            {remotePeer?.avatar ? (
              <img src={remotePeer.avatar} alt={remotePeer.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-14 h-14 text-slate-400" />
            )}
          </motion.div>
          
          <h2 className="text-2xl font-bold mb-2 tracking-wide">{remotePeer?.name || 'مستخدم'}</h2>
          
          {status === 'ringing' ? (
            <motion.p 
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-emerald-400 font-medium text-lg"
            >
              {isIncoming ? '📞 يكلمك الآن...' : '📞 جاري الاتصال...'}
            </motion.p>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-lg font-semibold tracking-wider">
                {formatTime(elapsed)}
              </span>
            </div>
          )}
        </div>

        {/* أزرار التحكم */}
        <div className="flex items-center gap-6 relative z-10">
          {/* كتم الميكروفون (أثناء المكالمة فقط) */}
          {status === 'active' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted 
                  ? 'bg-red-500/20 border-2 border-red-500/50 text-red-400' 
                  : 'bg-slate-700/60 border-2 border-slate-600/30 text-slate-300 hover:bg-slate-600/60'
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </motion.button>
          )}

          {/* زر القبول */}
          {status === 'ringing' && isIncoming && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileTap={{ scale: 0.9 }}
              onClick={acceptCall}
              className="w-18 h-18 p-5 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-colors"
            >
              <Phone className="w-8 h-8 text-white" />
            </motion.button>
          )}

          {/* زر الإنهاء */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={endCall}
            className="w-18 h-18 p-5 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-lg shadow-red-500/30 transition-colors"
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </motion.button>

          {/* مكبر الصوت (أثناء المكالمة فقط) */}
          {status === 'active' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={toggleSpeaker}
              className={`w-14 h-14 rounded-full border-2 transition-all flex items-center justify-center ${
                isSpeakerPhone 
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                  : 'bg-slate-700/60 border-slate-600/30 text-slate-300 hover:bg-slate-600/60'
              }`}
            >
              <Volume2 className="w-6 h-6" />
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
