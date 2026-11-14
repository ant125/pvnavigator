import type { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/admin";
import {
  feedbackRedirect,
  hintForRpc,
  messageFromForm,
  readFeedbackPost,
  threadIdFromPath,
} from "@/lib/feedbackRoute";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const threadId = threadIdFromPath(id);
  const nextPath = threadId ? `/admin/feedback/${threadId}` : "/admin/feedback";
  const post = await readFeedbackPost(request, "/admin/feedback");
  if (!post.ok) return post.response;
  await requireAdmin();
  if (!threadId) return feedbackRedirect("/admin/feedback", post.setCookies, "fehler");
  const body = messageFromForm(post.formData);
  if (!body) return feedbackRedirect(nextPath, post.setCookies, "ungueltig");

  const { error } = await post.supabase.rpc("admin_post_feedback_message", {
    p_thread_id: threadId,
    p_body: body,
  });
  if (error) return feedbackRedirect(nextPath, post.setCookies, hintForRpc(error));
  return feedbackRedirect(nextPath, post.setCookies);
}
