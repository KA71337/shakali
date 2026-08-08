"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileRenderOptions = {
  sitekey: string;
  theme: "dark";
  size: "flexible";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  siteKey: string | null;
  resetKey: number;
  nonce?: string;
  onTokenChangeAction: (token: string | null) => void;
  onErrorAction: () => void;
};

export function TurnstileWidget({
  siteKey,
  resetKey,
  nonce,
  onTokenChangeAction,
  onErrorAction,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const turnstile = window.turnstile;

    if (!siteKey || !scriptReady || !container || !turnstile) {
      return;
    }

    try {
      widgetIdRef.current = turnstile.render(container, {
        sitekey: siteKey,
        theme: "dark",
        size: "flexible",
        callback: (token) => onTokenChangeAction(token),
        "error-callback": () => {
          onTokenChangeAction(null);
          onErrorAction();
        },
        "expired-callback": () => onTokenChangeAction(null),
      });
    } catch {
      onTokenChangeAction(null);
      onErrorAction();
    }

    return () => {
      const widgetId = widgetIdRef.current;

      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }

      widgetIdRef.current = null;
      container.replaceChildren();
    };
  }, [onErrorAction, onTokenChangeAction, resetKey, scriptReady, siteKey]);

  return siteKey ? (
    <>
      <Script
        id="cloudflare-turnstile"
        src={TURNSTILE_SCRIPT_URL}
        strategy="afterInteractive"
        nonce={nonce}
        onReady={() => {
          setScriptFailed(false);
          setScriptReady(true);
        }}
        onError={() => {
          setScriptFailed(true);
          setScriptReady(false);
          onTokenChangeAction(null);
          onErrorAction();
        }}
      />

      <div className="rounded-2xl border border-white/8 bg-black/20 p-3 sm:p-4">
        <p className="mb-3 text-left text-xs leading-5 text-slate-400">
          Подтвердите, что вы не робот, и отправьте сообщение ещё раз.
        </p>
        <div
          ref={containerRef}
          className="turnstile-frame min-h-16.25 w-full overflow-hidden rounded-xl"
          aria-label="Проверка Cloudflare Turnstile"
        />
        {scriptFailed ? (
          <p className="mt-2 text-left text-xs text-rose-300" role="alert">
            Не удалось загрузить проверку. Проверьте соединение и попробуйте снова.
          </p>
        ) : null}
      </div>
    </>
  ) : null;
}
