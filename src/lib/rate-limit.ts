import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const COOLDOWN_MS = 10_000;
const REQUEST_WINDOW_MS = 60_000;
const CAPTCHA_AFTER_REQUESTS = 8;
const HARD_LIMIT_REQUESTS = 25;
const CAPTCHA_DURATION_MS = 15 * 60_000;
const HARD_BLOCK_MS = 15 * 60_000;

export class RequestLimitError extends Error {
  constructor(
    public readonly code: "RATE_LIMITED" | "TOO_MANY_REQUESTS" | "SOURCE_BLOCKED",
    public readonly retryAfter: number,
    message: string,
  ) {
    super(message);
  }
}

type Identity = {
  ipHash: string;
  deviceHash: string;
  sourceKey: string;
};

type MessageRecord = Identity & {
  message: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
  model: string | null;
};

function bucketDefinitions(identity: Identity) {
  return [
    { key: `ip:${identity.ipHash}`, kind: "ip" },
    { key: `device:${identity.deviceHash}`, kind: "device" },
  ] as const;
}

async function lockIdentity(tx: Prisma.TransactionClient, identity: Identity): Promise<void> {
  const keys = [
    `source:${identity.sourceKey}`,
    ...bucketDefinitions(identity).map(({ key }) => key),
  ].sort();

  for (const key of keys) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}

async function assertSourceAllowed(tx: Prisma.TransactionClient, identity: Identity): Promise<void> {
  const blocked = await tx.source.findFirst({
    where: {
      isBlocked: true,
      OR: [
        { sourceKey: identity.sourceKey },
        { ipHash: identity.ipHash },
        { deviceHash: identity.deviceHash },
      ],
    },
    select: { sourceKey: true },
  });

  if (blocked) {
    throw new RequestLimitError(
      "SOURCE_BLOCKED",
      24 * 60 * 60,
      "Слишком много запросов. Попробуйте позже.",
    );
  }
}

export async function assessRequest(
  identity: Identity,
  now = new Date(),
): Promise<{ captchaRequired: boolean }> {
  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await lockIdentity(tx, identity);
    await assertSourceAllowed(tx, identity);
    let captchaRequired = false;
    let hardLimitRetryAfter = 0;

    for (const definition of bucketDefinitions(identity)) {
      const existing = await tx.rateLimitBucket.findUnique({ where: { key: definition.key } });

      if (existing?.blockedUntil && existing.blockedUntil > now) {
        throw new RequestLimitError(
          "TOO_MANY_REQUESTS",
          Math.max(1, Math.ceil((existing.blockedUntil.getTime() - now.getTime()) / 1000)),
          "Слишком много запросов. Попробуйте позже.",
        );
      }

      const windowExpired =
        !existing || now.getTime() - existing.windowStartedAt.getTime() >= REQUEST_WINDOW_MS;
      const requestCount = windowExpired ? 1 : (existing?.requestCount ?? 0) + 1;
      const blockedUntil =
        requestCount > HARD_LIMIT_REQUESTS ? new Date(now.getTime() + HARD_BLOCK_MS) : null;
      const captchaUntil =
        requestCount > CAPTCHA_AFTER_REQUESTS
          ? new Date(now.getTime() + CAPTCHA_DURATION_MS)
          : existing?.captchaUntil && existing.captchaUntil > now
            ? existing.captchaUntil
            : null;

      await tx.rateLimitBucket.upsert({
        where: { key: definition.key },
        create: {
          key: definition.key,
          kind: definition.kind,
          requestCount,
          windowStartedAt: now,
          captchaUntil,
          blockedUntil,
        },
        update: {
          requestCount,
          windowStartedAt: windowExpired ? now : existing?.windowStartedAt,
          captchaUntil,
          blockedUntil,
        },
      });

      if (blockedUntil) {
        hardLimitRetryAfter = Math.max(
          hardLimitRetryAfter,
          Math.ceil(HARD_BLOCK_MS / 1000),
        );
      }

      captchaRequired ||= Boolean(captchaUntil && captchaUntil > now);
    }

    return { captchaRequired, hardLimitRetryAfter };
  });

  if (result.hardLimitRetryAfter > 0) {
    throw new RequestLimitError(
      "TOO_MANY_REQUESTS",
      result.hardLimitRetryAfter,
      "Слишком много запросов. Попробуйте позже.",
    );
  }

  return { captchaRequired: result.captchaRequired };
}

export async function reserveAndSaveMessage(
  input: MessageRecord,
  now = new Date(),
) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    await lockIdentity(tx, input);
    await assertSourceAllowed(tx, input);
    let retryAfter = 0;

    for (const definition of bucketDefinitions(input)) {
      const bucket = await tx.rateLimitBucket.upsert({
        where: { key: definition.key },
        create: { key: definition.key, kind: definition.kind },
        update: {},
      });

      if (bucket.lastMessageAt) {
        const remaining = COOLDOWN_MS - (now.getTime() - bucket.lastMessageAt.getTime());
        retryAfter = Math.max(retryAfter, Math.ceil(remaining / 1000));
      }
    }

    if (retryAfter > 0) {
      throw new RequestLimitError(
        "RATE_LIMITED",
        retryAfter,
        "Подождите ещё несколько секунд.",
      );
    }

    for (const definition of bucketDefinitions(input)) {
      await tx.rateLimitBucket.update({
        where: { key: definition.key },
        data: { lastMessageAt: now },
      });
    }

    await tx.source.upsert({
      where: { sourceKey: input.sourceKey },
      create: {
        sourceKey: input.sourceKey,
        ipHash: input.ipHash,
        deviceHash: input.deviceHash,
        lastSeenAt: now,
        messagesCount: 1,
      },
      update: {
        lastSeenAt: now,
        messagesCount: { increment: 1 },
      },
    });

    return tx.message.create({
      data: {
        message: input.message,
        ipHash: input.ipHash,
        deviceHash: input.deviceHash,
        sourceKey: input.sourceKey,
        userAgent: input.userAgent,
        device: input.device,
        browser: input.browser,
        os: input.os,
        model: input.model,
      },
    });
  });
}

export const MESSAGE_COOLDOWN_SECONDS = COOLDOWN_MS / 1000;
