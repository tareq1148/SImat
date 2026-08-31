import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { INTERVIEW_MODEL, INTERVIEW_SYSTEM, UPDATE_SPEC_TOOL } from "@/lib/interview";
import type { TaskSpec } from "@/lib/types";

export const maxDuration = 300;

function sse(controller: ReadableStreamDefaultController, data: unknown) {
  controller.enqueue(
    new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
  );
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY غير مضبوط في .env.local — المقابلة الذكية تحتاجه." },
      { status: 500 }
    );
  }

  const body = (await req.json()) as {
    specId?: string;
    message: string;
    attachments?: string[];
  };
  const userMessage = (body.message ?? "").trim();
  const attachmentIds = (body.attachments ?? []).slice(0, 3);
  if (!userMessage && attachmentIds.length === 0) {
    return Response.json({ error: "رسالة فارغة" }, { status: 400 });
  }

  // إنشاء أو تحميل المواصفة وسجل المحادثة
  let specId = body.specId ?? null;
  let history: Anthropic.MessageParam[] = [];
  if (specId) {
    const { data } = await supabase
      .from("task_specs")
      .select("id, interview_messages")
      .eq("id", specId)
      .single();
    if (data) history = (data.interview_messages as Anthropic.MessageParam[]) ?? [];
    else specId = null;
  }
  if (!specId) {
    const { data, error } = await supabase
      .from("task_specs")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (error || !data) {
      return Response.json({ error: "تعذر إنشاء المحادثة" }, { status: 500 });
    }
    specId = data.id;
  }

  // المرفقات: الصور وPDF تُعرض على النموذج كمحتوى فعلي؛ النصوص تُضمَّن؛ والباقي يُذكر بالاسم.
  // في السجل المحفوظ نستبدل الثنائيات بإشارة نصية (حتى لا تتضخم قاعدة البيانات).
  const fileBlocks: Anthropic.ContentBlockParam[] = [];
  const fileNotes: string[] = [];
  if (attachmentIds.length > 0) {
    const { data: files } = await supabase
      .from("spec_files")
      .select("id, name, path, mime, size")
      .in("id", attachmentIds);
    for (const f of files ?? []) {
      const { data: blob } = await supabase.storage
        .from("task-files")
        .download(f.path);
      if (!blob) {
        fileNotes.push(`تعذر قراءة الملف «${f.name}»`);
        continue;
      }
      if (f.mime.startsWith("image/") && f.mime !== "image/gif") {
        const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
        fileBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: f.mime as "image/png" | "image/jpeg" | "image/webp",
            data: b64,
          },
        });
        fileNotes.push(`صورة مرفقة: ${f.name}`);
      } else if (f.mime === "application/pdf") {
        const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
        fileBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: b64 },
        });
        fileNotes.push(`مستند PDF مرفق: ${f.name}`);
      } else if (
        ["text/plain", "text/csv", "text/markdown", "application/json"].includes(
          f.mime
        )
      ) {
        const text = (await blob.text()).slice(0, 8000);
        fileBlocks.push({
          type: "text",
          text: "محتوى الملف المرفق «" + f.name + "»:\n---\n" + text + "\n---",
        });
        fileNotes.push(`ملف نصي مرفق: ${f.name}`);
      } else {
        fileNotes.push(
          `ملف مرفق (${f.name} — ${f.mime}) محفوظ لكنه لا يُقرأ داخل المحادثة بعد؛ اسأل الموظف عن محتواه إن لزم.`
        );
      }
    }
    // اربط الملفات بالمواصفة
    await supabase
      .from("spec_files")
      .update({ task_spec_id: specId })
      .in("id", attachmentIds);
  }

  const textForModel =
    (userMessage || "أرفقت لك ملفات — اطلع عليها.") +
    (fileNotes.length ? `\n\n[${fileNotes.join(" | ")}]` : "");
  const apiUserContent: Anthropic.ContentBlockParam[] = [
    ...fileBlocks,
    { type: "text", text: textForModel },
  ];
  const historyUserContent =
    (userMessage || "أرفقت ملفات.") +
    (fileNotes.length ? `\n[مرفقات: ${fileNotes.join("، ")}]` : "");

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: apiUserContent },
  ];
  // نسخة السجل: أول رسالة مستخدم بنص فقط — بقية الأدوار تُضاف لكلا النسختين
  const historyMessages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: historyUserContent },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      sse(controller, { type: "spec_id", specId });
      let confirmed = false;
      try {
        // حلقة يدوية: نص متدفق + معالجة أداة حفظ المواصفة
        for (let round = 0; round < 6; round++) {
          const msgStream = client.messages.stream({
            model: INTERVIEW_MODEL,
            max_tokens: 8000,
            system: [
              {
                type: "text",
                text: INTERVIEW_SYSTEM,
                cache_control: { type: "ephemeral" },
              },
            ],
            tools: [UPDATE_SPEC_TOOL],
            messages,
          });

          msgStream.on("text", (delta) => {
            sse(controller, { type: "delta", text: delta });
          });

          const finalMsg = await msgStream.finalMessage();

          if (finalMsg.stop_reason === "refusal") {
            sse(controller, {
              type: "delta",
              text: "\nعذرًا، لا أستطيع المتابعة في هذا الطلب.",
            });
            break;
          }

          messages.push({ role: "assistant", content: finalMsg.content });
          historyMessages.push({ role: "assistant", content: finalMsg.content });

          const toolUses = finalMsg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          if (toolUses.length === 0) break;

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            if (tu.name === "update_task_spec") {
              const input = tu.input as { confirmed: boolean; spec: TaskSpec };
              const spec = input.spec;
              await supabase
                .from("task_specs")
                .update({
                  title: spec.title,
                  goal: spec.goal,
                  trigger_description: spec.trigger.description,
                  inputs: spec.inputs,
                  outputs: spec.outputs,
                  steps: spec.steps,
                  rules: spec.rules,
                  exceptions: spec.exceptions,
                  acceptance_criteria: spec.acceptance_criteria,
                  spec_confirmed: input.confirmed,
                  full_spec: spec,
                  interview_messages: historyMessages,
                })
                .eq("id", specId);
              if (input.confirmed) confirmed = true;
              sse(controller, { type: "spec_saved", confirmed: input.confirmed });
              results.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: "تم حفظ المواصفة بنجاح.",
              });
            } else {
              results.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: "أداة غير معروفة.",
                is_error: true,
              });
            }
          }
          messages.push({ role: "user", content: results });
          historyMessages.push({ role: "user", content: results });
        }

        await supabase
          .from("task_specs")
          .update({ interview_messages: historyMessages })
          .eq("id", specId);

        sse(controller, { type: "done", specId, confirmed });
      } catch (err) {
        // رسائل صديقة — لا JSON خام أمام المستخدم أبدًا
        const raw = err instanceof Error ? err.message : "";
        const msg = raw.includes("credit balance")
          ? "رصيد الذكاء الاصطناعي انتهى — اشحن رصيد مفتاح Anthropic من console.anthropic.com ثم أعد المحاولة."
          : raw.includes("rate_limit")
            ? "ضغط مؤقت على النموذج — انتظر ثواني وأعد الإرسال."
            : raw.includes("overloaded")
              ? "النموذج مشغول الآن — أعد المحاولة بعد لحظات."
              : err instanceof Anthropic.APIError
                ? "تعذر الوصول لنموذج المقابلة مؤقتًا — أعد المحاولة."
                : raw || "خطأ غير متوقع";
        sse(controller, { type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
