import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth";

type ProtectedAdminLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ProtectedAdminLayout({
  children,
}: ProtectedAdminLayoutProps) {
  await requireAdmin();

  return <>{children}</>;
}
