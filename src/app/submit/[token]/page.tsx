'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '~/components/ui/card';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { Progress } from '~/components/ui/progress';
import { toast } from 'sonner';
import { 
  FileText, 
  DollarSign, 
  Clock, 
  Shield, 
  Calendar,
  Building,
  Send,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Package,
  ClipboardList
} from 'lucide-react';

interface RFPItem {
  name: string;
  quantity: number;
  specifications?: string;
}

interface RFPData {
  id: string;
  title: string;
  description: string;
  budget?: number;
  currency?: string;
  deliveryDays?: number;
  paymentTerms?: string;
  warranty?: string;
  items?: RFPItem[];
  requirements?: string[];
  dueDate?: string;
  status: string;
}

interface VendorData {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface PortalData {
  rfp: RFPData;
  vendor: VendorData;
  alreadySubmitted: boolean;
  submittedAt?: string;
}

interface AIJobStatus {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  stepDescription?: string;
}

export default function VendorSubmitPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [proposalContent, setProposalContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<AIJobStatus | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (token) {
      void fetchRFPData();
    }
  }, [token]);

  // Subscribe to job updates via SSE
  useEffect(() => {
    if (!jobId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/ai-jobs/${jobId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const job = JSON.parse(event.data as string) as AIJobStatus & { error?: string };
        
        if (job.error && !job.status) {
          console.error('SSE error:', job.error);
          return;
        }

        setJobStatus(job);

        if (job.status === 'COMPLETED') {
          toast.success('Your proposal has been processed successfully!');
          eventSource.close();
        } else if (job.status === 'FAILED') {
          toast.error('There was an issue processing your proposal, but it has been saved.');
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      // Connection closed - normal for completed jobs
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
      }
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [jobId]);

  async function fetchRFPData() {
    try {
      const response = await fetch(`/api/submit-proposal?token=${token}`);
      
      if (!response.ok) {
        const errorData = await response.json() as { error: string };
        setError(errorData.error);
        return;
      }

      const result = await response.json() as PortalData;
      setData(result);
      
      if (result.alreadySubmitted) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error('Error fetching RFP data:', err);
      setError('Failed to load RFP data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!proposalContent.trim()) {
      toast.error('Please enter your proposal content');
      return;
    }

    if (proposalContent.trim().length < 50) {
      toast.error('Please provide a more detailed proposal (at least 50 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/submit-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          proposalContent: proposalContent.trim(),
        }),
      });

      const result = await response.json() as { success?: boolean; message?: string; jobId?: string; error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? 'Failed to submit proposal');
      }

      setSubmitted(true);
      setJobId(result.jobId ?? null);
      toast.success('Proposal submitted successfully!');
    } catch (err) {
      console.error('Error submitting proposal:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to submit proposal');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load RFP</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { rfp, vendor } = data;
  const items = Array.isArray(rfp.items) ? rfp.items : [];
  const requirements = Array.isArray(rfp.requirements) ? rfp.requirements : [];
  const currency = rfp.currency ?? 'USD';

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-emerald-900">Proposal Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you, {vendor.name}! Your proposal for &quot;{rfp.title}&quot; has been received.
            </p>
            
            {jobStatus && (
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Processing Status</span>
                  <Badge variant={
                    jobStatus.status === 'COMPLETED' ? 'default' :
                    jobStatus.status === 'FAILED' ? 'destructive' : 'secondary'
                  }>
                    {jobStatus.status}
                  </Badge>
                </div>
                <Progress value={jobStatus.progress} className="h-2" />
                {jobStatus.stepDescription && (
                  <p className="text-sm text-muted-foreground mt-2">{jobStatus.stepDescription}</p>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Our AI is analyzing your proposal to extract pricing, delivery, and other details. 
              You will receive a confirmation email shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-4">Vendor Portal</Badge>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Submit Your Proposal</h1>
          <p className="text-muted-foreground">
            Welcome, <span className="font-medium">{vendor.name}</span>
            {vendor.company && <span> from {vendor.company}</span>}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {rfp.title}
                </CardTitle>
                <CardDescription className="mt-2">
                  {rfp.description}
                </CardDescription>
              </div>
              {rfp.dueDate && (
                <Badge variant="secondary" className="shrink-0">
                  <Calendar className="h-3 w-3 mr-1" />
                  Due: {new Date(rfp.dueDate).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {rfp.budget && (
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-700 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs font-medium">Budget</span>
                  </div>
                  <p className="font-semibold text-emerald-900">
                    {currency} {rfp.budget.toLocaleString()}
                  </p>
                </div>
              )}
              {rfp.deliveryDays && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium">Delivery</span>
                  </div>
                  <p className="font-semibold text-blue-900">
                    Within {rfp.deliveryDays} days
                  </p>
                </div>
              )}
              {rfp.paymentTerms && (
                <div className="bg-amber-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 mb-1">
                    <Building className="h-4 w-4" />
                    <span className="text-xs font-medium">Payment</span>
                  </div>
                  <p className="font-semibold text-amber-900">
                    {rfp.paymentTerms}
                  </p>
                </div>
              )}
              {rfp.warranty && (
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-700 mb-1">
                    <Shield className="h-4 w-4" />
                    <span className="text-xs font-medium">Warranty</span>
                  </div>
                  <p className="font-semibold text-purple-900">
                    {rfp.warranty}
                  </p>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items Required
                </h3>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                      <span className="bg-primary text-primary-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {item.quantity}
                          {item.specifications && ` • ${item.specifications}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {requirements.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Additional Requirements
                </h3>
                <ul className="space-y-2">
                  {requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{String(req)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Your Proposal
            </CardTitle>
            <CardDescription>
              Enter your proposal details below. Our AI will automatically extract pricing, 
              delivery timeline, payment terms, and other details from your response.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={proposalContent}
              onChange={(e) => setProposalContent(e.target.value)}
              placeholder={`Dear Procurement Team,

We are pleased to submit our proposal for the ${rfp.title} requirement.

PRICING:
- Item 1: $XXX per unit x Quantity = $XXXX
- Item 2: $XXX per unit x Quantity = $XXXX
Total: $XX,XXX

DELIVERY: We can deliver within XX days of order confirmation.

PAYMENT TERMS: Net 30 / Net 60 / etc.

WARRANTY: We offer X year warranty on all items.

ADDITIONAL NOTES:
- Include any special offers, discounts, or additional information here.

Best regards,
${vendor.name}
${vendor.company ?? ''}`}
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground mt-2">
              💡 Tip: Include itemized pricing, delivery timeline, payment terms, and warranty details for best results.
            </p>
          </CardContent>
          <CardFooter className="flex justify-between items-center border-t pt-6">
            <p className="text-sm text-muted-foreground">
              Submitting as: <span className="font-medium">{vendor.email}</span>
            </p>
            <Button 
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || !proposalContent.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Proposal
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Having trouble? Contact the procurement team at the email address that sent you this RFP.
        </p>
      </div>
    </div>
  );
}

