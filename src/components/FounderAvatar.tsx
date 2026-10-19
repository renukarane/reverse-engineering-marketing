"use client";

import { useEffect, useRef, useState } from "react";

// Shows /founder.jpg when it exists (drop the photo into public/), otherwise
// a monogram, so the founder note never shows a broken image.
export default function FounderAvatar({ name, initials }: { name: string; initials: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // The image can fail before hydration attaches onError, so check once mounted.
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  return failed ? (
    <span className="avatar mono" aria-label={name}>
      {initials}
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} className="avatar" src="/founder.jpg" alt={name} width={88} height={88} onError={() => setFailed(true)} />
  );
}
