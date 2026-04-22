// src/services/CloudflareCallsService.ts
import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';

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
    const { data, error } = await supabase.functions.invoke('handle-cloudflare-call', {
      body: { action, sessionId, payload }
    });

    if (error) {
      console.error(`❌ Edge Function Error (${action}):`, error);
      throw error;
    }
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
   * سحب صوت الطرف الآخر
   */
  async startPull(remoteTrackName: string, onStream: (stream: MediaStream) => void): Promise<RTCPeerConnection> {
    const pullPc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }]
    });

    pullPc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        onStream(event.streams[0]);
      }
    };

    // 1. طلب سحب المسار من Cloudflare
    const pullData = await this.handleCFAPI('addTracks', this.sessionId!, {
      tracks: [{
        location: 'remote',
        trackName: remoteTrackName
      }]
    });

    // 2. ضبط الـ Offer القادم من Cloudflare
    await pullPc.setRemoteDescription(new RTCSessionDescription(pullData.sessionDescription));

    // 3. إنشاء Answer
    const answer = await pullPc.createAnswer();
    await pullPc.setLocalDescription(answer);

    // 4. إرسال الـ Answer لـ Cloudflare (Renegotiate)
    await this.handleCFAPI('renegotiate', this.sessionId!, {
      sessionDescription: {
        type: 'answer',
        sdp: answer.sdp
      }
    });

    return pullPc;
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
