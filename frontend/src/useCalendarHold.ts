import { useEffect, useRef, type RefObject } from "react";

export function useCalendarHold<T>(
  root: RefObject<HTMLDivElement | null>,
  locate: (target: Element | null, x: number, y: number, starting: boolean) => T | null,
  select: (start: T, end: T) => void,
  cancel: () => void,
  enabled = true
) {
  const callbacks = useRef({ locate, select, cancel });
  callbacks.current = { locate, select, cancel };

  useEffect(() => {
    const surface = root.current;
    if (!surface || !enabled) return;
    let press: { x: number; y: number; start: T; active: boolean } | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let suppressUntil = 0;
    function begin(target: EventTarget | null, x: number, y: number) {
      clearTimeout(timer);
      const start = callbacks.current.locate(target instanceof Element ? target : null, x, y, true);
      if (start === null) return;
      press = { x, y, start, active: false };
      timer = setTimeout(() => {
        if (press) activate(press);
      }, 420);
    }
    function activate(current: NonNullable<typeof press>) {
      current.active = true;
      callbacks.current.select(current.start, current.start);
    }
    function move(x: number, y: number, event: Event) {
      if (!press) return;
      if (!press.active) {
        if (Math.hypot(x - press.x, y - press.y) <= 9) return;
        if (event.type === "touchmove") {
          reset();
          return;
        }
        clearTimeout(timer);
        activate(press);
      }
      if (event.cancelable) event.preventDefault();
      const end = callbacks.current.locate(document.elementFromPoint(x, y), x, y, false);
      if (end !== null) callbacks.current.select(press.start, end);
    }
    function reset() {
      clearTimeout(timer);
      press = null;
    }
    function finish(event: Event) {
      if (press?.active) {
        suppressUntil = Date.now() + 450;
        if (event.cancelable) event.preventDefault();
      }
      reset();
    }
    function interrupted() {
      if (press?.active) callbacks.current.cancel();
      reset();
    }
    const mouseDown = (event: MouseEvent) => {
      if (event.button === 0) begin(event.target, event.clientX, event.clientY);
    };
    const mouseMove = (event: MouseEvent) => move(event.clientX, event.clientY, event);
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        interrupted();
        return;
      }
      const touch = event.touches[0];
      begin(event.target, touch.clientX, touch.clientY);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      move(touch.clientX, touch.clientY, event);
    };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const contextMenu = (event: MouseEvent) => {
      if (press) event.preventDefault();
    };
    surface.addEventListener("mousedown", mouseDown);
    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("mouseup", finish);
    surface.addEventListener("touchstart", touchStart, { passive: true });
    surface.addEventListener("touchmove", touchMove, { passive: false });
    surface.addEventListener("touchend", finish, { passive: false });
    surface.addEventListener("touchcancel", interrupted);
    surface.addEventListener("click", click, true);
    surface.addEventListener("contextmenu", contextMenu);
    return () => {
      reset();
      surface.removeEventListener("mousedown", mouseDown);
      document.removeEventListener("mousemove", mouseMove);
      document.removeEventListener("mouseup", finish);
      surface.removeEventListener("touchstart", touchStart);
      surface.removeEventListener("touchmove", touchMove);
      surface.removeEventListener("touchend", finish);
      surface.removeEventListener("touchcancel", interrupted);
      surface.removeEventListener("click", click, true);
      surface.removeEventListener("contextmenu", contextMenu);
    };
  }, [root, enabled]);
}
