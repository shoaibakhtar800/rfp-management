import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { rfpParser, type ComparisonProposal } from '~/lib/ai/rfp-parser';
import { z } from 'zod';
import type { Proposal } from 'generated/prisma';

const CompareProposalsSchema = z.object({
  rfpId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as unknown;
    const { rfpId } = CompareProposalsSchema.parse(body);
    
    const rfp = await db.rFP.findUnique({
      where: { id: rfpId },
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
    
    if (rfp.proposals.length === 0) {
      return NextResponse.json(
        { error: 'No proposals to compare' },
        { status: 400 },
      );
    }
    
    const proposalsForComparison = rfp.proposals.map((p) => ({
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
    
    const comparisonAnalysis = await rfpParser.compareProposals(
      proposalsForComparison as ComparisonProposal[],
      {
        title: rfp.title,
        description: rfp.description,
        budget: rfp.budget,
        deliveryDays: rfp.deliveryDays,
        paymentTerms: rfp.paymentTerms,
        warranty: rfp.warranty,
        items: rfp.items,
        requirements: rfp.requirements,
      },
    );
    
    await db.rFP.update({
      where: { id: rfpId },
      data: {
        status: 'EVALUATING',
        evaluationSummary: comparisonAnalysis,
        recommendation: {
          generatedAt: new Date().toISOString(),
          proposals: proposalsForComparison,
        },
      },
    });
    
    return NextResponse.json({
      rfp: {
        id: rfp.id,
        title: rfp.title,
        budget: rfp.budget,
        currency: rfp.currency,
        deliveryDays: rfp.deliveryDays,
      },
      proposals: rfp.proposals,
      analysis: comparisonAnalysis,
      generatedAt: new Date().toISOString(),
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
