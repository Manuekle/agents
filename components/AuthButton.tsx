"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clsx } from "@/lib/clsx";
import { SignOutIcon } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/env";
import { readUser } from "@/lib/supabase/answer";

type User = { email: string | null; avatar: string | null; handle: string | null };

/**
 * Sign-in link, or the current account with a sign-out. Renders nothing at all
 * when Supabase isn't configured, so a deploy without credentials doesn't show
 * a control that cannot work.
 */
export function AuthButton({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setReady(true);
      return;
    }

    const read = (u: {
      email?: string;
      user_metadata?: Record<string, unknown>;
    } | null) => {
      if (!u) return setUser(null);
      const meta = u.user_metadata ?? {};
      setUser({
        email: u.email ?? null,
        avatar: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
        handle:
          typeof meta.user_name === "string"
            ? meta.user_name
            : typeof meta.preferred_username === "string"
              ? meta.preferred_username
              : null,
      });
    };

    // The verified answer, and only when it is one. `getUser()` reports an
    // unreachable auth endpoint as `{ user: null, error }` rather than
    // throwing, so reading `data.user` alone put "Sign in" in the nav of a
    // signed-in user on any network wobble — and, because it lands *after*
    // onAuthStateChange has already painted the account from the stored
    // session, it did it by visibly replacing their avatar with it.
    //
    // On an unknowable answer the slot keeps whatever onAuthStateChange has:
    // the stored session for a signed-in user, nothing for anyone else.
    void readUser(sb).then((answer) => {
      if (answer.signedIn !== null) read(answer.user);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => read(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!SUPABASE_CONFIGURED) return null;

  // Hold the slot until we know: flashing "Sign in" at a signed-in user on
  // every navigation reads as having been logged out.
  // Sized like the signed-out link so the row doesn't shift width when the
  // real state arrives.
  if (!ready) return <span className="w-[68px]" aria-hidden />;

  if (!user) {
    return (
      <Link
        href="/login"
        className="font-mono text-xs px-3 py-1.5 border-2 border-line hover:bg-stone transition-colors whitespace-nowrap"
      >
        Sign in
      </Link>
    );
  }

  const label = user.handle ?? user.email ?? "account";

  return (
    <form action="/auth/signout" method="post" className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-2 min-w-0" title={label}>
        {user.avatar && (
          // Plain <img>: the avatar host is whatever GitHub hands back, and
          // next/image would need every one of those allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt=""
            width={22}
            height={22}
            className="border-2 border-line shrink-0"
          />
        )}
        {/* The handle costs ~80px and is the first thing to go: the avatar
            already says who is signed in, and in the drawer there is room for
            both. */}
        <span
          className={clsx(
            "font-mono text-xs truncate max-w-[12ch]",
            !compact && "hidden xl:inline",
          )}
        >
          {label}
        </span>
      </span>

      {/* An icon square, matching the theme toggle, rather than a text button:
          "Sign out" as words was 171px of bar next to an already-bordered
          stars pill, and it overflowed the row on narrow laptops. */}
      <button
        type="submit"
        aria-label="Sign out"
        title="Sign out"
        className={clsx(
          "border-2 border-line hover:bg-stone transition-colors cursor-pointer shrink-0",
          compact
            ? "font-mono text-xs px-2 py-1.5"
            : "grid place-items-center w-8 h-8",
        )}
      >
        {compact ? "Sign out" : <SignOutIcon size={14} />}
      </button>
    </form>
  );
}
