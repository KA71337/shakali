"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ImagePlus,
  LockKeyhole,
  Send,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { MESSAGE_CREATED_EVENT } from "@/components/public-chat-feed";
import { TurnstileWidget } from "@/components/turnstile-widget";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const LOCAL_MESSAGES = {
  empty: "Напишите сообщение или добавьте изображение.",
  imageTooLarge: "Изображение должно быть не больше 2 МБ.",
  imageType: "Разрешены только JPEG, PNG, WebP и GIF.",
  tooLong: "Сообщение слишком длинное. Максимум — 1000 символов.",
  tokenLoad:
    "Не удалось загрузить форму. Проверьте соединение и попробуйте снова.",
  tokenRefresh:
    "Не удалось обновить форму. Повторите попытку через несколько секунд.",
  network:
    "Не удалось отправить сообщение. Проверьте соединение и попробуйте снова.",
  invalidResponse: "Сервис вернул неожиданный ответ. Попробуйте ещё раз.",
  captcha: "Не удалось пройти проверку. Попробуйте ещё раз.",
  success: "✓ Сообщение отправлено",
} as const;

type FormTokenPayload = {
  token: string;
  turnstileSiteKey: string | null;
};

type SuccessResponse = {
  ok: true;
  retryAfter: number;
};

type ErrorResponse = {
  ok: false;
  code: string;
  message: string;
  retryAfter?: number;
  captchaSiteKey?: string;
};

type MessageResponse = SuccessResponse | ErrorResponse;

