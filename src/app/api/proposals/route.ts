import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { rfpParser } from '~/lib/ai/rfp-parser';
import { inngest } from '~/inngest/client';
import { z } from 'zod';

const CreateProposalSchema = z.object({
  rfpId: z.string(),
  vendorId: z.string(),
  emailContent: z.string(),
  attachments: z.any().optional(),
  async: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rfpId = searchParams.get('rfpId');
    const vendorId = searchParams.get('vendorId');
    
    const where: Record<string, string> = {};
    
    if (rfpId) {
      where.rfpId = rfpId;
    }
    
    if (vendorId) {
      where.vendorId = vendorId;
    }
    
    const proposals = await db.proposal.findMany({
      where,
      include: {
        rfp: true,
        vendor: true,
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });

    return NextResponse.json(proposals);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as unknown;
    const validatedData = CreateProposalSchema.parse(body);
    
    const [rfp, vendor] = await Promise.all([
      db.rFP.findUnique({
        where: { id: validatedData.rfpId },
      }),
      db.vendor.findUnique({
        where: { id: validatedData.vendorId },
      }),
    ]);
    
    if (!rfp) {
      return NextResponse.json(
        { error: 'RFP not found' },
        { status: 404 },
      );
    }
    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 },
      );
    }

    if (validatedData.async) {
      const job = await db.aIJob.create({
        data: {
          type: 'PARSE_PROPOSAL',
          status: 'PENDING',
          rfpId: validatedData.rfpId,
          inputData: {
            rfpId: validatedData.rfpId,
            vendorId: validatedData.vendorId,
            emailContent: validatedData.emailContent,
          },
        },
      });

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

      await db.aIJob.update({
        where: { id: job.id },
        data: { inngestEventId: result.ids[0] ?? '' },
      });

      return NextResponse.json({
        jobId: job.id,
        status: 'PENDING',
        message: 'Proposal parsing started in background',
      }, { status: 202 });
    }
    
    const parsedProposal = await rfpParser.parseVendorProposal(
      validatedData.emailContent,
      JSON.stringify({
        title: rfp.title,
        description: rfp.description,
        items: rfp.items,
        requirements: rfp.requirements,
      }),
    );
    
    const scoring = await rfpParser.scoreProposal(parsedProposal, rfp);
    
    const proposal = await db.proposal.create({
      data: {
        rfpId: validatedData.rfpId,
        vendorId: validatedData.vendorId,
        emailContent: validatedData.emailContent,
        attachments: validatedData.attachments as object ?? undefined,
        totalPrice: parsedProposal.totalPrice,
        currency: parsedProposal.currency,
        deliveryDays: parsedProposal.deliveryDays,
        paymentTerms: parsedProposal.paymentTerms,
        warranty: parsedProposal.warranty,
        validUntil: parsedProposal.validUntil ? new Date(parsedProposal.validUntil) : null,
        items: parsedProposal.items,
        notes: parsedProposal.notes,
        aiSummary: scoring.summary,
        aiScore: scoring.score,
        aiStrengths: scoring.strengths,
        aiWeaknesses: scoring.weaknesses,
        completenessScore: scoring.score,
        status: 'PARSED',
      },
      include: {
        vendor: true,
        rfp: true,
      },
    });
    
    await db.rFPVendor.upsert({
      where: {
        rfpId_vendorId: {
          rfpId: validatedData.rfpId,
          vendorId: validatedData.vendorId,
        },
      },
      create: {
        rfpId: validatedData.rfpId,
        vendorId: validatedData.vendorId,
        status: 'RESPONDED',
      },
      update: {
        status: 'RESPONDED',
      },
    });
    
    await db.rFP.update({
      where: { id: validatedData.rfpId },
      data: { status: 'RECEIVING_PROPOSALS' },
    });

    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error('Error creating proposal:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 },
    );
  }
}
