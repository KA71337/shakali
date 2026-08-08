import { MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { headers } from "next/headers";
import { connection } from "next/server";

import { MessageForm } from "@/components/message-form";

export default async function Home() {
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <div className="site-shell relative isolate flex min-h-svh flex-col overflow-hidden">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Перейти к форме
      </a>

      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <div className="mesh-orb mesh-orb-violet" />
        <div className="mesh-orb mesh-orb-cyan" />
        <div className="mesh-orb mesh-orb-blue" />
        <div className="grid-mask absolute inset-0" />
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-300/35 to-transparent" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <div className="flex items-center gap-3" aria-label="Без имени">
          <span className="brand-mark flex size-10 items-center justify-center rounded-2xl sm:size-11">
            <MessageCircle className="size-5 text-violet-100" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-[0.02em] text-white/90 sm:text-base">
            Без имени
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/4.5 px-3 py-2 text-[11px] font-medium text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:px-4 sm:text-xs">
          <ShieldCheck className="size-3.5 text-emerald-300" aria-hidden="true" />
          <span className="hidden sm:inline">Защищённая форма</span>
          <span className="sm:hidden">Защищено</span>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 pb-14 pt-8 sm:px-8 sm:pb-20 sm:pt-12 lg:pt-16"
      >
        <section className="w-full max-w-3xl text-center" aria-labelledby="page-title">
          <div className="hero-enter mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.19em] text-violet-200 sm:mb-6 sm:text-[11px]">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Пространство без лишних слов
          </div>

          <h1
            id="page-title"
            className="hero-enter hero-enter-delay-1 text-balance text-[2.55rem] font-semibold leading-[1.03] tracking-[-0.045em] text-white sm:text-6xl md:text-7xl"
          >
            Анонимное <span className="title-gradient">сообщение</span>
          </h1>
          <p className="hero-enter hero-enter-delay-2 mx-auto mt-5 max-w-xl text-pretty text-base leading-7 text-slate-400 sm:mt-6 sm:text-lg sm:leading-8">
            Напишите что-нибудь. Регистрация не требуется.
          </p>

          <div className="hero-enter hero-enter-delay-3 mt-8 sm:mt-10">
            <MessageForm nonce={nonce} />
          </div>

          <div className="hero-enter hero-enter-delay-4 mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 sm:mt-8 sm:gap-x-7">
            <span className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-emerald-300/80 shadow-[0_0_8px_rgba(110,231,183,0.7)]" />
              Без регистрации
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-violet-300/80 shadow-[0_0_8px_rgba(196,181,253,0.7)]" />
              До 1000 символов
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-sky-300/80 shadow-[0_0_8px_rgba(125,211,252,0.7)]" />
              Только по существу
            </span>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 py-6 text-center text-[11px] leading-5 tracking-wide text-slate-600 sm:px-8 sm:text-xs">
        <p>Анонимно · бережно · без лишних шагов</p>
        <p className="mx-auto mt-1 max-w-2xl">
          Сообщения отправляются без регистрации. Для защиты сервиса от спама используются технические данные.
        </p>
      </footer>
    </div>
  );
}
