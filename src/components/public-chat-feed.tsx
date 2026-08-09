"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollRef = useRef(true);

  const loadMessages = useCallback(async (background = false, forceScroll = false) => {
    if (background) setIsRefreshing(true);
    if (forceScroll) shouldScrollRef.current = true;

    try {
      const response = await fetch("/api/messages", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok || !isPublicMessagesResponse(payload)) throw new Error("Invalid response");

      const oldestFirst = [...payload.messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(oldestFirst);
      setError(null);
    } catch {
      setError("Не удалось обновить чат. Попробуйте ещё раз.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => void loadMessages(false, true), 0);
    const refresh = () => void loadMessages(true);
    const refreshAndScroll = () => void loadMessages(true, true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);

    window.addEventListener(MESSAGE_CREATED_EVENT, refreshAndScroll);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      window.removeEventListener(MESSAGE_CREATED_EVENT, refreshAndScroll);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadMessages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !isLoading && !shouldScrollRef.current) return;
    node.scrollTo({ top: node.scrollHeight, behavior: isLoading ? "auto" : "smooth" });
    shouldScrollRef.current = false;
  }, [messages, isLoading]);

  return (
    <section className="chat-feed" aria-label="История общего чата">
      <button
        type="button"
        onClick={() => void loadMessages(true)}
        disabled={isRefreshing}
        className="chat-refresh"
        aria-label="Обновить сообщения"
      >
        <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
      </button>

      <div
        ref={scrollRef}
        className="chat-messages"
        aria-live="polite"
        aria-busy={isLoading || isRefreshing}
      >
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-400">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Загружаем сообщения…
          </div>
        ) : error && messages.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            <p role="alert" className="text-sm text-rose-200">{error}</p>
            <button type="button" onClick={() => void loadMessages(false, true)} className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white">
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
            <ol className="message-list" aria-label="Сообщения, старые сверху, новые снизу">
              {messages.map((item) => (
                <li key={item.id} className="message-bubble">
                  <p className="message-author">Анонимный</p>
                  {item.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.imageUrl} alt="Изображение от анонимного участника" loading="lazy" className="message-image" />
                  ) : null}
                  {item.message ? <p className="message-body">{item.message}</p> : null}
                  <time dateTime={item.createdAt} className="message-time">{formatTime(item.createdAt)}</time>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
