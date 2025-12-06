import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { emailService } from '~/lib/email/email-service';
import { rfpParser } from '~/lib/ai/rfp-parser';

export async function POST(_request: NextRequest) {
  try {
    const lastCheck = await db.emailLog.findFirst({
      where: { type: 'PROPOSAL_RECEIVED' },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    });

    const since = lastCheck?.receivedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

    const emails = await emailService.fetchUnreadEmails(since);
    
    const processedEmails: { vendor: string; rfp: string; proposalId: string; score: number }[] = [];
    
    for (const email of emails) {
      try {
        const vendor = await db.vendor.findUnique({
          where: { email: email.from },
        });
        
        if (!vendor) {
          await db.emailLog.create({
            data: {
              type: 'OTHER',
              subject: email.subject,
              body: email.text,
              from: email.from,
              to: email.to,
              messageId: email.messageId,
              status: 'RECEIVED',
              receivedAt: email.date,
            },
          });
          continue;
        }
        
        const recentRFPVendor = await db.rFPVendor.findFirst({
          where: {
            vendorId: vendor.id,
            status: 'SENT',
          },
          orderBy: { createdAt: 'desc' },
          include: { rfp: true },
        });
        
        if (!recentRFPVendor) {
          await db.emailLog.create({
            data: {
              vendorId: vendor.id,
              type: 'OTHER',
              subject: email.subject,
              body: email.text,
              from: email.from,
              to: email.to,
              messageId: email.messageId,
              status: 'RECEIVED',
              receivedAt: email.date,
            },
          });
          continue;
        }
        
        const existingProposal = await db.proposal.findUnique({
          where: {
            rfpId_vendorId: {
              rfpId: recentRFPVendor.rfpId,
              vendorId: vendor.id,
            },
          },
        });
        
        if (existingProposal) {
          continue;
        }
        
        const parsedProposal = await rfpParser.parseVendorProposal(
          email.text,
          JSON.stringify({
            title: recentRFPVendor.rfp.title,
            description: recentRFPVendor.rfp.description,
            items: recentRFPVendor.rfp.items,
          }),
        );
        
        const scoring = await rfpParser.scoreProposal(parsedProposal, recentRFPVendor.rfp);
        
        const proposal = await db.proposal.create({
          data: {
            rfpId: recentRFPVendor.rfpId,
            vendorId: vendor.id,
            emailContent: email.text,
            attachments: email.attachments.map((att: { filename: string; size: number; contentType: string }) => ({
              filename: att.filename,
              size: att.size,
              contentType: att.contentType,
            })),
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
            status: 'PARSED',
            receivedAt: email.date,
          },
        });
        
        await db.rFPVendor.upsert({
          where: {
            rfpId_vendorId: {
              rfpId: recentRFPVendor.rfpId,
              vendorId: vendor.id,
            },
          },
          create: {
            rfpId: recentRFPVendor.rfpId,
            vendorId: vendor.id,
            status: 'RESPONDED',
          },
          update: { status: 'RESPONDED' },
        });
        
        await db.rFP.update({
          where: { id: recentRFPVendor.rfpId },
          data: { status: 'RECEIVING_PROPOSALS' },
        });
        
        await db.emailLog.create({
          data: {
            rfpId: recentRFPVendor.rfpId,
            vendorId: vendor.id,
            type: 'PROPOSAL_RECEIVED',
            subject: email.subject,
            body: email.text,
            from: email.from,
            to: email.to,
            messageId: email.messageId,
            status: 'PROCESSED',
            receivedAt: email.date,
          },
        });
        
        processedEmails.push({
          vendor: vendor.name,
          rfp: recentRFPVendor.rfp.title,
          proposalId: proposal.id,
          score: proposal.aiScore ?? 0,
        });
      } catch (error) {
        console.error('Error processing email:', error);
      }
    }
    
    return NextResponse.json({
      checked: emails.length,
      processed: processedEmails.length,
      proposals: processedEmails,
    });
  } catch (error) {
    console.error('Error checking emails:', error);
    return NextResponse.json(
      { error: 'Failed to check emails' },
      { status: 500 },
    );
  }
}
