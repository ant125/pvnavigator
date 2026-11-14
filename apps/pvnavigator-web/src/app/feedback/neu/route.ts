import type { NextRequest } from "next/server";
import { isPvNavigatorUuid } from "@pv-auth/session";

import { draftFromForm, feedbackRedirect, hintForRpc, readFeedbackPost } from "@/lib/feedbackRoute";

export async function POST(request: NextRequest) {
  const post = await readFeedbackPost(request, "/feedback");
  if (!post.ok) return post.response;
  const draft = draftFromForm(post.formData);
  if (!draft) return feedbackRedirect("/feedback", post.setCookies, "ungueltig");

  const { data, error } = await post.supabase.rpc("create_feedback_thread", {
    p_product_key: draft.productKey,
    p_category: draft.category,
    p_subject: draft.subject,
    p_body: draft.body,
    p_calculation_id: draft.calculationId,
  });
  if (error || typeof data !== "string" || !isPvNavigatorUuid(data)) {
    return feedbackRedirect("/feedback", post.setCookies, hintForRpc(error));
  }
  return feedbackRedirect(`/feedback/${data.toLowerCase()}`, post.setCookies);
}
