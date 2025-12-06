'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { Progress } from '~/components/ui/progress';
import { 
  Plus, 
  Search,
  FileText,
  Users,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  DollarSign,
  Loader2,
  Brain,
} from 'lucide-react';

interface RFP {
  id: string;
  title: string;
  description: string;
  status: string;
  budget?: number;
  currency: string;
  deliveryDays?: number;
  dueDate?: string;
  createdAt: string;
  _count: {
    proposals: number;
    vendors: number;
  };
}

interface AIJob {
  id: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  stepDescription?: string | null;
  rfpId?: string | null;
  error?: string | null;
  createdAt: string;
  outputData?: {
    rfpId?: string;
    title?: string;
  } | null;
}

export default function RFPsPage() {
  const router = useRouter();
  const [rfps, setRfps] = useState<RFP[]>([]);
  const [filteredRfps, setFilteredRfps] = useState<RFP[]>([]);
  const [processingJobs, setProcessingJobs] = useState<AIJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const eventSourceRef = useRef<EventSource | null>(null);
  const wasProcessingRef = useRef(false);

  const fetchRFPs = useCallback(async () => {
    try {
      const response = await fetch('/api/rfps');
      const data = await response.json() as RFP[] | { error: string };
      const rfpList = Array.isArray(data) ? data : [];
      setRfps(rfpList);
      setFilteredRfps(rfpList);
    } catch (error) {
      console.error('Error fetching RFPs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const startJobsStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/ai-jobs/stream?type=PARSE_RFP');
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as { 
          jobs?: AIJob[]; 
          done?: boolean; 
          timeout?: boolean;
          error?: string;
        };
        
        if (data.error) {
          console.error('SSE error:', data.error);
          return;
        }

        if (data.jobs) {
          const hadJobs = wasProcessingRef.current;
          wasProcessingRef.current = data.jobs.length > 0;
          
          setProcessingJobs(data.jobs);
          
          // Refresh RFPs when jobs complete (had jobs before, now empty)
          if (hadJobs && data.jobs.length === 0) {
            void fetchRFPs();
          }
        }

        if (data.done || data.timeout) {
          eventSource.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
      }
    };
  }, [fetchRFPs]);

  useEffect(() => {
    void fetchRFPs();
    startJobsStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [fetchRFPs, startJobsStream]);

  useEffect(() => {
    filterRFPs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfps, searchQuery, statusFilter]);

  function filterRFPs() {
    let filtered = [...rfps];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(rfp =>
        rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rfp.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(rfp => rfp.status === statusFilter);
    }

    setFilteredRfps(filtered);
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Clock className="h-4 w-4" />;
      case 'SENT':
        return <Send className="h-4 w-4" />;
      case 'RECEIVING_PROPOSALS':
      case 'EVALUATING':
        return <RefreshCw className="h-4 w-4" />;
      case 'AWARDED':
        return <CheckCircle className="h-4 w-4" />;
      case 'CANCELLED':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'secondary';
      case 'SENT':
        return 'blue';
      case 'RECEIVING_PROPOSALS':
        return 'yellow';
      case 'EVALUATING':
        return 'purple';
      case 'AWARDED':
        return 'green';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'default';
    }
  };

  function handleViewCompletedJob(job: AIJob) {
    if (job.outputData?.rfpId) {
      router.push(`/rfps/${job.outputData.rfpId}`);
    } else if (job.rfpId) {
      router.push(`/rfps/${job.rfpId}`);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[...Array(3) as unknown as number[]].map((_, i) => (
            <Card key={i.toString()}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RFPs</h1>
          <p className="text-muted-foreground">
            Manage and track your procurement requests
          </p>
        </div>
        <Button asChild>
          <Link href="/rfps/new">
            <Plus className="mr-2 h-4 w-4" />
            New RFP
          </Link>
        </Button>
      </div>

      {/* Processing AI Jobs */}
      {processingJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            AI Processing
          </h2>
          {processingJobs.map((job) => (
            <Card key={job.id} className="border-blue-200 bg-blue-50/50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {job.status === 'PENDING' ? (
                      <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    )}
                    <span className="font-medium">
                      {job.status === 'PENDING' ? 'Queued' : 'Creating RFP...'}
                    </span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">
                    {job.status === 'PENDING' ? 'Pending' : 'Processing'}
                  </Badge>
                </div>
                <Progress value={job.progress} className="h-2 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {job.stepDescription ?? 'Starting...'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search RFPs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="RECEIVING_PROPOSALS">Receiving Proposals</SelectItem>
            <SelectItem value="EVALUATING">Evaluating</SelectItem>
            <SelectItem value="AWARDED">Awarded</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* RFPs List */}
      {filteredRfps.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No RFPs found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first RFP to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button asChild>
                <Link href="/rfps/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create RFP
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRfps.map((rfp) => (
            <Card key={rfp.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>
                      <Link
                        href={`/rfps/${rfp.id}`}
                        className="hover:underline"
                      >
                        {rfp.title}
                      </Link>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {rfp.description}
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusColor(rfp.status) as React.ComponentProps<typeof Badge>['variant']}>
                    <span className="mr-1">{getStatusIcon(rfp.status)}</span>
                    {rfp.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {rfp.budget && (
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {rfp.currency} {rfp.budget.toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {rfp.deliveryDays && (
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{rfp.deliveryDays} days</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{rfp._count.vendors} vendors</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <span>{rfp._count.proposals} proposals</span>
                  </div>
                  
                  {rfp.dueDate && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Due {new Date(rfp.dueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Created {new Date(rfp.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/rfps/${rfp.id}`}>
                        View Details
                      </Link>
                    </Button>
                    {rfp.status === 'DRAFT' && (
                      <Button size="sm" asChild>
                        <Link href={`/rfps/${rfp.id}`}>
                          Send to Vendors
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
