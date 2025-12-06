'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { toast } from 'sonner';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAIJob } from '~/hooks/use-ai-job';
import { AIJobStatus } from '~/components/ai-job-status';

interface ParsedRFP {
  id: string;
  title: string;
  description: string;
  budget?: number;
  currency: string;
  deliveryDays?: number;
  paymentTerms?: string;
  warranty?: string;
  items: Array<{
    name: string;
    quantity: number;
    specifications?: string;
  }>;
  requirements?: string[];
}

export default function NewRFPPage() {
  const router = useRouter();
  const [userRequest, setUserRequest] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [parsedRFP, setParsedRFP] = useState<ParsedRFP | null>(null);

  const { job, isLoading, isProcessing, isComplete, startJob, reset } = useAIJob({
    onComplete: (completedJob) => {
      if (completedJob.outputData?.rfpId) {
        toast.success('RFP created successfully!');
        void fetchCreatedRFP(completedJob.outputData.rfpId);
      }
    },
    onError: (error) => {
      toast.error(`Failed to create RFP: ${error}`);
    },
  });

  async function fetchCreatedRFP(rfpId: string) {
    try {
      const response = await fetch(`/api/rfps/${rfpId}`);
      if (response.ok) {
        const rfp = await response.json() as ParsedRFP;
        setParsedRFP(rfp);
      }
    } catch (error) {
      console.error('Error fetching RFP:', error);
    }
  }

  const exampleRequest = `I need to procure laptops and monitors for our new office. Budget is $50,000 total. Need delivery within 30 days. We need 20 laptops with 16GB RAM, 512GB SSD, and Intel i7 processors. Also need 15 monitors that are 27-inch, 4K resolution. Payment terms should be net 30, and we need at least 1 year warranty on all items.`;

  async function handleParse() {
    if (!userRequest.trim()) {
      toast.error('Please describe your procurement needs');
      return;
    }

    reset();
    setParsedRFP(null);

    await startJob({
      type: 'PARSE_RFP',
      userRequest,
      dueDate: dueDate || undefined,
    });
  }

  function useExample() {
    setUserRequest(exampleRequest);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    setDueDate(futureDate.toISOString().split('T')[0]!);
  }

  function handleViewRFP() {
    if (parsedRFP?.id) {
      router.push(`/rfps/${parsedRFP.id}`);
    } else if (job?.outputData?.rfpId) {
      router.push(`/rfps/${job.outputData.rfpId}`);
    }
  }

  const isDisabled = isLoading || isProcessing || !userRequest.trim();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New RFP</h1>
        <p className="text-muted-foreground">
          Describe your procurement needs in natural language, and AI will structure it into an RFP
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Describe Your Requirements</CardTitle>
          <CardDescription>
            Tell us what you need to procure in plain English. Include details about quantities, specifications, budget, delivery timeline, and any other requirements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="request">Procurement Request</Label>
            <Textarea
              id="request"
              placeholder="Example: I need to procure 20 laptops for our engineering team. Budget is around $30,000. Need them delivered within 2 weeks..."
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              className="min-h-[200px]"
              disabled={isProcessing}
            />
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Be as specific as possible about quantities, specifications, and requirements
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={useExample}
                disabled={isProcessing}
              >
                Use Example
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Proposal Due Date (Optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              disabled={isProcessing}
            />
            <p className="text-sm text-muted-foreground">
              When do you need vendors to submit their proposals by?
            </p>
          </div>

          {/* AI Job Status */}
          {(job !== null || isLoading) && (
            <AIJobStatus job={job} isLoading={isLoading} />
          )}

          {!isComplete ? (
            <Button
              onClick={handleParse}
              disabled={isDisabled}
              className="w-full"
              size="lg"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Create RFP with AI
            </Button>
          ) : (
            <Button
              onClick={handleViewRFP}
              className="w-full"
              size="lg"
            >
              View RFP Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      {parsedRFP && (
        <Card>
          <CardHeader>
            <CardTitle>Generated RFP Preview</CardTitle>
            <CardDescription>
              Here&apos;s how AI structured your requirements into an RFP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{parsedRFP.title}</h3>
              <p className="text-muted-foreground mt-2">{parsedRFP.description}</p>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              {parsedRFP.budget && (
                <div>
                  <Label>Budget</Label>
                  <p className="text-lg font-medium">
                    {parsedRFP.currency} {parsedRFP.budget.toLocaleString()}
                  </p>
                </div>
              )}
              
              {parsedRFP.deliveryDays && (
                <div>
                  <Label>Delivery Timeline</Label>
                  <p className="text-lg font-medium">
                    Within {parsedRFP.deliveryDays} days
                  </p>
                </div>
              )}
              
              {parsedRFP.paymentTerms && (
                <div>
                  <Label>Payment Terms</Label>
                  <p className="text-lg font-medium">{parsedRFP.paymentTerms}</p>
                </div>
              )}
              
              {parsedRFP.warranty && (
                <div>
                  <Label>Warranty</Label>
                  <p className="text-lg font-medium">{parsedRFP.warranty}</p>
                </div>
              )}
            </div>

            {(parsedRFP.items?.length ?? 0) > 0 && (
              <>
                <Separator />
                <div>
                  <Label>Required Items</Label>
                  <div className="mt-2 space-y-2">
                    {parsedRFP.items.map((item, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <Badge variant="secondary" className="mt-0.5">
                          {item.quantity}x
                        </Badge>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.specifications && (
                            <p className="text-sm text-muted-foreground">
                              {item.specifications}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {parsedRFP.requirements && parsedRFP.requirements.length > 0 && (
              <>
                <Separator />
                <div>
                  <Label>Additional Requirements</Label>
                  <ul className="mt-2 space-y-1">
                    {parsedRFP.requirements.map((req, index) => (
                      <li key={index} className="text-sm flex items-start">
                        <span className="mr-2">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <div className="pt-4">
              <Button onClick={handleViewRFP} className="w-full">
                Continue to RFP Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
