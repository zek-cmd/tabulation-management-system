// Tells the judges' scoring screens that the admin changed data for an event.
// A failed notification must never break the admin's save, so the error is
// swallowed - but the call is awaited so it is not dropped mid-flight.
//
// The origin comes from the admin's own request, so the call lands on the port
// and address this server is really listening on, even when PORT is not set.

import type { NextRequest } from "next/server";

export type AdminChangeType = "contestants" | "judges" | "criteria" | "scores";

function resolveOrigin(req?: NextRequest) {
  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (host) {
      const proto =
        req.headers.get("x-forwarded-proto") ||
        (req.url.startsWith("https:") ? "https" : "http");
      return `${proto}://${host}`;
    }
  }
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

export async function notifyJudgeViews(
  req: NextRequest | undefined,
  eventId: number | string | null | undefined,
  dataType: AdminChangeType
) {
  if (!eventId) return;

  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
  const url = `${resolveOrigin(req)}${basePath}/api/emit-data-change/${eventId}/${dataType}`;

  try {
    await fetch(url);
  } catch (error) {
    console.error("Failed to notify judge views:", error);
  }
}
