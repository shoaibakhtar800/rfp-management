import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { z } from 'zod';

const CreateVendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    
    const where: Record<string, unknown> = {};
    
    if (category) {
      where.category = category!;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const vendors = await db.vendor.findMany({
      where,
      include: {
        _count: {
          select: {
            proposals: true,
            rfps: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendors' },
      { status: 500 },
    );
  }
}

// POST /api/vendors - Create new vendor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as unknown;
    const validatedData = CreateVendorSchema.parse(body);
    
    const existingVendor = await db.vendor.findUnique({
      where: { email: validatedData.email },
    });
    
    if (existingVendor) {
      return NextResponse.json(
        { error: 'Vendor with this email already exists' },
        { status: 400 },
      );
    }
    
    const vendor = await db.vendor.create({
      data: validatedData,
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create vendor' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json() as { ids: string[] };
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid vendor IDs' },
        { status: 400 },
      );
    }
    
    await db.vendor.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendors:', error);
    return NextResponse.json(
      { error: 'Failed to delete vendors' },
      { status: 500 },
    );
  }
}
