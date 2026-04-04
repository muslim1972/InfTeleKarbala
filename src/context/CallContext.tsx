/**
 * CallContext.tsx
 * 
 * القائد الأعلى لنظام المكالمات.
 * يدير حالة الرنين والرد والإنهاء داخل التطبيق بأكمله.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { CloudflareCallsService } from '../services/CloudflareCallsService';
import { toast } from 'react-hot-toast';
import { CallOverlay } from '../components/call/CallOverlay'; // ✨ أضفنا استيراد الواجهة الجديدة

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

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'ringing' | 'active' | 'ended'>('idle');
  const [isIncoming, setIsIncoming] = useState(false);
  const [remotePeer, setRemotePeer] = useState<{ id: string, name: string, avatar?: string } | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const cfServiceRef = useRef<CloudflareCallsService | null>(null);

  /**
   * الخطوة الأولى: الاستماع للمكالمات الواردة (Realtime)
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
            console.log('🔔 Incoming call detected!', newCall);
            setIsIncoming(true);
            setCallId(newCall.id);
            setStatus('ringing');
            
            // جلب بيانات المتصل (يمكنك تحسين هذا عبر 캐시)
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', newCall.sender_id).single();
            setRemotePeer({
              id: newCall.sender_id,
              name: profile?.username || 'زميل',
              avatar: profile?.avatar_url
            });
            
            // تهيئة خدمة كلاود فلير للمستقبل
            cfServiceRef.current = new CloudflareCallsService(newCall.cloudflare_session_id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  /**
   * الاستماع لتحديثات حالة المكالمة الحالية (الإنهاء من الطرف الآخر مثلاً)
   */
  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call-status-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        (payload) => {
          if (payload.new.status === 'ended' || payload.new.status === 'missed') {
            handleCallEndLocally();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [callId]);

  const handleCallEndLocally = useCallback(() => {
    cfServiceRef.current?.stop();
    cfServiceRef.current = null;
    setStatus('idle');
    setCallId(null);
    setRemotePeer(null);
    setRemoteStream(null);
    setIsIncoming(false);
    console.log('📞 Call ended and cleaned up locally');
  }, []);

  /**
   * بدء مكالمة جديدة
   */
  const startCall = async (recipientId: string, conversationId: string) => {
    if (!user) return;
    try {
      setStatus('ringing');
      setIsIncoming(false);
      
      // 1. إنشاء RTCPeerConnection وتهيئة الصوت
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      // 2. التقاط صوت الميكروفون
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
      
      // 3. إنشاء SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('🎙️ SDP Offer created, sending to server...');
      
      // 4. إرسال الـ Offer للدالة السحابية
      const { data, error } = await supabase.functions.invoke('start-call', {
        body: { 
          recipientId, 
          conversationId,
          sdpOffer: offer.sdp,
          senderId: user.id
        }
      });
      
      if (error) throw error;
      
      // 5. تطبيق SDP Answer من Cloudflare
      if (data.sdpAnswer) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer));
        console.log('✅ Remote description set from Cloudflare');
      }
      
      // 6. حفظ المراجع
      setCallId(data.callId);
      cfServiceRef.current = new CloudflareCallsService(data.sessionId);
      // حفظ الـ PeerConnection بداخل الخدمة
      (cfServiceRef.current as any)._externalPc = pc;
      (cfServiceRef.current as any)._externalStream = localStream;
      
      toast.success('جاري الاتصال بزميلك...');
    } catch (err) {
      console.error('Failed to start call:', err);
      toast.error('لم نتمكن من بدء المكالمة حالياً');
      setStatus('idle');
    }
  };

  /**
   * الرد على المكالمة
   */
  const acceptCall = async () => {
    if (!callId || !cfServiceRef.current) return;
    try {
      setStatus('active');
      
      // 1. جلب الـ track الخاص بالمرسل
      const { data: callData } = await supabase.from('calls').select('*').eq('id', callId).single();
      const remoteTrackName = callData.offer_sdp?.audioTrack;
      
      if (remoteTrackName) {
        await cfServiceRef.current.startPull(remoteTrackName, (stream) => {
          setRemoteStream(stream); // هذا هو الصوت القادم من الطرف الآخر!
        });
      }

      // 2. البدء ببث صوتي أنا أيضاً (بشكل تبادلي)
      const myTrackName = await cfServiceRef.current.startPush();
      
      // 3. تحديث الحالة
      await supabase.from('calls').update({ 
        status: 'active',
        answer_sdp: { audioTrack: myTrackName }
      }).eq('id', callId);

    } catch (err) {
      console.error('Error accepting call:', err);
      endCall();
    }
  };

  /**
   * إنهاء المكالمة
   */
  const endCall = async () => {
    if (!callId) return;
    await supabase.from('calls').update({ status: 'ended', ended_at: new Date() }).eq('id', callId);
    handleCallEndLocally();
  };

  return (
    <CallContext.Provider value={{ 
      callId, status, isIncoming, remotePeer, remoteStream,
      startCall, acceptCall, endCall 
    }}>
      {children}
      <CallOverlay /> {/* ✨ الواجهة ستظهر هنا تلقائياً عند تغيير الحالة */}
    </CallContext.Provider>
  );
}

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
