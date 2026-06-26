"use client";

import { useState } from "react";
import { REQUEST_TYPES } from "@/lib/site";

type Status = "idle" | "submitting" | "success" | "error";

const ACCESS_LEVELS = [
  "Public Access",
  "Institutional Brief Access",
  "NDA Data Room Access",
] as const;

export function RequestForm({
  variant = "briefing",
  defaultRequestType,
  windowName,
}: {
  variant?: "briefing" | "dataroom" | "contact";
  defaultRequestType?: (typeof REQUEST_TYPES)[number];
  windowName?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source: variant, windowName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Request could not be submitted.");
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-emerald/40 bg-emerald/10 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-light/50 text-emerald-light">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="heading-md mt-4 text-ivory">Request received</h3>
        <p className="mt-2 text-sm text-atlas-grey">
          Your request has been logged through a traceable, governed process. The
          Akanil team will review it and respond through the official channel.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 text-sm font-medium text-gold hover:text-gold-light"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" name="name" required />
        <Field label="Work email" name="email" type="email" required />
        <Field label="Organization" name="organization" required />
        <Field label="Role / title" name="role" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Request type"
          name="requestType"
          options={REQUEST_TYPES as unknown as string[]}
          defaultValue={defaultRequestType}
        />
        {variant === "dataroom" ? (
          <Select label="Requested access level" name="accessLevel" options={ACCESS_LEVELS as unknown as string[]} />
        ) : (
          <Field label="Relevant window / project" name="window" defaultValue={windowName} />
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ivory-muted" htmlFor="message">
          Context / message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory placeholder-atlas-grey/60 outline-none transition-colors focus:border-gold/60"
          placeholder="Briefly describe your institutional interest and what you would like to review."
        />
      </div>

      {variant === "dataroom" && (
        <label className="flex items-start gap-3 text-sm text-atlas-grey">
          <input
            type="checkbox"
            name="ndaAcknowledged"
            required
            className="mt-0.5 h-4 w-4 rounded border-atlas-line bg-obsidian-900 accent-gold"
          />
          <span>
            I understand that NDA data room access requires a confidentiality
            agreement, admin review, and controlled access approval.
          </span>
        </label>
      )}

      {status === "error" && (
        <p className="rounded-md border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper-light">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center rounded-md bg-gold px-6 py-3 text-sm font-semibold text-obsidian transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting…" : "Submit request"}
      </button>
      <p className="text-xs text-atlas-grey/70">
        Submissions are handled through a professional, traceable, and governed
        process. We will never share your details outside the review workflow.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ivory-muted" htmlFor={name}>
        {label} {required && <span className="text-gold">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory placeholder-atlas-grey/60 outline-none transition-colors focus:border-gold/60"
      />
    </div>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ivory-muted" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory outline-none transition-colors focus:border-gold/60"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-obsidian-800">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
