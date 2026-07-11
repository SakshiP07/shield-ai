import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';

const scrollPositions = new Map<string, number>();

export function useScrollRestoration(containerRef: RefObject<HTMLElement | null>) {
  const location = useLocation();
  const pathname = location.pathname;

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.scrollTop = scrollPositions.get(pathname) ?? 0;
  }, [pathname, containerRef]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onScroll = () => {
      scrollPositions.set(pathname, node.scrollTop);
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      onScroll();
      node.removeEventListener('scroll', onScroll);
    };
  }, [pathname, containerRef]);
}
