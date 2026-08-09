import "server-only";

import { db } from "@/lib/db";
import { getServerConfig } from "@/lib/env";
import { requireAdmin } from "@/lib/auth";

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return representedAsUtc - date.getTime();
}

function startOfToday(timeZone: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const utcGuess = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
  );
  return new Date(utcGuess.getTime() - getTimeZoneOffset(utcGuess, timeZone));
}

export async function getAdminDashboardData() {
  await requireAdmin();
  const today = startOfToday(getServerConfig().appTimezone);

  const [total, todayCount, blocked, pendingTelegram, messages] = await db.$transaction([
    db.message.count(),
    db.message.count({ where: { createdAt: { gte: today } } }),
    db.source.count({ where: { isBlocked: true } }),
    db.message.count({ where: { telegramStatus: { in: ["pending", "failed"] } } }),
    db.message.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        message: true,
        createdAt: true,
        ipHash: true,
        userAgent: true,
        device: true,
        browser: true,
        os: true,
        model: true,
        moderationStatus: true,
        telegramStatus: true,
        sourceKey: true,
      },
    }),
  ]);

  const sources = await db.source.findMany({
    where: { sourceKey: { in: [...new Set(messages.map((message) => message.sourceKey))] } },
    select: { sourceKey: true, isBlocked: true },
  });
  const blockedBySourceKey = new Map(
    sources.map((source) => [source.sourceKey, source.isBlocked]),
  );

  return {
    stats: { total, today: todayCount, blocked, pendingTelegram },
    messages: messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
      ipHash: message.ipHash.slice(0, 16),
      isBlocked: blockedBySourceKey.get(message.sourceKey) ?? false,
    })),
  };
}
