import { useState, useCallback, useRef } from 'react';

export const useFaceDetection = () => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // We keep a ref to the dynamically loaded library
  const faceApiRef = useRef<any>(null);

  const loadModels = useCallback(async () => {
    if (modelsLoaded) return;
    try {
      setIsProcessing(true);
      // Dynamic import of face-api
      const faceapi = await import('@vladmandic/face-api');
      faceApiRef.current = faceapi;

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models/face-api'),
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models/face-api'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models/face-api'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models/face-api'),
      ]);

      // Warm-up inference to avoid cold-start delay during actual detection
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 320;
      try {
        await faceapi.detectSingleFace(
          canvas,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.1 })
        ).withFaceLandmarks().withFaceDescriptor();
      } catch (e) {
        console.warn('Warm-up inference failed (expected if canvas is empty):', e);
      }

      setModelsLoaded(true);
    } catch (err) {
      console.error('Error loading face models:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [modelsLoaded]);

  const extractFaceDescriptor = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!faceApiRef.current || !modelsLoaded) throw new Error('Models not loaded');
    const faceapi = faceApiRef.current;

    // Use SSD MobileNet for enrollment (Higher Accuracy, Slower, but fine for enrollment)
    const detection = await faceapi.detectSingleFace(
      videoElement, 
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
    ).withFaceLandmarks().withFaceDescriptor();

    if (!detection) return null;
    return Array.from(detection.descriptor);
  }, [modelsLoaded]);

  const getEAR = (eye: any[]) => {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2.0 * h);
  };

  const detectFaceInFrame = useCallback(async (
    videoElement: HTMLVideoElement, 
    referenceDescriptors: Float32Array[]
  ) => {
    if (!faceApiRef.current || !modelsLoaded) throw new Error('Models not loaded');
    const faceapi = faceApiRef.current;

    // Use TinyFaceDetector for live frame checking (Faster, inputSize increased for better accuracy)
    const detection = await faceapi.detectSingleFace(
      videoElement,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 })
    ).withFaceLandmarks().withFaceDescriptor();

    if (!detection) return { detection: null, distance: 999, ear: 999 };

    // Calculate minimum distance across all provided reference descriptors
    let minDistance = 999;
    if (referenceDescriptors && referenceDescriptors.length > 0) {
      for (const ref of referenceDescriptors) {
        const dist = faceapi.euclideanDistance(detection.descriptor, ref);
        if (dist < minDistance) minDistance = dist;
      }
    } else {
      console.warn("No reference descriptors provided to detectFaceInFrame.");
    }
    
    const leftEye = detection.landmarks.getLeftEye();
    const rightEye = detection.landmarks.getRightEye();
    const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2.0;

    return { detection, distance: minDistance, ear };
  }, [modelsLoaded]);

  return {
    modelsLoaded,
    isProcessing,
    loadModels,
    extractFaceDescriptor,
    detectFaceInFrame
  };
};
