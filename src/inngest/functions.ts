import { inngest } from './client';
import { db } from '~/server/db';
import { emailService, type RFPEmailItem } from '~/lib/email/email-service';
import { rfpParser } from '~/lib/ai/rfp-parser';
import { env } from '~/env';

const normalizeItems = (items: unknown): RFPEmailItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Record<string, unknown> => 
      item !== null && typeof item === 'object' && typeof (item as Record<string, unknown>).name === 'string'
    )
    .map((item) => ({
      name: String(item.name),
      quantity: Number(item.quantity) || 0,
      specifications: typeof item.specifications === 'string' ? item.specifications : undefined,
    }));
};

const normalizeRequirements = (requirements: unknown): string[] => {
  if (!Array.isArray(requirements)) return [];
  return requirements.filter((req): req is string => typeof req === 'string');
};

export const parseRFPBackground = inngest.createFunction(
  { 
    id: 'ai/parse-rfp',
    retries: 3,
  },
  { event: 'ai/parse-rfp' },
  async ({ event, step }) => {
    const { jobId, userRequest, dueDate } = event.data as { 
      jobId: string; 
      userRequest: string;
      dueDate?: string;
    };

    await step.run('update-status-processing', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          progress: 10,
          stepDescription: 'Analyzing your request...',
        },
      });
    });

    const structuredRFP = await step.run('parse-rfp', async () => {
      return rfpParser.parseRFPFromNaturalLanguage(userRequest);
    });

    await step.run('update-progress', async () => {
        await db.aIJob.update({
          where: { id: jobId },
          data: { 
            progress: 70,
            stepDescription: 'Creating RFP...',
          },
        });
    });

    const rfp = await step.run('create-rfp', async () => {
      const parsedItems = Array.isArray(structuredRFP.items) ? structuredRFP.items : [];
      const parsedRequirements = structuredRFP.requirements ?? [];
      
      return db.rFP.create({
        data: {
          title: structuredRFP.title,
          description: structuredRFP.description,
          userRequest: userRequest,
          budget: structuredRFP.budget,
          currency: structuredRFP.currency,
          deliveryDays: structuredRFP.deliveryDays,
          paymentTerms: structuredRFP.paymentTerms,
          warranty: structuredRFP.warranty,
          items: parsedItems,
          requirements: parsedRequirements,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: 'DRAFT',
        },
      });
    });

    await step.run('complete-job', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          status: 'COMPLETED',
          rfpId: rfp.id,
          progress: 100,
          stepDescription: 'RFP created successfully!',
          completedAt: new Date(),
          outputData: {
            rfpId: rfp.id,
            title: rfp.title,
          },
        },
      });
    });

    return {
      jobId,
      rfpId: rfp.id,
      success: true,
    };
  }
);

export const parseProposalBackground = inngest.createFunction(
  { 
    id: 'ai/parse-proposal',
    retries: 3,
  },
  { event: 'ai/parse-proposal' },
  async ({ event, step }) => {
    const { jobId, rfpId, vendorId, emailContent, attachments } = event.data as { 
      jobId: string;
      rfpId: string;
      vendorId: string;
      emailContent: string;
      attachments?: unknown;
    };

    await step.run('update-status-processing', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          status: 'PROCESSING',
          startedAt: new Date(),
          progress: 10,
          stepDescription: 'Analyzing proposal...',
        },
      });
    });

    const rfp = await step.run('fetch-rfp', async () => {
      return db.rFP.findUnique({
        where: { id: rfpId },
      });
    });

    if (!rfp) {
      await step.run('mark-failed-no-rfp', async () => {
        await db.aIJob.update({
          where: { id: jobId },
          data: { 
            status: 'FAILED',
            error: 'RFP not found',
            completedAt: new Date(),
          },
        });
      });
      throw new Error('RFP not found');
    }

    const parsedProposal = await step.run('parse-proposal', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          progress: 30,
          stepDescription: 'Extracting pricing and terms...',
        },
      });

      return rfpParser.parseVendorProposal(
        emailContent,
        JSON.stringify({
          title: rfp.title,
          description: rfp.description,
          items: rfp.items,
          requirements: rfp.requirements,
        }),
      );
    });

    const scoring = await step.run('score-proposal', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          progress: 60,
          stepDescription: 'Scoring proposal...',
        },
      });

      return rfpParser.scoreProposal(parsedProposal, rfp);
    });

    const proposal = await step.run('create-proposal', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          progress: 80,
          stepDescription: 'Saving proposal...',
        },
      });

      return db.proposal.create({
        data: {
          rfpId,
          vendorId,
          emailContent,
          attachments: attachments as object ?? undefined,
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
    });

    await step.run('update-rfp-vendor', async () => {
      await db.rFPVendor.upsert({
        where: {
          rfpId_vendorId: { rfpId, vendorId },
        },
        create: {
          rfpId,
          vendorId,
          status: 'RESPONDED',
        },
        update: {
          status: 'RESPONDED',
        },
      });

      await db.rFP.update({
        where: { id: rfpId },
        data: { status: 'RECEIVING_PROPOSALS' },
      });
    });

    await step.run('complete-job', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          status: 'COMPLETED',
          proposalId: proposal.id,
          progress: 100,
          stepDescription: 'Proposal analyzed successfully!',
          completedAt: new Date(),
          outputData: {
            proposalId: proposal.id,
            score: scoring.score,
            summary: scoring.summary,
          },
        },
      });
    });

    return {
      jobId,
      proposalId: proposal.id,
      score: scoring.score,
      success: true,
    };
  }
);

