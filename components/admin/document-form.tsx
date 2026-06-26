import {
  createDocumentAction,
  updateDocumentAction,
} from "@/app/admin/documents/actions";
import {
  ACCESS_LEVELS,
  SENSITIVITY_LEVELS,
  DOCUMENT_STATUSES,
  DOCUMENT_WINDOWS,
  type DocumentRecord,
} from "@/lib/supabase/types";

// Shared create/edit form. Renders the full institutional metadata model.
// Raw storage paths are never shown — only whether a file is attached.
export function DocumentForm({ doc }: { doc?: DocumentRecord }) {
  const isEdit = Boolean(doc);
  const action = isEdit ? updateDocumentAction : createDocumentAction;

  return (
    <form action={action} className="space-y-6" encType="multipart/form-data">
      {isEdit && <input type="hidden" name="id" value={doc!.id} />}

      <section className="rounded-xl border border-atlas-line bg-obsidian-800 p-6">
        <h2 className="heading-md mb-4 text-ivory">Document</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Title" name="title" required defaultValue={doc?.title} />
          <Select label="Window" name="window" defaultValue={doc?.window ?? "General"}
            options={DOCUMENT_WINDOWS.map((w) => ({ value: w, label: w }))} />
          <Text label="Document type" name="document_type" defaultValue={doc?.document_type ?? ""}
            placeholder="e.g. Sample report, NDA, Decision memo" />
          <Text label="Related entity" name="related_entity" defaultValue={doc?.related_entity ?? ""}
            placeholder="Project / organization" />
        </div>
        <div className="mt-4">
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-ivory-muted">
            Description
          </label>
          <textarea id="description" name="description" rows={3} defaultValue={doc?.description ?? ""}
            className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory outline-none focus:border-gold/60" />
        </div>
      </section>

      <section className="rounded-xl border border-atlas-line bg-obsidian-800 p-6">
        <h2 className="heading-md mb-4 text-ivory">Classification & access</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Access level (Data Room layer)" name="access_level"
            defaultValue={doc?.access_level ?? "institutional_brief"} options={ACCESS_LEVELS} />
          <Select label="Sensitivity level" name="sensitivity_level"
            defaultValue={doc?.sensitivity_level ?? "confidential"} options={SENSITIVITY_LEVELS} />
          <Select label="Status" name="status" defaultValue={doc?.status ?? "draft"}
            options={DOCUMENT_STATUSES} />
          <Text label="Language" name="language" defaultValue={doc?.language ?? "en"} />
          <Text label="Version" name="version" defaultValue={doc?.version ?? "1"} />
          <Text label="Tags (comma-separated)" name="tags" defaultValue={(doc?.tags ?? []).join(", ")} />
        </div>
      </section>

      <section className="rounded-xl border border-atlas-line bg-obsidian-800 p-6">
        <h2 className="heading-md mb-4 text-ivory">Governance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Text label="Owner" name="owner" defaultValue={doc?.owner ?? ""} />
          <Text label="Approved by" name="approved_by" defaultValue={doc?.approved_by ?? ""} />
          <div />
          <Text label="Review date" name="review_date" type="date" defaultValue={doc?.review_date ?? ""} />
          <Text label="Expiry date" name="expiry_date" type="date" defaultValue={doc?.expiry_date ?? ""} />
        </div>
        {isEdit && (
          <label className="mt-4 flex items-center gap-2 text-sm text-ivory-muted">
            <input type="checkbox" name="is_active" defaultChecked={doc?.is_active}
              className="h-4 w-4 accent-gold" />
            Active
          </label>
        )}
      </section>

      <section className="rounded-xl border border-atlas-line bg-obsidian-800 p-6">
        <h2 className="heading-md mb-1 text-ivory">File (gated)</h2>
        <p className="mb-4 text-xs text-atlas-grey">
          Uploaded to a private bucket via the server. No public URL is issued and
          the storage path is never exposed. Protected signed-URL delivery is Phase 3.
        </p>
        {isEdit && (
          <p className="mb-3 text-sm text-ivory-muted">
            Current file:{" "}
            <span className={doc?.storage_path ? "text-emerald-light" : "text-atlas-grey"}>
              {doc?.storage_path ? "attached" : "none"}
            </span>
          </p>
        )}
        <input type="file" name="file"
          className="block w-full text-sm text-ivory-muted file:mr-4 file:rounded-md file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-medium file:text-obsidian hover:file:bg-gold-light" />
      </section>

      <div className="flex gap-3">
        <button type="submit"
          className="rounded-md bg-gold px-6 py-2.5 text-sm font-semibold text-obsidian transition-colors hover:bg-gold-light">
          {isEdit ? "Save changes" : "Create document"}
        </button>
        <a href="/admin/documents"
          className="rounded-md border border-atlas-line px-6 py-2.5 text-sm text-ivory-muted transition-colors hover:border-gold/40 hover:text-gold">
          Cancel
        </a>
      </div>
    </form>
  );
}

function Text({
  label, name, type = "text", required, defaultValue, placeholder,
}: {
  label: string; name: string; type?: string; required?: boolean;
  defaultValue?: string; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ivory-muted">
        {label} {required && <span className="text-gold">*</span>}
      </label>
      <input id={name} name={name} type={type} required={required}
        defaultValue={defaultValue} placeholder={placeholder}
        className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory placeholder-atlas-grey/60 outline-none focus:border-gold/60" />
    </div>
  );
}

function Select({
  label, name, defaultValue, options,
}: {
  label: string; name: string; defaultValue?: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ivory-muted">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue}
        className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory outline-none focus:border-gold/60">
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-obsidian-800">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
