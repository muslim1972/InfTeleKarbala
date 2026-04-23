// src/services/CloudflareCallsService.ts
import { supabase } from '../lib/supabase';

export class CloudflareCallsService {
  private pc: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private localStream: MediaStream | null = null;

  constructor(sessionId?: string | null) {
    this.sessionId = sessionId || null;
    // إضافة iceCandidatePoolSize لتسريع عملية الربط
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      iceCandidatePoolSize: 10
    });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log(`📡 [ICE] New candidate: ${e.candidate.type} (${e.candidate.protocol})`);
      } else {
        console.log('📡 [ICE] Gathering complete');
      }
    };
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
      // 1. الميكروفون - تبسيط الإعدادات لضمان التوافق الشامل
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true 
      });
      
      this.localStream.getTracks().forEach(track => {
        if (this.pc && this.localStream) {
          track.enabled = true;
          console.log(`🎙️ [Mic] Track active: ${track.label}, State: ${track.readyState}`);
          // استخدام sendrecv بدلاً من sendonly لضمان نشاط القناة في بعض المتصفحات
          this.pc.addTransceiver(track, {
            direction: 'sendrecv',
            streams: [this.localStream]
          });
        }
      });

      // 2. إنشاء الـ Offer الأولي والانتظار حتى اكتمال جمع الـ ICE Candidates (لحل تأخير الـ 17 ثانية)
      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);

      console.log('📡 [CF Service] Gathering ICE candidates...');
      await new Promise<void>((resolve) => {
        if (this.pc!.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (this.pc!.iceGatheringState === 'complete') {
              this.pc!.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          this.pc!.addEventListener('icegatheringstatechange', checkState);
          // مهلة أمان 3 ثواني
          setTimeout(resolve, 3000);
        }
      });

      const finalOffer = this.pc!.localDescription;

      // 3. إنشاء الجلسة وإضافة المسار في خطوة واحدة (أكثر استقراراً عند اكتمال ICE)
      console.log('📡 [CF Service] Creating session with local track...');
      const trackId = `audio-${Date.now()}`;
      
      const audioTransceiver = this.pc!.getTransceivers().find(t => 
        t.sender.track && t.sender.track.kind === 'audio'
      );

      const sessionData = await this.handleCFAPI('createSession', undefined, {
        sessionDescription: { type: 'offer', sdp: finalOffer?.sdp },
        tracks: [{
          location: 'local',
          mid: audioTransceiver?.mid,
          trackName: trackId
        }]
      });

      this.sessionId = sessionData.sessionId;
      await this.pc!.setRemoteDescription(new RTCSessionDescription(sessionData.sessionDescription));
      
      console.log('✅ [CF Service] Push successful. Track:', trackId);
      
      // مراقبة حالة الاتصال
      this.pc!.oniceconnectionstatechange = () => {
        console.log(`📡 [ICE State] ${this.pc!.iceConnectionState}`);
      };

      return trackId; 
    } catch (error) {
      console.error('❌ [CF Service] Error in startPush:', error);
      throw error;
    }
  }

  /**
   * سحب صوت الطرف الآخر (Pull)
   * نستخدم RTCPeerConnection منفصل + تمرير remoteSessionId لفك قفل 406
   */
  async startPull(remoteTrackName: string, remoteSessionId: string, onStream: (stream: MediaStream) => void): Promise<RTCPeerConnection> {
    try {
      console.log(`📡 [CF Service] Starting Pull: ${remoteTrackName} from Source: ${remoteSessionId}`);
      
      const pullPc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pullPc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          onStream(event.streams[0]);
        }
      };

      // 1. طلب السحب مع تمرير sessionId المصدر (هذا هو مفتاح حل 406 في مشروعك)
      const data = await this.handleCFAPI('addTracks', this.sessionId!, {
        tracks: [{
          location: 'remote',
          trackName: remoteTrackName,
          sessionId: remoteSessionId // الربط الإلزامي بين الجلستين
        }]
      });

      if (!data || !data.sessionDescription) {
        throw new Error('No sessionDescription returned for Pull');
      }

      // 2. تثبيت العرض (Offer من Cloudflare)
      await pullPc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
      
      // 3. إنشاء الرد والانتظار حتى اكتمال جمع الـ ICE Candidates
      const answer = await pullPc.createAnswer();
      await pullPc.setLocalDescription(answer);

      console.log('📡 [CF Service] Gathering ICE candidates for Pull...');
      await new Promise<void>((resolve) => {
        if (pullPc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pullPc.iceGatheringState === 'complete') {
              pullPc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pullPc.addEventListener('icegatheringstatechange', checkState);
          setTimeout(resolve, 3000);
        }
      });

      const finalAnswer = pullPc.localDescription;

      // 4. إكمال عملية المصافحة (Renegotiate)
      await this.handleCFAPI('renegotiate', this.sessionId!, {
        sessionDescription: {
          type: 'answer',
          sdp: finalAnswer?.sdp
        }
      });

      console.log('✅ [CF Service] Remote audio pull complete');
      return pullPc;
    } catch (error) {
      console.error('❌ [CF Service] Error in startPull:', error);
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
