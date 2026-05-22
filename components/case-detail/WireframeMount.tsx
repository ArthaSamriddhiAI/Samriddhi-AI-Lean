"use client";

import { useEffect, useRef } from "react";

interface Props {
  html: string;
}

/* Mounts a pre-rendered static wireframe (public/wireframes/surana.html) inside
 * the platform shell. dangerouslySetInnerHTML injects the markup but browsers do
 * NOT execute <script> tags inserted that way, so the wireframe's chart-rendering
 * script would never run. After mount we re-create each <script> via
 * document.createElement so it executes (a standard reattach pattern). */
export function WireframeMount({ html }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scripts = containerRef.current.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [html]);

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
}
