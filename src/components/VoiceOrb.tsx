"use client";

// كرة الصوت — نسخة مصغّرة من كرة «ابدأ» بألوان الشعار، للاستخدام داخل شريط الكتابة
// (جاهزة لوضع المحادثة الصوتية الذكية لاحقًا)

export default function VoiceOrb({
  size = 40,
  state = "idle",
  big = false,
}: {
  size?: number;
  state?: "idle" | "listening" | "speaking";
  big?: boolean;
}) {
  return (
    <span
      className={`voice-orb ${big ? "orb-big" : ""} ${state !== "idle" ? "is-active" : ""} ${
        state === "listening" ? "is-listening" : ""
      } ${state === "speaking" ? "is-speaking" : ""}`}
      style={{ width: size, height: size }}
    >
      <span className={`orb-fluid ${big ? "orb-lg" : "orb-sm"}`}>
        <i className="orb-blob b1" />
        <i className="orb-blob b2" />
        <i className="orb-blob b3" />
        <i className="orb-blob b4" />
      </span>
    </span>
  );
}
