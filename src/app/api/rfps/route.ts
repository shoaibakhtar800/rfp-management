import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { rfpParser } from '~/lib/ai/rfp-parser';
import { inngest } from '~/inngest/client';
import { z } from 'zod';

const CreateRFPSchema = z.object({
  userRequest: z.string().min(1, 'User request is required'),
  dueDate: z.string().optional(),
  async: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    const where = status ? { status: status as 'DRAFT' | 'SENT' | 'RECEIVING_PROPOSALS' | 'EVALUATING' | 'AWARDED' | 'CANCELLED' } : undefined;
    
    const rfps = await db.rFP.findMany({
      where,
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
        },
        awardedVendor: true,
        _count: {
          select: {
            proposals: true,
            vendors: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(rfps);
  } catch (error) {
    console.error('Error fetching RFPs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RFPs' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as z.infer<typeof CreateRFPSchema>;
    
    if (body.async) {
      const job = await db.aIJob.create({
        data: {
          type: 'PARSE_RFP',
          status: 'PENDING',
          inputData: {
            userRequest: body.userRequest,
            dueDate: body.dueDate,
          },
        },
      });

      const result = await inngest.send({
        name: 'ai/parse-rfp',
        data: {
          jobId: job.id,
          userRequest: body.userRequest,
          dueDate: body.dueDate,
        },
      });

      await db.aIJob.update({
        where: { id: job.id },
        data: { inngestEventId: result.ids[0] ?? '' },
      });

      return NextResponse.json({
        jobId: job.id,
        status: 'PENDING',
        message: 'RFP creation started in background',
      }, { status: 202 });
    }

    const structuredRFP = await rfpParser.parseRFPFromNaturalLanguage(
      body.userRequest,
    );
    const parsedItems = Array.isArray(structuredRFP.items) ? structuredRFP.items : [];
    const parsedRequirements = structuredRFP.requirements ?? [];
    
    const rfp = await db.rFP.create({
      data: {
        title: structuredRFP.title,
        description: structuredRFP.description,
        userRequest: body.userRequest,
        budget: structuredRFP.budget,
        currency: structuredRFP.currency,
        deliveryDays: structuredRFP.deliveryDays,
        paymentTerms: structuredRFP.paymentTerms,
        warranty: structuredRFP.warranty,
        items: parsedItems,
        requirements: parsedRequirements,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: 'DRAFT',
      },
    });

    return NextResponse.json(rfp, { status: 201 });
  } catch (error) {
    console.error('Error creating RFP:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create RFP' },
      { status: 500 },
    );
  }
}
