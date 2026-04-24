// src/services/CloudflareCallsService.ts
import { supabase } from '../lib/supabase';

export class CloudflareCallsService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private sessionId: string | null = null;

  constructor(sessionId?: string | null) {
    this.sessionId = sessionId || null;
    // تهيئة الـ PeerConnection مع خوادم Google STUN لضمان تجاوز جدران الحماية
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  }

  getSessionId() {
    return this.sessionId;
  }

  /**
   * استدعاء الـ Edge Function
   */
  private async handleCFAPI(action: string, sessionId?: string, payload?: any) {
    const { data, error } = await supabase.functions.invoke('handle-cloudflare-call', {
      body: { action, sessionId, payload }
    });
    if (error) throw error;
    return data;
  }

  /**
   * بدء بث الصوت من الميكروفون
   */
  async startPush(): Promise<string> {
    try {
      // 1. طلب الإذن للميكروفون
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      
      // 2. إضافة المسار الصوتي للاتصال
      this.localStream.getTracks().forEach(track => {
        this.pc?.addTrack(track, this.localStream!);
      });

      // 3. إنشاء الـ Offer التقني الأول
      let offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);

      // 4. إنشاء الجلسة إذا لم تكن موجودة
      if (!this.sessionId) {
          const sessionData = await this.handleCFAPI('createSession', undefined, {
            sessionDescription: { type: 'offer', sdp: offer.sdp }
          });
          this.sessionId = sessionData.sessionId;
          await this.pc!.setRemoteDescription(new RTCSessionDescription(sessionData.sessionDescription));
          
          // تحديث الـ Offer للتأكد من المزامنة قبل إضافة المسار
          offer = await this.pc!.createOffer();
          await this.pc!.setLocalDescription(offer);
      }

      // 5. إرسال المسار
      const trackId = `audio-${Date.now()}`;
      const data = await this.handleCFAPI('addTracks', this.sessionId!, {
        sessionDescription: {
          type: 'offer',
          sdp: offer.sdp
        },
        tracks: [{
          location: 'local',
          mid: this.pc!.getTransceivers().find(t => t.receiver.track.kind === 'audio')?.mid,
          trackName: trackId
        }]
      });

      // 6. استقبال الـ Answer وتثبيته
      await this.pc!.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
      
      console.log('🎙️ Audio stream pushed to Cloudflare successfully');
      return trackId; 
    } catch (error) {
      console.error('❌ Error pushing audio:', error);
      throw error;
    }
  }

  /**
   * سحب صوت الطرف الآخر (Pull)
   */
  async startPull(remoteTrackName: string, remoteSessionId: string, onRemoteStream: (stream: MediaStream) => void): Promise<RTCPeerConnection> {
    try {
      if (!this.pc) throw new Error('PeerConnection not initialized');

      // إعداد مستمع للمسارات القادمة على نفس الاتصال
      this.pc.ontrack = (event) => {
        console.log('🔊 Remote track received');
        if (event.streams && event.streams[0]) {
          onRemoteStream(event.streams[0]);
        }
      };

      // 1. طلب "سحب" المسار عبر Edge Function
      const data = await this.handleCFAPI('addTracks', this.sessionId!, {
        tracks: [{
          location: 'remote',
          trackName: remoteTrackName,
          sessionId: remoteSessionId // الربط بين الجلسات
        }]
      });

      if (!data || !data.sessionDescription) throw new Error('Failed to pull track via relay');

      // 2. تثبيت الـ Remote Description (Offer القادم من Cloudflare)
      await this.pc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
      
      // 3. إنشاء الـ Answer
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      // 4. تأكيد المصافحة (Renegotiate)
      await this.handleCFAPI('renegotiate', this.sessionId!, {
        sessionDescription: {
          type: 'answer',
          sdp: answer.sdp
        }
      });

      console.log('🔊 Remote audio pull handshake complete on main PC');
      return this.pc;
    } catch (error) {
      console.error('❌ Error pulling remote audio:', error);
      throw error;
    }
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
    this.sessionId = null;
  }
}
