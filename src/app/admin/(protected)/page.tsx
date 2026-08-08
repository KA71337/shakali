import { AdminDashboard } from "@/components/admin-dashboard";
import { getAdminDashboardData } from "@/lib/admin-data";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  return <AdminDashboard data={data} />;
}
