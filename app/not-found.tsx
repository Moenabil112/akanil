import Link from "next/link";
import { AkanilMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="container-content flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <AkanilMark className="h-12 w-12 text-gold/70" />
      <p className="eyebrow mt-8">Error 404</p>
      <h1 className="heading-lg mt-3 text-ivory">This window could not be found.</h1>
      <p className="mt-4 max-w-md text-atlas-grey">
        The page you are looking for is not part of the Akanil ecosystem, or has
        moved. Return to the homepage to explore the digital windows.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md border border-gold/50 px-5 py-2.5 text-sm font-medium text-gold transition-colors hover:bg-gold hover:text-obsidian"
      >
        Back to Akanil
      </Link>
    </div>
  );
}
