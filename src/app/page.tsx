import { headers } from "next/headers";
import { connection } from "next/server";

import { ChatShell } from "@/components/chat-shell";

export default async function Home() {
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return <ChatShell nonce={nonce} />;
}
