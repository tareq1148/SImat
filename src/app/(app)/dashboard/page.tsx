import { redirect } from "next/navigation";

// اندمجت النظرة العامة في الشاشة الرئيسية (المحادثة)
export default function Dashboard() {
  redirect("/chat");
}
