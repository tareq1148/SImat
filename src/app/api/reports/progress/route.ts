import { supabaseServer } from "@/lib/supabase/server";

// شاشة الإنجاز: أسابيع مقفلة المهام + كفاءة أسبوع-بأسبوع + مستوى + خطة تقدم مدروسة (قواعد مُفسَّرة)

interface PlanItem {
  icon: string;
  title: string;
  why: string;
  cta: { label: string; href: string };
}

const LEVELS = [
  { at: 0, name: "مبتدئ الأتمتة" },
  { at: 5, name: "مُنجِز" },
  { at: 15, name: "متمكّن" },
  { at: 30, name: "خبير أتمتة" },
  { at: 60, name: "محترف سِمَاط" },
];

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const [{ data: flows }, { data: runs }, { data: approvals }] =
    await Promise.all([
      supabase
        .from("flows")
        .select("id, name, status, manual_minutes_per_run"),
      supabase.from("runs").select("flow_id, status, started_at"),
      supabase.from("approvals").select("id, flow_id").eq("status", "pending"),
    ]);

  // آخر ٧ أيام تقويمية (بتوقيت الرياض UTC+3) — حتى يظهر أثر أي أتمتة جديدة في يومها فورًا
  const now = Date.now();
  const DAY = 24 * 3600 * 1000;
  const KSA = 3 * 3600 * 1000;
  const todayStart = Math.floor((now + KSA) / DAY) * DAY - KSA;
  const minutesOf = (flowId: string) =>
    (flows ?? []).find((f) => f.id === flowId)?.manual_minutes_per_run ?? 15;

  const dayLabels = [
    "قبل ٦ أيام",
    "قبل ٥ أيام",
    "قبل ٤ أيام",
    "قبل ٣ أيام",
    "قبل يومين",
    "أمس",
    "اليوم",
  ];
  const weeks = dayLabels.map((label, idx) => {
    const age = 6 - idx; // 0 = اليوم
    const start = todayStart - age * DAY;
    const end = start + DAY;
    const d = new Date(start + KSA);
    const date = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const inDay = (runs ?? []).filter((r) => {
      const t = new Date(r.started_at).getTime();
      return t >= start && t < end;
    });
    const closed = inDay.filter((r) => r.status === "success");
    return {
      label,
      date,
      is_today: age === 0,
      closed: closed.length,
      failed: inDay.filter((r) => r.status === "error").length,
      minutes_saved: closed.reduce((s, r) => s + minutesOf(r.flow_id), 0),
    };
  });

  const thisWeek = weeks[6]; // اليوم
  const lastWeek = weeks[5]; // أمس
  const wow =
    lastWeek.closed > 0
      ? Math.round(((thisWeek.closed - lastWeek.closed) / lastWeek.closed) * 100)
      : thisWeek.closed > 0
        ? 100
        : 0;

  const totalClosed = (runs ?? []).filter((r) => r.status === "success").length;
  let levelIdx = 0;
  LEVELS.forEach((l, i) => {
    if (totalClosed >= l.at) levelIdx = i;
  });
  const level = LEVELS[levelIdx];
  const next = LEVELS[levelIdx + 1] ?? null;

  // خطة التقدم — قواعد مرتبة بالأولوية، مبنية من بياناته الفعلية
  const plan: PlanItem[] = [];
  const fl = flows ?? [];

  if ((approvals ?? []).length > 0) {
    const a = approvals![0];
    plan.push({
      icon: "🛡️",
      title: `اقفل ${approvals!.length} موافقة معلّقة`,
      why: "تشغيلاتك واقفة تنتظر قرارك — كل موافقة مقفولة = مهمة تكتمل فورًا.",
      cta: { label: "افتح الموافقات", href: `/flow/${a.flow_id}?tab=run` },
    });
  }
  const broken = fl.find((f) => f.status === "NeedsRepair");
  if (broken) {
    plan.push({
      icon: "🔧",
      title: `أصلح مسار «${broken.name}»`,
      why: "فيه فشل مسجّل — زر الإصلاح التلقائي يعالجه ويعيد الاختبار بضغطة واحدة.",
      cta: { label: "إصلاح الآن", href: `/flow/${broken.id}?tab=run` },
    });
  }
  const ready = fl.find((f) => f.status === "Ready" || f.status === "Paused");
  if (ready) {
    plan.push({
      icon: "⚡",
      title: `فعّل مسار «${ready.name}»`,
      why: `نجح اختباره وهو جاهز — كل تشغيلة توفر لك ~${ready.manual_minutes_per_run ?? 15} دقيقة.`,
      cta: { label: "فعّل وشغّل", href: `/flow/${ready.id}?tab=run` },
    });
  }
  const halfway = fl.find(
    (f) =>
      f.status === "Draft" ||
      f.status === "NeedsConnections" ||
      f.status === "NeedsInformation" ||
      f.status === "ReadyToTest"
  );
  if (halfway) {
    plan.push({
      icon: "🧩",
      title: `أكمل مسار «${halfway.name}»`,
      why: "وصلت نصف الطريق — أكمل الربط والاختبار ليبدأ التوفير الفعلي.",
      cta: { label: "أكمل الإعداد", href: `/flow/${halfway.id}?tab=canvas` },
    });
  }
  const noMinutes = fl.find(
    (f) => f.manual_minutes_per_run == null && f.status === "Active"
  );
  if (noMinutes) {
    plan.push({
      icon: "⏱️",
      title: "اضبط دقائق التوفير لمساراتك",
      why: "تقرير الوقت الموفَّر يصير حقيقيًا بدل التقدير الافتراضي (15 دقيقة).",
      cta: { label: "اضبطها", href: `/flow/${noMinutes.id}?tab=history` },
    });
  }
  if (wow < 0 && plan.length < 4) {
    plan.push({
      icon: "📉",
      title: "يومك أهدأ من أمس",
      why: `أقفلت ${thisWeek.closed} مقابل ${lastWeek.closed} أمس — شغّل مساراتك المفعّلة أو جدولها.`,
      cta: { label: "افتح مساراتك", href: "/chat" },
    });
  }
  plan.push({
    icon: "✨",
    title: "أضف أتمتة جديدة اليوم",
    why: "خذ أكثر مهمة تكررت عليك هالأيام وابدأ فيها مقابلة — 5 دقائق وصفًا توفر ساعات.",
    cta: { label: "ابدأ المقابلة", href: "/chat" },
  });

  return Response.json({
    headline: {
      closed_this_week: thisWeek.closed,
      minutes_saved_this_week: thisWeek.minutes_saved,
      wow,
      last_week_closed: lastWeek.closed,
    },
    weeks,
    level: {
      name: level.name,
      total_closed: totalClosed,
      next: next
        ? { name: next.name, at: next.at, remaining: next.at - totalClosed }
        : null,
      progress: next
        ? Math.min(
            100,
            Math.round(
              ((totalClosed - level.at) / (next.at - level.at)) * 100
            )
          )
        : 100,
    },
    plan: plan.slice(0, 4),
  });
}
