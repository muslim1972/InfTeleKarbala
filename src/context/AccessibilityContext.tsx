import React, { createContext, useContext, useEffect, useState } from 'react';

export type FontScale = 'normal' | 'medium' | 'large' | 'xlarge';

export interface FontScaleOption {
  id: FontScale;
  label: string;
  percentage: string;
  description: string;
  previewClass: string;
}

export const FONT_SCALE_OPTIONS: FontScaleOption[] = [
  {
    id: 'normal',
    label: 'افتراضي',
    percentage: '100%',
    description: 'الحجم القياسي للتطبيق (16px)',
    previewClass: 'text-sm'
  },
  {
    id: 'medium',
    label: 'متوسط / مريح',
    percentage: '112%',
    description: 'زيادة طفيفة ومريحة للقراءة اليومية (18px)',
    previewClass: 'text-base'
  },
  {
    id: 'large',
    label: 'كبير',
    percentage: '125%',
    description: 'واضح جداً ومثالي لمن يعانون من إجهاد العين (20px)',
    previewClass: 'text-lg'
  },
  {
    id: 'xlarge',
    label: 'كبير جداً',
    percentage: '138%',
    description: 'مخصص لحالات ضعف البصر والشاشات البعيدة (22px)',
    previewClass: 'text-xl'
  }
];

interface AccessibilityContextType {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  increaseFontScale: () => void;
  decreaseFontScale: () => void;
  resetFontScale: () => void;
  currentOption: FontScaleOption;
}

const AccessibilityContext = createContext<AccessibilityContextType>({
  fontScale: 'normal',
  setFontScale: () => {},
  increaseFontScale: () => {},
  decreaseFontScale: () => {},
  resetFontScale: () => {},
  currentOption: FONT_SCALE_OPTIONS[0]
});

const STORAGE_KEY = 'app_font_scale_v1';

export const AccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    if (typeof window === 'undefined') return 'normal';
    const stored = localStorage.getItem(STORAGE_KEY) as FontScale;
    if (stored && ['normal', 'medium', 'large', 'xlarge'].includes(stored)) {
      return stored;
    }
    return 'normal';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('font-scale-normal', 'font-scale-medium', 'font-scale-large', 'font-scale-xlarge');
    root.classList.add(`font-scale-${fontScale}`);
    root.setAttribute('data-font-scale', fontScale);
    localStorage.setItem(STORAGE_KEY, fontScale);
  }, [fontScale]);

  const setFontScale = (scale: FontScale) => {
    setFontScaleState(scale);
  };

  const scaleOrder: FontScale[] = ['normal', 'medium', 'large', 'xlarge'];

  const increaseFontScale = () => {
    const currentIndex = scaleOrder.indexOf(fontScale);
    if (currentIndex < scaleOrder.length - 1) {
      setFontScale(scaleOrder[currentIndex + 1]);
    }
  };

  const decreaseFontScale = () => {
    const currentIndex = scaleOrder.indexOf(fontScale);
    if (currentIndex > 0) {
      setFontScale(scaleOrder[currentIndex - 1]);
    }
  };

  const resetFontScale = () => {
    setFontScale('normal');
  };

  const currentOption = FONT_SCALE_OPTIONS.find(opt => opt.id === fontScale) || FONT_SCALE_OPTIONS[0];

  return (
    <AccessibilityContext.Provider
      value={{
        fontScale,
        setFontScale,
        increaseFontScale,
        decreaseFontScale,
        resetFontScale,
        currentOption
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
