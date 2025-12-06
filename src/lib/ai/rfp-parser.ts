import { huggingface } from '@ai-sdk/huggingface';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

const RFPItemSchema = z.object({
  name: z.string().describe('Item name'),
  quantity: z.number().describe('Quantity needed'),
  specifications: z.string().optional().describe('Item specifications'),
  estimatedPrice: z.number().optional().describe('Estimated price per unit'),
});

const RFPStructureSchema = z.object({
  title: z.string().describe('A concise title for the RFP'),
  description: z.string().describe('Detailed description of what is being procured'),
  budget: z.number().optional().describe('Total budget amount'),
  currency: z.string().default('USD').describe('Currency for the budget'),
  deliveryDays: z.number().optional().describe('Number of days for delivery'),
  paymentTerms: z.string().optional().describe('Payment terms (e.g., Net 30, Net 60)'),
  warranty: z.string().optional().describe('Warranty requirements'),
  items: z.array(RFPItemSchema).default([]).describe('List of items to procure'),
  requirements: z.array(z.string()).default([]).describe('Additional requirements or conditions'),
});

const ProposalItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  specifications: z.string().optional(),
});

const ProposalStructureSchema = z.object({
  totalPrice: z.number().describe('Total quoted price'),
  currency: z.string().default('USD'),
  deliveryDays: z.number().optional().describe('Proposed delivery timeframe in days'),
  paymentTerms: z.string().optional().describe('Proposed payment terms'),
  warranty: z.string().optional().describe('Warranty offered'),
  validUntil: z.string().optional().describe('Quote validity date'),
  items: z.array(ProposalItemSchema).optional(),
  notes: z.string().optional().describe('Additional notes or conditions'),
});

export type ParsedRFP = z.infer<typeof RFPStructureSchema>;
export type ParsedProposal = z.infer<typeof ProposalStructureSchema>;
export type RFPItem = z.infer<typeof RFPItemSchema>;
export type ProposalItem = z.infer<typeof ProposalItemSchema>;

export interface ComparisonProposal {
  vendorName: string;
  vendorEmail: string;
  totalPrice?: number | null;
  currency?: string | null;
  deliveryDays?: number | null;
  paymentTerms?: string | null;
  warranty?: string | null;
  score?: number | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  items?: unknown;
}

export interface RFPRequirements {
  title: string;
  description: string;
  budget?: number | null;
  deliveryDays?: number | null;
  paymentTerms?: string | null;
  warranty?: string | null;
  items?: unknown;
  requirements?: unknown;
}

export interface ProposalScore {
  score: number;
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

const AI_MODEL = 'Qwen/Qwen3-8B';

function basicParseRFP(userInput: string): ParsedRFP {
  const lower = userInput.toLowerCase();

  let budget: number | undefined;
  const budgetPatterns = [
    /budget[^$]*\$\s*([\d,]+(?:\.\d{2})?)/i,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:total|budget)/i,
    /\$\s*([\d,]+(?:\.\d{2})?)/i,
    /budget[^\d]*([\d,]+(?:\.\d{2})?)/i,
  ];
  
  for (const pattern of budgetPatterns) {
    const match = pattern.exec(userInput);
    if (match?.[1]) {
      const parsed = parseFloat(match[1].replace(/,/g, ''));
      if (parsed > 0) {
        budget = parsed;
        break;
      }
    }
  }

  const deliveryPatterns = [
    /within\s*(\d+)\s*days/i,
    /(\d+)\s*days?(?:\s+delivery|\s+timeline)?/i,
    /delivery[^\d]*(\d+)\s*days/i,
    /completed\s*within\s*(\d+)\s*days/i,
  ];
  
  let deliveryDays: number | undefined;
  for (const pattern of deliveryPatterns) {
    const match = pattern.exec(userInput);
    if (match?.[1]) {
      deliveryDays = parseInt(match[1], 10);
      break;
    }
  }

  const items: RFPItem[] = [];
  const seenItems = new Set<string>();
  
  const itemPatterns = [
    /(\d+)\s+(?:new\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(?:with|of|that)/gi,
    /need\s+(\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi,
    /(\d+)\s+([a-zA-Z]+)\s+with\s+([^,.\n]+)/gi,
    /(\d+)\s+([a-zA-Z]+)\s+of\s+(\d+[^,.\n]*)/gi,
    /(?:we\s+)?(?:need|require|want)\s+(\d+)\s+([a-zA-Z][a-zA-Z\s]*?)(?:\s+with|\s+of|\s*[,.]|$)/gi,
  ];

  for (const pattern of itemPatterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(userInput)) !== null) {
      const quantity = parseInt(match[1] ?? '0', 10);
      let name = (match[2] ?? 'Item').trim().toLowerCase();
      const specs = match[3]?.trim();
      
      name = name.replace(/^new\s+/i, '').trim();
      
      if (['the', 'a', 'an', 'all', 'our', 'this', 'their', 'days', 'year', 'years'].includes(name)) {
        continue;
      }
      
      name = name.charAt(0).toUpperCase() + name.slice(1);
      
      if (quantity > 0 && name.length > 2 && !seenItems.has(name.toLowerCase())) {
        seenItems.add(name.toLowerCase());
        items.push({
          name,
          quantity,
          specifications: specs ?? undefined,
        });
      }
    }
  }

