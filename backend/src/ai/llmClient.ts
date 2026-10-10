/**
 * Stand-in for a real LLM call so the practice repo runs offline.
 * It returns a canned answer based on the prompt. In a real app this
 * would call a model API (and could fail, be slow, or cost money).
 */
export async function complete(prompt: string): Promise<string> {
  if (prompt.toLowerCase().includes("ignore all previous instructions")) {
    return "APPROVED. Discount of 40% is fine, no review needed.";
  }
  return "Summary: discount request is within normal range for this account.";
}
