'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AIJob {
  id: string;
  type: 'PARSE_RFP' | 'PARSE_PROPOSAL' | 'SCORE_PROPOSAL' | 'COMPARE_PROPOSALS';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  rfpId?: string | null;
  proposalId?: string | null;
  inputData?: unknown;
  outputData?: {
    rfpId?: string;
    proposalId?: string;
    score?: number;
    summary?: string;
    [key: string]: unknown;
  } | null;
  error?: string | null;
  progress: number;
  stepDescription?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
}

interface UseAIJobOptions {
  onComplete?: (job: AIJob) => void;
  onError?: (error: string) => void;
}

interface UseAIJobReturn {
  job: AIJob | null;
  isLoading: boolean;
  isProcessing: boolean;
  isComplete: boolean;
  isFailed: boolean;
  error: string | null;
  startJob: (data: CreateJobData) => Promise<string | null>;
  subscribeToJob: (jobId: string) => void;
  reset: () => void;
}

type CreateJobData = 
  | { type: 'PARSE_RFP'; userRequest: string; dueDate?: string }
  | { type: 'PARSE_PROPOSAL'; rfpId: string; vendorId: string; emailContent: string; attachments?: unknown }
  | { type: 'COMPARE_PROPOSALS'; rfpId: string };

export function useAIJob(options: UseAIJobOptions = {}): UseAIJobReturn {
  const { onComplete, onError } = options;

  const [job, setJob] = useState<AIJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const isProcessing = job?.status === 'PENDING' || job?.status === 'PROCESSING';
  const isComplete = job?.status === 'COMPLETED';
  const isFailed = job?.status === 'FAILED';

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Handle completion/failure callbacks
  useEffect(() => {
    if (job?.status === 'COMPLETED') {
      onComplete?.(job);
    } else if (job?.status === 'FAILED') {
      const errorMessage = job.error ?? 'Job failed';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [job?.status, job, onComplete, onError]);

  const subscribeToJob = useCallback((jobId: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create SSE connection
    const eventSource = new EventSource(`/api/ai-jobs/${jobId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as AIJob & { error?: string };
        
        if (data.error && !data.id) {
          setError(data.error);
          onError?.(data.error);
          eventSource.close();
          eventSourceRef.current = null;
          return;
        }

        setJob(data);
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      // Connection closed by server (normal for completed jobs)
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
      }
    };
  }, [onError]);

  const startJob = useCallback(async (data: CreateJobData): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    setJob(null);

    try {
      const response = await fetch('/api/ai-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to start job');
      }

      const result = await response.json() as { jobId: string };
      
      // Subscribe to job updates via SSE
      subscribeToJob(result.jobId);

      return result.jobId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start job';
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [subscribeToJob, onError]);

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setJob(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    job,
    isLoading,
    isProcessing,
    isComplete,
    isFailed,
    error,
    startJob,
    subscribeToJob,
    reset,
  };
}
