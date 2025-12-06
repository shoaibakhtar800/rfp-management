import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { z } from 'zod';

const UpdateVendorSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    
    const vendor = await db.vendor.findUnique({
      where: { id },
      include: {
        rfps: {
          include: {
            rfp: true,
          },
        },
        proposals: {
          include: {
            rfp: true,
          },
        },
        emailLogs: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor' },
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
    const validatedData = UpdateVendorSchema.parse(body);

    if (validatedData.email) {
      const existingVendor = await db.vendor.findFirst({
        where: {
          email: validatedData.email,
          id: { not: id },
        },
      });

      if (existingVendor) {
        return NextResponse.json(
          { error: 'Vendor with this email already exists' },
          { status: 400 },
        );
      }
    }

    const vendor = await db.vendor.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error updating vendor:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update vendor' },
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
    
    await db.vendor.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json(
      { error: 'Failed to delete vendor' },
      { status: 500 },
    );
  }
}
