import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminLoginForm } from "@/components/admin-login-form";

export const metadata: Metadata = {
  title: "Вход в панель управления",
  description: "Защищённый вход для администратора",
};

export default async function AdminLoginPage() {
  await connection();
  return <AdminLoginForm />;
}
