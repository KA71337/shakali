"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  Activity,
  Ban,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Fingerprint,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  Monitor,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

export type AdminDashboardData = {
  stats: {
    total: number;
    today: number;
    blocked: number;
    pendingTelegram: number;
  };
  messages: Array<{
    id: string;
    message: string;
    createdAt: string;
    ipHash: string;
    userAgent: string;
    device: string;
    browser: string;
    os: string;
    model: string | null;
    moderationStatus: string;
    telegramStatus: string;
    sourceKey: string;
    isBlocked: boolean;
  }>;
};

type AdminDashboardProps = Readonly<{
  data: AdminDashboardData;
}>;

type Confirmation =
  | {
      kind: "delete";
      id: string;
    }
  | {
      kind: "block" | "unblock";
      sourceKey: string;
    };

type Feedback = {
  kind: "success" | "error";
  message: string;
};

type StatCard = {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  accent: string;
  iconStyle: string;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("ru-RU");

const moderationLabels: Record<string, string> = {
  allowed: "Разрешено",
  approved: "Одобрено",
  blocked: "Заблокировано",
  clean: "Чисто",
  pending: "На проверке",
  rejected: "Отклонено",
};

const telegramLabels: Record<string, string> = {
  blocked: "Не отправлено",
  delivered: "Доставлено",
  failed: "Ошибка",
  pending: "В очереди",
  sent: "Отправлено",
  skipped: "Пропущено",
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Дата неизвестна";
  }

  return dateFormatter.format(date);
}

function getResponseMessage(payload: unknown): string | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return null;
}

async function ensureSuccessfulResponse(
  response: Response,
  fallbackMessage: string,
) {
  if (response.ok) {
    return;
  }

  const payload: unknown = await response.json().catch(() => null);
  throw new Error(getResponseMessage(payload) ?? fallbackMessage);
}

