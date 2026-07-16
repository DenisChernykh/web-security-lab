import { useEffect, useState } from "react";
import { acknowledgeXss, renderXss } from "../lib/lab-api.js";

export function XssPreview({ traceId }: { traceId: string }) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    void renderXss(traceId).then(setHtml);
    const onMessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (data !== null && typeof data === "object" &&
        (data as { type?: unknown }).type === "lab-xss" &&
        (data as { traceId?: unknown }).traceId === traceId &&
        Object.keys(data).length === 2) {
        void acknowledgeXss(traceId);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [traceId]);
  return <iframe className="xss-preview" title="Изолированный XSS-предпросмотр" sandbox="allow-scripts" srcDoc={html} />;
}
