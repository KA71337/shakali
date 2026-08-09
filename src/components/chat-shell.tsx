import { KeyRound, MessageCircle } from "lucide-react";
import Link from "next/link";

import { MessageForm } from "@/components/message-form";
import { PublicChatFeed } from "@/components/public-chat-feed";

type ChatShellProps = {
  nonce?: string;
};

export function ChatShell({ nonce }: ChatShellProps) {
  return (
    <div className="site-shell min-h-svh">
      <a
        href="#message-composer"
        className="sr-only z-50 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Перейти к сообщению
      </a>

      <main className="chat-page" aria-labelledby="page-title">
        <section className="telegram-chat">
          <header className="chat-header">
            <span className="brand-mark flex size-10 shrink-0 items-center justify-center rounded-full">
              <MessageCircle className="size-5 text-violet-100" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 id="page-title" className="truncate text-[15px] font-semibold text-white">
                Общий чат
              </h1>
              <p className="truncate text-xs text-slate-400">Все участники — Анонимный</p>
            </div>
            <Link
              href="/admin/login"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
              aria-label="Открыть вход в админ-панель"
            >
              <KeyRound className="size-4.5" aria-hidden="true" />
            </Link>
          </header>

          <PublicChatFeed />
          <MessageForm nonce={nonce} />
        </section>
      </main>
    </div>
  );
}