type Notice = {
  kind: "success" | "error";
  text: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFormTokenPayload(value: unknown): value is FormTokenPayload {
  return (
    isRecord(value) &&
    typeof value.token === "string" &&
    value.token.length > 0 &&
    (typeof value.turnstileSiteKey === "string" ||
      value.turnstileSiteKey === null)
  );
}

function isMessageResponse(value: unknown): value is MessageResponse {
  if (!isRecord(value)) {
    return false;
  }

  if (value.ok === true) {
    return (
      typeof value.retryAfter === "number" &&
      Number.isFinite(value.retryAfter)
    );
  }

  if (value.ok !== false) {
    return false;
  }

  const validRetryAfter =
    value.retryAfter === undefined ||
    (typeof value.retryAfter === "number" &&
      Number.isFinite(value.retryAfter));
  const validCaptchaSiteKey =
    value.captchaSiteKey === undefined ||
    typeof value.captchaSiteKey === "string";

  return (
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    validRetryAfter &&
    validCaptchaSiteKey
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function requestFormToken(signal?: AbortSignal): Promise<FormTokenPayload> {
  const response = await fetch("/api/form-token", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
    signal,
  });
  const payload = await readJson(response);

  if (!response.ok || !isFormTokenPayload(payload)) {
    throw new Error("Invalid form token response");
  }

  return payload;
}

function countUnicodeSymbols(value: string): number {
  return Array.from(value).length;
}

function limitUnicodeSymbols(value: string): string {
  const symbols = Array.from(value);
  return symbols.length > MAX_MESSAGE_LENGTH
    ? symbols.slice(0, MAX_MESSAGE_LENGTH).join("")
    : value;
}

function normalizeRetryAfter(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.ceil(value));
}

function formatSeconds(value: number): string {
  const remainder100 = value % 100;
  const remainder10 = value % 10;
  let unit = "секунд";

  if (remainder100 < 11 || remainder100 > 14) {
    if (remainder10 === 1) {
      unit = "секунду";
    } else if (remainder10 >= 2 && remainder10 <= 4) {
      unit = "секунды";
    }
  }

  return `${value} ${unit}`;
}

type MessageFormProps = {
  nonce?: string;
};

export function MessageForm({ nonce }: MessageFormProps) {
  const reduceMotion = useReducedMotion();
  const isMountedRef = useRef(true);
  const mountRequestRef = useRef<AbortController | null>(null);
  const submitRequestRef = useRef<AbortController | null>(null);
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [formToken, setFormToken] = useState<string | null>(null);
  const [knownSiteKey, setKnownSiteKey] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [isTokenLoading, setIsTokenLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [retryDeadline, setRetryDeadline] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const messageLength = countUnicodeSymbols(message);

  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();
    mountRequestRef.current = controller;

    void requestFormToken(controller.signal)
      .then((payload) => {
        if (!isMountedRef.current) {
          return;
        }

        setFormToken(payload.token);
        if (payload.turnstileSiteKey) {
          setKnownSiteKey(payload.turnstileSiteKey);
        }
        setTokenError(null);
      })
      .catch((error: unknown) => {
        if (
          !isMountedRef.current ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        setTokenError(LOCAL_MESSAGES.tokenLoad);
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsTokenLoading(false);
        }
      });

    return () => {
      isMountedRef.current = false;
      controller.abort();
      submitRequestRef.current?.abort();
      setImagePreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, []);

  useEffect(() => {
    if (retryDeadline === null) {
      return;
    }

    const updateCountdown = () => {
      const nextValue = Math.max(
        0,
        Math.ceil((retryDeadline - Date.now()) / 1000),
      );
      setRemainingSeconds(nextValue);

      if (nextValue === 0) {
        setRetryDeadline((currentDeadline) =>
          currentDeadline === retryDeadline ? null : currentDeadline,
        );
      }
    };

    const intervalId = window.setInterval(updateCountdown, 500);
    document.addEventListener("visibilitychange", updateCountdown);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", updateCountdown);
    };
  }, [retryDeadline]);

  const applyRetryAfter = (retryAfter: number | undefined) => {
    const seconds = normalizeRetryAfter(retryAfter);

    if (seconds === 0) {
      setRetryDeadline(null);
      setRemainingSeconds(0);
      return;
    }

    setRetryDeadline(Date.now() + seconds * 1000);
    setRemainingSeconds(seconds);
  };

  const retryTokenLoad = async () => {
    setIsTokenLoading(true);
    setTokenError(null);
    const controller = new AbortController();
    mountRequestRef.current?.abort();
    mountRequestRef.current = controller;

    try {
      const payload = await requestFormToken(controller.signal);

      if (!isMountedRef.current) {
        return;
      }

      setFormToken(payload.token);
      if (payload.turnstileSiteKey) {
        setKnownSiteKey(payload.turnstileSiteKey);
      }
    } catch (error: unknown) {
      if (
        isMountedRef.current &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setTokenError(LOCAL_MESSAGES.tokenLoad);
      }
    } finally {
      if (isMountedRef.current) {
        setIsTokenLoading(false);
      }
    }
  };

  const handleMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(limitUnicodeSymbols(event.target.value));
  };

  const clearImage = () => {
    setImage(null);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return clearImage();
    if (file.size > MAX_IMAGE_BYTES) {
      clearImage();
      setNotice({ kind: "error", text: LOCAL_MESSAGES.imageTooLarge });
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      clearImage();
      setNotice({ kind: "error", text: LOCAL_MESSAGES.imageType });
      return;
    }
    setImage(file);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setNotice(null);
  };

  const handleCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null);
    setNotice({ kind: "error", text: LOCAL_MESSAGES.captcha });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (trimmedMessage.length === 0 && !image) {
      setNotice({ kind: "error", text: LOCAL_MESSAGES.empty });
      return;
    }

    if (messageLength > MAX_MESSAGE_LENGTH) {
      setNotice({ kind: "error", text: LOCAL_MESSAGES.tooLong });
      return;
    }

    if (!formToken || isSubmitting || remainingSeconds > 0) {
      return;
    }

    if (captchaRequired && !captchaToken) {
      setNotice({
        kind: "error",
        text: "Сначала пройдите проверку, затем отправьте сообщение ещё раз.",
      });
      return;
    }

    const controller = new AbortController();
    submitRequestRef.current?.abort();
    submitRequestRef.current = controller;
    setIsSubmitting(true);
    setNotice(null);
    setTokenError(null);
    setFormToken(null);

    let result: MessageResponse | null = null;
    let requestErrorMessage: string | null = null;

    try {
      const formData = new FormData();
      formData.set("message", message);
      formData.set("formToken", formToken);
      formData.set("website", "");
      if (captchaToken) formData.set("turnstileToken", captchaToken);
      if (image) formData.set("image", image);
      const response = await fetch("/api/messages", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        body: formData,
        signal: controller.signal,
      });
      const payload = await readJson(response);

      if (!isMessageResponse(payload)) {
        requestErrorMessage = LOCAL_MESSAGES.invalidResponse;
      } else {
        result = payload;
      }
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        requestErrorMessage = LOCAL_MESSAGES.network;
      }
    }

    let refreshedToken: FormTokenPayload | null = null;

    if (!controller.signal.aborted) {
      try {
        refreshedToken = await requestFormToken(controller.signal);
      } catch {
        refreshedToken = null;
      }
    }

    if (!isMountedRef.current || controller.signal.aborted) {
      return;
    }

    if (refreshedToken) {
      setFormToken(refreshedToken.token);
      if (refreshedToken.turnstileSiteKey) {
        setKnownSiteKey(refreshedToken.turnstileSiteKey);
      }
    } else {
      setTokenError(LOCAL_MESSAGES.tokenRefresh);
    }

    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
    setIsSubmitting(false);

    if (requestErrorMessage) {
      setNotice({ kind: "error", text: requestErrorMessage });
      return;
    }

    if (!result) {
      setNotice({ kind: "error", text: LOCAL_MESSAGES.invalidResponse });
      return;
    }

    if (result.ok) {
      setMessage("");
      clearImage();
      setCaptchaRequired(false);
      applyRetryAfter(result.retryAfter);
      setNotice({ kind: "success", text: LOCAL_MESSAGES.success });
      window.dispatchEvent(new Event(MESSAGE_CREATED_EVENT));
      return;
    }

    if (result.code === "CAPTCHA_REQUIRED") {
      setCaptchaRequired(true);
      setKnownSiteKey(
        result.captchaSiteKey ??
          refreshedToken?.turnstileSiteKey ??
          knownSiteKey,
      );
    }

    applyRetryAfter(result.retryAfter);
    setNotice({ kind: "error", text: result.message });
  };

  const captchaSiteKey = captchaRequired ? knownSiteKey : null;
  const isBusy = isTokenLoading || isSubmitting;
  const submitDisabled =
    isBusy ||
    !formToken ||
    remainingSeconds > 0 ||
    (message.trim().length === 0 && !image) ||
    messageLength > MAX_MESSAGE_LENGTH ||
    (captchaRequired && (!captchaSiteKey || !captchaToken));

  let buttonLabel = "Отправить анонимно →";

  if (isSubmitting) {
    buttonLabel = "Отправка…";
  } else if (isTokenLoading) {
    buttonLabel = "Загружаем форму…";
  } else if (remainingSeconds > 0) {
    buttonLabel = `Повторить через ${formatSeconds(remainingSeconds)}`;
  } else if (captchaRequired && !captchaToken) {
    buttonLabel = "Пройдите проверку";
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="glass-card mx-auto w-full max-w-2xl rounded-[1.75rem] p-4 text-left sm:rounded-4xl sm:p-6 md:p-7"
      initial={reduceMotion ? false : { y: 12, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      noValidate
    >
      <input
        type="text"
        name="website"
        value=""
        readOnly
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="honeypot-field"
      />

      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between gap-3 px-1 sm:mb-4">
          <label
            htmlFor="anonymous-message"
            className="text-xs font-semibold tracking-wide text-slate-200 sm:text-sm"
          >
            Ваше сообщение
          </label>
          <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10px] text-slate-500 sm:text-[11px]">
            До 1000 символов
          </span>
        </div>

        <div className="textarea-shell rounded-2xl border border-white/9 bg-black/25 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:rounded-[1.35rem] sm:p-2">
          <textarea
            id="anonymous-message"
            name="message"
            value={message}
            onChange={handleMessageChange}
            placeholder="Введите сообщение..."
            rows={7}
            autoComplete="off"
            spellCheck
            disabled={isSubmitting}
            aria-describedby="message-hint message-counter form-status"
            aria-invalid={notice?.kind === "error"}
            className="message-textarea min-h-40 w-full resize-y rounded-xl bg-transparent px-3 py-3 text-[15px] leading-6 text-slate-100 caret-violet-300 disabled:cursor-wait disabled:opacity-60 sm:min-h-44 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-base sm:leading-7"
          />

          <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1 sm:px-4">
            <p id="message-hint" className="text-[10px] text-slate-600 sm:text-[11px]">
              Пишите свободно, но уважительно
            </p>
            <output
              id="message-counter"
              htmlFor="anonymous-message"
              className={`tabular-nums text-[11px] font-medium transition-colors ${
                messageLength >= 900 ? "text-amber-300" : "text-slate-500"
              }`}
              aria-label={`${messageLength} из ${MAX_MESSAGE_LENGTH} символов`}
            >
              {messageLength} / {MAX_MESSAGE_LENGTH}
            </output>
          </div>
        </div>

        <div className="mt-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageChange}
            disabled={isSubmitting}
            className="sr-only"
            id="message-image"
          />
          <label
            htmlFor="message-image"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.08]"
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            Добавить изображение (до 2 МБ)
          </label>
          {imagePreviewUrl ? (
            <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviewUrl} alt="Предпросмотр выбранного изображения" className="max-h-72 w-full rounded-xl object-contain" />
              <button type="button" onClick={clearImage} className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white" aria-label="Удалить изображение">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <AnimatePresence initial={false} mode="popLayout">
          {notice ? (
            <motion.div
              id="form-status"
              key={`${notice.kind}-${notice.text}`}
              role={notice.kind === "error" ? "alert" : "status"}
              aria-live={notice.kind === "error" ? "assertive" : "polite"}
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              className={`mt-4 flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-sm leading-5 sm:px-4 ${
                notice.kind === "success"
                  ? "border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-100"
                  : "border-rose-300/15 bg-rose-300/6.5 text-rose-100"
              }`}
            >
              {notice.kind === "success" ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-emerald-300"
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-rose-300"
                  aria-hidden="true"
                />
              )}
              <div>
                <p>{notice.text}</p>
                {remainingSeconds > 0 ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs opacity-75">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    ⏱ Следующее сообщение через {formatSeconds(remainingSeconds)}.
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : (
            <span id="form-status" className="sr-only" aria-live="polite">
              {isSubmitting ? "Сообщение отправляется" : "Форма готова"}
            </span>
          )}
        </AnimatePresence>

        {tokenError ? (
          <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/6 px-3.5 py-3 text-xs leading-5 text-amber-100 sm:flex-row sm:items-center sm:px-4">
            <span>{tokenError}</span>
            <button
              type="button"
              onClick={() => void retryTokenLoad()}
              disabled={isTokenLoading || isSubmitting}
              className="shrink-0 rounded-full border border-amber-200/20 bg-amber-100/[0.07] px-3 py-1.5 font-semibold text-amber-100 transition hover:bg-amber-100/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-wait disabled:opacity-50"
            >
              Повторить
            </button>
          </div>
        ) : null}

        <div className="mt-4">
          <TurnstileWidget
            siteKey={captchaSiteKey}
            resetKey={captchaResetKey}
            nonce={nonce}
            onTokenChangeAction={handleCaptchaToken}
            onErrorAction={handleCaptchaError}
          />
        </div>

        {captchaRequired && !captchaSiteKey ? (
          <p
            className="mt-4 rounded-2xl border border-rose-300/15 bg-rose-300/6.5 px-4 py-3 text-xs leading-5 text-rose-100"
            role="alert"
          >
            Проверка временно недоступна. Обновите страницу и попробуйте снова.
          </p>
        ) : null}

        <motion.button
          type="submit"
          disabled={submitDisabled}
          whileHover={reduceMotion || submitDisabled ? undefined : { y: -1 }}
          whileTap={reduceMotion || submitDisabled ? undefined : { scale: 0.99 }}
          className="send-button mt-4 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-linear-to-r from-violet-600 via-violet-500 to-indigo-500 px-5 py-4 text-sm font-semibold text-white transition-[filter,opacity,transform] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:from-slate-700 disabled:via-slate-700 disabled:to-slate-800 disabled:text-slate-400 disabled:opacity-65 disabled:shadow-none sm:text-[15px]"
        >
          {isBusy ? (
            <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" />
          ) : remainingSeconds > 0 ? (
            <Clock3 className="size-4.5" aria-hidden="true" />
          ) : (
            <Send className="size-4.5" aria-hidden="true" />
          )}
          <span>{buttonLabel}</span>
        </motion.button>

        <div className="mt-4 flex items-start gap-2.5 px-1 text-[10px] leading-[1.55] text-slate-500 sm:mt-5 sm:text-[11px]">
          <LockKeyhole
            className="mt-0.5 size-3.5 shrink-0 text-slate-500"
            aria-hidden="true"
          />
          <p>
            Сообщения отправляются без регистрации. Для защиты сервиса от спама
            используются технические данные. Не указывайте пароли и другую
            конфиденциальную информацию.
          </p>
        </div>
      </div>
    </motion.form>
  );
}
