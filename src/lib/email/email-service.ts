import { Resend } from 'resend';
import { env } from '~/env';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  messageId: string;
}

export interface RFPEmailItem {
  name: string;
  quantity: number;
  specifications?: string | null;
}

export interface RFPEmailData {
  title: string;
  description: string;
  budget?: number | null;
  currency?: string | null;
  deliveryDays?: number | null;
  paymentTerms?: string | null;
  warranty?: string | null;
  items?: RFPEmailItem[] | null;
  requirements?: string[] | null;
  dueDate?: string | Date | null;
  submissionToken?: string | null;
  portalBaseUrl?: string | null;
}

export interface VendorEmailInfo {
  email: string;
  name: string;
  submissionToken?: string | null;
}

export interface SendRFPResult {
  vendorEmail: string;
  messageId: string;
  success: boolean;
  html: string;
  text: string;
  error?: string;
}

export interface ReceivedEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  date: Date;
  attachments: ReceivedEmailAttachment[];
}

export interface ReceivedEmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  size: number;
}

let resendClient: Resend | null = null;
let fromEmail = '';

function initializeResend(): void {
  if (resendClient !== null) return;

  const resendApiKey = env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set. Email sending will fail.');
    return;
  }

  resendClient = new Resend(resendApiKey);
  fromEmail = env.RESEND_FROM;
  console.log('Resend email service initialized');
}

