/**
 * CallContext.tsx
 * 
 * نظام المكالمات المحدث باستخدام LiveKit لضمان جودة عالية للاتصال الصوتي والمرئي
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';
import { CallOverlayWrapper } from '../components/call/CallOverlayWrapper';
import { globalAudioManager } from '../services/GlobalAudioManager';
import { RingbackToneGenerator } from '../services/RingbackToneGenerator';

export type CallStatus = 'idle' | 'ringing' | 'active' | 'ended';

interface CallContextType {
  callId: string | null;
  status: CallStatus;
  isIncoming: boolean;
  isVideoCall: boolean;
  remotePeer: { id: string, name: string, avatar?: string } | null;
  startCall: (recipientId: string, conversationId: string, isVideo?: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  endCall: () => Promise<void>;
  livekitToken: string | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // States
  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isIncoming, setIsIncoming] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [remotePeer, setRemotePeer] = useState<{ id: string, name: string, avatar?: string } | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);

  // Refs
  const ringbackRef = useRef<RingbackToneGenerator | null>(null);
  const callIdRef = useRef<string | null>(null);

  const cleanupCall = useCallback(() => {
    console.log('📞 Cleaning up call resources...');
    globalAudioManager.stopAllAudio();
    if (ringbackRef.current) {
      ringbackRef.current.stop();
      ringbackRef.current = null;
    }
    setStatus('idle');
    setCallId(null);
    callIdRef.current = null;
    setRemotePeer(null);
    setIsIncoming(false);
    setIsVideoCall(false);
    setLivekitToken(null);
  }, []);

  const fetchToken = async (roomId: string) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: { 
          roomName: roomId, 
          participantName: user.full_name || user.username || 'User',
          participantId: user.id
        }
      });
      if (error) throw error;
      return data.token;
    } catch (err) {
      console.error('Error fetching LiveKit token:', err);
      return null;
    }
  };

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('hr-calls-inbound')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hr_audio_calls', filter: `recipient_id=eq.${user.id}` },
        async (payload) => {
          const newCall = payload.new;
          if (newCall.status === 'calling' && newCall.id !== callIdRef.current && status === 'idle') {
            setCallId(newCall.id);
            callIdRef.current = newCall.id;
            setIsIncoming(true);
            setIsVideoCall(newCall.metadata?.is_video || false);
            setStatus('ringing');

            globalAudioManager.startAlert().catch(() => console.warn('Autoplay blocked'));

            const { data: profiles } = await supabase.rpc('get_available_profiles_by_ids', { profile_ids: [newCall.sender_id] });
            const profile = profiles?.[0];
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
  }, [user, status]);

  useEffect(() => {
    if (!callId || !user) return;

    const statusChannel = supabase
      .channel(`hr-call-status-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hr_audio_calls', filter: `id=eq.${callId}` },
        async (payload) => {
          const updated = payload.new;
          if (['ended', 'missed', 'rejected'].includes(updated.status)) {
            cleanupCall();
            return;
          }

          // Caller sees that recipient accepted
          if (!isIncoming && updated.status === 'active' && status !== 'active') {
            if (ringbackRef.current) ringbackRef.current.stop();
            const token = await fetchToken(callId);
            if (token) {
              setLivekitToken(token);
              setStatus('active');
            } else {
              toast.error('فشل الاتصال بخادم LiveKit');
              cleanupCall();
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(statusChannel); };
  }, [callId, user, isIncoming, status, cleanupCall]);

  const startCall = useCallback(async (recipientId: string, conversationId: string, isVideo = false) => {
    if (!user || status !== 'idle') return;

    try {
      setStatus('ringing');
      setIsIncoming(false);
      setIsVideoCall(isVideo);
      
      const { data: profiles } = await supabase.rpc('get_available_profiles_by_ids', { profile_ids: [recipientId] });
      const profile = profiles?.[0];
      setRemotePeer({ id: recipientId, name: profile?.username || 'زميل', avatar: profile?.avatar_url });

      const ringback = new RingbackToneGenerator();
      ringbackRef.current = ringback;
      ringback.start();

      const { data: callRecord, error: dbError } = await supabase
        .from('hr_audio_calls')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          conversation_id: conversationId,
          status: 'calling',
          metadata: { is_video: isVideo }
        })
        .select().single();

      if (dbError) throw dbError;
      setCallId(callRecord.id);
      callIdRef.current = callRecord.id;

      supabase.functions.invoke('start-call', {
        body: {
          recipientId, callId: callRecord.id, callerName: user.full_name || user.username || 'زميل',
          isHrAudioCall: true, appUrl: window.location.origin, isVideo
        }
      }).catch(console.error);

    } catch (err: any) {
      toast.error('فشل بدء المكالمة');
      cleanupCall();
    }
  }, [user, status, cleanupCall]);

  const acceptCall = useCallback(async () => {
    if (!callId || !user) return;

    try {
      globalAudioManager.stopAllAudio();
      
      const token = await fetchToken(callId);
      if (!token) throw new Error('Token generation failed');

      setLivekitToken(token);
      setStatus('active');

      const { error } = await supabase
        .from('hr_audio_calls')
        .update({ status: 'active' })
        .eq('id', callId);

      if (error) throw error;

    } catch (err: any) {
      toast.error('فشل قبول المكالمة');
      cleanupCall();
    }
  }, [callId, user, cleanupCall]);

  const endCall = useCallback(async () => {
    const currentId = callIdRef.current;
    cleanupCall();
    if (currentId) {
      await supabase.from('hr_audio_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', currentId);
    }
  }, [cleanupCall]);

  const value = useMemo(() => ({
    callId, status, isIncoming, isVideoCall, remotePeer, livekitToken,
    startCall, acceptCall, endCall
  }), [callId, status, isIncoming, isVideoCall, remotePeer, livekitToken, startCall, acceptCall, endCall]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlayWrapper />
    </CallContext.Provider>
  );
}

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
