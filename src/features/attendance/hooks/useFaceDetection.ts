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
        faceapi.nets.faceLandmark68Net.loadFromUri('/models/face-api'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models/face-api'),
      ]);
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

    const detection = await faceapi.detectSingleFace(
      videoElement, 
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
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
    referenceDescriptor: Float32Array
  ) => {
    if (!faceApiRef.current || !modelsLoaded) throw new Error('Models not loaded');
    const faceapi = faceApiRef.current;

    const detection = await faceapi.detectSingleFace(
      videoElement,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
    ).withFaceLandmarks().withFaceDescriptor();

    if (!detection) return { detection: null, distance: 999, ear: 999 };

    const distance = faceapi.euclideanDistance(detection.descriptor, referenceDescriptor);
    
    const leftEye = detection.landmarks.getLeftEye();
    const rightEye = detection.landmarks.getRightEye();
    const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2.0;

    return { detection, distance, ear };
  }, [modelsLoaded]);

  return {
    modelsLoaded,
    isProcessing,
    loadModels,
    extractFaceDescriptor,
    detectFaceInFrame
  };
};
