// src/features/attendance/utils/imageEnhancement.ts

/**
 * Calculates the average brightness of a video frame.
 * @param videoElement The video element to analyze
 * @returns A value between 0 (dark) and 255 (bright)
 */
export const getAverageBrightness = (videoElement: HTMLVideoElement): number => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 128; // Default to mid-gray if unavailable

  // Use a small sample size for performance
  canvas.width = 64;
  canvas.height = 64;
  
  try {
    ctx.drawImage(videoElement, 0, 0, 64, 64);
    const imageData = ctx.getImageData(0, 0, 64, 64);
    const data = imageData.data;
    let sum = 0;

    // Calculate luminance for each pixel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Standard luminance formula
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += luminance;
    }

    return sum / (64 * 64);
  } catch (err) {
    console.error("Error calculating brightness:", err);
    return 128;
  }
};

/**
 * Creates a white flash overlay on the screen to illuminate the user's face in dark environments.
 * @returns A function to remove the flash overlay
 */
export const triggerScreenFlash = (): () => void => {
  const flashOverlay = document.createElement('div');
  flashOverlay.style.position = 'fixed';
  flashOverlay.style.top = '0';
  flashOverlay.style.left = '0';
  flashOverlay.style.width = '100vw';
  flashOverlay.style.height = '100vh';
  flashOverlay.style.backgroundColor = 'white';
  flashOverlay.style.opacity = '0.5'; // Not full opacity so user can still see slightly
  flashOverlay.style.zIndex = '9999';
  flashOverlay.style.pointerEvents = 'none';
  flashOverlay.style.transition = 'opacity 0.2s ease-in-out';
  
  document.body.appendChild(flashOverlay);

  // Return cleanup function
  return () => {
    flashOverlay.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(flashOverlay)) {
        document.body.removeChild(flashOverlay);
      }
    }, 200);
  };
};
