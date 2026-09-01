import { quickDiagnosis } from "../src/lib/diagnose";

const CASES: [string, string][] = [
  ["invalid_grant: Token has been expired or revoked.", "Gmail"],
  ["Forbidden: bot was blocked by the user", "Telegram"],
  ["The workflow has credentials that are not shared with you", "Gmail"],
  ["429 Too Many Requests - rate limit exceeded", "OpenAI"],
  ["connect ETIMEDOUT 142.250.185.100:443", "HTTP Request"],
  ["The workflow 'x' is not active and can not be called via webhook", "Webhook"],
  ["Cannot read properties of undefined (reading 'body')", "Set"],
];

for (const [raw, node] of CASES) {
  const d = quickDiagnosis(raw, node);
  console.log("-".repeat(58));
  console.log("raw    :", raw.slice(0, 52));
  console.log("cause  :", d.cause);
  console.log("msg    :", d.message);
  console.log("action :", d.action, "|", d.action_label, "|", d.severity);
}
