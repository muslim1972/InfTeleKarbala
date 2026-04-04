/**
 * CallContext.tsx
 * 
 * نظام المكالمات الصوتية - WebRTC مباشر (P2P)
 * يستخدم Supabase Realtime كـ Signaling Server لتبادل SDP و ICE Candidates
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
  remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

// نغمة رنين بسيطة باستخدام Web Audio API
function createRingtone(): { start: () => void; stop: () => void } {
  let audioCtx: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  let gainNode: GainNode | null = null;
  let intervalId: number | null = null;

  return {
    start: () => {
      try {
        audioCtx = new AudioContext();
        gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
        gainNode.gain.value = 0;

        oscillator = audioCtx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 440;
        oscillator.connect(gainNode);
        oscillator.start();

        // نمط رنين: تشغيل/إيقاف كل ثانية
        let isOn = false;
        intervalId = window.setInterval(() => {
          if (gainNode) {
            isOn = !isOn;
            gainNode.gain.setTargetAtTime(isOn ? 0.3 : 0, audioCtx!.currentTime, 0.05);
          }
        }, 800);
      } catch (e) {
        console.warn('Ringtone failed:', e);
      }
    },
    stop: () => {
      if (intervalId) clearInterval(intervalId);
      oscillator?.stop();
      audioCtx?.close();
      oscillator = null;
      gainNode = null;
      audioCtx = null;
      intervalId = null;
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
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);

  /**
   * تنظيف كامل لجميع موارد المكالمة
   */
  const cleanupCall = useCallback(() => {
    console.log('🧹 Cleaning up call resources...');
    
    // إيقاف النغمة
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
    
    // إيقاف الميكروفون
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`🎙️ Track stopped: ${track.kind}`);
      });
      localStreamRef.current = null;
    }
    
    // إغلاق PeerConnection
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
      console.log('🔌 PeerConnection closed');
    }
    
    // إعادة ضبط الحالة
    setStatus('idle');
    setCallId(null);
    setRemotePeer(null);
    setRemoteStream(null);
    setIsIncoming(false);
    console.log('✅ Call cleanup complete');
  }, []);

  /**
   * الاستماع للمكالمات الواردة
   */
  useEffect(() => {
    if (!user) return;

    console.log('📡 Listening for incoming calls for', user.id);
    const channel = supabase
      .channel('calls-inbound')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `recipient_id=eq.${user.id}` },
        async (payload) => {
          const newCall = payload.new;
          if (newCall.status === 'calling') {
            console.log('🔔 Incoming call detected!', newCall.id);
            
            // تنظيف أي مكالمة سابقة أولاً
            cleanupCall();
            
            setIsIncoming(true);
            setCallId(newCall.id);
            setStatus('ringing');
            
            // تشغيل نغمة الرنين
            const ringtone = createRingtone();
            ringtoneRef.current = ringtone;
            ringtone.start();
            
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', newCall.sender_id).single();
            setRemotePeer({
              id: newCall.sender_id,
              name: profile?.username || 'زميل',
              avatar: profile?.avatar_url
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, cleanupCall]);

  /**
   * الاستماع لتحديثات حالة المكالمة + ICE Candidates
   */
  useEffect(() => {
    if (!callId || !user) return;

    console.log(`📡 Subscribing to call updates: ${callId}`);

    const statusChannel = supabase
      .channel(`call-status-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        async (payload) => {
          const updated = payload.new;
          
          if (updated.status === 'ended' || updated.status === 'missed') {
            console.log('📞 Call ended by remote');
            cleanupCall();
            return;
          }
          
          // المرسل يستقبل الـ Answer
          if (updated.status === 'active' && updated.answer_sdp?.sdp && pcRef.current) {
            try {
              if (pcRef.current.signalingState === 'have-local-offer') {
                console.log('📥 Received Answer SDP, setting remote description...');
                await pcRef.current.setRemoteDescription(new RTCSessionDescription({
                  type: 'answer',
                  sdp: updated.answer_sdp.sdp
                }));
                setStatus('active');
                // إيقاف النغمة عند الرد
                ringtoneRef.current?.stop();
                console.log('✅ Call ACTIVE (sender side)');
              }
            } catch (err) {
              console.error('❌ Error setting remote description:', err);
            }
          }
        }
      )
      .subscribe();

    const iceChannel = supabase
      .channel(`ice-${callId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_candidates', filter: `call_id=eq.${callId}` },
        async (payload) => {
          const candidate = payload.new;
          if (candidate.sender_id !== user.id && pcRef.current) {
            try {
              if (pcRef.current.remoteDescription) {
                console.log('🧊 Adding ICE candidate');
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate.candidate));
              } else {
                console.log('🧊 Skipping ICE candidate (no remote description yet)');
              }
            } catch (err) {
              console.error('❌ Error adding ICE candidate:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log(`📡 Unsubscribing from call: ${callId}`);
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(iceChannel);
    };
  }, [callId, user, cleanupCall]);

  /**
   * إعداد PeerConnection
   */
  const createPeerConnection = useCallback((currentCallId: string, userId: string) => {
    // تنظيف أي PeerConnection قديم
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    pc.ontrack = (event) => {
      console.log('🔊 Remote audio track received!');
      if (event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };
    
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await supabase.from('call_candidates').insert({
            call_id: currentCallId,
            sender_id: userId,
            candidate: event.candidate.toJSON()
          });
        } catch (err) {
          console.error('❌ Failed to send ICE candidate:', err);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`📶 Connection: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        console.log('✅ WebRTC Connected! Audio flowing.');
      }
      if (pc.connectionState === 'failed') {
        console.error('❌ WebRTC Connection failed');
        toast.error('فشل الاتصال، حاول مرة أخرى');
        cleanupCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE: ${pc.iceConnectionState}`);
    };

    pcRef.current = pc;
    return pc;
  }, [cleanupCall]);

  /**
   * التقاط الصوت من الميكروفون
   */
  const captureAudio = useCallback(async (pc: RTCPeerConnection) => {
    // إيقاف أي ميكروفون سابق
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    console.log('🎙️ Microphone captured');
    return stream;
  }, []);

  /**
   * بدء مكالمة (المرسل)
   */
  const startCall = async (recipientId: string, conversationId: string) => {
    if (!user) return;
    
    // تنظيف أي مكالمة سابقة
    cleanupCall();
    
    // انتظار قصير للسماح بتنظيف القنوات
    await new Promise(r => { const id = window.setTimeout(() => { clearTimeout(id); r(undefined); }, 100); });
    
    try {
      setStatus('ringing');
      setIsIncoming(false);
      
      // 1. حفظ سجل المكالمة
      const { data: callRecord, error: dbError } = await supabase
        .from('calls')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          conversation_id: conversationId,
          status: 'calling'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const currentCallId = callRecord.id;
      setCallId(currentCallId);
      console.log(`📞 Call created: ${currentCallId}`);

      // 2. جلب بيانات المستقبل
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', recipientId).single();
      setRemotePeer({
        id: recipientId,
        name: profile?.username || 'مستخدم',
        avatar: profile?.avatar_url
      });

      // 3. تشغيل نغمة انتظار
      const ringtone = createRingtone();
      ringtoneRef.current = ringtone;
      ringtone.start();

      // 4. إعداد PeerConnection + التقاط الصوت
      const pc = createPeerConnection(currentCallId, user.id);
      await captureAudio(pc);
      
      // 5. إنشاء SDP Offer وحفظها في DB
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      await supabase.from('calls').update({
        offer_sdp: { type: 'offer', sdp: offer.sdp }
      }).eq('id', currentCallId);

      console.log('📤 Offer sent, waiting for answer...');
    } catch (err) {
      console.error('Failed to start call:', err);
      toast.error('لم نتمكن من بدء المكالمة حالياً');
      cleanupCall();
    }
  };

  /**
   * الرد على المكالمة (المستقبل)
   */
  const acceptCall = async () => {
    if (!callId || !user) return;
    try {
      console.log('📞 Accepting call:', callId);
      
      // إيقاف النغمة
      ringtoneRef.current?.stop();
      
      // 1. جلب بيانات المكالمة
      const { data: callData, error: fetchErr } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (fetchErr || !callData) throw fetchErr || new Error('Call not found');
      if (!callData.offer_sdp?.sdp) throw new Error('No offer SDP found');

      // 2. إعداد PeerConnection + التقاط الصوت
      const pc = createPeerConnection(callId, user.id);
      await captureAudio(pc);

      // 3. تعيين الـ Offer كـ Remote Description
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: callData.offer_sdp.sdp
      }));
      console.log('📥 Offer set as remote description');

      // 4. إنشاء Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('📤 Answer created and set as local description');

      // 5. حفظ الـ Answer في DB + تحديث الحالة
      await supabase.from('calls').update({
        status: 'active',
        answer_sdp: { type: 'answer', sdp: answer.sdp }
      }).eq('id', callId);

      setStatus('active');
      console.log('✅ Call ACTIVE (receiver side)');
    } catch (err) {
      console.error('Error accepting call:', err);
      toast.error('حدث خطأ أثناء الرد على المكالمة');
      cleanupCall();
    }
  };

  /**
   * إنهاء المكالمة
   */
  const endCall = async () => {
    const currentCallId = callId;
    cleanupCall();
    if (currentCallId) {
      await supabase.from('calls').update({ 
        status: 'ended', 
        ended_at: new Date().toISOString() 
      }).eq('id', currentCallId);
    }
  };

  return (
    <CallContext.Provider value={{ 
      callId, status, isIncoming, remotePeer, remoteStream,
      startCall, acceptCall, endCall 
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
