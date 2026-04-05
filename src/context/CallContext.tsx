/**
 * CallContext.tsx
 * 
 * نظام المكالمات الصوتية - تم تحويله بالكامل إلى Cloudflare Calls SFU
 * يعتمد على جدول 'hr_audio_calls' لتبادل معرفات الجلسات (Session IDs)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';
import { CallOverlay } from '../components/call/CallOverlay';

interface CallContextType {
  callId: string | null;
  status: 'idle' | 'ringing' | 'active' | 'ended';
  isIncoming: boolean;
  remotePeer: { id: string, name: string, avatar?: string } | null;
  startCall: (recipientId: string, conversationId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  isMuted: boolean;
  remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
  bundlePolicy: 'max-bundle',
};

// نغمة رنين واقعية (تردد مزدوج 440Hz + 480Hz مع إيقاع هاتف)
function createRingtone(): { start: () => void; stop: () => void } {
  let audioCtx: AudioContext | null = null;
  let osc1: OscillatorNode | null = null;
  let osc2: OscillatorNode | null = null;
  let gainNode: GainNode | null = null;
  let intervalId: number | null = null;

  return {
    start: () => {
      try {
        audioCtx = new AudioContext();
        gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
        gainNode.gain.value = 0;

        osc1 = audioCtx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 440;
        
        osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 480;

        const merger = audioCtx.createGain();
        merger.gain.value = 0.5;
        merger.connect(gainNode);
        
        osc1.connect(merger);
        osc2.connect(merger);
        osc1.start();
        osc2.start();

        let step = 0;
        intervalId = window.setInterval(() => {
          if (gainNode && audioCtx) {
            const t = audioCtx.currentTime;
            if (step % 3 === 0) {
              gainNode.gain.setTargetAtTime(0.25, t, 0.02);
            } else {
              gainNode.gain.setTargetAtTime(0, t, 0.05);
            }
            step++;
          }
        }, 700);
      } catch (e) {
        console.warn('Ringtone failed:', e);
      }
    },
    stop: () => {
      if (intervalId) clearInterval(intervalId);
      try {
        osc1?.stop(); osc2?.stop(); audioCtx?.close();
      } catch (_) { }
      osc1 = null; osc2 = null; gainNode = null; audioCtx = null; intervalId = null;
    }
  };
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'ringing' | 'active' | 'ended'>('idle');
  const [isIncoming, setIsIncoming] = useState(false);
  const [remotePeer, setRemotePeer] = useState<{ id: string, name: string, avatar?: string } | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  
  // حفظ Session ID المحلي والبعيد
  const myCfSessionIdRef = useRef<string | null>(null);
  const isPulledRef = useRef(false);

  // --- دوال مساعدة لطلب Cloudflare عبر Vercel API ---
  const handleCFAPI = async (action: string, payload: any = {}, sessionId?: string) => {
    const res = await fetch('/api/cloudflare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, sessionId, payload })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  /**
   * تنظيف كامل لجميع الموارد
   */
  const cleanupCall = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    setStatus('idle');
    setCallId(null);
    setRemotePeer(null);
    setRemoteStream(null);
    setIsIncoming(false);
    setIsMuted(false);
    myCfSessionIdRef.current = null;
    isPulledRef.current = false;
  }, []);

  /**
   * الاستماع للمكالمات الواردة (Realtime)
   */
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('calls-inbound')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hr_audio_calls', filter: `recipient_id=eq.${user.id}` },
        async (payload) => {
          const newCall = payload.new;
          if (newCall.status === 'calling') {
            cleanupCall();
            setIsIncoming(true);
            setCallId(newCall.id);
            setStatus('ringing');
            
            const ringtone = createRingtone();
            ringtoneRef.current = ringtone;
            ringtone.start();
            
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', newCall.sender_id).single();
            setRemotePeer({
              id: newCall.sender_id,
              name: profile?.username || 'مستخدم',
              avatar: profile?.avatar_url
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, cleanupCall]);

  /**
   * سحب مسار الطرف الآخر عند توفر الـ Session الخاص به
   */
  const pullRemoteTrack = useCallback(async (mySessionId: string, remoteSessionId: string) => {
    if (isPulledRef.current || !pcRef.current) return;
    isPulledRef.current = true; // منع التكرار

    try {
      const data = await handleCFAPI('addTracks', {
        tracks: [{ location: 'remote', sessionId: remoteSessionId, trackName: 'audio-main' }]
      }, mySessionId);

      // Cloudflare SFU يعيد SDP Offer في حالة السحب (Pull)
      if (data.sessionDescription && data.sessionDescription.type === 'offer') {
        const pc = pcRef.current;
        await pc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // إرسال Answer للسيرفر عبر renegotiate
        await handleCFAPI('renegotiate', {
          sessionDescription: { type: 'answer', sdp: answer.sdp }
        }, mySessionId);
      }
    } catch (err) {
      console.error('Failed to pull remote track:', err);
      isPulledRef.current = false;
    }
  }, []);

  /**
   * تحديثات حالة المكالمة
   */
  useEffect(() => {
    if (!callId || !user) return;

    const statusChannel = supabase
      .channel(`call-status-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hr_audio_calls', filter: `id=eq.${callId}` },
        async (payload) => {
          const updated = payload.new;
          
          if (updated.status === 'ended' || updated.status === 'missed' || updated.status === 'rejected') {
            cleanupCall();
            return;
          }
          
          // إذا كنت أنا المُتصل، والمستقبل رد ووضع الـ session الخاص به
          if (!isIncoming && updated.status === 'active' && updated.receiver_cf_session_id && myCfSessionIdRef.current) {
            setStatus('active');
            ringtoneRef.current?.stop();
            await pullRemoteTrack(myCfSessionIdRef.current, updated.receiver_cf_session_id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(statusChannel); };
  }, [callId, user, isIncoming, cleanupCall, pullRemoteTrack]);

  /**
   * التقاط المايكروفون ودفع المسار لـ Cloudflare
   */
  const pushLocalTrack = async () => {
    // 1. إنشاء Session
    const sessionData = await handleCFAPI('createSession');
    const sessionId = sessionData.sessionId;
    myCfSessionIdRef.current = sessionId;

    // 2. التقاط الصوت
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    // 3. إعداد PC
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      pc.addTrack(audioTrack, stream);
    }

    // 4. إنشاء SDP Offer ودفعه لـ CF
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const pushData = await handleCFAPI('addTracks', {
      sessionDescription: { type: 'offer', sdp: offer.sdp },
      tracks: [{ location: 'local', trackName: 'audio-main', mid: pc.getTransceivers()[0]?.mid }]
    }, sessionId);

    // 5. استقبال SDP Answer
    if (pushData.sessionDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: pushData.sessionDescription.sdp }));
    }

    return sessionId;
  };

  /**
   * بدء مكالمة (المُرسل)
   */
  const startCall = async (recipientId: string, conversationId: string) => {
    if (!user) return;
    cleanupCall();
    
    try {
      setStatus('ringing');
      setIsIncoming(false);
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', recipientId).single();
      setRemotePeer({
        id: recipientId,
        name: profile?.username || 'مستخدم',
        avatar: profile?.avatar_url
      });

      const ringtone = createRingtone();
      ringtoneRef.current = ringtone;
      ringtone.start();

      // دفع الصوت لـ CF
      const sessionId = await pushLocalTrack();
      
      // حفظ الجلسة في الجدول الجديد hr_audio_calls
      const { data: callRecord, error: dbError } = await supabase
        .from('hr_audio_calls')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          conversation_id: conversationId,
          status: 'calling',
          cf_session_id: sessionId
        })
        .select()
        .single();

      if (dbError) throw dbError;
      setCallId(callRecord.id);

      // إرسال إشعار للمستقبل (لا يوقف العملية)
      supabase.functions.invoke('start-call', {
        body: { 
          recipientId, 
          callId: callRecord.id,
          callerName: user.full_name || 'زميل',
          url: window.location.origin,
          isHrAudioCall: true
        }
      }).catch(() => {});

    } catch (err) {
      toast.error('لم نتمكن من بدء المكالمة');
      cleanupCall();
    }
  };

  /**
   * الرد على المكالمة (المُستقبِل)
   */
  const acceptCall = async () => {
    if (!callId || !user) return;
    try {
      ringtoneRef.current?.stop();
      
      const { data: callData, error: fetchErr } = await supabase
        .from('hr_audio_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (fetchErr || !callData) throw new Error('Call not found');

      // 1. دفع صوتي الشخصي للـ SFU 
      const mySessionId = await pushLocalTrack();

      // 2. سحب صوت المُرسل
      if (callData.cf_session_id) {
        await pullRemoteTrack(mySessionId, callData.cf_session_id);
      }

      // 3. إبلاغ المرسل بـ session الخاصي بي
      await supabase.from('hr_audio_calls').update({
        status: 'active',
        receiver_cf_session_id: mySessionId
      }).eq('id', callId);

      setStatus('active');
    } catch (err) {
      toast.error('حدث خطأ أثناء الاتصال');
      cleanupCall();
    }
  };

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, []);

  const endCall = async () => {
    const currentCallId = callId;
    cleanupCall();
    if (currentCallId) {
      await supabase.from('hr_audio_calls').update({ 
        status: 'ended', 
        ended_at: new Date().toISOString() 
      }).eq('id', currentCallId);
    }
  };

  return (
    <CallContext.Provider value={{ 
      callId, status, isIncoming, remotePeer, remoteStream,
      startCall, acceptCall, endCall, toggleMute, isMuted 
    }}>
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
