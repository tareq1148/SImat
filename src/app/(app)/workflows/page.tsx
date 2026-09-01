import { redirect } from "next/navigation";

// شاشة «سير العمل» أُلغيت — المسارات تُفتح من «مساراتك» في الشريط الجانبي
export default function WorkflowsPage() {
  redirect("/chat");
}
