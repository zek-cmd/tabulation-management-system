import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon"];

function extensionFor(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext && ext.length <= 5) return ext;
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    default:
      return ".ico";
  }
}

// POST: upload an institution logo for one event (multipart form: file, eventId)
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const eventIdRaw = form.get("eventId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!eventIdRaw) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  const eventId = Number(eventIdRaw);
  if (!Number.isInteger(eventId)) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Use a PNG, JPG, WEBP, SVG or ICO image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be 2 MB or smaller" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, logoUrl: true } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const ext = extensionFor(file.name, file.type);
  const fileName = `event-${eventId}-logo${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(uploadDir, fileName);
  const publicUrl = `/uploads/${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(filePath, buffer);

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { logoUrl: publicUrl },
    select: { id: true, logoUrl: true },
  });

  return NextResponse.json(updated);
}

// DELETE: remove the logo of one event and go back to the default
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventIdParam = searchParams.get("eventId");
  if (!eventIdParam) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }
  const eventId = Number(eventIdParam);
  if (!Number.isInteger(eventId)) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, logoUrl: true } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.logoUrl && event.logoUrl.startsWith("/uploads/")) {
    const fileName = path.basename(event.logoUrl);
    const filePath = path.join(process.cwd(), "public", "uploads", fileName);
    try {
      await fs.unlink(filePath);
    } catch {
      // file already gone, nothing to clean up
    }
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { logoUrl: null },
    select: { id: true, logoUrl: true },
  });

  return NextResponse.json(updated);
}
