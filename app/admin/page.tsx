import AdminDashboard from "./AdminDashboard";
import { getSiteImages } from "@/lib/site-images";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const images = await getSiteImages();
  return <AdminDashboard siteImages={images} />;
}