export const compareProposalsBackground = inngest.createFunction(
  { 
    id: 'ai/compare-proposals',
    retries: 3,
  },
  { event: 'ai/compare-proposals' },
  async ({ event, step }) => {
    const { jobId, rfpId } = event.data as { 
      jobId: string;
      rfpId: string;
    };

    await step.run('update-status-processing', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          status: 'PROCESSING',
          startedAt: new Date(),
          progress: 10,
          stepDescription: 'Fetching proposals...',
        },
      });
    });

    const rfp = await step.run('fetch-data', async () => {
      return db.rFP.findUnique({
        where: { id: rfpId },
        include: {
          proposals: {
            include: {
              vendor: true,
            },
          },
        },
      });
    });

    if (!rfp) {
      await step.run('mark-failed-no-rfp', async () => {
        await db.aIJob.update({
          where: { id: jobId },
          data: { 
            status: 'FAILED',
            error: 'RFP not found',
            completedAt: new Date(),
          },
        });
      });
      throw new Error('RFP not found');
    }

    if (rfp.proposals.length < 2) {
      await step.run('mark-failed-insufficient', async () => {
          await db.aIJob.update({
          where: { id: jobId },
          data: { 
            status: 'FAILED',
            error: 'At least 2 proposals required for comparison',
            completedAt: new Date(),
          },
        });
      });
      throw new Error('At least 2 proposals required');
    }

    const comparison = await step.run('compare-proposals', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          progress: 40,
          stepDescription: 'Analyzing and comparing proposals...',
        },
      });

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

      return rfpParser.compareProposals(proposals, {
        title: rfp.title,
        description: rfp.description,
        budget: rfp.budget,
        deliveryDays: rfp.deliveryDays,
        paymentTerms: rfp.paymentTerms,
        warranty: rfp.warranty,
        items: rfp.items,
        requirements: rfp.requirements,
      });
    });

    await step.run('save-comparison', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          progress: 80,
          stepDescription: 'Saving analysis...',
        },
      });

      await db.rFP.update({
        where: { id: rfpId },
        data: { 
          evaluationSummary: comparison,
          status: 'EVALUATING',
        },
      });
    });

    await step.run('complete-job', async () => {
      await db.aIJob.update({
        where: { id: jobId },
        data: { 
          status: 'COMPLETED',
          progress: 100,
          stepDescription: 'Comparison completed!',
          completedAt: new Date(),
          outputData: {
            rfpId,
            proposalCount: rfp.proposals.length,
            comparisonLength: comparison.length,
          },
        },
      });
    });

    return {
      jobId,
      rfpId,
      comparison,
      success: true,
    };
  }
);

