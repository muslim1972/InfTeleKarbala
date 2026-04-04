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

// ICE Servers للاتصال
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'ringing' | 'active' | 'ended'>('idle');
  const [isIncoming, setIsIncoming] = useState(false);
  const [remotePeer, setRemotePeer] = useState<{ id: string, name: string, avatar?: string } | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const candidateChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /**
   * الخطوة الأولى: الاستماع للمكالمات الواردة
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
            setIsIncoming(true);
            setCallId(newCall.id);
            setStatus('ringing');
            
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
  }, [user]);

  /**
   * الاستماع لتحديثات حالة المكالمة (إنهاء/رد)
   */
  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call-status-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        async (payload) => {
          const updated = payload.new;
          
          if (updated.status === 'ended' || updated.status === 'missed') {
            handleCallEndLocally();
            return;
          }
          
          // المرسل يستقبل الـ Answer من المستقبل
          if (updated.status === 'active' && updated.answer_sdp && !isIncoming && pcRef.current) {
            try {
              console.log('📥 Received Answer SDP from receiver');
              const answerSdp = updated.answer_sdp;
              if (pcRef.current.signalingState === 'have-local-offer') {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription({
                  type: 'answer',
                  sdp: answerSdp.sdp
                }));
                setStatus('active');
                console.log('✅ Call is now ACTIVE (sender side)');
              }
            } catch (err) {
              console.error('❌ Error setting remote description:', err);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [callId, isIncoming]);

  /**
   * الاستماع لـ ICE Candidates من الطرف الآخر
   */
  useEffect(() => {
    if (!callId || !user) return;

    const channel = supabase
      .channel(`ice-${callId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_candidates', filter: `call_id=eq.${callId}` },
        async (payload) => {
          const candidate = payload.new;
          // فقط أضف candidates الطرف الآخر (ليس candidates التي أنا أرسلتها)
          if (candidate.sender_id !== user.id && pcRef.current) {
            try {
              console.log('🧊 Received ICE candidate from peer');
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate.candidate));
            } catch (err) {
              console.error('❌ Error adding ICE candidate:', err);
            }
          }
        }
      )
      .subscribe();

    candidateChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [callId, user]);

  // تنظيف المكالمة محلياً
  const handleCallEndLocally = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    if (candidateChannelRef.current) {
      supabase.removeChannel(candidateChannelRef.current);
      candidateChannelRef.current = null;
    }
    setStatus('idle');
    setCallId(null);
    setRemotePeer(null);
    setRemoteStream(null);
    setIsIncoming(false);
    console.log('📞 Call ended and cleaned up');
  }, []);

  /**
   * إعداد PeerConnection مشترك
   */
  const setupPeerConnection = useCallback((currentCallId: string, userId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // عند استقبال صوت من الطرف الآخر
    pc.ontrack = (event) => {
      console.log('🔊 Remote track received!', event.streams.length);
      if (event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };
    
    // عند توفر ICE Candidate جديد → أرسله للطرف الآخر عبر DB
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate...');
        await supabase.from('call_candidates').insert({
          call_id: currentCallId,
          sender_id: userId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`📶 Connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        console.log('✅ WebRTC Connected! Audio should flow now.');
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.log('⚠️ Connection lost');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE state: ${pc.iceConnectionState}`);
    };

    pcRef.current = pc;
    return pc;
  }, []);

  /**
   * بدء مكالمة (المرسل)
   */
  const startCall = async (recipientId: string, conversationId: string) => {
    if (!user) return;
    try {
      setStatus('ringing');
      setIsIncoming(false);
      
      // 1. حفظ سجل المكالمة في DB أولاً
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

      // 3. إعداد PeerConnection + التقاط الصوت
      const pc = setupPeerConnection(currentCallId, user.id);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      // 4. إنشاء SDP Offer وحفظها في DB
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      await supabase.from('calls').update({
        offer_sdp: { type: 'offer', sdp: offer.sdp }
      }).eq('id', currentCallId);

      console.log('📤 Offer sent, waiting for answer...');
      toast.success('جاري الاتصال بزميلك...');
    } catch (err) {
      console.error('Failed to start call:', err);
      toast.error('لم نتمكن من بدء المكالمة حالياً');
      setStatus('idle');
    }
  };

  /**
   * الرد على المكالمة (المستقبل)
   */
  const acceptCall = async () => {
    if (!callId || !user) return;
    try {
      console.log('📞 Accepting call:', callId);
      
      // 1. جلب بيانات المكالمة (تحتوي على Offer SDP)
      const { data: callData, error: fetchErr } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (fetchErr || !callData) throw fetchErr || new Error('Call not found');

      const offerSdp = callData.offer_sdp;
      if (!offerSdp?.sdp) throw new Error('No offer SDP found');

      // 2. إعداد PeerConnection + التقاط الصوت
      const pc = setupPeerConnection(callId, user.id);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 3. تعيين الـ Offer كـ Remote Description
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp.sdp
      }));
      console.log('📥 Offer set as remote description');

      // 4. إنشاء Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('📤 Answer created');

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
      endCall();
    }
  };

  /**
   * إنهاء المكالمة
   */
  const endCall = async () => {
    if (!callId) {
      handleCallEndLocally();
      return;
    }
    await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId);
    handleCallEndLocally();
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
