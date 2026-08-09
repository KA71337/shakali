"use client";

import { LoaderCircle, MessageCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const MESSAGE_CREATED_EVENT = "anonymous-message-created";

const POLL_INTERVAL_MS = 15_000;

type PublicMessage = {
  id: string;
  message: string;
  createdAt: string;
  imageUrl: string | null;
};

type PublicMessagesResponse = {
  messages: PublicMessage[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPublicMessage(value: unknown): value is PublicMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.message === "string" &&
    typeof value.createdAt === "string" &&
    (typeof value.imageUrl === "string" || value.imageUrl === null)
  );
}

function isPublicMessagesResponse(value: unknown): value is PublicMessagesResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.messages) &&
    value.messages.every(isPublicMessage)
  );
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function PublicChatFeed() {
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (background = false) => {
    if (background) setIsRefreshing(true);

    try {
      const response = await fetch("/api/messages", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok || !isPublicMessagesResponse(payload)) {
        throw new Error("Invalid public messages response");
      }

      setMessages(payload.messages);
      setError(null);
    } catch {
      setError("Не удалось обновить чат. Попробуйте ещё раз.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => void loadMessages(), 0);
    const refresh = () => void loadMessages(true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);

    window.addEventListener(MESSAGE_CREATED_EVENT, refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      window.removeEventListener(MESSAGE_CREATED_EVENT, refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadMessages]);

  return (
    <section
      className="glass-card w-full rounded-[1.75rem] p-4 text-left sm:rounded-4xl sm:p-6"
      aria-labelledby="public-chat-title"
    >
      <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <MessageCircle className="size-5 text-violet-300" aria-hidden="true" />
            <h2 id="public-chat-title" className="text-lg font-semibold text-white sm:text-xl">
              Общий чат
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm">
            Последние анонимные сообщения
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadMessages(true)}
          disabled={isRefreshing}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-300 transition hover:border-violet-300/25 hover:bg-violet-300/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-wait disabled:opacity-60"
          aria-label="Обновить сообщения"
        >
          <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          <span className="hidden sm:inline">Обновить</span>
        </button>
      </div>

      <div className="relative z-10 mt-4" aria-live="polite" aria-busy={isLoading || isRefreshing}>
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-400">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Загружаем сообщения…
          </div>
        ) : error && messages.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            <p role="alert" className="text-sm text-rose-200">{error}</p>
            <button
              type="button"
              onClick={() => void loadMessages()}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            >
              Повторить
            </button>
          </div>
        ) : messages.length === 0 ? (
          <p className="flex min-h-40 items-center justify-center text-center text-sm text-slate-500">
            Здесь пока тихо. Отправьте первое сообщение.
          </p>
        ) : (
          <>
            {error ? <p role="status" className="mb-3 text-xs text-amber-200">{error}</p> : null}
            <ol className="max-h-[34rem] space-y-3 overflow-y-auto pr-1" aria-label="Последние сообщения">
              {messages.map((item) => (
                <li key={item.id} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wide text-violet-200">Анонимный</p>
                    <time dateTime={item.createdAt} className="text-[10px] text-slate-600 sm:text-xs">
                      {formatTime(item.createdAt)}
                    </time>
                  </div>
                  {item.message ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200 sm:text-[15px]">
                      {item.message}
                    </p>
                  ) : null}
                  {item.imageUrl ? (
                    // The route is same-origin and streams only validated image bytes.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt="Изображение от анонимного пользователя"
                      loading="lazy"
                      className="mt-3 max-h-[32rem] w-full rounded-xl object-contain"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
