'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { 
  FileText, 
  Users, 
  Send, 
  TrendingUp,
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import type { Proposal, Vendor } from 'generated/prisma';

interface DashboardStats {
  totalRFPs: number;
  activeRFPs: number;
  totalVendors: number;
  pendingProposals: number;
  totalProposals: number;
  averageScore: number;
}

interface RecentRFP {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  _count: {
    proposals: number;
    vendors: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRFPs, setRecentRFPs] = useState<RecentRFP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // Fetch RFPs
      const rfpsResponse = await fetch('/api/rfps');
      const rfps = await rfpsResponse.json() as RecentRFP[];
      
      // Fetch Vendors
      const vendorsResponse = await fetch('/api/vendors');
      const vendors = await vendorsResponse.json() as Vendor[];
      
      // Fetch Proposals
      const proposalsResponse = await fetch('/api/proposals');
      const proposals = await proposalsResponse.json() as Proposal[];
      
      // Calculate stats
      const stats: DashboardStats = {
        totalRFPs: rfps.length,
        activeRFPs: rfps.filter((r: RecentRFP) => 
          ['SENT', 'RECEIVING_PROPOSALS', 'EVALUATING'].includes(r.status)
        ).length,
        totalVendors: vendors.length,
        pendingProposals: proposals.filter((p: Proposal) => p.status === 'RECEIVED').length,
        totalProposals: proposals.length,
        averageScore: proposals.reduce((acc: number, p: Proposal) => 
          acc + (p.aiScore ?? 0), 0
        ) / (proposals.length || 1),
      };
      
      setStats(stats);
      setRecentRFPs(rfps.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4) as unknown as number[]].map((_, i) => (
            <Card key={i.toString()}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
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
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your RFP management system
          </p>
        </div>
        <Button asChild>
          <Link href="/rfps/new">
            <Plus className="mr-2 h-4 w-4" />
            New RFP
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total RFPs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRFPs ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeRFPs ?? 0} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalVendors ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Registered vendors
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proposals</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProposals ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingProposals ?? 0} pending review
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.averageScore?.toFixed(1) ?? '0.0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Proposal quality score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent RFPs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent RFPs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/rfps">View all</Link>
            </Button>
          </div>
          <CardDescription>
            Your most recently created RFPs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRFPs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No RFPs created yet. Create your first RFP to get started.
              </div>
            ) : (
              recentRFPs.map((rfp) => (
                <div
                  key={rfp.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <Link
                        href={`/rfps/${rfp.id}`}
                        className="font-medium hover:underline"
                      >
                        {rfp.title}
                      </Link>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-muted-foreground">
                          {new Date(rfp.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {rfp._count.proposals} proposals
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {rfp._count.vendors} vendors
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusColor(rfp.status) as React.ComponentProps<typeof Badge>['variant']}>
                      <span className="mr-1">{getStatusIcon(rfp.status)}</span>
                      {rfp.status.replaceAll('_', ' ')}
                    </Badge>
                    {rfp.status === 'RECEIVING_PROPOSALS' && rfp._count.proposals > 0 && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/compare?rfpId=${rfp.id}`}>
                          <BarChart3 className="h-4 w-4 mr-1" />
                          Compare
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}