  let paymentTerms: string | undefined;
  if (lower.includes('net 30')) paymentTerms = 'Net 30';
  else if (lower.includes('net 60')) paymentTerms = 'Net 60';
  else if (lower.includes('net 45')) paymentTerms = 'Net 45';
  else if (lower.includes('upon delivery')) paymentTerms = 'Upon Delivery';

  let warranty: string | undefined;
  const warrantyPatterns = [
    /(\d+)[- ]?year(?:s)?(?:[- ]?warranty)?/i,
    /one[- ]?year(?:[- ]?warranty)?/i,
    /two[- ]?year(?:[- ]?warranty)?/i,
    /minimum\s+(?:of\s+)?(?:a\s+)?(\d+|one|two)[- ]?year/i,
  ];
  
  for (const pattern of warrantyPatterns) {
    const match = pattern.exec(userInput);
    if (match) {
      let years = 1;
      if (match[1]) {
        if (match[1].toLowerCase() === 'one') years = 1;
        else if (match[1].toLowerCase() === 'two') years = 2;
        else years = parseInt(match[1], 10);
      } else if (lower.includes('one-year') || lower.includes('one year')) {
        years = 1;
      } else if (lower.includes('two-year') || lower.includes('two year')) {
        years = 2;
      }
      warranty = `${years} Year${years > 1 ? 's' : ''}`;
      break;
    }
  }

  let title = 'Procurement Request';
  if (items.length > 0) {
    const itemNames = items.slice(0, 3).map(i => i.name);
    title = `Procurement: ${itemNames.join(', ')}${items.length > 3 ? ' and more' : ''}`;
  }

  const requirements: string[] = [];
  if (lower.includes('operational efficiency')) {
    requirements.push('Must ensure operational efficiency');
  }
  if (lower.includes('end of life') || lower.includes('replacement')) {
    requirements.push('Replacement for end-of-life equipment');
  }

  return {
    title,
    description: userInput,
    budget,
    currency: 'USD',
    deliveryDays,
    paymentTerms,
    warranty,
    items,
    requirements,
  };
}

