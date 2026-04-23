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
      // 1. الميكروفون
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      
      this.localStream.getTracks().forEach(track => {
        if (this.pc && this.localStream) {
          track.enabled = true;
          console.log(`🎙️ [Mic] Track active: ${track.label}, State: ${track.readyState}`);
          this.pc.addTrack(track, this.localStream);
        }
      });

      // 2. إنشاء الـ Offer الأولي
      let offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);

      // 3. إنشاء الجلسة (بدون مسارات في البداية) كما في ShamilApp
      if (!this.sessionId) {
        console.log('📡 [CF Service] Step 1: Creating Session...');
        const sessionData = await this.handleCFAPI('createSession', undefined, {
          sessionDescription: { type: 'offer', sdp: offer.sdp }
        });
        this.sessionId = sessionData.sessionId;
        await this.pc!.setRemoteDescription(new RTCSessionDescription(sessionData.sessionDescription));
        
        // تحديث الـ Offer للتأكد من المزامنة قبل إضافة المسار
        offer = await this.pc!.createOffer();
        await this.pc!.setLocalDescription(offer);
      }

      // 4. إضافة المسار في خطوة منفصلة (المرحلة الثانية)
      console.log('📡 [CF Service] Step 2: Adding Local Track...');
      const trackId = `audio-${Date.now()}`;
      
      // نختار الـ mid الخاص بالمرسل (Sender) الذي يحمل مسار الصوت الفعلي
      const audioTransceiver = this.pc!.getTransceivers().find(t => 
        t.sender.track && t.sender.track.kind === 'audio'
      );

      if (!audioTransceiver || !audioTransceiver.mid) {
        throw new Error('Could not find a valid audio transceiver MID');
      }

      const data = await this.handleCFAPI('addTracks', this.sessionId!, {
        sessionDescription: {
          type: 'offer',
          sdp: offer.sdp
        },
        tracks: [{
          location: 'local',
          mid: audioTransceiver.mid,
          trackName: trackId
        }]
      });

      // تثبيت الـ Answer النهائي للمرحلة الثانية
      await this.pc!.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
      
      console.log('✅ [CF Service] Push successful. Track:', data.tracks[0].trackName);
      return data.tracks[0].trackName; 
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
      
      // 3. إنشاء الرد (Answer)
      const answer = await pullPc.createAnswer();
      await pullPc.setLocalDescription(answer);

      // 4. تأكيد المصافحة (Renegotiate)
      await this.handleCFAPI('renegotiate', this.sessionId!, {
        sessionDescription: {
          type: 'answer',
          sdp: answer.sdp
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
