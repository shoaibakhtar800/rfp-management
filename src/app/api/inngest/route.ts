import { serve } from 'inngest/next';
import { inngest } from '~/inngest/client';
import { 
  sendRFPEmails, 
  sendAwardNotification, 
  checkVendorEmails, 
  parseProposal,
  parseRFPBackground,
  parseProposalBackground,
  compareProposalsBackground,
} from '~/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Email functions
    sendRFPEmails,
    sendAwardNotification,
    checkVendorEmails,
    parseProposal,
    // AI background processing functions
    parseRFPBackground,
    parseProposalBackground,
    compareProposalsBackground,
  ],
});
