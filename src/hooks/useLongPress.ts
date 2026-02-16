import { useCallback, useRef } from 'react';

type Target = EventTarget | null;

interface LongPressOptions { delay?: number; moveThreshold?: number }

const useLongPress = (
    onLongPress: (target: Target) => void,
    onClick: (event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => void,
    options?: LongPressOptions
) => {
    const { delay = 500, moveThreshold = 10 } = options || {};
    const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const targetRef = useRef<Target>(null);
    const longPressTriggered = useRef(false);
    const startPos = useRef<{ x: number; y: number } | null>(null);

    const start = useCallback(
        (event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
            targetRef.current = event.currentTarget;
            longPressTriggered.current = false;

            if ('touches' in event && event.touches && event.touches[0]) {
                startPos.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            } else if ('clientX' in event) {
                startPos.current = { x: (event as React.MouseEvent).clientX, y: (event as React.MouseEvent).clientY };
            }

            timeout.current = setTimeout(() => {
                longPressTriggered.current = true;
                onLongPress(targetRef.current);
            }, delay);
        },
        [onLongPress, delay]
    );

    const clear = useCallback(() => {
        timeout.current && clearTimeout(timeout.current);
    }, []);

    const end = useCallback(() => {
        clear();
        startPos.current = null;
    }, [clear]);

    const move = useCallback((e: React.TouchEvent<HTMLElement>) => {
        if (!startPos.current) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        const dx = Math.abs(t.clientX - startPos.current.x);
        const dy = Math.abs(t.clientY - startPos.current.y);

        if (dx > moveThreshold || dy > moveThreshold) {
            clear();
            startPos.current = null;
        }
    }, [moveThreshold, clear]);

    const handleClick = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
        if (longPressTriggered.current) {
            return;
        }
        onClick(e);
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        // Prevent context menu on long press
        if (longPressTriggered.current) {
            e.preventDefault();
        }
    };

    return {
        onMouseDown: (e: React.MouseEvent<HTMLElement>) => start(e),
        onTouchStart: (e: React.TouchEvent<HTMLElement>) => start(e),
        onMouseUp: end,
        onTouchEnd: end,
        onTouchMove: move,
        onMouseLeave: end,
        onClick: handleClick,
        onContextMenu: handleContextMenu,
    };
};

export default useLongPress;
