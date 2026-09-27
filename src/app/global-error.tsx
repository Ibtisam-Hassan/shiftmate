"use client";

/** Last resort when even the root layout fails, so it can't use the app's styles or components. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h1>ShiftMate is having a problem</h1>
          <p>Try again in a minute.</p>
          <button onClick={reset} style={{ padding: "8px 16px" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
