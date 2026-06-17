import { useEffect, useState, useCallback } from 'react';

/**
 * دالة مساعدة للتمرير السلس نحو عنصر في الشاشة 
 * تعتمد على requestAnimationFrame لعدم تجميد واجهة المستخدم
 * بدلاً من استخدام setTimeout.
 */
export const smoothScrollToId = (elementId: string, offset: number = 0, retries: number = 5) => {
    if (retries <= 0) return;

    requestAnimationFrame(() => {
        const element = document.getElementById(elementId);
        if (element) {
            const y = element.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        } else {
            // محاولة إيجاد العنصر في الإطار التالي (الرسم التالي لـ React)
            requestAnimationFrame(() => {
                smoothScrollToId(elementId, offset, retries - 1);
            });
        }
    });
};

/**
 * خطاف مخصص لإدارة التمرير بعد التغييرات في الحالة
 */
export const useSmoothScroll = () => {
    const [scrollTarget, setScrollTarget] = useState<{ id: string; offset: number } | null>(null);

    useEffect(() => {
        if (scrollTarget) {
            smoothScrollToId(scrollTarget.id, scrollTarget.offset);
            // تفريغ الهدف بعد بدء التمرير
            const timeout = window.setTimeout(() => {
                setScrollTarget(null);
            }, 100);
            return () => window.clearTimeout(timeout);
        }
    }, [scrollTarget]);

    const scrollToElement = useCallback((id: string, offset: number = 0) => {
        setScrollTarget({ id, offset });
    }, []);

    return { scrollToElement, smoothScrollToId };
};
