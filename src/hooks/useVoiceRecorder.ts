import { useState, useRef, useCallback, useEffect } from 'react';

interface VoiceRecorderState {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  waveformData: number[];
  error: string | null;
}

export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    duration: 0,
    audioBlob: null,
    waveformData: [],
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const updateWaveform = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);

    // Sample 32 points for the waveform visualization
    const samples = 32;
    const step = Math.floor(dataArray.length / samples);
    const waveform: number[] = [];
    for (let i = 0; i < samples; i++) {
      const value = dataArray[i * step];
      // normalize to [0,1]
      const norm = Math.abs(value - 128) / 128;
      // optionally boost quiet signals with a sqrt curve
      waveform.push(Math.sqrt(norm));
    }

    setState(prev => ({ ...prev, waveformData: waveform }));
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      streamRef.current = stream;

      // Setup audio analyser for waveform
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Start WITHOUT timeslice - collect all data at stop
      mediaRecorder.start();

      setState({
        isRecording: true,
        duration: 0,
        audioBlob: null,
        waveformData: [],
        error: null,
      });

      // Start timer
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTime) / 1000),
        }));
      }, 1000);

      // Start waveform animation
      updateWaveform();

    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setState(prev => ({
        ...prev,
        error: 'لا يمكن الوصول إلى الميكروفون. يرجى السماح بالوصول من إعدادات المتصفح.',
      }));
    }
  }, [updateWaveform]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        cleanup();
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log(`Voice recording stopped. Blob size: ${blob.size}, type: ${blob.type}, chunks: ${chunksRef.current.length}`);
        setState(prev => ({
          ...prev,
          isRecording: false,
          audioBlob: blob,
        }));
        cleanup();
        resolve(blob);
      };

      // Request final data before stopping
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
      }
      mediaRecorder.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }
    cleanup();
    chunksRef.current = [];
    setState({
      isRecording: false,
      duration: 0,
      audioBlob: null,
      waveformData: [],
      error: null,
    });
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRecording();
    };
  }, [cancelRecording]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording: state.isRecording,
    duration: state.duration,
    formattedDuration: formatDuration(state.duration),
    audioBlob: state.audioBlob,
    waveformData: state.waveformData,
    error: state.error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
