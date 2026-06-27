import { NextRequest, NextResponse } from "next/server";
import {
  getServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getGrantedLevel } from "@/lib/data-room";
import { authorizeDocumentAccess } from "@/lib/auth/roles";
import { track } from "@/lib/analytics/server";
import type { AccessLevel } from "@/lib/supabase/types";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "akanil-data-room";
const EXPIRY = Number(process.env.DATA_ROOM_SIGNED_URL_EXPIRY_SECONDS || 3600);

/**
 * Protected download request. Issues a short-lived signed URL ONLY after the
 * full authorization chain passes: session → window permission → access level
 * → NDA. Raw storage paths are never returned. Every grant is logged.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Data room storage is not configured in this environment." },
      { status: 503 }
    );
  }

  let documentId: string | undefined;
  try {
    ({ documentId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!documentId) {
    return NextResponse.json({ error: "documentId is required." }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, window, access_level, storage_path, is_active")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc || !doc.is_active) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const user = await getSessionUser();
  const grantedLevel =
    user && doc.window
      ? await getGrantedLevel(user.profileId, doc.window)
      : null;

  const decision = authorizeDocumentAccess({
    role: user?.role ?? null,
    ndaStatus: user?.ndaStatus ?? null,
    documentLevel: doc.access_level as AccessLevel,
    grantedLevel,
    authenticated: Boolean(user),
  });

  await track("document_view_attempt", { level: doc.access_level as string });

  if (!decision.allowed) {
    await track("signed_url_denied", { reason: decision.reason ?? "unknown" });
    const status = decision.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: "Access denied.", reason: decision.reason }, { status });
  }

  if (!doc.storage_path) {
    return NextResponse.json({ error: "No file is attached to this document." }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, EXPIRY);

  if (error || !signed) {
    console.error("[akanil] signed url generation failed", error);
    return NextResponse.json({ error: "Could not prepare the download." }, { status: 502 });
  }

  // Access log — best effort, never blocks delivery.
  try {
    await supabase.from("document_access_logs").insert({
      document_id: doc.id,
      user_id: user?.authUserId ?? null,
      organization_id: user?.organizationId ?? null,
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });
  } catch (e) {
    console.error("[akanil] access log write failed", e);
  }

  await track("signed_url_approved", { level: doc.access_level as string });

  return NextResponse.json({ url: signed.signedUrl, expiresIn: EXPIRY });
}
