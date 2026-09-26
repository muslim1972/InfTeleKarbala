import React, { createContext, useContext, useEffect, useState } from 'react';

export type FontScale = 'xsmall' | 'small' | 'normal' | 'medium' | 'large' | 'xlarge';

export interface FontScaleOption {
  id: FontScale;
  label: string;
  percentage: string;
  description: string;
  previewClass: string;
}

/** الترتيب من الأصغر للأكبر — يُستخدم للدورة (cycle) وأزرار الزيادة/النقصان */
export const FONT_SCALE_ORDER: FontScale[] = ['xsmall', 'small', 'normal', 'medium', 'large', 'xlarge'];

export const FONT_SCALE_OPTIONS: FontScaleOption[] = [
  {
    id: 'xsmall',
    label: 'صغير جداً',
    percentage: '80%',
    description: 'أقصى تصغير — أكبر قدر من البيانات على الشاشة (13px)',
    previewClass: 'text-xs'
  },
  {
    id: 'small',
    label: 'صغير',
    percentage: '90%',
    description: 'تصغير خفيف يمنح الواجهة مساحة أوسع (14px)',
    previewClass: 'text-sm'
  },
  {
    id: 'normal',
    label: 'افتراضي',
    percentage: '100%',
    description: 'الحجم القياسي للتطبيق (16px)',
    previewClass: 'text-base'
  },
  {
    id: 'medium',
    label: 'متوسط / مريح',
    percentage: '112%',
    description: 'زيادة طفيفة ومريحة للقراءة اليومية (18px)',
    previewClass: 'text-lg'
  },
  {
    id: 'large',
    label: 'كبير',
    percentage: '125%',
    description: 'واضح جداً ومثالي لمن يعانون من إجهاد العين (20px)',
    previewClass: 'text-xl'
  },
  {
    id: 'xlarge',
    label: 'كبير جداً',
    percentage: '138%',
    description: 'مخصص لحالات ضعف البصر والشاشات البعيدة (22px)',
    previewClass: 'text-2xl'
  }
];

interface AccessibilityContextType {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  increaseFontScale: () => void;
  decreaseFontScale: () => void;
  cycleFontScale: () => FontScale;
  resetFontScale: () => void;
  currentOption: FontScaleOption;
}

const AccessibilityContext = createContext<AccessibilityContextType>({
  fontScale: 'normal',
  setFontScale: () => {},
  increaseFontScale: () => {},
  decreaseFontScale: () => {},
  cycleFontScale: () => 'normal',
  resetFontScale: () => {},
  currentOption: FONT_SCALE_OPTIONS[2]
});

const STORAGE_KEY = 'app_font_scale_v1';
const ALL_SCALES: FontScale[] = FONT_SCALE_ORDER;

export const AccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    if (typeof window === 'undefined') return 'normal';
    const stored = localStorage.getItem(STORAGE_KEY) as FontScale;
    if (stored && ALL_SCALES.includes(stored)) {
      return stored;
    }
    return 'normal';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove(...ALL_SCALES.map((s) => `font-scale-${s}`));
    root.classList.add(`font-scale-${fontScale}`);
    root.setAttribute('data-font-scale', fontScale);
    localStorage.setItem(STORAGE_KEY, fontScale);
  }, [fontScale]);

  const setFontScale = (scale: FontScale) => {
    setFontScaleState(scale);
  };

  const increaseFontScale = () => {
    const currentIndex = FONT_SCALE_ORDER.indexOf(fontScale);
    if (currentIndex < FONT_SCALE_ORDER.length - 1) {
      setFontScale(FONT_SCALE_ORDER[currentIndex + 1]);
    }
  };

  const decreaseFontScale = () => {
    const currentIndex = FONT_SCALE_ORDER.indexOf(fontScale);
    if (currentIndex > 0) {
      setFontScale(FONT_SCALE_ORDER[currentIndex - 1]);
    }
  };

  /** دورة كاملة عبر كل المقاسات (تصغير ← تكبير) ثم العودة للأول — تعيد الحجم الجديد */
  const cycleFontScale = (): FontScale => {
    const currentIndex = FONT_SCALE_ORDER.indexOf(fontScale);
    const next = FONT_SCALE_ORDER[(currentIndex + 1) % FONT_SCALE_ORDER.length];
    setFontScale(next);
    return next;
  };

  const resetFontScale = () => {
    setFontScale('normal');
  };

  const currentOption = FONT_SCALE_OPTIONS.find(opt => opt.id === fontScale) || FONT_SCALE_OPTIONS[2];

  return (
    <AccessibilityContext.Provider
      value={{
        fontScale,
        setFontScale,
        increaseFontScale,
        decreaseFontScale,
        cycleFontScale,
        resetFontScale,
        currentOption
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
