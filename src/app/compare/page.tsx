'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { Progress } from '~/components/ui/progress';
import { Separator } from '~/components/ui/separator';
import { toast } from 'sonner';
import { 
  BarChart3,
  Trophy,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Award,
  TrendingDown,
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface Proposal {
  id: string;
  vendorId: string;
  totalPrice?: number;
  currency: string;
  deliveryDays?: number;
  paymentTerms?: string;
  warranty?: string;
  aiScore?: number;
  aiSummary?: string;
  aiStrengths?: string[];
  aiWeaknesses?: string[];
  status: string;
  vendor: Vendor;
}

interface RFP {
  id: string;
  title: string;
  status: string;
  budget?: number;
  currency: string;
  deliveryDays?: number;
  proposals: Proposal[];
}

interface ComparisonResult {
  rfp: {
    id: string;
    title: string;
    budget?: number;
    currency: string;
    deliveryDays?: number;
  };
  proposals: Proposal[];
  analysis: string;
  generatedAt: string;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const rfpIdFromUrl = searchParams.get('rfpId');
  
  const [rfps, setRfps] = useState<RFP[]>([]);
  const [selectedRfpId, setSelectedRfpId] = useState<string>('');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    void fetchRFPs();
  }, []);

  useEffect(() => {
    if (rfpIdFromUrl) {
      setSelectedRfpId(rfpIdFromUrl);
    }
  }, [rfpIdFromUrl]);

  useEffect(() => {
    if (selectedRfpId) {
      void handleCompare();
    }
  }, [selectedRfpId]);

  async function fetchRFPs() {
    try {
      const response = await fetch('/api/rfps');
      const data = await response.json() as RFP[];
      // Filter RFPs that have proposals
      const rfpsWithProposals = data.filter((rfp) => rfp.proposals.length > 0);
      setRfps(rfpsWithProposals);
    } catch (error) {
      console.error('Error fetching RFPs:', error);
      toast.error('Failed to fetch RFPs');
    } finally {
      setLoading(false);
    }
  }

  async function handleCompare() {
    if (!selectedRfpId) return;

    setComparing(true);
    try {
      const response = await fetch('/api/proposals/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfpId: selectedRfpId }),
      });

      if (!response.ok) {
        throw new Error('Failed to compare proposals');
      }

      const result = await response.json() as ComparisonResult;
      setComparison(result);
    } catch (error) {
      console.error('Error comparing proposals:', error);
      toast.error('Failed to compare proposals');
    } finally {
      setComparing(false);
    }
  }

  const selectedRfp = rfps.find((r) => r.id === selectedRfpId);

  // Calculate metrics for comparison
  const getLowestPrice = () => {
    if (!comparison?.proposals.length) return null;
    const priced = comparison.proposals.filter((p) => p.totalPrice);
    if (!priced.length) return null;
    return priced.reduce((min, p) => 
      (p.totalPrice ?? Infinity) < (min.totalPrice ?? Infinity) ? p : min
    );
  };

  const getHighestScore = () => {
    if (!comparison?.proposals.length) return null;
    const scored = comparison.proposals.filter((p) => p.aiScore);
    if (!scored.length) return null;
    return scored.reduce((max, p) => 
      (p.aiScore ?? 0) > (max.aiScore ?? 0) ? p : max
    );
  };

  const getFastestDelivery = () => {
    if (!comparison?.proposals.length) return null;
    const withDelivery = comparison.proposals.filter((p) => p.deliveryDays);
    if (!withDelivery.length) return null;
    return withDelivery.reduce((min, p) => 
      (p.deliveryDays ?? Infinity) < (min.deliveryDays ?? Infinity) ? p : min
    );
  };

  const lowestPrice = getLowestPrice();
  const highestScore = getHighestScore();
  const fastestDelivery = getFastestDelivery();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/rfps">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Compare Proposals</h1>
            <p className="text-muted-foreground">
              AI-powered comparison and recommendations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedRfpId} onValueChange={setSelectedRfpId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select an RFP to compare" />
            </SelectTrigger>
            <SelectContent>
              {rfps.map((rfp) => (
                <SelectItem key={rfp.id} value={rfp.id}>
                  {rfp.title} ({rfp.proposals.length} proposals)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRfpId && (
            <Button
              variant="outline"
              onClick={handleCompare}
              disabled={comparing}
            >
              {comparing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {!selectedRfpId ? (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Select an RFP to Compare</h3>
            <p className="text-muted-foreground mb-4">
              Choose an RFP from the dropdown above to see proposal comparisons
            </p>
            {rfps.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No RFPs with proposals found.{' '}
                <Link href="/rfps" className="text-primary hover:underline">
                  Create an RFP
                </Link>{' '}
                and receive proposals first.
              </p>
            )}
          </CardContent>
        </Card>
      ) : comparing ? (
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h3 className="font-semibold text-lg mb-2">Analyzing Proposals...</h3>
            <p className="text-muted-foreground">
              AI is comparing and scoring all proposals
            </p>
          </CardContent>
        </Card>
      ) : comparison ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Lowest Price
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lowestPrice ? (
                  <>
                    <p className="text-2xl font-bold text-green-600">
                      {lowestPrice.currency} {lowestPrice.totalPrice?.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lowestPrice.vendor.name}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No pricing data</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-blue-600" />
                  Highest Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                {highestScore ? (
                  <>
                    <p className="text-2xl font-bold text-blue-600">
                      {highestScore.aiScore}/100
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {highestScore.vendor.name}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No score data</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  Fastest Delivery
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fastestDelivery ? (
                  <>
                    <p className="text-2xl font-bold text-purple-600">
                      {fastestDelivery.deliveryDays} days
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {fastestDelivery.vendor.name}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No delivery data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proposal Comparison</CardTitle>
              <CardDescription>
                Side-by-side comparison of all {comparison.proposals.length} proposals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Vendor</th>
                      <th className="text-left py-3 px-4 font-medium">Price</th>
                      <th className="text-left py-3 px-4 font-medium">Delivery</th>
                      <th className="text-left py-3 px-4 font-medium">Warranty</th>
                      <th className="text-left py-3 px-4 font-medium">AI Score</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.proposals
                      .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))
                      .map((proposal, index) => (
                        <tr
                          key={proposal.id}
                          className={`border-b hover:bg-muted/50 ${
                            index === 0 ? 'bg-yellow-50/50' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {index === 0 && (
                                <Trophy className="h-4 w-4 text-yellow-600" />
                              )}
                              <div>
                                <p className="font-medium">{proposal.vendor.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {proposal.vendor.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              {proposal.totalPrice ? (
                                <>
                                  <span
                                    className={
                                      proposal.id === lowestPrice?.id
                                        ? 'text-green-600 font-medium'
                                        : ''
                                    }
                                  >
                                    {proposal.currency} {proposal.totalPrice.toLocaleString()}
                                  </span>
                                  {proposal.id === lowestPrice?.id && (
                                    <TrendingDown className="h-4 w-4 text-green-600" />
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              {proposal.deliveryDays ? (
                                <>
                                  <span
                                    className={
                                      proposal.id === fastestDelivery?.id
                                        ? 'text-purple-600 font-medium'
                                        : ''
                                    }
                                  >
                                    {proposal.deliveryDays} days
                                  </span>
                                  {proposal.id === fastestDelivery?.id && (
                                    <TrendingDown className="h-4 w-4 text-purple-600" />
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {proposal.warranty ? (
                              <span className="text-muted-foreground">{proposal.warranty}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {proposal.aiScore !== null && proposal.aiScore !== undefined ? (
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={proposal.aiScore}
                                  className={`w-16 h-2 ${
                                    proposal.id === highestScore?.id
                                      ? '[&>div]:bg-blue-600'
                                      : ''
                                  }`}
                                />
                                <span
                                  className={
                                    proposal.id === highestScore?.id
                                      ? 'text-blue-600 font-medium'
                                      : ''
                                  }
                                >
                                  {proposal.aiScore}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                proposal.status === 'ACCEPTED'
                                  ? 'default'
                                  : proposal.status === 'REJECTED'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {proposal.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                AI Analysis & Recommendation
              </CardTitle>
              <CardDescription>
                Generated {comparison.generatedAt && new Date(comparison.generatedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">
                  {comparison.analysis}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Proposal Details */}
          <div className="grid gap-4 md:grid-cols-2">
            {comparison.proposals
              .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))
              .map((proposal, index) => (
                <Card
                  key={proposal.id}
                  className={index === 0 ? 'border-yellow-300 bg-yellow-50/30' : ''}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <div className="p-1 bg-yellow-100 rounded-full">
                            <Trophy className="h-4 w-4 text-yellow-600" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-lg">{proposal.vendor.name}</CardTitle>
                          <CardDescription>{proposal.vendor.email}</CardDescription>
                        </div>
                      </div>
                      {proposal.aiScore !== null && proposal.aiScore !== undefined && (
                        <div className="text-right">
                          <p className="text-2xl font-bold">{proposal.aiScore}</p>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {proposal.totalPrice && (
                        <div>
                          <p className="text-muted-foreground text-xs">Price</p>
                          <p className="font-medium">
                            {proposal.currency} {proposal.totalPrice.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {proposal.deliveryDays && (
                        <div>
                          <p className="text-muted-foreground text-xs">Delivery</p>
                          <p className="font-medium">{proposal.deliveryDays} days</p>
                        </div>
                      )}
                      {proposal.warranty && (
                        <div>
                          <p className="text-muted-foreground text-xs">Warranty</p>
                          <p className="font-medium">{proposal.warranty}</p>
                        </div>
                      )}
                      {proposal.paymentTerms && (
                        <div>
                          <p className="text-muted-foreground text-xs">Payment</p>
                          <p className="font-medium">{proposal.paymentTerms}</p>
                        </div>
                      )}
                    </div>

                    {proposal.aiSummary && (
                      <>
                        <Separator />
                        <p className="text-sm">{proposal.aiSummary}</p>
                      </>
                    )}

                    {(proposal.aiStrengths?.length ?? proposal.aiWeaknesses?.length) && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {proposal.aiStrengths && proposal.aiStrengths.length > 0 && (
                            <div>
                              <p className="text-green-600 text-xs font-medium mb-2">
                                Strengths
                              </p>
                              <ul className="space-y-1">
                                {proposal.aiStrengths.map((s, i) => (
                                  <li key={i} className="flex items-start gap-1">
                                    <CheckCircle className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                                    <span className="text-xs">{s}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {proposal.aiWeaknesses && proposal.aiWeaknesses.length > 0 && (
                            <div>
                              <p className="text-orange-600 text-xs font-medium mb-2">
                                Weaknesses
                              </p>
                              <ul className="space-y-1">
                                {proposal.aiWeaknesses.map((w, i) => (
                                  <li key={i} className="flex items-start gap-1">
                                    <AlertCircle className="h-3 w-3 text-orange-500 mt-1 shrink-0" />
                                    <span className="text-xs">{w}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Action Button */}
          {selectedRfp?.status !== 'AWARDED' && (
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Ready to make a decision?</h3>
                    <p className="text-sm text-muted-foreground">
                      Award this RFP to the best vendor
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/rfps/${selectedRfpId}`}>
                      <Award className="mr-2 h-4 w-4" />
                      Award RFP
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}

