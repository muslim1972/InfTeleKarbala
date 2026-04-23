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
   */
  async startPull(remoteTrackName: string, remoteSessionId: string, onStream: (stream: MediaStream) => void): Promise<RTCPeerConnection> {
    if (!this.pc || !this.sessionId) {
      throw new Error('Push session must be started before Pull');
    }

    console.log(`📡 [CF Service] Starting Pull for track: ${remoteTrackName} from session: ${remoteSessionId}`);

    // 1. إعداد مستمع المسارات
    this.pc.ontrack = (event) => {
      console.log('📡 [CF Service] Remote track event received');
      if (event.streams && event.streams[0]) {
        onStream(event.streams[0]);
      }
    };

    // 2. طلب سحب المسار من Cloudflare (مع تمرير sessionId للمصدر)
    const pullData = await this.handleCFAPI('addTracks', this.sessionId, {
      tracks: [{
        location: 'remote',
        trackName: remoteTrackName,
        sessionId: remoteSessionId // الربط بين الجلستين
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
