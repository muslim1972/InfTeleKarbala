// src/services/CloudflareCallsService.ts
import { supabase } from '../lib/supabase';

export class CloudflareCallsService {
  private pc: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private localStream: MediaStream | null = null;

  constructor() {
    // تكوين PeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }]
    });
  }

  /**
   * استدعاء الـ Edge Function للتعامل مع Cloudflare
   */
  private async handleCFAPI(action: string, sessionId?: string, payload?: any) {
    console.log(`📡 [CF Service] Calling Edge Function: ${action}`, { sessionId, hasPayload: !!payload });
    const { data, error } = await supabase.functions.invoke('handle-cloudflare-call', {
      body: { action, sessionId, payload }
    });

    if (error) {
      console.error(`❌ [CF Service] Edge Function Error (${action}):`, error);
      throw error;
    }
    console.log(`✅ [CF Service] Edge Function Success (${action}):`, data);
    return data;
  }

  /**
   * بدء دفع الصوت (Local Mic)
   */
  async startPush(): Promise<string> {
    try {
      // 1. الحصول على الميكروفون
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.localStream.getTracks().forEach(track => {
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });

      // 2. إنشاء Offer
      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);

      // 3. توليد اسم المسار مسبقاً
      const localTrackName = `audio-${Date.now()}`;

      // 4. إنشاء جلسة في Cloudflare مع المسارات مباشرة
      console.log('📡 [CF Service] Creating session with track:', localTrackName);
      const sessionData = await this.handleCFAPI('createSession', undefined, {
        sessionDescription: {
          type: 'offer',
          sdp: offer.sdp
        },
        // إضافة المسار هنا مباشرة يجعل الجلسة مستقرة فوراً
        tracks: [{
          location: 'local',
          mid: this.pc!.getTransceivers()[0].mid,
          trackName: localTrackName
        }]
      });

      this.sessionId = sessionData.sessionId;

      // 5. ضبط الـ Answer من Cloudflare
      await this.pc!.setRemoteDescription(new RTCSessionDescription(sessionData.sessionDescription));

      return localTrackName;
    } catch (error) {
      console.error('❌ startPush failed:', error);
      throw error;
    }
  }

  /**
   * سحب صوت الطرف الآخر (Pull)
   * نستخدم RTCPeerConnection منفصل لكل عملية سحب كما في ShamilApp
   */
  async startPull(remoteTrackName: string, onStream: (stream: MediaStream) => void): Promise<RTCPeerConnection> {
    try {
      console.log(`📡 [CF Service] Starting Pull for track: ${remoteTrackName}`);
      
      const pullPc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // إعداد مستمع المسارات القادمة
      pullPc.ontrack = (event) => {
        console.log('📡 [CF Service] Remote track received!');
        if (event.streams && event.streams[0]) {
          onStream(event.streams[0]);
        }
      };

      // 1. طلب "سحب" المسار عبر Edge Function
      // ملاحظة: لا نحتاج لتمرير remoteSessionId لأن أسماء المسارات فريدة في التطبيق
      const data = await this.handleCFAPI('addTracks', this.sessionId!, {
        tracks: [{
          location: 'remote',
          trackName: remoteTrackName
        }]
      });

      if (!data || !data.sessionDescription) {
        throw new Error('Cloudflare did not return a sessionDescription for Pull');
      }

      // 2. تثبيت الـ Remote Description (Offer من Cloudflare)
      console.log('📡 [CF Service] Setting remote offer');
      await pullPc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
      
      // 3. إنشاء الـ Answer محلياً
      console.log('📡 [CF Service] Creating answer');
      const answer = await pullPc.createAnswer();
      await pullPc.setLocalDescription(answer);

      // 4. تأكيد المصافحة (Renegotiate) عبر Edge Function لإتمام الربط
      console.log('📡 [CF Service] Sending renegotiate answer');
      await this.handleCFAPI('renegotiate', this.sessionId!, {
        sessionDescription: {
          type: 'answer',
          sdp: answer.sdp
        }
      });

      console.log('✅ [CF Service] Remote audio pull complete');
      return pullPc;
    } catch (error) {
      console.error('❌ [CF Service] Error pulling remote audio:', error);
      throw error;
    }
  }

  getSessionId() {
    return this.sessionId;
  }

  stop() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}
