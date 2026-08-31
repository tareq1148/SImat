import { redirect } from "next/navigation";

// الاتصالات صارت داخل لوحة الإعدادات المنزلقة
export default function ConnectionsPage() {
  redirect("/chat");
}
