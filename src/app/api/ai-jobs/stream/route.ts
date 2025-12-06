import type { NextRequest } from 'next/server';
import { db } from '~/server/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastJobsHash = '';
      let attempts = 0;
      const maxAttempts = 300; // 5 minutes max

      const sendEvent = (data: unknown) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      const checkJobs = async () => {
        try {
          const jobs = await db.aIJob.findMany({
            where: {
              status: { in: ['PENDING', 'PROCESSING'] },
              ...(type ? { type } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          });

          const currentHash = JSON.stringify(
            jobs.map((j) => `${j.id}-${j.status}-${j.progress}`)
          );

          if (currentHash !== lastJobsHash) {
            lastJobsHash = currentHash;
            sendEvent({
              jobs: jobs.map((job) => ({
                id: job.id,
                type: job.type,
                status: job.status,
                progress: job.progress,
                stepDescription: job.stepDescription,
                error: job.error,
                rfpId: job.rfpId,
                outputData: job.outputData,
                createdAt: job.createdAt,
              })),
            });
          }

          if (jobs.length === 0) {
            sendEvent({ jobs: [], done: true });
            controller.close();
            return true;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            sendEvent({ jobs: [], timeout: true });
            controller.close();
            return true;
          }

          return false;
        } catch (error) {
          console.error('SSE jobs stream error:', error);
          sendEvent({ error: 'Internal server error' });
          controller.close();
          return true;
        }
      };

      const shouldStop = await checkJobs();
      if (shouldStop) return;

      const interval = setInterval(() => {
        void checkJobs().then((shouldStop) => {
          if (shouldStop) {
            clearInterval(interval);
          }
        });
      }, 1000);

      request.signal.addEventListener('abort', () => {
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

