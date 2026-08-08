"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        throw new Error(
          getResponseMessage(payload) ??
            "Не удалось войти. Проверьте пароль и повторите попытку.",
        );
      }

      router.replace("/admin");
      router.refresh();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Сервис временно недоступен. Повторите попытку позже.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-[#07090d] px-4 py-12 text-zinc-100 sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(56,189,248,0.14),transparent_38%),radial-gradient(circle_at_90%_85%,rgba(99,102,241,0.10),transparent_30%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-size-[48px_48px] opacity-[0.025]"
        />

        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          aria-labelledby="admin-login-title"
          className="relative w-full max-w-md"
        >
          <div className="absolute -inset-px rounded-[29px] bg-linear-to-b from-sky-400/25 via-white/8 to-transparent blur-[1px]" />
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1118]/95 p-6 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-8">
            <div
              aria-hidden="true"
              className="absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-sky-300/80 to-transparent"
            />

            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300 shadow-lg shadow-sky-950/40">
                <ShieldCheck aria-hidden="true" className="h-6 w-6" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/7 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" />
                Защищённый контур
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">
                Административный доступ
              </p>
              <h1
                id="admin-login-title"
                className="text-3xl font-semibold tracking-[-0.035em] text-white"
              >
                Панель управления
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
                Введите пароль администратора для доступа к защищённой панели.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              aria-busy={isSubmitting}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="admin-password"
                  className="mb-2.5 block text-sm font-medium text-zinc-200"
                >
                  Пароль
                </label>
                <div className="group relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-sky-300"
                  />
                  <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "admin-login-error" : undefined}
                    placeholder="Введите пароль"
                    className="h-13 w-full rounded-2xl border border-white/10 bg-white/[0.035] py-3 pl-11 pr-12 text-base text-white outline-none transition placeholder:text-zinc-600 hover:border-white/15 focus:border-sky-400/50 focus:bg-sky-400/[0.035] focus:ring-4 focus:ring-sky-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={isSubmitting}
                    aria-label={
                      showPassword ? "Скрыть пароль" : "Показать пароль"
                    }
                    aria-pressed={showPassword}
                    className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/6 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {error ? (
                  <motion.div
                    id="admin-login-error"
                    role="alert"
                    initial={{ opacity: 0, height: 0, y: -4 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -4 }}
                    className="overflow-hidden"
                  >
                    <p className="rounded-xl border border-rose-400/15 bg-rose-400/7 px-3.5 py-3 text-sm leading-5 text-rose-200">
                      {error}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isSubmitting || !password}
                className="group flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-sky-300 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-950/40 transition hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1118] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:shadow-none"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                    Проверка доступа…
                  </>
                ) : (
                  <>
                    Войти
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 flex items-center gap-3 border-t border-white/7 pt-5 text-xs leading-5 text-zinc-500">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/4">
                <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
              Доступ разрешён только авторизованным администраторам.
            </div>
          </div>
        </motion.section>
      </main>
    </MotionConfig>
  );
}
