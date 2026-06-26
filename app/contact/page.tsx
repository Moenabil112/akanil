import type { Metadata } from "next";
import { PageHeader, Section, Eyebrow, CheckList } from "@/components/ui";
import { RequestForm } from "@/components/request-form";

export const metadata: Metadata = {
  title: "Contact Akanil",
  description:
    "Contact Akanil for institutional briefings, technical reviews, strategic partnerships, or controlled data room access.",
};

const REASONS = [
  "Request institutional briefing",
  "Request project one-pager",
  "Request governance memo",
  "Request technical review",
  "Request data room access",
  "Explore strategic partnership",
  "Explore technology cooperation",
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Contact Akanil"
        intro="For institutional briefings, technical reviews, strategic partnerships, or controlled data room access, please contact Akanil through the official channel."
        accent="gold"
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>Contact Reasons</Eyebrow>
            <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <CheckList items={REASONS} accent="gold" />
            </div>
          </div>
          <div className="rounded-xl border border-atlas-line bg-obsidian-800 p-7 md:p-8">
            <h2 className="heading-md text-ivory">Request Institutional Briefing</h2>
            <p className="mt-2 text-sm text-atlas-grey">
              Share your details and the Akanil team will respond through the
              official channel.
            </p>
            <div className="mt-6">
              <RequestForm variant="contact" defaultRequestType="Institutional Briefing" />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