export const sendRFPEmails = inngest.createFunction(
  { 
    id: 'rfp/send-emails',
    retries: 3,
  },
  { event: 'rfp/send-emails' },
  async ({ event, step }) => {
    const { rfpId, vendorIds, portalBaseUrl } = event.data as { 
      rfpId: string; 
      vendorIds: string[];
      portalBaseUrl?: string;
    };

    const rfp = await step.run('fetch-rfp', async () => {
      return db.rFP.findUnique({
        where: { id: rfpId },
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
        },
      });
    });

    if (!rfp) {
      throw new Error('RFP not found');
    }

    const vendors = await step.run('fetch-vendors', async () => {
      return db.vendor.findMany({
        where: { id: { in: vendorIds } },
        select: { id: true, name: true, email: true },
      });
    });

    const rfpVendors = await step.run('prepare-rfp-vendors', async () => {
      const results = [];
      for (const vendor of vendors) {
        const rfpVendor = await db.rFPVendor.upsert({
          where: {
            rfpId_vendorId: { rfpId, vendorId: vendor.id },
          },
          create: {
            rfpId,
            vendorId: vendor.id,
            status: 'PENDING',
          },
          update: {},
          select: {
            id: true,
            vendorId: true,
            submissionToken: true,
          },
        });
        results.push({
          ...vendor,
          submissionToken: rfpVendor.submissionToken!,
        });
      }
      return results;
    });

    const results: Array<{
      vendorId: string;
      vendorEmail: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    for (const vendor of rfpVendors) {
      const result = await step.run(`send-email-${vendor.id}`, async () => {
        try {
          const emailResults = await emailService.sendRFPToVendors(
            {
              title: rfp.title,
              description: rfp.description,
              budget: rfp.budget,
              currency: rfp.currency,
              deliveryDays: rfp.deliveryDays,
              paymentTerms: rfp.paymentTerms,
              warranty: rfp.warranty,
              items: normalizeItems(rfp.items),
              requirements: normalizeRequirements(rfp.requirements),
              dueDate: rfp.dueDate,
            },
            [{ 
              email: vendor.email, 
              name: vendor.name,
              submissionToken: vendor.submissionToken,
            }],
            portalBaseUrl
          );

          const emailResult = emailResults[0];
          if (!emailResult) {
            throw new Error('No email result returned');
          }

          await db.rFPVendor.update({
            where: {
              rfpId_vendorId: { rfpId, vendorId: vendor.id },
            },
            data: {
              sentAt: emailResult.success ? new Date() : null,
              status: emailResult.success ? 'SENT' : 'PENDING',
            },
          });

          await db.emailLog.create({
            data: {
              rfpId: rfpId,
              vendorId: vendor.id,
              type: 'RFP_SENT',
              subject: `RFP: ${rfp.title}`,
              body: emailResult.html,
              from: env.RESEND_FROM,
              to: vendor.email,
              messageId: emailResult.messageId,
              status: emailResult.success ? 'SENT' : 'FAILED',
              error: emailResult.error,
              sentAt: emailResult.success ? new Date() : null,
            },
          });

          return {
            vendorId: vendor.id,
            vendorEmail: vendor.email,
            success: emailResult.success,
            messageId: emailResult.messageId,
            error: emailResult.error,
          };
        } catch (error) {
          return {
            vendorId: vendor.id,
            vendorEmail: vendor.email,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      results.push(result);
    }

    return {
      rfpId,
      totalVendors: vendors.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    };
  }
);

export const sendAwardNotification = inngest.createFunction(
  { 
    id: 'rfp/send-award-notification',
    retries: 3,
  },
  { event: 'rfp/send-award-notification' },
  async ({ event, step }) => {
    const { rfpId, vendorId, notes } = event.data as { rfpId: string; vendorId: string; notes: string };

    const [rfp, vendor] = await step.run('fetch-data', async () => {
      return Promise.all([
        db.rFP.findUnique({ where: { id: rfpId } }),
        db.vendor.findUnique({ where: { id: vendorId } }),
      ]);
    });

    if (!rfp || !vendor) {
      throw new Error('RFP or Vendor not found');
    }

    const emailResult = await step.run('send-notification', async () => {
      const subject = `Congratulations! Award Notification: ${rfp.title}`;
      const bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #22c55e;">🎉 Congratulations!</h2>
          
          <p>Dear ${vendor.name},</p>
          
          <p>We are pleased to inform you that your proposal for <strong>"${rfp.title}"</strong> has been selected!</p>
          
          ${notes ? `
          <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <strong>Notes:</strong>
            <p style="margin: 10px 0 0 0;">${notes}</p>
          </div>
          ` : ''}
          
          <p>We will follow up shortly with the next steps to finalize our agreement.</p>
          
          <p>Thank you for your excellent proposal and we look forward to working with you.</p>
          
          <p>Best regards,<br>
          <strong>Procurement Team</strong></p>
        </div>
      `;

      const result = await emailService.sendEmail({
        to: vendor.email,
        subject,
        html: bodyHtml,
        text: bodyHtml.replace(/<[^>]*>?/gm, ''),
      });

      await db.emailLog.create({
        data: {
          rfpId,
          vendorId,
          type: 'AWARD_NOTIFICATION',
          subject,
          body: bodyHtml,
          from: env.RESEND_FROM,
          to: vendor.email,
          messageId: result.messageId,
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      return result;
    });

    return {
      success: true,
      rfpId,
      vendorId,
      messageId: emailResult.messageId,
    };
  }
);

export const checkVendorEmails = inngest.createFunction(
  { 
    id: 'rfp/check-vendor-emails',
    retries: 2,
  },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const lastCheckDate = await step.run('get-last-check', async () => {
      const log = await db.emailLog.findFirst({
        where: { type: 'PROPOSAL_RECEIVED' },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      });
      return log?.receivedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    });

    const emails = await step.run('fetch-emails', async () => {
      try {
        const sinceDate = typeof lastCheckDate === 'string' 
          ? new Date(lastCheckDate) 
          : lastCheckDate;
        return await emailService.fetchUnreadEmails(sinceDate);
      } catch (error) {
        console.error('Error fetching emails:', error);
        return [];
      }
    });

    if (emails.length === 0) {
      return { checked: 0, processed: 0, proposals: [] };
    }

    const processedEmails: Array<{
      vendor: string;
      rfp: string;
      proposalId: string;
      score: number | null;
    }> = [];

    for (const email of emails) {
      const result = await step.run(`process-email-${email.messageId}`, async () => {
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
            return null;
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
            return null;
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
            return null;
          }

          const parsedProposal = await rfpParser.parseVendorProposal(
            email.text,
            JSON.stringify({
              title: recentRFPVendor.rfp.title,
              description: recentRFPVendor.rfp.description,
              items: recentRFPVendor.rfp.items,
            })
          );

          const scoring = await rfpParser.scoreProposal(parsedProposal, recentRFPVendor.rfp);

          const proposal = await db.proposal.create({
            data: {
              rfpId: recentRFPVendor.rfpId,
              vendorId: vendor.id,
              emailContent: email.text,
              attachments: email.attachments.map((att) => ({
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

          await db.rFPVendor.update({
            where: {
              rfpId_vendorId: {
                rfpId: recentRFPVendor.rfpId,
                vendorId: vendor.id,
              },
            },
            data: { status: 'RESPONDED' },
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

          return {
            vendor: vendor.name,
            rfp: recentRFPVendor.rfp.title,
            proposalId: proposal.id,
            score: proposal.aiScore,
          };
        } catch (error) {
          console.error('Error processing email:', error);
          return null;
        }
      });

      if (result) {
        processedEmails.push(result);
      }
    }

    return {
      checked: emails.length,
      processed: processedEmails.length,
      proposals: processedEmails,
    };
  }
);

export const parseProposal = inngest.createFunction(
  { 
    id: 'rfp/parse-proposal',
    retries: 2,
  },
  { event: 'rfp/parse-proposal' },
  async ({ event, step }) => {
    const { proposalId } = event.data as { proposalId: string };

    const proposal = await step.run('fetch-proposal', async () => {
      return db.proposal.findUnique({
        where: { id: proposalId },
        include: {
          rfp: true,
          vendor: true,
        },
      });
    });

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const parsedData = await step.run('parse-content', async () => {
      return rfpParser.parseVendorProposal(
        proposal.emailContent,
        JSON.stringify({
          title: proposal.rfp.title,
          description: proposal.rfp.description,
          items: proposal.rfp.items,
        })
      );
    });

    const scoring = await step.run('score-proposal', async () => {
      return rfpParser.scoreProposal(parsedData, proposal.rfp);
    });

    const updatedProposal = await step.run('update-proposal', async () => {
      return db.proposal.update({
        where: { id: proposalId },
        data: {
          totalPrice: parsedData.totalPrice,
          currency: parsedData.currency,
          deliveryDays: parsedData.deliveryDays,
          paymentTerms: parsedData.paymentTerms,
          warranty: parsedData.warranty,
          validUntil: parsedData.validUntil ? new Date(parsedData.validUntil) : null,
          items: parsedData.items,
          notes: parsedData.notes,
          aiSummary: scoring.summary,
          aiScore: scoring.score,
          aiStrengths: scoring.strengths,
          aiWeaknesses: scoring.weaknesses,
          status: 'PARSED',
        },
      });
    });

    return {
      proposalId,
      parsed: true,
      score: updatedProposal.aiScore,
    };
  }
);
