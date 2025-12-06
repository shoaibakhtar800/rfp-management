import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    
    const job = await db.aIJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Error fetching AI job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI job' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    
    const job = await db.aIJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
    }

    if (job.status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Cannot delete a job that is currently processing' },
        { status: 400 },
      );
    }

    await db.aIJob.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting AI job:', error);
    return NextResponse.json(
      { error: 'Failed to delete AI job' },
      { status: 500 },
    );
  }
}

