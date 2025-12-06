import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '~/server/db';
import { inngest } from '~/inngest/client';

const AwardSchema = z.object({
  vendorId: z.string(),
  notes: z.string().optional(),
  notify: z.boolean().optional().default(false),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const body = await request.json() as unknown;
    const { vendorId, notes, notify } = AwardSchema.parse(body);

    const [rfp, vendor] = await Promise.all([
      db.rFP.findUnique({
        where: { id },
        include: {
          proposals: true,
          vendors: true,
        },
      }),
      db.vendor.findUnique({ where: { id: vendorId } }),
    ]);

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.rFP.update({
        where: { id },
        data: {
          status: 'AWARDED',
          awardedVendorId: vendorId,
          awardNotes: notes,
          awardedAt: now,
        },
      });

      await Promise.all([
        tx.proposal.updateMany({
          where: { rfpId: id, vendorId },
          data: { status: 'ACCEPTED' },
        }),
        tx.proposal.updateMany({
          where: { rfpId: id, vendorId: { not: vendorId } },
          data: { status: 'REJECTED' },
        }),
        tx.rFPVendor.updateMany({
          where: { rfpId: id, vendorId },
          data: { status: 'AWARDED' },
        }),
        tx.rFPVendor.updateMany({
          where: { rfpId: id, vendorId: { not: vendorId } },
          data: { status: 'NOT_SELECTED' },
        }),
      ]);
    });

    if (notify) {
      await inngest.send({
        name: 'rfp/send-award-notification',
        data: {
          rfpId: id,
          vendorId,
          notes,
        },
      });
    }

    const updatedRfp = await db.rFP.findUnique({
      where: { id },
      include: {
        awardedVendor: true,
        vendors: { include: { vendor: true } },
        proposals: { include: { vendor: true } },
      },
    });

    return NextResponse.json({
      success: true,
      rfp: updatedRfp,
      notificationScheduled: notify,
    });
  } catch (error) {
    console.error('Error awarding RFP:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to award RFP' },
      { status: 500 },
    );
  }
}