function generateRFPEmailContent(rfp: RFPEmailData, submissionLink?: string): { html: string; text: string } {
  const items = Array.isArray(rfp.items) ? rfp.items : [];
  const requirements = Array.isArray(rfp.requirements) ? rfp.requirements : [];
  const currency = rfp.currency ?? 'USD';
  const itemsList = items
    .map(
      (item) =>
        `• ${item.name} - Quantity: ${item.quantity}${
          item.specifications ? ` (${item.specifications})` : ''
        }`,
    )
    .join('\n');

  const submitSection = submissionLink ? `
      <div style="margin-top: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 10px; text-align: center;">
        <h3 style="color: white; margin: 0 0 15px 0;">Submit Your Proposal Online</h3>
        <p style="color: rgba(255,255,255,0.9); margin: 0 0 20px 0;">
          Click the button below to submit your proposal through our secure vendor portal.
        </p>
        <a href="${submissionLink}" 
           style="display: inline-block; background: white; color: #667eea; padding: 12px 30px; 
                  text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
          📝 Submit Proposal
        </a>
        <p style="color: rgba(255,255,255,0.7); margin: 15px 0 0 0; font-size: 12px;">
          Or copy this link: ${submissionLink}
        </p>
      </div>
  ` : `
      <div style="margin-top: 30px;">
        <h3>How to Submit Your Proposal</h3>
        <p>Please reply to this email with your detailed proposal including:</p>
        <ul>
          <li>Itemized pricing for all requested items</li>
          <li>Delivery timeline</li>
          <li>Payment terms</li>
          <li>Warranty details</li>
          <li>Any additional terms or conditions</li>
        </ul>
      </div>
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Request for Proposal: ${rfp.title}</h2>
      
      <p>Dear {{vendor_name}},</p>
      
      <p>We are pleased to invite you to submit a proposal for the following procurement requirement:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Description</h3>
        <p>${rfp.description}</p>
        
        ${rfp.budget ? `<p><strong>Budget:</strong> ${currency} ${rfp.budget.toLocaleString()}</p>` : ''}
        ${rfp.deliveryDays ? `<p><strong>Delivery Required:</strong> Within ${rfp.deliveryDays} days</p>` : ''}
        ${rfp.paymentTerms ? `<p><strong>Payment Terms:</strong> ${rfp.paymentTerms}</p>` : ''}
        ${rfp.warranty ? `<p><strong>Warranty Required:</strong> ${rfp.warranty}</p>` : ''}
      </div>
      
      ${items.length > 0 ? `
      <div style="margin: 20px 0;">
        <h3>Items Required</h3>
        <ul style="line-height: 1.8;">
          ${items.map((item) => `
            <li>
              <strong>${item.name}</strong> - Quantity: ${item.quantity}
              ${item.specifications ? `<br><span style="color: #666; font-size: 0.9em;">${item.specifications}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
      ` : ''}
      
      ${requirements.length > 0 ? `
      <div style="margin: 20px 0;">
        <h3>Additional Requirements</h3>
        <ul>
          ${requirements.map((req) => `<li>${String(req)}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      ${rfp.dueDate ? `
      <p style="background-color: #fff3cd; padding: 10px; border-left: 4px solid #ffc107;">
        <strong>Proposal Due Date:</strong> ${new Date(rfp.dueDate).toLocaleDateString()}
      </p>
      ` : ''}
      
      ${submitSection}
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
        <h4>Your proposal should include:</h4>
        <ul style="color: #666;">
          <li>Itemized pricing for all requested items</li>
          <li>Delivery timeline</li>
          <li>Payment terms</li>
          <li>Warranty details</li>
          <li>Any additional terms or conditions</li>
        </ul>
      </div>
      
      <p>We look forward to receiving your competitive proposal.</p>
      
      <p>Best regards,<br>
      Procurement Team</p>
    </div>
  `;

  const submitTextSection = submissionLink 
    ? `
SUBMIT YOUR PROPOSAL ONLINE
Click this link to submit: ${submissionLink}

Our secure vendor portal makes it easy to submit your proposal.
`
    : `
HOW TO SUBMIT YOUR PROPOSAL
Please reply to this email with your detailed proposal.
`;

  const text = `
Request for Proposal: ${rfp.title}

Dear {{vendor_name}},

We are pleased to invite you to submit a proposal for the following procurement requirement:

DESCRIPTION
${rfp.description}

${rfp.budget ? `Budget: ${currency} ${rfp.budget.toLocaleString()}` : ''}
${rfp.deliveryDays ? `Delivery Required: Within ${rfp.deliveryDays} days` : ''}
${rfp.paymentTerms ? `Payment Terms: ${rfp.paymentTerms}` : ''}
${rfp.warranty ? `Warranty Required: ${rfp.warranty}` : ''}

ITEMS REQUIRED
${itemsList}

${requirements.length > 0 ? `
ADDITIONAL REQUIREMENTS
${requirements.map((req) => `• ${String(req)}`).join('\n')}
` : ''}

${rfp.dueDate ? `Proposal Due Date: ${new Date(rfp.dueDate).toLocaleDateString()}` : ''}
${submitTextSection}

YOUR PROPOSAL SHOULD INCLUDE:
• Itemized pricing for all requested items
• Delivery timeline
• Payment terms
• Warranty details
• Any additional terms or conditions

We look forward to receiving your competitive proposal.

Best regards,
Procurement Team
  `.trim();

  return { html, text };
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  initializeResend();

  if (!resendClient) {
    throw new Error('Resend not configured. Please set RESEND_API_KEY in your environment variables.');
  }

  const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
  
  const { data, error } = await resendClient.emails.send({
    from: fromEmail,
    to: toAddresses,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(error.message);
  }

  return { messageId: data?.id ?? `resend-${Date.now()}` };
}

export async function sendRFPToVendors(
  rfp: RFPEmailData,
  vendors: VendorEmailInfo[],
  portalBaseUrl?: string,
): Promise<SendRFPResult[]> {
  const results: SendRFPResult[] = [];

  for (const vendor of vendors) {
    try {
      const submissionLink = vendor.submissionToken && portalBaseUrl
        ? `${portalBaseUrl}/submit/${vendor.submissionToken}`
        : undefined;
      
      const emailContent = generateRFPEmailContent(rfp, submissionLink);
      const personalizedHtml = emailContent.html.replace('{{vendor_name}}', vendor.name);
      const personalizedText = emailContent.text.replace('{{vendor_name}}', vendor.name);
      
      const { messageId } = await sendEmail({
        to: vendor.email,
        subject: `RFP: ${rfp.title}`,
        html: personalizedHtml,
        text: personalizedText,
      });

      results.push({
        vendorEmail: vendor.email,
        messageId,
        success: true,
        html: personalizedHtml,
        text: personalizedText,
      });
    } catch (error) {
      const fallbackContent = generateRFPEmailContent(rfp);
      results.push({
        vendorEmail: vendor.email,
        messageId: '',
        success: false,
        html: fallbackContent.html,
        text: fallbackContent.text,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

export async function fetchUnreadEmails(_since?: Date): Promise<ReceivedEmail[]> {
  console.log('fetchUnreadEmails: Resend does not support receiving emails.');
  console.log('Please use manual proposal entry or integrate with a separate email receiving service.');
  return [];
}

export function isVendorResponse(email: ReceivedEmail, _rfpMessageIds: string[]): boolean {
  const subjectLower = email.subject.toLowerCase();
  return (
    subjectLower.includes('re:') &&
    (subjectLower.includes('rfp') || subjectLower.includes('proposal') || subjectLower.includes('quote'))
  );
}

export const emailService = {
  sendEmail,
  sendRFPToVendors,
  fetchUnreadEmails,
  isVendorResponse,
};
