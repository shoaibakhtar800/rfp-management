import { type NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { inngest } from '~/inngest/client';
import { z } from 'zod';

const CreateRFPJobSchema = z.object({
  type: z.literal('PARSE_RFP'),
  userRequest: z.string().min(1),
  dueDate: z.string().optional(),
});

const CreateProposalJobSchema = z.object({
  type: z.literal('PARSE_PROPOSAL'),
  rfpId: z.string(),
  vendorId: z.string(),
  emailContent: z.string(),
  attachments: z.any().optional(),
});

const CreateCompareJobSchema = z.object({
  type: z.literal('COMPARE_PROPOSALS'),
  rfpId: z.string(),
});

const CreateJobSchema = z.discriminatedUnion('type', [
  CreateRFPJobSchema,
  CreateProposalJobSchema,
  CreateCompareJobSchema,
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');
    const rfpId = searchParams.get('rfpId');
    const status = searchParams.get('status');

    if (jobId) {
      const job = await db.aIJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 },
        );
      }

      return NextResponse.json(job);
    }

    const where: Record<string, unknown> = {};
    if (rfpId) where.rfpId = rfpId;
    if (status) where.status = status;

    const jobs = await db.aIJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Error fetching AI jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI jobs' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as unknown;
    const validatedData = CreateJobSchema.parse(body);

    const job = await db.aIJob.create({
      data: {
        type: validatedData.type,
        status: 'PENDING',
        inputData: validatedData,
        rfpId: 'rfpId' in validatedData ? validatedData.rfpId : undefined,
      },
    });

    let eventId: string;

    if (validatedData.type === 'PARSE_RFP') {
      const result = await inngest.send({
        name: 'ai/parse-rfp',
        data: {
          jobId: job.id,
          userRequest: validatedData.userRequest,
          dueDate: validatedData.dueDate,
        },
      });
      eventId = result.ids[0] ?? '';
    } else if (validatedData.type === 'PARSE_PROPOSAL') {
      const result = await inngest.send({
        name: 'ai/parse-proposal',
        data: {
          jobId: job.id,
          rfpId: validatedData.rfpId,
          vendorId: validatedData.vendorId,
          emailContent: validatedData.emailContent,
          attachments: validatedData.attachments as unknown,
        },
      });
      eventId = result.ids[0] ?? '';
    } else {
      const result = await inngest.send({
        name: 'ai/compare-proposals',
        data: {
          jobId: job.id,
          rfpId: validatedData.rfpId,
        },
      });
      eventId = result.ids[0] ?? '';
    }

    await db.aIJob.update({
      where: { id: job.id },
      data: { inngestEventId: eventId },
    });

    return NextResponse.json({
      jobId: job.id,
      status: 'PENDING',
      eventId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating AI job:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create AI job' },
      { status: 500 },
    );
  }
}

