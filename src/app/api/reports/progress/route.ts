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

  const now = Date.now();
  const WEEK = 7 * 24 * 3600 * 1000;
  const minutesOf = (flowId: string) =>
    (flows ?? []).find((f) => f.id === flowId)?.manual_minutes_per_run ?? 15;

  const weekLabels = [
    "قبل ٥ أسابيع",
    "قبل ٤ أسابيع",
    "قبل ٣ أسابيع",
    "قبل أسبوعين",
    "الأسبوع الماضي",
    "هذا الأسبوع",
  ];
  const weeks = weekLabels.map((label, idx) => {
    const age = 5 - idx; // 0 = هذا الأسبوع
    const start = now - (age + 1) * WEEK;
    const end = now - age * WEEK;
    const inWeek = (runs ?? []).filter((r) => {
      const t = new Date(r.started_at).getTime();
      return t > start && t <= end;
    });
    const closed = inWeek.filter((r) => r.status === "success");
    return {
      label,
      closed: closed.length,
      failed: inWeek.filter((r) => r.status === "error").length,
      minutes_saved: closed.reduce((s, r) => s + minutesOf(r.flow_id), 0),
    };
  });

  const thisWeek = weeks[5];
  const lastWeek = weeks[4];
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
      title: "أسبوعك أهدأ من الماضي",
      why: `أقفلت ${thisWeek.closed} مقابل ${lastWeek.closed} الأسبوع الماضي — شغّل مساراتك المفعّلة أو جدولها.`,
      cta: { label: "افتح مساراتك", href: "/dashboard" },
    });
  }
  plan.push({
    icon: "✨",
    title: "أضف أتمتة جديدة هذا الأسبوع",
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
