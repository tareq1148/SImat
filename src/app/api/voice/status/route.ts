import { voiceStudioStatus } from "@/lib/voicestudio";

export async function GET() {
  const status = await voiceStudioStatus();
  return Response.json(status);
}
