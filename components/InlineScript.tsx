// React warns in development whenever a render produces a <script> tag, because
// scripts inserted through a DOM update never execute. The one in the root
// layout is only ever meant to run during HTML parsing on a hard navigation, so
// it is emitted as executable JS on the server and as inert text/plain on the
// client. suppressHydrationWarning covers the resulting `type` mismatch.
//
// Pattern from next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
