"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin/auth";
import {
  getServiceClient,
  isSupabaseConfigured,
  writeAuditLog,
} from "@/lib/supabase/server";
import type {
  AccessLevel,
  DocumentStatus,
  SensitivityLevel,
} from "@/lib/supabase/types";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "akanil-data-room";

// Build the metadata patch shared by create + update. Empty strings → null so
// optional date/text columns stay clean.
function readMetadata(formData: FormData) {
  const str = (k: string) => {
    const v = formData.get(k);
    const s = typeof v === "string" ? v.trim() : "";
    return s.length ? s : null;
  };
  const tags = (str("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    title: str("title"),
    description: str("description"),
    window: str("window"),
    document_type: str("document_type"),
    access_level: (str("access_level") || "institutional_brief") as AccessLevel,
    sensitivity_level: (str("sensitivity_level") || "confidential") as SensitivityLevel,
    language: str("language") || "en",
    version: str("version") || "1",
    status: (str("status") || "draft") as DocumentStatus,
    owner: str("owner"),
    review_date: str("review_date"),
    expiry_date: str("expiry_date"),
    approved_by: str("approved_by"),
    related_entity: str("related_entity"),
    tags,
  };
}

/** Uploads to the PRIVATE bucket via service role. Returns the storage path. */
async function uploadFile(file: File): Promise<string> {
  const supabase = getServiceClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `documents/${crypto.randomUUID()}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createDocumentAction(formData: FormData) {
  const session = await verifySession(cookies().get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  if (!isSupabaseConfigured()) redirect("/admin/documents");

  const meta = readMetadata(formData);
  if (!meta.title) redirect("/admin/documents/new?error=title");

  const file = formData.get("file");
  let storage_path: string | null = null;
  if (file instanceof File && file.size > 0) {
    storage_path = await uploadFile(file);
  }

  const { data, error } = await getServiceClient()
    .from("documents")
    .insert({ ...meta, storage_path, is_active: true })
    .select("id")
    .single();
  if (error) {
    console.error("[akanil] document create failed", error);
    redirect("/admin/documents/new?error=save");
  }

  await writeAuditLog({
    actor: session.email,
    action_type: "document_created",
    target_type: "documents",
    target_id: data.id,
    metadata: { hasFile: Boolean(storage_path), access_level: meta.access_level },
  });

  revalidatePath("/admin/documents");
  redirect("/admin/documents");
}

export async function updateDocumentAction(formData: FormData) {
  const session = await verifySession(cookies().get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  if (!isSupabaseConfigured()) redirect("/admin/documents");

  const id = String(formData.get("id") || "");
  if (!id) redirect("/admin/documents");

  const meta = readMetadata(formData);
  if (!meta.title) redirect(`/admin/documents/${id}?error=title`);

  const patch: Record<string, unknown> = {
    ...meta,
    is_active: formData.get("is_active") === "on",
  };

  // Optional file replacement.
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    patch.storage_path = await uploadFile(file);
  }

  const { error } = await getServiceClient()
    .from("documents")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[akanil] document update failed", error);
    redirect(`/admin/documents/${id}?error=save`);
  }

  await writeAuditLog({
    actor: session.email,
    action_type: "document_updated",
    target_type: "documents",
    target_id: id,
    metadata: { status: meta.status, access_level: meta.access_level },
  });

  revalidatePath("/admin/documents");
  redirect("/admin/documents");
}
