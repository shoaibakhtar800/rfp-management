import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { inngest } from '~/inngest/client';
import { z } from 'zod';

const SubmitProposalSchema = z.object({
  token: z.string().min(1, 'Submission token is required'),
  proposalContent: z.string().min(10, 'Proposal content must be at least 10 characters'),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    contentType: z.string(),
  })).optional(),
});

export type SubmitProposalInput = z.infer<typeof SubmitProposalSchema>;

// GET - Fetch RFP details by submission token (for vendor portal)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find the RFPVendor record with this token
    const rfpVendor = await db.rFPVendor.findUnique({
      where: { submissionToken: token },
      include: {
        rfp: {
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
            status: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },
      },
    });

    if (!rfpVendor) {
      return NextResponse.json({ error: 'Invalid or expired submission link' }, { status: 404 });
    }

    // Check if RFP is still accepting proposals
    if (!['SENT', 'RECEIVING_PROPOSALS'].includes(rfpVendor.rfp.status)) {
      return NextResponse.json({ 
        error: 'This RFP is no longer accepting proposals',
        rfpStatus: rfpVendor.rfp.status,
      }, { status: 400 });
    }

    // Check if vendor already submitted a proposal
    const existingProposal = await db.proposal.findUnique({
      where: {
        rfpId_vendorId: {
          rfpId: rfpVendor.rfpId,
          vendorId: rfpVendor.vendorId,
        },
      },
    });

    return NextResponse.json({
      rfp: rfpVendor.rfp,
      vendor: rfpVendor.vendor,
      alreadySubmitted: !!existingProposal,
      submittedAt: existingProposal?.receivedAt ?? null,
    });
  } catch (error) {
    console.error('Error fetching RFP by token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Submit a proposal via vendor portal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as unknown;
    const validatedData = SubmitProposalSchema.parse(body);

    // Find the RFPVendor record with this token
    const rfpVendor = await db.rFPVendor.findUnique({
      where: { submissionToken: validatedData.token },
      include: {
        rfp: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!rfpVendor) {
      return NextResponse.json({ error: 'Invalid or expired submission link' }, { status: 404 });
    }

    // Check if RFP is still accepting proposals
    if (!['SENT', 'RECEIVING_PROPOSALS'].includes(rfpVendor.rfp.status)) {
      return NextResponse.json({ 
        error: 'This RFP is no longer accepting proposals',
      }, { status: 400 });
    }

    // Check for existing proposal
    const existingProposal = await db.proposal.findUnique({
      where: {
        rfpId_vendorId: {
          rfpId: rfpVendor.rfpId,
          vendorId: rfpVendor.vendorId,
        },
      },
    });

    if (existingProposal) {
      return NextResponse.json({ 
        error: 'You have already submitted a proposal for this RFP',
        proposalId: existingProposal.id,
      }, { status: 400 });
    }

    // Create AI job for proposal parsing
    const job = await db.aIJob.create({
      data: {
        type: 'PARSE_PROPOSAL',
        status: 'PENDING',
        rfpId: rfpVendor.rfpId,
        inputData: {
          rfpId: rfpVendor.rfpId,
          vendorId: rfpVendor.vendorId,
          emailContent: validatedData.proposalContent,
          attachments: validatedData.attachments ?? [],
          submittedViaPortal: true,
        },
      },
    });

    // Trigger Inngest function for background processing
    const result = await inngest.send({
      name: 'ai/parse-proposal',
      data: {
        jobId: job.id,
        rfpId: rfpVendor.rfpId,
        vendorId: rfpVendor.vendorId,
        emailContent: validatedData.proposalContent,
        attachments: validatedData.attachments ?? [],
      },
    });

    // Update job with event ID
    await db.aIJob.update({
      where: { id: job.id },
      data: { inngestEventId: result.ids[0] ?? '' },
    });

    // Update RFPVendor status to RESPONDED
    await db.rFPVendor.update({
      where: { id: rfpVendor.id },
      data: { status: 'RESPONDED' },
    });

    // Update RFP status to RECEIVING_PROPOSALS if it's still SENT
    if (rfpVendor.rfp.status === 'SENT') {
      await db.rFP.update({
        where: { id: rfpVendor.rfpId },
        data: { status: 'RECEIVING_PROPOSALS' },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Proposal submitted successfully! We are processing your response.',
      jobId: job.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error submitting proposal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

