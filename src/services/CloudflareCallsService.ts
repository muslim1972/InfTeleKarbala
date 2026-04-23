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

      // 3. إنشاء جلسة في Cloudflare
      const sessionData = await this.handleCFAPI('createSession', undefined, {
        sessionDescription: {
          type: 'offer',
          sdp: offer.sdp
        }
      });

      this.sessionId = sessionData.sessionId;

      // 4. ضبط الـ Answer من Cloudflare
      await this.pc!.setRemoteDescription(new RTCSessionDescription(sessionData.sessionDescription));

      // 5. إضافة المسار (Track) للجلسة
      const trackData = await this.handleCFAPI('addTracks', this.sessionId!, {
        tracks: [{
          location: 'local',
          mid: this.pc!.getTransceivers()[0].mid,
          trackName: `audio-${Date.now()}`
        }]
      });

      return trackData.tracks[0].trackName;
    } catch (error) {
      console.error('❌ startPush failed:', error);
      throw error;
    }
  }

  /**
   * سحب صوت الطرف الآخر (Pull)
   * نستخدم نفس الاتصال (this.pc) لضمان توافق الجلسة مع Cloudflare
   */
  async startPull(remoteTrackName: string, onStream: (stream: MediaStream) => void): Promise<RTCPeerConnection> {
    if (!this.pc || !this.sessionId) {
      throw new Error('Push session must be started before Pull');
    }

    console.log(`📡 [CF Service] Starting Pull for track: ${remoteTrackName}`);

    // 1. إعداد مستمع المسارات (ontrack) على نفس الاتصال
    this.pc.ontrack = (event) => {
      console.log('📡 [CF Service] Remote track event received');
      if (event.streams && event.streams[0]) {
        onStream(event.streams[0]);
      }
    };

    // 2. طلب سحب المسار من Cloudflare
    const pullData = await this.handleCFAPI('addTracks', this.sessionId, {
      tracks: [{
        location: 'remote',
        trackName: remoteTrackName
      }]
    });

    // 3. ضبط الـ Offer القادم من Cloudflare (كموصف بعيد)
    console.log('📡 [CF Service] Setting remote description (Offer from CF)');
    await this.pc.setRemoteDescription(new RTCSessionDescription(pullData.sessionDescription));

    // 4. إنشاء الـ Answer محلياً
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    // 5. إرسال الـ Answer لـ Cloudflare لإتمام الربط
    await this.handleCFAPI('renegotiate', this.sessionId, {
      sessionDescription: {
        type: 'answer',
        sdp: answer.sdp
      }
    });

    return this.pc;
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
