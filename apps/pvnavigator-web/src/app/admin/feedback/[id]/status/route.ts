import type { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/admin";
import {
  feedbackRedirect,
  hintForRpc,
  readFeedbackPost,
  statusFromForm,
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
  const status = statusFromForm(post.formData);
  if (!status) return feedbackRedirect(nextPath, post.setCookies, "ungueltig");

  const { error } = await post.supabase.rpc("admin_set_feedback_status", {
    p_thread_id: threadId,
    p_status: status,
  });
  if (error) return feedbackRedirect(nextPath, post.setCookies, hintForRpc(error));
  return feedbackRedirect(nextPath, post.setCookies);
}
