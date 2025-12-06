import type { NextRequest } from 'next/server';
import { db } from '~/server/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const { id } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastStatus = '';
      let lastProgress = -1;
      let attempts = 0;
      const maxAttempts = 120;

      const sendEvent = (data: unknown) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      const checkJob = async () => {
        try {
          const job = await db.aIJob.findUnique({
            where: { id },
          });

          if (!job) {
            sendEvent({ error: 'Job not found', status: 'NOT_FOUND' });
            controller.close();
            return true;
          }

          if (job.status !== lastStatus || job.progress !== lastProgress) {
            lastStatus = job.status;
            lastProgress = job.progress;
            sendEvent({
              id: job.id,
              type: job.type,
              status: job.status,
              progress: job.progress,
              stepDescription: job.stepDescription,
              error: job.error,
              outputData: job.outputData,
              startedAt: job.startedAt,
              completedAt: job.completedAt,
            });
          }

          if (job.status === 'COMPLETED' || job.status === 'FAILED') {
            controller.close();
            return true;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            sendEvent({ error: 'Timeout waiting for job', status: 'TIMEOUT' });
            controller.close();
            return true;
          }

          return false;
        } catch (error) {
          console.error('SSE error:', error);
          sendEvent({ error: 'Internal server error', status: 'ERROR' });
          controller.close();
          return true;
        }
      };

      const shouldStop = await checkJob();
      if (shouldStop) return;

      const interval = setInterval(() => {
        void checkJob().then((shouldStop) => {
          if (shouldStop) {
            clearInterval(interval);
          }
        });
      }, 1000);

      _request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

