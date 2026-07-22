import { useEffect, useState, useCallback } from 'react';

/**
 * دالة مساعدة للتمرير السلس نحو عنصر في الشاشة 
 * تعتمد على requestAnimationFrame لعدم تجميد واجهة المستخدم
 * بدلاً من استخدام setTimeout.
 */
export const smoothScrollToId = (elementId: string, offset: number = 15, retries: number = 5) => {
    if (retries <= 0) return;

    requestAnimationFrame(() => {
        const element = document.getElementById(elementId);
        if (element) {
            const stickyHeader = document.querySelector('header.sticky, header.fixed, header');
            
            // البحث عن أول عنصر أب يمتلك شريط تمرير (overflow-y: auto / scroll)
            let parent: HTMLElement | null = element.parentElement;
            let scrollableParent: HTMLElement | null = null;

            while (parent && parent !== document.body && parent !== document.documentElement) {
                const overflowY = window.getComputedStyle(parent).overflowY;
                if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
                    scrollableParent = parent;
                    break;
                }
                parent = parent.parentElement;
            }

            const getStickyOffset = () => {
                let currentOffset = offset;
                if (stickyHeader) {
                    const headerRect = stickyHeader.getBoundingClientRect();
                    if (headerRect.height > 0 && headerRect.top < 50) {
                        currentOffset = Math.max(offset, headerRect.bottom + 12);
                    }
                }
                return currentOffset;
            };

            const performScroll = () => {
                const currentStickyOffset = getStickyOffset();
                if (scrollableParent) {
                    const elementRect = element.getBoundingClientRect();
                    const parentRect = scrollableParent.getBoundingClientRect();
                    const targetScrollTop = scrollableParent.scrollTop + (elementRect.top - parentRect.top) - currentStickyOffset;
                    scrollableParent.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
                } else {
                    const y = element.getBoundingClientRect().top + window.scrollY - currentStickyOffset;
                    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                }
            };

            // 1. إجراء التمرير الفوري الأولي
            performScroll();

            // 2. تتبع الحركة عبر إطارات requestAnimationFrame لضبط الموضع أثناء انهيار/توسع الأقسام المجاورة (300 مللي ثانية)
            let frameCount = 0;
            const maxFrames = 20; // 20 frames @ 60fps ≈ 330ms

            const checkAndAdjust = () => {
                frameCount++;
                if (frameCount <= maxFrames) {
                    const currentStickyOffset = getStickyOffset();
                    const elementRect = element.getBoundingClientRect();
                    const currentTop = scrollableParent 
                        ? (elementRect.top - scrollableParent.getBoundingClientRect().top)
                        : elementRect.top;

                    // إذا ابتعد العنصر عن الأوفسيت المطلوب بأكثر من 4 بكسل (بسبب طي قسم أعلاه)، نعيد ضبط الموضع
                    if (Math.abs(currentTop - currentStickyOffset) > 4) {
                        performScroll();
                    }
                    requestAnimationFrame(checkAndAdjust);
                }
            };

            requestAnimationFrame(checkAndAdjust);
        } else {
            // محاولة إيجاد العنصر في الإطار التالي (الرسم التالي لـ React)
            requestAnimationFrame(() => {
                smoothScrollToId(elementId, offset, retries - 1);
            });
        }
    });
};

/**
 * دالة مساعدة لإعادة التمرير السلس إلى بداية الصفحة/الحاوية عند طي الأقسام
 */
export const smoothScrollToTop = () => {
    requestAnimationFrame(() => {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('div, main, section'));
        let scrollableParent: HTMLElement | null = null;

        for (const el of candidates) {
            const overflowY = window.getComputedStyle(el).overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
                scrollableParent = el;
                break;
            }
        }

        if (scrollableParent) {
            scrollableParent.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
