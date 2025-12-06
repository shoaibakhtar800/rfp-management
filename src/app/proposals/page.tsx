'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { Progress } from '~/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Search,
  FileText,
  DollarSign,
  Clock,
  Shield,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Plus,
  Mail
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface RFP {
  id: string;
  title: string;
  status: string;
  budget?: number;
  currency: string;
}

interface Proposal {
  id: string;
  rfpId: string;
  vendorId: string;
  emailContent: string;
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
  receivedAt: string;
  vendor: Vendor;
  rfp: RFP;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([]);
  const [rfps, setRfps] = useState<RFP[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingEmails, setCheckingEmails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rfpFilter, setRfpFilter] = useState('all');
  
  // Manual proposal creation
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProposal, setNewProposal] = useState({
    rfpId: '',
    vendorId: '',
    emailContent: '',
  });

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    filterProposals();
  }, [proposals, searchQuery, statusFilter, rfpFilter]);

  async function fetchData() {
    try {
      const [proposalsRes, rfpsRes, vendorsRes] = await Promise.all([
        fetch('/api/proposals'),
        fetch('/api/rfps'),
        fetch('/api/vendors'),
      ]);

        const [proposalsData, rfpsData, vendorsData] = await Promise.all([
        proposalsRes.json() as Promise<Proposal[]>,
        rfpsRes.json() as Promise<RFP[]>,
        vendorsRes.json() as Promise<Vendor[]>,
      ]);

      setProposals(proposalsData);
      setRfps(rfpsData);
      setVendors(vendorsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  function filterProposals() {
    let filtered = [...proposals];

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.vendor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.rfp.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (rfpFilter !== 'all') {
      filtered = filtered.filter((p) => p.rfpId === rfpFilter);
    }

    setFilteredProposals(filtered);
  }

  async function handleCheckEmails() {
    setCheckingEmails(true);
    try {
      const response = await fetch('/api/emails/check', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to check emails');
      }

      const result = await response.json() as { processed: number };
      
      if (result.processed > 0) {
        toast.success(`Found ${result.processed} new proposal(s)`);
        void fetchData();
      } else {
        toast.info('No new proposals found');
      }
    } catch (error) {
      console.error('Error checking emails:', error);
      toast.error('Failed to check emails');
    } finally {
      setCheckingEmails(false);
    }
  }

  async function handleCreateProposal() {
    if (!newProposal.rfpId || !newProposal.vendorId || !newProposal.emailContent) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProposal),
      });

      if (!response.ok) {
        throw new Error('Failed to create proposal');
      }

      toast.success('Proposal created and parsed');
      setCreateDialogOpen(false);
      setNewProposal({ rfpId: '', vendorId: '', emailContent: '' });
      void fetchData();
    } catch (error) {
      console.error('Error creating proposal:', error);
      toast.error('Failed to create proposal');
    } finally {
      setCreating(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'secondary';
      case 'PARSED':
        return 'default';
      case 'EVALUATED':
        return 'default';
      case 'SHORTLISTED':
        return 'default';
      case 'ACCEPTED':
        return 'default';
      case 'REJECTED':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const availableRfps = rfps.filter((r) =>
    ['DRAFT', 'SENT', 'RECEIVING_PROPOSALS', 'EVALUATING'].includes(r.status)
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[...Array(3).keys()].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proposals</h1>
          <p className="text-muted-foreground">
            View and manage vendor proposals
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCheckEmails}
            disabled={checkingEmails}
          >
            {checkingEmails ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Emails
              </>
            )}
          </Button>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Proposal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Proposal Manually</DialogTitle>
                <DialogDescription>
                  Paste the vendor&apos;s proposal content to parse it with AI
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 overflow-hidden">
                    <Label>Select RFP *</Label>
                    <Select
                      value={newProposal.rfpId}
                      onValueChange={(value) =>
                        setNewProposal({ ...newProposal, rfpId: value })
                      }
                    >
                      <SelectTrigger className="w-full [&>span]:truncate [&>span]:block [&>span]:text-left">
                        <SelectValue placeholder="Choose RFP" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRfps.map((rfp) => (
                          <SelectItem key={rfp.id} value={rfp.id}>
                            {rfp.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 overflow-hidden">
                    <Label>Select Vendor *</Label>
                    <Select
                      value={newProposal.vendorId}
                      onValueChange={(value) =>
                        setNewProposal({ ...newProposal, vendorId: value })
                      }
                    >
                      <SelectTrigger className="w-full [&>span]:truncate [&>span]:block [&>span]:text-left">
                        <SelectValue placeholder="Choose vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name} ({vendor.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Proposal Content *</Label>
                  <Textarea
                    value={newProposal.emailContent}
                    onChange={(e) =>
                      setNewProposal({ ...newProposal, emailContent: e.target.value })
                    }
                    placeholder="Paste the vendor's proposal email or document content here..."
                    className="min-h-[200px]"
                  />
                  <p className="text-sm text-muted-foreground">
                    AI will automatically extract pricing, delivery times, warranty, and other details
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateProposal} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create & Parse
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by vendor or RFP..."
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
            <SelectItem value="RECEIVED">Received</SelectItem>
            <SelectItem value="PARSED">Parsed</SelectItem>
            <SelectItem value="EVALUATED">Evaluated</SelectItem>
            <SelectItem value="SHORTLISTED">Shortlisted</SelectItem>
            <SelectItem value="ACCEPTED">Accepted</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={rfpFilter} onValueChange={setRfpFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by RFP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RFPs</SelectItem>
            {rfps.map((rfp) => (
              <SelectItem key={rfp.id} value={rfp.id}>
                {rfp.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Proposals List */}
      {filteredProposals.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No proposals found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all' || rfpFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Proposals will appear here when vendors respond to RFPs'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleCheckEmails} disabled={checkingEmails}>
                {checkingEmails ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Check for Emails
              </Button>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProposals.map((proposal) => (
            <Card key={proposal.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{proposal.vendor.name}</CardTitle>
                    <CardDescription>
                      {proposal.vendor.email}
                      {proposal.vendor.company && ` • ${proposal.vendor.company}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {proposal.aiScore !== null && proposal.aiScore !== undefined && (
                      <div className="flex items-center gap-2">
                        <Progress value={proposal.aiScore} className="w-20 h-2" />
                        <span className="text-sm font-medium">{proposal.aiScore}/100</span>
                      </div>
                    )}
                    <Badge variant={getStatusColor(proposal.status)}>
                      {proposal.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* RFP Reference */}
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">For RFP:</span>
                    <Link
                      href={`/rfps/${proposal.rfpId}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {proposal.rfp.title}
                    </Link>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {proposal.totalPrice !== null && proposal.totalPrice !== undefined && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-muted-foreground text-xs">Price</p>
                          <p className="font-medium text-green-600">
                            {proposal.currency} {proposal.totalPrice.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    {proposal.deliveryDays && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-muted-foreground text-xs">Delivery</p>
                          <p className="font-medium">{proposal.deliveryDays} days</p>
                        </div>
                      </div>
                    )}
                    {proposal.warranty && (
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="text-muted-foreground text-xs">Warranty</p>
                          <p className="font-medium">{proposal.warranty}</p>
                        </div>
                      </div>
                    )}
                    {proposal.paymentTerms && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-orange-600" />
                        <div>
                          <p className="text-muted-foreground text-xs">Payment</p>
                          <p className="font-medium">{proposal.paymentTerms}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Summary */}
                  {proposal.aiSummary && (
                    <div className="bg-muted/50 p-3 rounded-lg text-sm">
                      <p>{proposal.aiSummary}</p>
                    </div>
                  )}

                  {/* Strengths & Weaknesses */}
                  {((proposal.aiStrengths?.length ?? 0) > 0 || (proposal.aiWeaknesses?.length ?? 0) > 0) && (
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      {proposal.aiStrengths && proposal.aiStrengths.length > 0 && (
                        <div className="space-y-1">
                          {proposal.aiStrengths.slice(0, 2).map((s, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                              <span className="text-muted-foreground">{s}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {proposal.aiWeaknesses && proposal.aiWeaknesses.length > 0 && (
                        <div className="space-y-1">
                          {proposal.aiWeaknesses.slice(0, 2).map((w, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <AlertCircle className="h-3 w-3 text-orange-500 mt-1 shrink-0" />
                              <span className="text-muted-foreground">{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      Received {new Date(proposal.receivedAt).toLocaleString()}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/rfps/${proposal.rfpId}`}>View RFP</Link>
                    </Button>
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

