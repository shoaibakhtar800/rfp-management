import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { z } from 'zod';

const UpdateRFPSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  budget: z.number().optional(),
  currency: z.string().optional(),
  deliveryDays: z.number().optional(),
  paymentTerms: z.string().optional(),
  warranty: z.string().optional(),
  items: z.any().optional(),
  requirements: z.any().optional(),
  status: z.enum(['DRAFT', 'SENT', 'RECEIVING_PROPOSALS', 'EVALUATING', 'AWARDED', 'CANCELLED']).optional(),
  dueDate: z.string().optional(),
  evaluationSummary: z.string().optional(),
  recommendation: z.unknown().optional(),
  awardedVendorId: z.string().nullable().optional(),
  awardNotes: z.string().optional(),
  awardedAt: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    
    const rfp = await db.rFP.findUnique({
      where: { id },
      include: {
        vendors: {
          include: {
            vendor: true,
          },
        },
        proposals: {
          include: {
            vendor: true,
          },
          orderBy: {
            aiScore: 'desc',
          },
        },
        emailLogs: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        awardedVendor: true,
      },
    });

    if (!rfp) {
      return NextResponse.json(
        { error: 'RFP not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(rfp);
  } catch (error) {
    console.error('Error fetching RFP:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RFP' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const body = await request.json() as unknown;
    const validatedData = UpdateRFPSchema.parse(body);

    const updateData: Record<string, unknown> = { ...validatedData };
    if (validatedData.dueDate) {
      updateData.dueDate = new Date(validatedData.dueDate);
    }
    if (validatedData.awardedAt) {
      updateData.awardedAt = new Date(validatedData.awardedAt);
    }
    if (validatedData.awardedVendorId === null || validatedData.awardedVendorId === '') {
      updateData.awardedVendorId = null;
    } else if (validatedData.awardedVendorId) {
      const vendor = await db.vendor.findUnique({
        where: { id: validatedData.awardedVendorId },
      });
      if (!vendor) {
        return NextResponse.json(
          { error: 'Awarded vendor not found' },
          { status: 404 },
        );
      }
    }

    const rfp = await db.rFP.update({
      where: { id },
      data: updateData,
      include: {
        vendors: {
          include: {
            vendor: true,
          },
        },
        proposals: true,
        awardedVendor: true,
      },
    });

    return NextResponse.json(rfp);
  } catch (error) {
    console.error('Error updating RFP:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update RFP' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    
    await db.rFP.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting RFP:', error);
    return NextResponse.json(
      { error: 'Failed to delete RFP' },
      { status: 500 },
    );
  }
}