function getStatusStyle(value: string) {
  const normalized = value.toLocaleLowerCase("en-US");

  if (
    normalized.includes("block") ||
    normalized.includes("reject") ||
    normalized.includes("fail") ||
    normalized.includes("error")
  ) {
    return "border-rose-400/15 bg-rose-400/[0.08] text-rose-200";
  }

  if (
    normalized.includes("allow") ||
    normalized.includes("approv") ||
    normalized.includes("clean") ||
    normalized.includes("deliver") ||
    normalized.includes("sent") ||
    normalized.includes("success")
  ) {
    return "border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-200";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("queue") ||
    normalized.includes("wait")
  ) {
    return "border-amber-400/15 bg-amber-400/[0.08] text-amber-200";
  }

  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function StatusPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const normalized = value.toLocaleLowerCase("en-US");
  const labels = label === "Модерация" ? moderationLabels : telegramLabels;
  const displayValue = labels[normalized] ?? value;

  return (
    <span
      title={`${label}: ${value}`}
      aria-label={`${label}: ${displayValue}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusStyle(value)}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {displayValue}
    </span>
  );
}

function TechnicalItem({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </dt>
      <dd className="wrap-break-word text-xs leading-5 text-zinc-300">{children}</dd>
    </div>
  );
}

function ConfirmationDialog({
  confirmation,
  busy,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isDelete = confirmation.kind === "delete";
  const isUnblock = confirmation.kind === "unblock";

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onCancel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements =
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        );

      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [busy, onCancel]);

  const detail = isDelete
    ? "Сообщение будет удалено без возможности восстановления."
    : isUnblock
      ? "Источник и связанные с ним IP/device будут разблокированы. Ранее скрытые сообщения останутся скрытыми."
      : "Новые сообщения от этого источника и связанных IP/device будут автоматически блокироваться.";

  const identifier = isDelete
    ? `ID: ${confirmation.id}`
    : confirmation.sourceKey;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <motion.div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirmation-title"
        aria-describedby="admin-confirmation-description"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#10141c] p-6 shadow-2xl shadow-black/70"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Закрыть подтверждение"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/6 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        <div
          className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border ${
            isDelete
              ? "border-rose-400/15 bg-rose-400/8 text-rose-300"
              : "border-amber-400/15 bg-amber-400/8 text-amber-300"
          }`}
        >
          {isDelete ? (
            <Trash2 aria-hidden="true" className="h-5 w-5" />
          ) : isUnblock ? (
            <RotateCcw aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Ban aria-hidden="true" className="h-5 w-5" />
          )}
        </div>

        <h2
          id="admin-confirmation-title"
          className="pr-8 text-xl font-semibold tracking-tight text-white"
        >
          {isDelete
            ? "Удалить сообщение?"
            : isUnblock
              ? "Разблокировать источник?"
              : "Заблокировать источник?"}
        </h2>
        <p
          id="admin-confirmation-description"
          className="mt-2 text-sm leading-6 text-zinc-400"
        >
          {detail}
        </p>
        <p className="mt-4 break-all rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 font-mono text-[11px] leading-5 text-zinc-500">
          {identifier}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10141c] disabled:cursor-wait disabled:opacity-60 ${
              isDelete
                ? "bg-rose-400 text-rose-950 hover:bg-rose-300 focus-visible:ring-rose-400"
                : "bg-amber-300 text-amber-950 hover:bg-amber-200 focus-visible:ring-amber-300"
            }`}
          >
            {busy ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : isDelete ? (
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            ) : isUnblock ? (
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Ban aria-hidden="true" className="h-4 w-4" />
            )}
            {isDelete ? "Удалить" : isUnblock ? "Разблокировать" : "Заблокировать"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function AdminDashboard({ data }: AdminDashboardProps) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const statCards: StatCard[] = [
    {
      label: "Всего сообщений",
      value: data.stats.total,
      detail: "За всё время",
      icon: Database,
      accent: "from-sky-400/14 to-sky-400/2",
      iconStyle: "border-sky-400/15 bg-sky-400/8 text-sky-300",
    },
    {
      label: "Получено сегодня",
      value: data.stats.today,
      detail: "Текущие сутки",
      icon: Activity,
      accent: "from-emerald-400/14 to-emerald-400/2",
      iconStyle:
        "border-emerald-400/15 bg-emerald-400/8 text-emerald-300",
    },
    {
      label: "Заблокировано",
      value: data.stats.blocked,
      detail: "Модерацией",
      icon: Ban,
      accent: "from-rose-400/14 to-rose-400/2",
      iconStyle: "border-rose-400/15 bg-rose-400/8 text-rose-300",
    },
    {
      label: "Ожидают Telegram",
      value: data.stats.pendingTelegram,
      detail: "В очереди отправки",
      icon: Send,
      accent: "from-amber-400/14 to-amber-400/2",
      iconStyle:
        "border-amber-400/15 bg-amber-400/8 text-amber-300",
    },
  ];

  function refreshDashboard() {
    startRefresh(() => router.refresh());
  }

  async function handleConfirmedAction() {
    if (!confirmation || actionKey) {
      return;
    }

    const currentConfirmation = confirmation;
    const currentActionKey =
      currentConfirmation.kind === "delete"
        ? `delete:${currentConfirmation.id}`
        : `${currentConfirmation.kind}:${currentConfirmation.sourceKey}`;

    setActionKey(currentActionKey);
    setFeedback(null);

    try {
      if (currentConfirmation.kind === "delete") {
        const response = await fetch(
          `/api/admin/messages/${encodeURIComponent(currentConfirmation.id)}`,
          { method: "DELETE" },
        );

        await ensureSuccessfulResponse(
          response,
          "Не удалось удалить сообщение.",
        );
        setFeedback({ kind: "success", message: "Сообщение удалено." });
      } else {
        const isUnblock = currentConfirmation.kind === "unblock";
        const response = await fetch("/api/admin/sources/block", {
          method: isUnblock ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sourceKey: currentConfirmation.sourceKey }),
        });

        await ensureSuccessfulResponse(
          response,
          isUnblock
            ? "Не удалось разблокировать источник."
            : "Не удалось заблокировать источник.",
        );
        setFeedback({
          kind: "success",
          message: isUnblock
            ? "Источник и связанные ограничения разблокированы."
            : "Источник добавлен в список блокировки.",
        });
      }

      setConfirmation(null);
      startRefresh(() => router.refresh());
    } catch (caughtError: unknown) {
      setFeedback({
        kind: "error",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Не удалось выполнить действие. Повторите попытку.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      await ensureSuccessfulResponse(response, "Не удалось завершить сессию.");

      router.replace("/admin/login");
      startRefresh(() => router.refresh());
    } catch (caughtError: unknown) {
      setFeedback({
        kind: "error",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Не удалось завершить сессию.",
      });
      setIsLoggingOut(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-hidden bg-[#07090d] text-zinc-100">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(56,189,248,0.10),transparent_30%),radial-gradient(circle_at_95%_5%,rgba(99,102,241,0.08),transparent_25%)]"
        />

        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#080b10]/85 backdrop-blur-xl">
          <div className="relative mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/8 text-sky-300">
                <ShieldCheck aria-hidden="true" className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold tracking-tight text-white">
                    Панель управления
                  </p>
                  <span className="hidden rounded-md border border-white/8 bg-white/4 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500 sm:inline">
                    admin
                  </span>
                </div>
                <p className="hidden text-[11px] text-zinc-500 sm:block">
                  Мониторинг входящих сообщений
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshDashboard}
                disabled={isRefreshing}
                aria-label="Обновить данные"
                title="Обновить данные"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.035] text-zinc-400 transition hover:border-white/15 hover:bg-white/7 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-wait disabled:opacity-50"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex h-9 items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] px-3 text-xs font-medium text-zinc-300 transition hover:border-rose-400/20 hover:bg-rose-400/7 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-wait disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                ) : (
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </div>
          </div>
        </header>

        <main className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-sky-300/75">
                <LayoutDashboard aria-hidden="true" className="h-3.5 w-3.5" />
                Обзор системы
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
                Сводка активности
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Актуальные показатели и последние входящие сообщения.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/6 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_rgba(110,231,183,0.75)]" />
              Данные загружены
            </div>
          </div>

          <AnimatePresence mode="popLayout" initial={false}>
            {feedback ? (
              <motion.div
                key={`${feedback.kind}:${feedback.message}`}
                role={feedback.kind === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-5 overflow-hidden"
              >
                <div
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
                    feedback.kind === "error"
                      ? "border-rose-400/15 bg-rose-400/[0.07] text-rose-200"
                      : "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-200"
                  }`}
                >
                  {feedback.kind === "error" ? (
                    <CircleAlert
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                  ) : (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                  )}
                  <span className="flex-1">{feedback.message}</span>
                  <button
                    type="button"
                    onClick={() => setFeedback(null)}
                    aria-label="Закрыть уведомление"
                    className="rounded-md p-0.5 opacity-60 transition hover:bg-white/10 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <section aria-labelledby="statistics-title">
            <h2 id="statistics-title" className="sr-only">
              Статистика сообщений
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((stat, index) => {
                const Icon = stat.icon;

                return (
                  <motion.article
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: index * 0.045,
                      duration: 0.35,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={`relative overflow-hidden rounded-2xl border border-white/7 bg-linear-to-br ${stat.accent} p-4 shadow-lg shadow-black/10 sm:p-5`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium text-zinc-500">
                          {stat.label}
                        </p>
                        <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                          {numberFormatter.format(stat.value)}
                        </p>
                        <p className="mt-1.5 text-[11px] text-zinc-600">
                          {stat.detail}
                        </p>
                      </div>
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${stat.iconStyle}`}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="messages-title" className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <MessageSquareText
                    aria-hidden="true"
                    className="h-4 w-4 text-sky-300"
                  />
                  <h2
                    id="messages-title"
                    className="text-lg font-semibold tracking-tight text-white"
                  >
                    Последние сообщения
                  </h2>
                </div>
                <p className="text-xs text-zinc-600">
                  Показано: {numberFormatter.format(data.messages.length)}
                </p>
              </div>
              <div className="hidden items-center gap-1.5 text-[11px] text-zinc-600 sm:flex">
                <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                Новые сверху
              </div>
            </div>

            {data.messages.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/2 px-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.035] text-zinc-500">
                  <MessageSquareText aria-hidden="true" className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-300">
                  Сообщений пока нет
                </h3>
                <p className="mt-1.5 max-w-sm text-xs leading-5 text-zinc-600">
                  Новые входящие сообщения появятся здесь автоматически после
                  обновления данных.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.messages.map((message, index) => {
                  const deleteActionKey = `delete:${message.id}`;
                  const sourceActionKind = message.isBlocked ? "unblock" : "block";
                  const sourceActionKey = `${sourceActionKind}:${message.sourceKey}`;
                  const isMessageBusy =
                    actionKey === deleteActionKey || actionKey === sourceActionKey;

                  return (
                    <motion.article
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: Math.min(index * 0.025, 0.2),
                        duration: 0.3,
                      }}
                      aria-labelledby={`message-${message.id}`}
                      className="group overflow-hidden rounded-2xl border border-white/7 bg-[#0c1017]/90 shadow-lg shadow-black/10 transition-colors hover:border-white/11"
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 id={`message-${message.id}`} className="sr-only">
                              Сообщение {message.id}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill
                                label="Модерация"
                                value={message.moderationStatus}
                              />
                              <StatusPill
                                label="Telegram"
                                value={message.telegramStatus}
                              />
                            </div>
                          </div>
                          <time
                            dateTime={message.createdAt}
                            suppressHydrationWarning
                            className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500"
                          >
                            <CalendarClock
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                            />
                            {formatDate(message.createdAt)}
                          </time>
                        </div>

                        <p className="mt-4 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-zinc-200 sm:text-[15px]">
                          {message.message || "Пустое сообщение"}
                        </p>
                      </div>

                      <div className="border-t border-white/6 bg-black/15 p-4 sm:p-5">
                        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                          <Monitor aria-hidden="true" className="h-3.5 w-3.5" />
                          Техническая информация
                        </div>
                        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                          <TechnicalItem label="Устройство">
                            <span className="inline-flex items-center gap-1.5">
                              <Smartphone
                                aria-hidden="true"
                                className="h-3.5 w-3.5 text-zinc-600"
                              />
                              {message.device || "Не определено"}
                            </span>
                          </TechnicalItem>
                          <TechnicalItem label="Модель">
                            {message.model || "Не определена"}
                          </TechnicalItem>
                          <TechnicalItem label="Браузер">
                            {message.browser || "Не определён"}
                          </TechnicalItem>
                          <TechnicalItem label="ОС">
                            {message.os || "Не определена"}
                          </TechnicalItem>
                          <TechnicalItem label="IP hash">
                            <span className="inline-flex max-w-full items-center gap-1.5 font-mono text-[11px]">
                              <Fingerprint
                                aria-hidden="true"
                                className="h-3.5 w-3.5 shrink-0 text-zinc-600"
                              />
                              <span className="truncate" title={message.ipHash}>
                                {message.ipHash}
                              </span>
                            </span>
                          </TechnicalItem>
                          <TechnicalItem label="Источник">
                            <span
                              className="block truncate font-mono text-[11px]"
                              title={message.sourceKey}
                            >
                              {message.sourceKey}
                            </span>
                          </TechnicalItem>
                          <TechnicalItem
                            label="User agent"
                            className="col-span-2 sm:col-span-3 lg:col-span-6"
                          >
                            <span className="block break-all font-mono text-[10px] leading-4 text-zinc-500">
                              {message.userAgent || "Не определён"}
                            </span>
                          </TechnicalItem>
                        </dl>

                        <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-4 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmation({
                                kind: sourceActionKind,
                                sourceKey: message.sourceKey,
                              })
                            }
                            disabled={isMessageBusy}
                            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-45 sm:min-h-9 ${
                              message.isBlocked
                                ? "border-emerald-400/10 bg-emerald-400/5 text-emerald-200/80 hover:border-emerald-400/20 hover:bg-emerald-400/9 hover:text-emerald-200 focus-visible:ring-emerald-400"
                                : "border-amber-400/10 bg-amber-400/5 text-amber-200/80 hover:border-amber-400/20 hover:bg-amber-400/9 hover:text-amber-200 focus-visible:ring-amber-400"
                            }`}
                          >
                            {actionKey === sourceActionKey ? (
                              <LoaderCircle
                                aria-hidden="true"
                                className="h-3.5 w-3.5 animate-spin"
                              />
                            ) : message.isBlocked ? (
                              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                            ) : (
                              <Ban aria-hidden="true" className="h-3.5 w-3.5" />
                            )}
                            {message.isBlocked
                              ? "Разблокировать источник"
                              : "Заблокировать источник"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmation({ kind: "delete", id: message.id })
                            }
                            disabled={isMessageBusy}
                            className="flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-400/10 bg-rose-400/5 px-3 text-xs font-medium text-rose-200/80 transition hover:border-rose-400/20 hover:bg-rose-400/9 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-wait disabled:opacity-45"
                          >
                            {actionKey === deleteActionKey ? (
                              <LoaderCircle
                                aria-hidden="true"
                                className="h-3.5 w-3.5 animate-spin"
                              />
                            ) : (
                              <Trash2
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                              />
                            )}
                            Удалить
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </section>

          <footer className="mt-8 flex flex-col gap-2 border-t border-white/6 py-5 text-[11px] text-zinc-700 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5">
              <LockKeyhole aria-hidden="true" className="h-3 w-3" />
              Защищённая административная зона
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bot aria-hidden="true" className="h-3 w-3" />
              Статус Telegram отражает состояние доставки
            </span>
          </footer>
        </main>

        <AnimatePresence>
          {confirmation ? (
            <ConfirmationDialog
              confirmation={confirmation}
              busy={actionKey !== null}
              onCancel={() => {
                if (!actionKey) {
                  setConfirmation(null);
                }
              }}
              onConfirm={handleConfirmedAction}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
