/**
 * CallContext.tsx
 * 
 * نظام المكالمات الصوتية المطور - نسخة مقتبسة من ShamilApp
 * يعتمد على Cloudflare Calls SFU و GlobalAudioManager
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';
import { CallOverlay } from '../components/call/CallOverlay';
import { globalAudioManager } from '../services/GlobalAudioManager';
import { RingbackToneGenerator } from '../services/RingbackToneGenerator';
import { CloudflareCallsService } from '../services/CloudflareCallsService';

export type CallStatus = 'idle' | 'ringing' | 'active' | 'ended';

interface CallContextType {
  callId: string | null;
  status: CallStatus;
  isIncoming: boolean;
  remotePeer: { id: string, name: string, avatar?: string } | null;
  startCall: (recipientId: string, conversationId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  isMuted: boolean;
  isSpeakerPhone: boolean;
  toggleSpeaker: () => void;
  remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // States
  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isIncoming, setIsIncoming] = useState(false);
  const [remotePeer, setRemotePeer] = useState<{ id: string, name: string, avatar?: string } | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerPhone, setIsSpeakerPhone] = useState(false);

  // Refs
  const cfServiceRef = useRef<CloudflareCallsService | null>(null);
  const ringbackRef = useRef<RingbackToneGenerator | null>(null);
  const pullPcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | null>(null);

  /**
   * تنظيف كامل لجميع الموارد (Cleanup)
   */
  const cleanupCall = useCallback(() => {
    console.log('📞 Cleaning up call resources...');
    
    // إيقاف الأصوات
    globalAudioManager.stopAllAudio();
    if (ringbackRef.current) {
      ringbackRef.current.stop();
      ringbackRef.current = null;
    }

    // تنظيف WebRTC
    if (cfServiceRef.current) {
      cfServiceRef.current.stop();
      cfServiceRef.current = null;
    }
    if (pullPcRef.current) {
      pullPcRef.current.close();
      pullPcRef.current = null;
    }

    // إعادة تعيين الحالة
    setStatus('idle');
    setCallId(null);
    callIdRef.current = null;
    setRemotePeer(null);
    setRemoteStream(null);
    setIsIncoming(false);
    setIsMuted(false);
    setIsSpeakerPhone(false);
  }, []);

  /**
   * الاستماع للمكالمات الواردة عبر Realtime
   */
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('hr-calls-inbound')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'hr_audio_calls', 
          filter: `recipient_id=eq.${user.id}` 
        },
        async (payload) => {
          const newCall = payload.new;
          if (newCall.status === 'calling' && newCall.id !== callIdRef.current && status === 'idle') {
            console.log('🔔 Incoming call detected:', newCall.id);
            
            setCallId(newCall.id);
            callIdRef.current = newCall.id;
            setIsIncoming(true);
            setStatus('ringing');

            // تشغيل صوت الرنين
            globalAudioManager.startAlert().catch(() => {
              console.warn('Autoplay blocked, waiting for interaction');
            });

            // جلب بيانات المتصل
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, username, avatar_url')
              .eq('id', newCall.sender_id)
              .single();

            setRemotePeer({
              id: newCall.sender_id,
              name: profile?.username || 'زميل',
              avatar: profile?.avatar_url
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, status]);

  /**
   * مراقبة تحديثات حالة المكالمة الحالية
   */
  useEffect(() => {
    if (!callId || !user) return;

    const statusChannel = supabase
      .channel(`hr-call-status-${callId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'hr_audio_calls', 
          filter: `id=eq.${callId}` 
        },
        async (payload) => {
          const updated = payload.new;
          console.log('📞 Call record updated:', updated.status);

          if (['ended', 'missed', 'rejected'].includes(updated.status)) {
            cleanupCall();
            return;
          }

          // إذا كنت أنا المُتصل (المرسل)، والمستقبل قبل المكالمة
          if (!isIncoming && updated.status === 'active' && updated.receiver_track_name && cfServiceRef.current) {
            console.log('✅ Recipient accepted! Pulling remote stream...');
            setStatus('active');
            
            if (ringbackRef.current) {
              ringbackRef.current.stop();
            }

            try {
              const pc = await cfServiceRef.current.startPull(updated.receiver_track_name, (stream) => {
                setRemoteStream(stream);
              });
              pullPcRef.current = pc;
            } catch (err) {
              console.error('Failed to pull remote stream:', err);
              toast.error('فشل جلب صوت الطرف الآخر');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
    };
  }, [callId, user, isIncoming, cleanupCall]);

  /**
   * بدء مكالمة جديدة (المرسل)
   */
  const startCall = useCallback(async (recipientId: string, conversationId: string) => {
    if (!user || status !== 'idle') return;

    try {
      console.log('📞 Starting voice call...');
      setStatus('ringing');
      setIsIncoming(false);
      
      // جلب بيانات الطرف الآخر فوراً للواجهة
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', recipientId)
        .single();

      setRemotePeer({
        id: recipientId,
        name: profile?.username || 'زميل',
        avatar: profile?.avatar_url
      });

      // 1. بدء تشغيل نغمة الانتظار
      const ringback = new RingbackToneGenerator();
      ringbackRef.current = ringback;
      ringback.start();

      // 2. إعداد Cloudflare ودفع الصوت المحلي
      const cfService = new CloudflareCallsService();
      cfServiceRef.current = cfService;
      
      const trackName = await cfService.startPush();
      const sessionId = cfService.getSessionId();

      // 3. إنشاء سجل المكالمة في القاعدة
      const { data: callRecord, error: dbError } = await supabase
        .from('hr_audio_calls')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          conversation_id: conversationId,
          status: 'calling',
          cf_session_id: sessionId,
          metadata: { sender_track_name: trackName }
        })
        .select()
        .single();

      if (dbError) throw dbError;
      setCallId(callRecord.id);
      callIdRef.current = callRecord.id;

      // 4. إرسال إشعار OneSignal (Edge Function)
      supabase.functions.invoke('start-call', {
        body: {
          recipientId,
          callId: callRecord.id,
          callerName: user.full_name || user.username || 'زميل',
          isHrAudioCall: true,
          appUrl: window.location.origin // تمرير الرابط الحالي ديناميكياً
        }
      }).catch(err => console.error('Push notification failed:', err));

    } catch (err: any) {
      console.error('❌ startCall failed:', err);
      
      let errorMsg = 'فشل بدء المكالمة';
      if (err.message?.includes('Failed to fetch') || err.name === 'FunctionsFetchError') {
        errorMsg = 'فشل الاتصال بخدمة المكالمات (Edge Function). يرجى التأكد من نشر الوظائف.';
      } else if (err.message?.includes('getUserMedia')) {
        errorMsg = 'يرجى السماح بالوصول للميكروفون للمتابعة';
      }

      toast.error(errorMsg, { duration: 5000 });
      cleanupCall();
    }
  }, [user, status, cleanupCall]);

  /**
   * قبول المكالمة (المستقبل)
   */
  const acceptCall = useCallback(async () => {
    if (!callId || !user) return;

    try {
      console.log('📞 Accepting incoming call...');
      globalAudioManager.stopAllAudio();
      setStatus('active');

      // 1. جلب بيانات المكالمة (للحصول على مسار المرسل)
      const { data: callData, error: fetchErr } = await supabase
        .from('hr_audio_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (fetchErr || !callData) throw new Error('Call not found');

      // 2. إعداد Cloudflare ودفع الصوت المحلي
      const cfService = new CloudflareCallsService();
      cfServiceRef.current = cfService;

      const trackName = await cfService.startPush();
      const receiverSessionId = cfService.getSessionId();

      // 3. تحديث السجل لإبلاغ المرسل
      await supabase
        .from('hr_audio_calls')
        .update({
          status: 'active',
          receiver_cf_session_id: receiverSessionId,
          receiver_track_name: trackName
        })
        .eq('id', callId);

      // 4. سحب صوت المرسل
      const senderTrackName = callData.metadata?.sender_track_name || 'audio-main';
      const pc = await cfService.startPull(senderTrackName, (stream) => {
        setRemoteStream(stream);
      });
      pullPcRef.current = pc;

    } catch (err: any) {
      console.error('❌ acceptCall failed:', err);
      toast.error('حدث خطأ أثناء قبول المكالمة');
      cleanupCall();
    }
  }, [callId, user, cleanupCall]);

  /**
   * إنهاء المكالمة
   */
  const endCall = useCallback(async () => {
    const currentId = callIdRef.current;
    cleanupCall();

    if (currentId) {
      await supabase
        .from('hr_audio_calls')
        .update({ 
          status: 'ended', 
          ended_at: new Date().toISOString() 
        })
        .eq('id', currentId);
    }
  }, [cleanupCall]);

  /**
   * كتم الميكروفون
   */
  const toggleMute = useCallback(() => {
    if (cfServiceRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      
      // الحصول على المسارات الصوتية وتعطيلها/تفعيلها
      const stream = (cfServiceRef.current as any).localStream;
      if (stream) {
        stream.getAudioTracks().forEach((track: any) => {
          track.enabled = !newMuted;
        });
      }
    }
  }, [isMuted]);

  /**
   * تحويل الصوت لمكبر الصوت
   */
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerPhone(prev => !prev);
  }, []);

  // المرجع للقيم المستقرة
  const value = useMemo(() => ({
    callId, status, isIncoming, remotePeer, remoteStream,
    startCall, acceptCall, endCall, toggleMute, isMuted,
    isSpeakerPhone, toggleSpeaker
  }), [
    callId, status, isIncoming, remotePeer, remoteStream,
    startCall, acceptCall, endCall, toggleMute, isMuted,
    isSpeakerPhone, toggleSpeaker
  ]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay />
    </CallContext.Provider>
  );
}

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
