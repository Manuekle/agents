import type { Metadata } from "next";
import Link from "next/link";
import { Panel, PixelButton, StatePanel } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";

// A 404 wearing the site rather than Next's default page. It renders inside
// the root layout, so the nav and footer are already there — this is only what
// goes between them.

export const metadata: Metadata = {
  title: "Not found",
  // A 404 has nothing worth ranking, and every wrong URL would otherwise be a
  // separate thin page in the index.
  robots: { index: false, follow: true },
};

const ELSEWHERE: { href: string; label: string; detail: string }[] = [
  { href: "/", label: "Home", detail: "the landing page and your saved agents" },
  { href: "/demo", label: "Demo", detail: "an agent composed end to end, no account" },
  { href: "/skills", label: "Skills", detail: "search both registries" },
  { href: "/pricing", label: "Pricing", detail: "what each plan gives you" },
];

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      {/* Static mascot: nothing on this page is in progress. */}
      <StatePanel
        mascot="sherlock"
        title="404_NOT_FOUND"
        actions={
          <>
            <Link href="/">
              <PixelButton variant="coral">
                <span className="inline-flex items-center gap-1.5">
                  Back home
                  <ArrowRightIcon size={12} />
                </span>
              </PixelButton>
            </Link>
            <Link href="/demo">
              <PixelButton variant="ghost">See the demo</PixelButton>
            </Link>
          </>
        }
      >
        That page isn&apos;t here. It may have moved, or the link may be a typo
        — nothing has been deleted from your account.
      </StatePanel>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {ELSEWHERE.map((l) => (
          <Link key={l.href} href={l.href} className="block">
            <Panel className="p-3 h-full hover:bg-stone transition-colors">
              <div className="font-mono text-xs font-bold">{l.label}</div>
              <div className="font-mono text-[10px] text-muted mt-0.5 leading-snug">
                {l.detail}
              </div>
            </Panel>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center font-mono text-[10px] text-muted">
        Looking for something specific? Press <kbd>⌘K</kbd>.
      </p>
    </div>
  );
}
