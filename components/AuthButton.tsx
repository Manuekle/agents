"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/env";

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

    sb.auth.getUser().then(({ data }) => {
      read(data.user);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => read(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!SUPABASE_CONFIGURED) return null;

  // Hold the slot until we know: flashing "Sign in" at a signed-in user on
  // every navigation reads as having been logged out.
  if (!ready) return <span className="w-16" aria-hidden />;

  if (!user) {
    return (
      <Link
        href="/login"
        className="font-mono text-xs px-2 sm:px-3 py-1.5 border-2 border-line hover:bg-stone transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const label = user.handle ?? user.email ?? "account";

  return (
    <form action="/auth/signout" method="post" className="inline-flex items-center gap-2">
      <span
        className={compact ? "inline-flex items-center gap-2" : "hidden md:inline-flex items-center gap-2"}
        title={label}
      >
        {user.avatar && (
          // Plain <img>: the avatar host is whatever GitHub hands back, and
          // next/image would need every one of those allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt=""
            width={20}
            height={20}
            className="border-2 border-line shrink-0"
          />
        )}
        <span className="font-mono text-xs truncate max-w-[10ch]">{label}</span>
      </span>
      <button
        type="submit"
        className="font-mono text-xs px-2 py-1.5 border-2 border-line hover:bg-stone transition-colors cursor-pointer"
      >
        Sign out
      </button>
    </form>
  );
}
