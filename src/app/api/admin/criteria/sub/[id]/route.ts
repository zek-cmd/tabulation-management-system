import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyJudgeViews } from "@/lib/realtimeNotify";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, weight, autoAssignToAllContestants } = await req.json();
  if (!name || weight === undefined) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const criteria = await prisma.criteria.update({
    where: { id: Number(id) },
    data: {
      name,
      weight: Number(weight),
      autoAssignToAllContestants: !!autoAssignToAllContestants,
    },
  });
  await notifyJudgeViews(req, criteria.eventId, "criteria");
  return NextResponse.json(criteria);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.criteria.findUnique({ where: { id: Number(id) } });
  await prisma.criteria.delete({
    where: { id: Number(id) },
  });
  if (existing) await notifyJudgeViews(req, existing.eventId, "criteria");
  return NextResponse.json({ success: true });
}