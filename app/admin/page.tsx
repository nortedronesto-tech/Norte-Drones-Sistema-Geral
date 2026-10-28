import AdminDashboard from "./AdminDashboard";
import { getSiteImages } from "@/lib/site-images";
import { getAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [images, access] = await Promise.all([getSiteImages(), getAccess()]);
  return <AdminDashboard siteImages={images} isAdmin={!!access?.isAdmin} />;
}