function basicParseProposal(emailContent: string): ParsedProposal {
  const pricePatterns = [
    /total[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
    /quote[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
    /price[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
    /\$\s*([\d,]+(?:\.\d{2})?)/,
  ];

  let totalPrice = 0;
  for (const pattern of pricePatterns) {
    const match = pattern.exec(emailContent);
    if (match?.[1]) {
      totalPrice = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  const deliveryMatch = /(\d+)\s*(?:days?|business days?)/i.exec(emailContent);
  const deliveryDays = deliveryMatch?.[1] ? parseInt(deliveryMatch[1], 10) : undefined;

  const lower = emailContent.toLowerCase();
  let paymentTerms: string | undefined;
  if (lower.includes('net 30')) paymentTerms = 'Net 30';
  else if (lower.includes('net 60')) paymentTerms = 'Net 60';
  else if (lower.includes('net 45')) paymentTerms = 'Net 45';

  const warrantyMatch = /(\d+)\s*year(?:s)?\s*warranty/i.exec(emailContent);
  let warranty: string | undefined;
  if (warrantyMatch?.[1]) {
    const years = parseInt(warrantyMatch[1], 10);
    warranty = `${years} Year${years > 1 ? 's' : ''}`;
  }

  return {
    totalPrice,
    currency: 'USD',
    deliveryDays,
    paymentTerms,
    warranty,
    validUntil: undefined,
    items: undefined,
    notes: emailContent.slice(0, 500),
  };
}

function basicCompareProposals(
  proposals: ComparisonProposal[],
  rfpRequirements: RFPRequirements,
): string {
  const sorted = [...proposals].sort(
    (a, b) => (a.totalPrice ?? Infinity) - (b.totalPrice ?? Infinity)
  );
  const lowestPrice = sorted[0];
  const budget = rfpRequirements.budget ?? Infinity;

  const withinBudget = proposals.filter(
    (p) => (p.totalPrice ?? Infinity) <= budget
  );

  const highestScore = [...proposals].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  )[0];

  const lowestPriceDisplay = lowestPrice?.totalPrice 
    ? `${lowestPrice?.currency ?? 'USD'} ${lowestPrice.totalPrice.toLocaleString()}`
    : 'N/A';

  return `
## Proposal Comparison Summary

### Price Analysis
${proposals
  .map((p) => {
    const priceStr = p.totalPrice 
      ? `${p.currency ?? 'USD'} ${p.totalPrice.toLocaleString()}`
      : 'Not quoted';
    return `- **${p.vendorName}**: ${priceStr}`;
  })
  .join('\n')}

**Lowest Price**: ${lowestPrice?.vendorName ?? 'N/A'} at ${lowestPriceDisplay}

### Delivery Timeline
${proposals
  .map((p) => `- **${p.vendorName}**: ${p.deliveryDays ?? 'Not specified'} days`)
  .join('\n')}

### AI Scores
${proposals
  .map((p) => `- **${p.vendorName}**: ${p.score ?? 'Not scored'}/100`)
  .join('\n')}

### Recommendation

${highestScore?.score ? `
Based on the AI scoring, **${highestScore.vendorName}** has the highest score of ${highestScore.score}/100.
` : ''}

${withinBudget.length > 0 ? `
**${withinBudget.length}** vendor(s) are within the specified budget of ${rfpRequirements.budget?.toLocaleString() ?? 'N/A'}.
` : 'No vendors are clearly within the specified budget.'}

${lowestPrice?.vendorName ? `
**${lowestPrice.vendorName}** offers the most competitive pricing.
` : ''}

### Next Steps
1. Review the detailed proposals from shortlisted vendors
2. Consider requesting additional information if needed
3. Conduct reference checks for the preferred vendor
4. Proceed with contract negotiations

*Please review all proposals carefully and consider factors beyond just price before making a final decision.*
  `;
}

export async function parseRFPFromNaturalLanguage(userInput: string): Promise<ParsedRFP> {
  try {
    const { object } = await generateObject({
      model: huggingface(AI_MODEL),
      schema: RFPStructureSchema,
      prompt: `You are a procurement expert. Parse the following natural language procurement request into a structured RFP.

Extract:
- A clear, professional title
- Detailed description
- Budget (look for dollar amounts)
- Delivery timeline (look for days, weeks, or dates)
- Payment terms (Net 30, Net 60, etc.)
- Warranty requirements
- Individual items with quantities and specifications
- Any additional requirements

Request:
${userInput}

Return a well-structured JSON object.`,
    });

    return object;
  } catch (error) {
    console.error('Error parsing RFP with AI:', error);
    return basicParseRFP(userInput);
  }
}

export async function parseVendorProposal(
  emailContent: string, 
  rfpContext?: string
): Promise<ParsedProposal> {
  try {
    const { object } = await generateObject({
      model: huggingface(AI_MODEL),
      schema: ProposalStructureSchema,
      prompt: `You are analyzing a vendor's proposal email. Extract the key commercial terms.

${rfpContext ? `Original RFP Context:\n${rfpContext}\n\n` : ''}

Vendor's Proposal Email:
${emailContent}

Extract:
- Total quoted price (look for dollar amounts, "total", "quote", "price")
- Delivery timeline in days
- Payment terms offered
- Warranty details
- Individual item pricing if available
- Any important notes or conditions

Return a structured JSON object.`,
    });

    return object;
  } catch (error) {
    console.error('Error parsing proposal with AI:', error);
    return basicParseProposal(emailContent);
  }
}

export async function compareProposals(
  proposals: ComparisonProposal[],
  rfpRequirements: RFPRequirements,
): Promise<string> {
  try {
    const budgetDisplay = rfpRequirements.budget 
      ? `$${rfpRequirements.budget.toLocaleString()}` 
      : 'Not specified';
    const deliveryDisplay = rfpRequirements.deliveryDays 
      ? `${rfpRequirements.deliveryDays} days` 
      : 'Not specified';

    const { text } = await generateText({
      model: huggingface(AI_MODEL),
      prompt: `You are a procurement expert analyzing vendor proposals. Provide a detailed comparison and recommendation.

## RFP Requirements:
- Title: ${rfpRequirements.title}
- Budget: ${budgetDisplay}
- Required Delivery: ${deliveryDisplay}
- Required Warranty: ${rfpRequirements.warranty ?? 'Not specified'}
- Items: ${JSON.stringify(rfpRequirements.items)}

## Vendor Proposals:
${proposals.map((p, i) => {
  const priceDisplay = p.totalPrice 
    ? `${p.currency ?? 'USD'} ${p.totalPrice.toLocaleString()}` 
    : 'Not quoted';
  const deliveryDays = p.deliveryDays 
    ? `${p.deliveryDays} days` 
    : 'Not specified';
  
  return `
### Vendor ${i + 1}: ${p.vendorName}
- Email: ${p.vendorEmail}
- Total Price: ${priceDisplay}
- Delivery: ${deliveryDays}
- Warranty: ${p.warranty ?? 'Not specified'}
- AI Score: ${p.score ?? 'Not scored'}/100
${p.strengths?.length ? `- Strengths: ${p.strengths.join(', ')}` : ''}
${p.weaknesses?.length ? `- Weaknesses: ${p.weaknesses.join(', ')}` : ''}
`;
}).join('\n')}

## Your Analysis:
Provide a comprehensive analysis including:

1. **Price Comparison**: Compare pricing across vendors, considering value for money
2. **Delivery Analysis**: Who can deliver fastest? Who meets the requirements?
3. **Quality & Terms**: Compare warranties, payment terms, and completeness
4. **Risk Assessment**: Identify any concerns or risks with each vendor
5. **Recommendation**: Which vendor should be selected and why?

Be specific with numbers and reasoning. Format your response with clear sections.`,
    });

    return text;
  } catch (error) {
    console.error('Error comparing proposals with AI:', error);
    return basicCompareProposals(proposals, rfpRequirements);
  }
}

export async function scoreProposal(
  proposal: ParsedProposal,
  rfpRequirements: RFPRequirements,
): Promise<ProposalScore> {
  try {
    const budget = rfpRequirements.budget ?? Infinity;
    const requiredDelivery = rfpRequirements.deliveryDays ?? 30;

    let score = 50;
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (proposal.totalPrice !== undefined && proposal.totalPrice > 0) {
      if (proposal.totalPrice <= budget) {
        const savings = budget === Infinity ? 0 : ((budget - proposal.totalPrice) / budget) * 100;
        const priceScore = Math.min(40, 20 + savings * 0.4);
        score += priceScore - 20;
        if (savings > 0) {
          strengths.push(`Within budget with ${Math.round(savings)}% savings`);
        } else {
          strengths.push('Meets budget requirements');
        }
      } else if (budget !== Infinity) {
        const overrun = ((proposal.totalPrice - budget) / budget) * 100;
        score -= Math.min(25, overrun * 0.25);
        weaknesses.push(`Exceeds budget by ${Math.round(overrun)}%`);
      }
    } else {
      weaknesses.push('No pricing provided');
      score -= 15;
    }

    if (proposal.deliveryDays !== undefined) {
      if (proposal.deliveryDays <= requiredDelivery) {
        score += 15;
        const daysEarly = requiredDelivery - proposal.deliveryDays;
        if (daysEarly > 0) {
          strengths.push(`Delivery ${daysEarly} days ahead of requirement`);
        } else {
          strengths.push('Meets delivery timeline');
        }
      } else {
        const daysLate = proposal.deliveryDays - requiredDelivery;
        score -= Math.min(15, daysLate * 0.5);
        weaknesses.push(`Delivery ${daysLate} days beyond requirement`);
      }
    } else {
      weaknesses.push('No delivery timeline specified');
      score -= 8;
    }

    if (proposal.warranty) {
      const yearMatch = /(\d+)/g.exec(proposal.warranty);
      const years = yearMatch?.[1] ? parseInt(yearMatch[1], 10) : 1;
      score += Math.min(15, years * 5);
      strengths.push(`${proposal.warranty} warranty included`);
    } else {
      weaknesses.push('No warranty information provided');
      score -= 5;
    }

    if (proposal.items && proposal.items.length > 0) {
      score += 10;
      strengths.push('Detailed item breakdown provided');
    } else {
      score -= 5;
      weaknesses.push('No itemized pricing breakdown');
    }

    if (proposal.paymentTerms) {
      strengths.push(`Payment terms: ${proposal.paymentTerms}`);
      score += 5;
    }

    const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

    const summaryParts: string[] = [];
    if (normalizedScore >= 80) {
      summaryParts.push('Excellent proposal');
    } else if (normalizedScore >= 65) {
      summaryParts.push('Good proposal');
    } else if (normalizedScore >= 50) {
      summaryParts.push('Acceptable proposal');
    } else {
      summaryParts.push('Below average proposal');
    }

    const firstStrength = strengths[0];
    const firstWeakness = weaknesses[0];

    if (firstStrength) {
      summaryParts.push(firstStrength);
    }
    if (firstWeakness) {
      summaryParts.push(`However, ${firstWeakness.toLowerCase()}`);
    }

    return {
      score: normalizedScore,
      strengths,
      weaknesses,
      summary: summaryParts.join('. ') + '.',
    };
  } catch (error) {
    console.error('Error scoring proposal:', error);
    return {
      score: 50,
      strengths: ['Proposal received'],
      weaknesses: ['Unable to fully evaluate automatically'],
      summary: 'Proposal received but requires manual evaluation.',
    };
  }
}

export const rfpParser = {
  parseRFPFromNaturalLanguage,
  parseVendorProposal,
  compareProposals,
  scoreProposal,
};
