"use client";

import { useEffect } from "react";

type EmbedFrameBridgeProps = {
  enabled: boolean;
  parentOrigin: string | null;
  view: "event" | "checkout";
  calendarSlug?: string;
  eventId?: string;
  sessionId?: string;
};

export function EmbedFrameBridge({
  enabled,
  parentOrigin,
  view,
  calendarSlug,
  eventId,
  sessionId,
}: EmbedFrameBridgeProps) {
  useEffect(() => {
    if (!enabled || window.parent === window) {
      return undefined;
    }

    function post(type: string, payload: Record<string, unknown> = {}) {
      window.parent.postMessage(
        {
          source: "zectix-embed",
          type,
          ...payload,
        },
        parentOrigin || "*",
      );
    }

    function postResize() {
      const root = document.documentElement;
      const body = document.body;
      const height = Math.ceil(
        Math.max(
          root.scrollHeight,
          body.scrollHeight,
          root.offsetHeight,
          body.offsetHeight,
        ),
      );
      post("resize", { height, view, calendarSlug, eventId, sessionId });
    }

    const observer = new ResizeObserver(() => {
      postResize();
    });
    observer.observe(document.documentElement);
    observer.observe(document.body);

    function handleCustomEvent(event: Event) {
      const detail =
        event instanceof CustomEvent &&
        event.detail &&
        typeof event.detail === "object" &&
        !Array.isArray(event.detail)
          ? (event.detail as Record<string, unknown>)
          : null;

      const type = typeof detail?.type === "string" ? detail.type : null;
      if (!type) {
        return;
      }

      const payload = { ...detail };
      delete payload.type;
      post(type, payload);
    }

    window.addEventListener("zectix:embed", handleCustomEvent);
    post("ready", { view, calendarSlug, eventId, sessionId });

    const frameId = window.requestAnimationFrame(() => {
      postResize();
    });
    const timeoutId = window.setTimeout(() => {
      postResize();
    }, 250);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener("zectix:embed", handleCustomEvent);
    };
  }, [enabled, parentOrigin, view, calendarSlug, eventId, sessionId]);

  return null;
}
