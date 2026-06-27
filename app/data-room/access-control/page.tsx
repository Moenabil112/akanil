import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section, Eyebrow } from "@/components/ui";
import { WindowAccessCards } from "@/components/data-room/window-cards";
import { RequestForm } from "@/components/request-form";
import { getSessionUser } from "@/lib/auth/session";
import { getWindowAccessSummary } from "@/lib/data-room";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Request Access",
  robots: { index: false, follow: false },
};

export default async function UserAccessControlPage({
  searchParams,
}: {
  searchParams: { window?: string };
}) {
  const user = await getSessionUser();

  if (!user) {
    return (
      <Section className="flex min-h-[60vh] items-center">
        <div className="mx-auto max-w-md text-center">
          <Eyebrow>
            <span className="mx-auto">Restricted</span>
          </Eyebrow>
          <h1 className="heading-lg mt-4 text-ivory">Request Data Room Access</h1>
          <p className="mt-4 text-atlas-grey">
            Sign in to request access to additional windows, or apply for first-time
            access from the public data room page.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/auth/sign-in?next=/data-room/access-control"
              className="rounded-md bg-gold px-6 py-3 text-sm font-semibold text-obsidian hover:bg-gold-light">
              Sign in
            </Link>
            <Link href="/data-room"
              className="rounded-md border border-gold/50 px-6 py-3 text-sm font-medium text-gold hover:bg-gold hover:text-obsidian">
              Apply for access
            </Link>
          </div>
        </div>
      </Section>
    );
  }

  const windows = await getWindowAccessSummary(user);

  return (
    <>
      <PageHeader
        eyebrow="Request Additional Access"
        title="Access Control"
        intro="Review your current window access and request additional windows or higher access levels. Each request is reviewed and, where required, gated behind an approved NDA."
        accent="teal"
        badge="Controlled Institutional Access Layer"
      />

      <Section>
        <Eyebrow>Your current access</Eyebrow>
        <div className="mt-8">
          <WindowAccessCards windows={windows} />
        </div>
      </Section>

      <Section className="border-t border-atlas-line bg-obsidian-900">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>Request access</Eyebrow>
            <h2 className="heading-lg mt-6 text-ivory">
              Submit an access request.
            </h2>
            <p className="mt-5 text-atlas-grey">
              {searchParams.window
                ? `Requesting access to: ${searchParams.window}.`
                : "Tell us which window and level you need."}{" "}
              Your request is logged and routed to the Akanil team for review.
            </p>
            <p className="mt-4 text-sm">
              <Link href="/data-room/status" className="text-gold hover:underline">
                ← Back to your access status
              </Link>
            </p>
          </div>
          <div className="rounded-xl border border-atlas-line bg-obsidian-800 p-7 md:p-8">
            <RequestForm
              variant="dataroom"
              defaultRequestType="Data Room Access"
              windowName={searchParams.window}
            />
          </div>
        </div>
      </Section>
    </>
  );
}
