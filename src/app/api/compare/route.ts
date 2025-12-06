import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { rfpParser } from '~/lib/ai/rfp-parser';
import { inngest } from '~/inngest/client';
import { z } from 'zod';

const CompareSchema = z.object({
  rfpId: z.string(),
  async: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as z.infer<typeof CompareSchema>;
    const validatedData = CompareSchema.parse(body);

    const rfp = await db.rFP.findUnique({
      where: { id: validatedData.rfpId },
      include: {
        proposals: {
          include: {
            vendor: true,
          },
        },
      },
    });

    if (!rfp) {
      return NextResponse.json(
        { error: 'RFP not found' },
        { status: 404 },
      );
    }

    if (rfp.proposals.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 proposals required for comparison' },
        { status: 400 },
      );
    }

    if (validatedData.async) {
      const job = await db.aIJob.create({
        data: {
          type: 'COMPARE_PROPOSALS',
          status: 'PENDING',
          rfpId: validatedData.rfpId,
          inputData: {
            rfpId: validatedData.rfpId,
            proposalCount: rfp.proposals.length,
          },
        },
      });

      const result = await inngest.send({
        name: 'ai/compare-proposals',
        data: {
          jobId: job.id,
          rfpId: validatedData.rfpId,
        },
      });

      await db.aIJob.update({
        where: { id: job.id },
        data: { inngestEventId: result.ids[0] ?? '' },
      });

      return NextResponse.json({
        jobId: job.id,
        status: 'PENDING',
        message: 'Comparison started in background',
      }, { status: 202 });
    }

    const proposals = rfp.proposals.map((p) => ({
      vendorName: p.vendor.name,
      vendorEmail: p.vendor.email,
      totalPrice: p.totalPrice,
      currency: p.currency,
      deliveryDays: p.deliveryDays,
      paymentTerms: p.paymentTerms,
      warranty: p.warranty,
      score: p.aiScore,
      strengths: p.aiStrengths as string[] | null,
      weaknesses: p.aiWeaknesses as string[] | null,
      items: p.items,
    }));

    const comparison = await rfpParser.compareProposals(proposals, {
      title: rfp.title,
      description: rfp.description,
      budget: rfp.budget,
      deliveryDays: rfp.deliveryDays,
      paymentTerms: rfp.paymentTerms,
      warranty: rfp.warranty,
      items: rfp.items,
      requirements: rfp.requirements,
    });

    await db.rFP.update({
      where: { id: validatedData.rfpId },
      data: { 
        evaluationSummary: comparison,
        status: 'EVALUATING',
      },
    });

    return NextResponse.json({
      rfpId: rfp.id,
      comparison,
      proposals: rfp.proposals.map((p) => ({
        id: p.id,
        vendorName: p.vendor.name,
        vendorEmail: p.vendor.email,
        totalPrice: p.totalPrice,
        currency: p.currency,
        deliveryDays: p.deliveryDays,
        paymentTerms: p.paymentTerms,
        warranty: p.warranty,
        aiScore: p.aiScore,
        aiSummary: p.aiSummary,
        aiStrengths: p.aiStrengths,
        aiWeaknesses: p.aiWeaknesses,
      })),
    });
  } catch (error) {
    console.error('Error comparing proposals:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to compare proposals' },
      { status: 500 },
    );
  }
}

