'use client';

import { type AIJob } from '~/hooks/use-ai-job';
import { Progress } from '~/components/ui/progress';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock,
  Brain 
} from 'lucide-react';

interface AIJobStatusProps {
  job: AIJob | null;
  isLoading?: boolean;
  className?: string;
  showCard?: boolean;
}

export function AIJobStatus({ 
  job, 
  isLoading = false, 
  className = '',
  showCard = true,
}: AIJobStatusProps) {
  if (!job && !isLoading) return null;

  const getStatusIcon = () => {
    if (isLoading || job?.status === 'PENDING') {
      return <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />;
    }
    if (job?.status === 'PROCESSING') {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    if (job?.status === 'COMPLETED') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (job?.status === 'FAILED') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return <Brain className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusBadge = () => {
    if (isLoading || job?.status === 'PENDING') {
      return <Badge variant="secondary">Pending</Badge>;
    }
    if (job?.status === 'PROCESSING') {
      return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
    }
    if (job?.status === 'COMPLETED') {
      return <Badge className="bg-green-100 text-green-800">Complete</Badge>;
    }
    if (job?.status === 'FAILED') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return null;
  };

  const getJobTypeLabel = () => {
    switch (job?.type) {
      case 'PARSE_RFP':
        return 'Creating RFP';
      case 'PARSE_PROPOSAL':
        return 'Analyzing Proposal';
      case 'SCORE_PROPOSAL':
        return 'Scoring Proposal';
      case 'COMPARE_PROPOSALS':
        return 'Comparing Proposals';
      default:
        return 'Processing';
    }
  };

  const content = (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium">{getJobTypeLabel()}</span>
        </div>
        {getStatusBadge()}
      </div>

      {(job?.status === 'PROCESSING' || job?.status === 'PENDING') && (
        <>
          <Progress value={job?.progress ?? 0} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {job?.stepDescription ?? 'Starting...'}
          </p>
        </>
      )}

      {job?.status === 'COMPLETED' && job.outputData && (
        <div className="text-sm text-green-700 bg-green-50 p-2 rounded">
          {job.type === 'PARSE_RFP' && job.outputData.rfpId && (
            <span>RFP created successfully!</span>
          )}
          {job.type === 'PARSE_PROPOSAL' && job.outputData.score && (
            <span>Score: {job.outputData.score}/100</span>
          )}
          {job.type === 'COMPARE_PROPOSALS' && (
            <span>Comparison completed!</span>
          )}
        </div>
      )}

      {job?.status === 'FAILED' && job.error && (
        <div className="text-sm text-red-700 bg-red-50 p-2 rounded">
          {job.error}
        </div>
      )}
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card className="border-dashed">
      <CardContent className="pt-4">
        {content}
      </CardContent>
    </Card>
  );
}

// Inline status for smaller displays
interface AIJobStatusInlineProps {
  job: AIJob | null;
  isLoading?: boolean;
}

export function AIJobStatusInline({ job, isLoading = false }: AIJobStatusInlineProps) {
  if (!job && !isLoading) return null;

  const getStatusContent = () => {
    if (isLoading || job?.status === 'PENDING') {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Queued...</span>
        </div>
      );
    }
    if (job?.status === 'PROCESSING') {
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{job.stepDescription ?? 'Processing...'}</span>
          <span className="text-xs text-muted-foreground">({job.progress}%)</span>
        </div>
      );
    }
    if (job?.status === 'COMPLETED') {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Complete!</span>
        </div>
      );
    }
    if (job?.status === 'FAILED') {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="h-4 w-4" />
          <span className="text-sm">Failed: {job.error}</span>
        </div>
      );
    }
    return null;
  };

  return getStatusContent();
}

