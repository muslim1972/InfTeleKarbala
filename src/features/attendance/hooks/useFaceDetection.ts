import { useState, useCallback, useRef, useEffect } from 'react';

// Global singleton state so model loading is shared across component mounts and instant on repeat calls
let globalFaceApi: any = null;
let globalDetectionModelsLoaded = false;
let globalEnrollmentModelsLoaded = false;
let globalLoadingPromise: Promise<void> | null = null;

export const useFaceDetection = () => {
  const [modelsLoaded, setModelsLoaded] = useState(globalDetectionModelsLoaded);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // We keep a ref to the dynamically loaded library
  const faceApiRef = useRef<any>(globalFaceApi);

  useEffect(() => {
    if (globalDetectionModelsLoaded) {
      setModelsLoaded(true);
      faceApiRef.current = globalFaceApi;
    }
  }, []);

  const loadModels = useCallback(async (forEnrollment = false) => {
    if (globalDetectionModelsLoaded && (!forEnrollment || globalEnrollmentModelsLoaded)) {
      setModelsLoaded(true);
      faceApiRef.current = globalFaceApi;
      return;
    }

    if (globalLoadingPromise) {
      await globalLoadingPromise;
      setModelsLoaded(true);
      faceApiRef.current = globalFaceApi;
      return;
    }

    globalLoadingPromise = (async () => {
      try {
        setIsProcessing(true);
        if (!globalFaceApi) {
          const faceapi = await import('@vladmandic/face-api');
          globalFaceApi = faceapi;
        }
        const faceapi = globalFaceApi;
        faceApiRef.current = faceapi;

        const loadPromises: Promise<any>[] = [];

        if (!globalDetectionModelsLoaded) {
          loadPromises.push(
            faceapi.nets.tinyFaceDetector.loadFromUri('/models/face-api'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models/face-api'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models/face-api')
          );
        }

        if (forEnrollment && !globalEnrollmentModelsLoaded) {
          loadPromises.push(
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models/face-api')
          );
        }

        await Promise.all(loadPromises);

        globalDetectionModelsLoaded = true;
        if (forEnrollment) globalEnrollmentModelsLoaded = true;

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
          // Expected on empty canvas
        }

        setModelsLoaded(true);
      } catch (err) {
        console.error('Error loading face models:', err);
        throw err;
      } finally {
        globalLoadingPromise = null;
        setIsProcessing(false);
      }
    })();

    await globalLoadingPromise;
  }, []);

  const extractFaceDescriptor = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!faceApiRef.current || (!globalDetectionModelsLoaded && !globalEnrollmentModelsLoaded)) {
      throw new Error('Models not loaded');
    }
    const faceapi = faceApiRef.current;

    // Use SSD MobileNet if loaded, otherwise fallback to TinyFaceDetector
    let detection: any = null;
    if (globalEnrollmentModelsLoaded) {
      detection = await faceapi.detectSingleFace(
        videoElement, 
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
      ).withFaceLandmarks().withFaceDescriptor();
    } else {
      detection = await faceapi.detectSingleFace(
        videoElement,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 })
      ).withFaceLandmarks().withFaceDescriptor();
    }

    if (!detection) return null;
    return Array.from(detection.descriptor);
  }, []);

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
    if (!faceApiRef.current || !globalDetectionModelsLoaded) throw new Error('Models not loaded');
    const faceapi = faceApiRef.current;

    // Use TinyFaceDetector for live frame checking (Faster, inputSize optimized for speed & accuracy)
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
  }, []);

  return {
    modelsLoaded: globalDetectionModelsLoaded,
    isProcessing,
    loadModels,
    extractFaceDescriptor,
    detectFaceInFrame
  };
};
