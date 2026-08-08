-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "model" TEXT,
    "moderationStatus" TEXT NOT NULL DEFAULT 'clean',
    "telegramStatus" TEXT NOT NULL DEFAULT 'pending',
    "telegramError" TEXT,
    "notificationAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "sourceKey" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messagesCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("sourceKey")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "captchaUntil" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Message_ipHash_idx" ON "Message"("ipHash");

-- CreateIndex
CREATE INDEX "Message_deviceHash_idx" ON "Message"("deviceHash");

-- CreateIndex
CREATE INDEX "Message_sourceKey_idx" ON "Message"("sourceKey");

-- CreateIndex
CREATE INDEX "Message_telegramStatus_idx" ON "Message"("telegramStatus");

-- CreateIndex
CREATE INDEX "Source_ipHash_idx" ON "Source"("ipHash");

-- CreateIndex
CREATE INDEX "Source_deviceHash_idx" ON "Source"("deviceHash");

-- CreateIndex
CREATE INDEX "Source_isBlocked_idx" ON "Source"("isBlocked");

-- CreateIndex
CREATE INDEX "RateLimitBucket_blockedUntil_idx" ON "RateLimitBucket"("blockedUntil");

-- CreateIndex
CREATE INDEX "LoginAttempt_blockedUntil_idx" ON "LoginAttempt"("blockedUntil");
