import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '~/server/db';
import { inngest } from '~/inngest/client';
import { env } from '~/env';

const SendRFPSchema = z.object({
  vendorIds: z.array(z.string()).min(1, 'At least one vendor is required'),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const body = await request.json() as unknown;
    const { vendorIds } = SendRFPSchema.parse(body);

    const rfp = await db.rFP.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        budget: true,
        currency: true,
        deliveryDays: true,
        paymentTerms: true,
        warranty: true,
        items: true,
        requirements: true,
        dueDate: true,
      },
    });

    if (!rfp) {
      return NextResponse.json(
        { error: 'RFP not found' },
        { status: 404 },
      );
    }

    const vendors = await db.vendor.findMany({
      where: {
        id: { in: vendorIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (vendors.length === 0) {
      return NextResponse.json(
        { error: 'No valid vendors found' },
        { status: 400 },
      );
    }

    await Promise.all(
      vendors.map((vendor) =>
        db.rFPVendor.upsert({
          where: {
            rfpId_vendorId: {
              rfpId: id,
              vendorId: vendor.id,
            },
          },
          create: {
            rfpId: id,
            vendorId: vendor.id,
            status: 'PENDING',
          },
          update: {
            status: 'PENDING',
          },
        })
      )
    );

    const protocol = request.headers.get('x-forwarded-proto') ?? env.PROTOCOL as string;
    const host = request.headers.get('host') ?? env.HOST as string;
    const portalBaseUrl = `${protocol}://${host}`;

    await inngest.send({
      name: 'rfp/send-emails',
      data: {
        rfpId: id,
        vendorIds: vendors.map((v) => v.id),
        portalBaseUrl,
      },
    });

    await db.rFP.update({
      where: { id },
      data: { status: 'SENT' },
    });

    return NextResponse.json({
      success: true,
      message: 'RFP is being sent to vendors',
      vendorCount: vendors.length,
    });
  } catch (error) {
    console.error('Error sending RFP:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to send RFP' },
      { status: 500 },
    );
  }
}
