/**
 * CloudflareCallsService.ts
 * 
 * الملحق التقني لإدارة مكالمات WebRTC عبر Cloudflare Calls.
 * يتعامل مع الميكروفون، إنشاء الاتصال، وتبادل المسارات الصوتية.
 */

const CLOUDFLARE_APP_ID = import.meta.env.VITE_CLOUDFLARE_APP_ID;

export class CloudflareCallsService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private sessionId: string | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    // تهيئة الـ PeerConnection مع خوادم Google STUN لضمان تجاوز جدران الحماية
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  }

  /**
   * بدء بث الصوت من الميكروفون إلى Cloudflare
   */
  async startPush(_onTrack?: (track: MediaStreamTrack) => void) {
    try {
      // 1. طلب الإذن للميكروفون
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. إضافة المسار الصوتي للاتصال
      this.localStream.getTracks().forEach(track => {
        this.pc?.addTrack(track, this.localStream!);
      });

      // 3. إنشاء الـ Offer التقني
      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);

      // 4. إرسال المسار لـ Cloudflare لفتحه (Indexing)
      const response = await fetch(
        `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/${this.sessionId}/tracks/new`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionDescription: {
              type: 'offer',
              sdp: offer.sdp
            },
            tracks: [{
              location: 'local',
              mid: this.pc!.getTransceivers().find(t => t.receiver.track.kind === 'audio')?.mid,
              trackName: 'audio-main'
            }]
          })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to push track');

      // 5. استقبال الـ Answer من Cloudflare وتثبيته
      await this.pc!.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
      
      console.log('🎙️ Audio stream pushed to Cloudflare successfully');
      return data.tracks[0].trackName; // سنحتاج هذا الاسم ليسحبه الطرف الآخر
    } catch (error) {
      console.error('❌ Error pushing audio to Cloudflare:', error);
      throw error;
    }
  }

  /**
   * سحب صوت الطرف الآخر (Pull)
   */
  async startPull(remoteTrackName: string, onRemoteStream: (stream: MediaStream) => void) {
    try {
      const pullPc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // إعداد مستمع للمسارات القادمة
      pullPc.ontrack = (event) => {
        onRemoteStream(event.streams[0]);
      };

      // طلب "سحب" المسار المعين
      const response = await fetch(
        `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/${this.sessionId}/tracks/new`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: [{
              location: 'remote',
              trackName: remoteTrackName
            }]
          })
        }
      );

      const data = await response.json();
      await pullPc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
      
      const answer = await pullPc.createAnswer();
      await pullPc.setLocalDescription(answer);

      // تأكيد المصافحة (Answer)
      await fetch(
        `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/${this.sessionId}/tracks/${data.tracks[0].trackName}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionDescription: {
              type: 'answer',
              sdp: answer.sdp
            }
          })
        }
      );

      console.log('🔊 Remote audio pulled and playing');
    } catch (error) {
      console.error('❌ Error pulling remote audio:', error);
    }
  }

  /**
   * إنهاء المكالمة وتنظيف المصادر
   */
  stop() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.pc?.close();
    this.pc = null;
    this.localStream = null;
  }
}
