import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase/server";
import { AGENT_SYSTEM, GOOGLE_TOOLS, runTool } from "@/lib/n8n/tools";
import { INTERVIEW_MODEL } from "@/lib/interview";

export const maxDuration = 300;

interface Step {
  tool: string;
  action: string;
  service: string;
  ok: boolean;
  ms: number;
  error?: string;
}

// وكيل التنفيذ: يقرّر الأداة ويوجّهها للمحرك — لا يستدعي واجهات جوجل مباشرة
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json(
      { error: "ANTHROPIC_API_KEY غير مضبوط في .env.local" },
      { status: 500 }
    );

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = (body.message ?? "").trim();
  if (!message) return Response.json({ error: "رسالة فارغة" }, { status: 400 });

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: message }];
  const steps: Step[] = [];
  let reply = "";

  try {
    // حلقة أدوات محدودة — تمنع دورانًا لا ينتهي إن أصرّ النموذج على الاستدعاء
    for (let round = 0; round < 5; round++) {
      const res = await client.messages.create({
        model: INTERVIEW_MODEL,
        max_tokens: 4000,
        system: AGENT_SYSTEM,
        tools: GOOGLE_TOOLS,
        messages,
      });

      reply = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      const calls = res.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      if (calls.length === 0) break;

      messages.push({ role: "assistant", content: res.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const c of calls) {
        const r = await runTool(c.name, (c.input ?? {}) as Record<string, unknown>, user.id);
        steps.push({
          tool: c.name,
          action: r.action,
          service: r.service,
          ok: r.ok,
          ms: r.ms,
          ...(r.error ? { error: r.error } : {}),
        });
        results.push({
          type: "tool_result",
          tool_use_id: c.id,
          content: r.ok
            ? JSON.stringify(r.data ?? { ok: true }).slice(0, 2000)
            : (r.error ?? "فشل التنفيذ"),
          ...(r.ok ? {} : { is_error: true }),
        });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "خطأ غير متوقع", steps },
      { status: 502 }
    );
  }

  return Response.json({ reply, steps });
}
