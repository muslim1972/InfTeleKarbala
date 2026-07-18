import { useRef, useState, useCallback } from 'react';

export const useCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async (
    constraints: MediaStreamConstraints = { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } }
  ) => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
      return stream;
    } catch (err: any) {
      console.error('Camera Error:', err);
      let notes = 'تعذر فتح الكاميرا لخلل تقني';
      if (err.name === 'NotAllowedError') notes = 'صلاحية الكاميرا مرفوضة من المستخدم';
      else if (err.name === 'NotFoundError') notes = 'لا توجد كاميرا في الجهاز';
      else if (err.name === 'NotReadableError') notes = 'الكاميرا مستخدمة من تطبيق آخر';
      
      setCameraError(notes);
      setIsCameraOpen(false);
      throw new Error(notes);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  }, []);

  const captureFrame = useCallback(async (canvasEl: HTMLCanvasElement): Promise<string> => {
    const video = videoRef.current;
    if (!video) throw new Error('Video not active');

    const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get canvas context');

    const MAX_DIM = 300;
    let targetWidth = video.videoWidth;
    let targetHeight = video.videoHeight;
    
    if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.floor(targetHeight * (MAX_DIM / targetWidth));
        targetWidth = MAX_DIM;
      } else {
        targetWidth = Math.floor(targetWidth * (MAX_DIM / targetHeight));
        targetHeight = MAX_DIM;
      }
    }

    canvasEl.width = targetWidth;
    canvasEl.height = targetHeight;
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    return canvasEl.toDataURL('image/webp', 0.8);
  }, []);

  return {
    videoRef,
    streamRef,
    isCameraOpen,
    cameraError,
    startCamera,
    stopCamera,
    captureFrame
  };
};
