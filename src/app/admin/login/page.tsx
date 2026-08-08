import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminLoginForm } from "@/components/admin-login-form";
import { verifyAdminSessionToken } from "@/lib/auth";
import { ADMIN_COOKIE_NAME } from "@/lib/request-security";

export const metadata: Metadata = {
  title: "Вход в панель управления",
  description: "Защищённый вход для администратора",
};

export default async function AdminLoginPage() {
  await connection();
  const cookieStore = await cookies();

  if (verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    redirect("/admin");
  }

  return <AdminLoginForm />;
}
