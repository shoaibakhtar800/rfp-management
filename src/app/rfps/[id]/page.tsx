'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { Skeleton } from '~/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Progress } from '~/components/ui/progress';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  Send,
  Users,
  FileText,
  DollarSign,
  Clock,
  Calendar,
  Shield,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Award,
  BarChart3,
  Mail,
  Package,
  Trash2,
  ExternalLink,
  Copy
} from 'lucide-react';

interface RFPItem {
  name: string;
  quantity: number;
  specifications?: string;
  estimatedPrice?: number;
}

interface Vendor {
  id: string;
  name: string;
  email: string;
  company?: string;
  category?: string;
}

interface RFPVendor {
  id: string;
  vendorId: string;
  status: string;
  sentAt?: string;
  submissionToken?: string;
  vendor: Vendor;
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
  receivedAt: string;
  vendor: Vendor;
}

interface EmailLog {
  id: string;
  type: string;
  subject: string;
  status: string;
  sentAt?: string;
  receivedAt?: string;
  createdAt: string;
}

interface RFP {
  id: string;
  title: string;
  description: string;
  userRequest: string;
  budget?: number;
  currency: string;
  deliveryDays?: number;
  paymentTerms?: string;
  warranty?: string;
  items: RFPItem[];
  requirements?: string[];
  status: string;
  dueDate?: string;
  evaluationSummary?: string;
  awardedVendorId?: string;
  awardedAt?: string;
  awardNotes?: string;
  awardedVendor?: Vendor;
  createdAt: string;
  updatedAt: string;
  vendors: RFPVendor[];
  proposals: Proposal[];
  emailLogs: EmailLog[];
}

export default function RFPDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [awardVendorId, setAwardVendorId] = useState<string>('');
  const [awardNotes, setAwardNotes] = useState('');
  const [notifyVendor, setNotifyVendor] = useState(true);

  useEffect(() => {
    void fetchRFP();
    void fetchVendors();
  }, [id]);

  async function fetchRFP() {
    try {
      const response = await fetch(`/api/rfps/${id}`);
      if (!response.ok) {
        throw new Error('RFP not found');
      }
      const data = await response.json() as RFP;
      setRfp(data);
    } catch (error) {
      console.error('Error fetching RFP:', error);
      toast.error('Failed to fetch RFP');
    } finally {
      setLoading(false);
    }
  }

  async function fetchVendors() {
    try {
      const response = await fetch('/api/vendors');
      const data = await response.json() as Vendor[] | { error: string };
      setAllVendors(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  }

  async function handleSendToVendors() {
    if (selectedVendorIds.length === 0) {
      toast.error('Please select at least one vendor');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/rfps/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorIds: selectedVendorIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to send RFP');
      }

      toast.success('RFP is being sent to vendors');
      setSendDialogOpen(false);
      setSelectedVendorIds([]);
      void fetchRFP();
    } catch (error) {
      console.error('Error sending RFP:', error);
      toast.error('Failed to send RFP');
    } finally {
      setSending(false);
    }
  }

  async function handleAwardVendor() {
    if (!awardVendorId) {
      toast.error('Please select a vendor');
      return;
    }

    setAwarding(true);
    try {
      const response = await fetch(`/api/rfps/${id}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: awardVendorId,
          notes: awardNotes,
          notify: notifyVendor,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to award RFP');
      }

      toast.success('RFP awarded successfully');
      setAwardDialogOpen(false);
      setAwardVendorId('');
      setAwardNotes('');
      void fetchRFP();
    } catch (error) {
      console.error('Error awarding RFP:', error);
      toast.error('Failed to award RFP');
    } finally {
      setAwarding(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this RFP? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/rfps/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete RFP');
      }

      toast.success('RFP deleted successfully');
      router.push('/rfps');
    } catch (error) {
      console.error('Error deleting RFP:', error);
      toast.error('Failed to delete RFP');
    } finally {
      setDeleting(false);
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
        return 'default';
      case 'RECEIVING_PROPOSALS':
        return 'default';
      case 'EVALUATING':
        return 'default';
      case 'AWARDED':
        return 'default';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getProposalStatusColor = (status: string) => {
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

  // Get vendors that haven't been sent the RFP yet
  const availableVendors = allVendors.filter(
    (vendor) => !rfp?.vendors.some((v) => v.vendorId === vendor.id)
  );

  // Get vendors with proposals for awarding
  const vendorsWithProposals = rfp?.proposals.map((p) => p.vendor) ?? [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!rfp) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">RFP Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The RFP you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/rfps">Back to RFPs</Link>
        </Button>
      </div>
    );
  }

  const items = Array.isArray(rfp.items) ? rfp.items : [];
  const requirements = Array.isArray(rfp.requirements) ? rfp.requirements : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/rfps">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{rfp.title}</h1>
              <Badge variant={getStatusColor(rfp.status)}>
                <span className="mr-1">{getStatusIcon(rfp.status)}</span>
                {rfp.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Created {new Date(rfp.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {rfp.status === 'DRAFT' && (
            <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Send className="mr-2 h-4 w-4" />
                  Send to Vendors
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Send RFP to Vendors</DialogTitle>
                  <DialogDescription>
                    Select vendors to receive this RFP
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  {availableVendors.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No vendors available. <Link href="/vendors" className="text-primary hover:underline">Add vendors first.</Link>
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {availableVendors.map((vendor) => (
                        <div
                          key={vendor.id}
                          className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                        >
                          <Checkbox
                            id={vendor.id}
                            checked={selectedVendorIds.includes(vendor.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedVendorIds([...selectedVendorIds, vendor.id]);
                              } else {
                                setSelectedVendorIds(
                                  selectedVendorIds.filter((id) => id !== vendor.id)
                                );
                              }
                            }}
                          />
                          <Label htmlFor={vendor.id} className="flex-1 cursor-pointer">
                            <div className="font-medium">{vendor.name}</div>
                            <div className="text-sm text-muted-foreground">{vendor.email}</div>
                            {vendor.company && (
                              <div className="text-sm text-muted-foreground">{vendor.company}</div>
                            )}
                          </Label>
                          {vendor.category && (
                            <Badge variant="secondary" className="text-xs">
                              {vendor.category}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendToVendors}
                    disabled={sending || selectedVendorIds.length === 0}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send to {selectedVendorIds.length} Vendor(s)
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {rfp.proposals.length > 0 && rfp.status !== 'AWARDED' && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/compare?rfpId=${id}`}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Compare
                </Link>
              </Button>

              <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <Award className="mr-2 h-4 w-4" />
                    Award
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Award RFP</DialogTitle>
                    <DialogDescription>
                      Select the winning vendor for this RFP
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="space-y-3 max-h-[200px] overflow-y-auto">
                      {vendorsWithProposals.map((vendor) => {
                        const proposal = rfp.proposals.find((p) => p.vendorId === vendor.id);
                        return (
                          <div
                            key={vendor.id}
                            className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                              awardVendorId === vendor.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                            }`}
                            onClick={() => setAwardVendorId(vendor.id)}
                          >
                            <div className="flex-1">
                              <div className="font-medium">{vendor.name}</div>
                              <div className="text-sm text-muted-foreground">{vendor.email}</div>
                              {proposal && (
                                <div className="flex gap-3 mt-1 text-sm">
                                  {proposal.totalPrice && (
                                    <span className="text-green-600">
                                      ${proposal.totalPrice.toLocaleString()}
                                    </span>
                                  )}
                                  {proposal.aiScore && (
                                    <span className="text-blue-600">
                                      Score: {proposal.aiScore}/100
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="awardNotes">Notes (optional)</Label>
                      <Textarea
                        id="awardNotes"
                        value={awardNotes}
                        onChange={(e) => setAwardNotes(e.target.value)}
                        placeholder="Add any notes about this award decision..."
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifyVendor"
                        checked={notifyVendor}
                        onCheckedChange={(checked) => setNotifyVendor(!!checked)}
                      />
                      <Label htmlFor="notifyVendor">
                        Send email notification to the winning vendor
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAwardDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAwardVendor} disabled={awarding || !awardVendorId}>
                      {awarding ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Awarding...
                        </>
                      ) : (
                        <>
                          <Award className="mr-2 h-4 w-4" />
                          Award to Vendor
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Award Banner */}
      {rfp.status === 'AWARDED' && rfp.awardedVendor && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-full">
                <Award className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800">
                  Awarded to {rfp.awardedVendor.name}
                </h3>
                <p className="text-sm text-green-700">
                  {rfp.awardedAt && `Awarded on ${new Date(rfp.awardedAt).toLocaleDateString()}`}
                  {rfp.awardNotes && ` • ${rfp.awardNotes}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vendors">
            Vendors ({rfp.vendors.length})
          </TabsTrigger>
          <TabsTrigger value="proposals">
            Proposals ({rfp.proposals.length})
          </TabsTrigger>
          <TabsTrigger value="emails">
            Email Log ({rfp.emailLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* RFP Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">RFP Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{rfp.description}</p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  {rfp.budget && (
                    <div className="flex items-start gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <Label className="text-muted-foreground text-xs">Budget</Label>
                        <p className="font-medium">
                          {rfp.currency} {rfp.budget.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}

                  {rfp.deliveryDays && (
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <Label className="text-muted-foreground text-xs">Delivery</Label>
                        <p className="font-medium">{rfp.deliveryDays} days</p>
                      </div>
                    </div>
                  )}

                  {rfp.paymentTerms && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <Label className="text-muted-foreground text-xs">Payment Terms</Label>
                        <p className="font-medium">{rfp.paymentTerms}</p>
                      </div>
                    </div>
                  )}

                  {rfp.warranty && (
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <Label className="text-muted-foreground text-xs">Warranty</Label>
                        <p className="font-medium">{rfp.warranty}</p>
                      </div>
                    </div>
                  )}

                  {rfp.dueDate && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <Label className="text-muted-foreground text-xs">Due Date</Label>
                        <p className="font-medium">
                          {new Date(rfp.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Required Items ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-muted-foreground">No items specified</p>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                      >
                        <Badge variant="secondary" className="mt-0.5">
                          {item.quantity}x
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          {item.specifications && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.specifications}
                            </p>
                          )}
                        </div>
                        {item.estimatedPrice && (
                          <span className="text-sm text-muted-foreground">
                            ~${item.estimatedPrice}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Requirements */}
          {requirements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-1 shrink-0" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Original Request */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Original Request</CardTitle>
              <CardDescription>The natural language input that created this RFP</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="whitespace-pre-wrap">{rfp.userRequest}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vendors</CardTitle>
              <CardDescription>
                Vendors who have received this RFP
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rfp.vendors.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No vendors yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Send this RFP to vendors to get started
                  </p>
                  {rfp.status === 'DRAFT' && (
                    <Button onClick={() => setSendDialogOpen(true)}>
                      <Send className="mr-2 h-4 w-4" />
                      Send to Vendors
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {rfp.vendors.map((rfpVendor) => {
                    const hasSubmitted = rfp.proposals.some(p => p.vendorId === rfpVendor.vendorId);
                    const submissionUrl = rfpVendor.submissionToken 
                      ? `${window.location.origin}/submit/${rfpVendor.submissionToken}`
                      : null;
                    
                    return (
                      <div
                        key={rfpVendor.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-muted rounded-full">
                            <Users className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{rfpVendor.vendor.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {rfpVendor.vendor.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {rfpVendor.sentAt && (
                            <span className="text-xs text-muted-foreground mr-2">
                              Sent {new Date(rfpVendor.sentAt).toLocaleDateString()}
                            </span>
                          )}
                          
                          {/* Submit Proposal Button - Only show if not yet submitted */}
                          {!hasSubmitted && submissionUrl && rfpVendor.status !== 'DECLINED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  void navigator.clipboard.writeText(submissionUrl);
                                  toast.success('Submission link copied!');
                                }}
                                title="Copy submission link"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => window.open(submissionUrl, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Submit Proposal
                              </Button>
                            </>
                          )}
                          
                          {hasSubmitted && (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Submitted
                            </Badge>
                          )}
                          
                          {!hasSubmitted && (
                            <Badge variant={
                              rfpVendor.status === 'AWARDED' ? 'default' :
                              rfpVendor.status === 'NOT_SELECTED' ? 'secondary' :
                              rfpVendor.status === 'DECLINED' ? 'destructive' :
                              'secondary'
                            }>
                              {rfpVendor.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proposals</CardTitle>
              <CardDescription>
                Received proposals from vendors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rfp.proposals.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No proposals yet</h3>
                  <p className="text-muted-foreground">
                    Waiting for vendor responses
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rfp.proposals.map((proposal) => (
                    <div
                      key={proposal.id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{proposal.vendor.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {proposal.vendor.email}
                          </p>
                        </div>
                        <Badge variant={getProposalStatusColor(proposal.status)}>
                          {proposal.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {proposal.totalPrice && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Price</Label>
                            <p className="font-medium text-green-600">
                              {proposal.currency} {proposal.totalPrice.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {proposal.deliveryDays && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Delivery</Label>
                            <p className="font-medium">{proposal.deliveryDays} days</p>
                          </div>
                        )}
                        {proposal.warranty && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Warranty</Label>
                            <p className="font-medium">{proposal.warranty}</p>
                          </div>
                        )}
                        {proposal.aiScore !== null && proposal.aiScore !== undefined && (
                          <div>
                            <Label className="text-muted-foreground text-xs">AI Score</Label>
                            <div className="flex items-center gap-2">
                              <Progress value={proposal.aiScore} className="w-16 h-2" />
                              <span className="font-medium">{proposal.aiScore}/100</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {proposal.aiSummary && (
                        <div className="bg-muted/50 p-3 rounded-lg text-sm">
                          <p>{proposal.aiSummary}</p>
                        </div>
                      )}

                      {(proposal.aiStrengths?.length ?? 0) > 0 || (proposal.aiWeaknesses?.length ?? 0) > 0 && (
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          {proposal.aiStrengths && proposal.aiStrengths.length > 0 && (
                            <div>
                              <Label className="text-green-600 text-xs">Strengths</Label>
                              <ul className="mt-1 space-y-1">
                                {proposal.aiStrengths.map((s, i) => (
                                  <li key={i} className="flex items-start gap-1">
                                    <CheckCircle className="h-3 w-3 text-green-500 mt-1" />
                                    <span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {proposal.aiWeaknesses && proposal.aiWeaknesses.length > 0 && (
                            <div>
                              <Label className="text-orange-600 text-xs">Weaknesses</Label>
                              <ul className="mt-1 space-y-1">
                                {proposal.aiWeaknesses.map((w, i) => (
                                  <li key={i} className="flex items-start gap-1">
                                    <AlertCircle className="h-3 w-3 text-orange-500 mt-1" />
                                    <span>{w}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Received {new Date(proposal.receivedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Log Tab */}
        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Log</CardTitle>
              <CardDescription>
                All emails sent and received for this RFP
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rfp.emailLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No emails yet</h3>
                  <p className="text-muted-foreground">
                    Email logs will appear here once RFP is sent
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rfp.emailLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          log.type === 'RFP_SENT' ? 'bg-blue-100' :
                          log.type === 'PROPOSAL_RECEIVED' ? 'bg-green-100' :
                          log.type === 'AWARD_NOTIFICATION' ? 'bg-yellow-100' :
                          'bg-muted'
                        }`}>
                          <Mail className={`h-4 w-4 ${
                            log.type === 'RFP_SENT' ? 'text-blue-600' :
                            log.type === 'PROPOSAL_RECEIVED' ? 'text-green-600' :
                            log.type === 'AWARD_NOTIFICATION' ? 'text-yellow-600' :
                            'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{log.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {new Date(log.sentAt ?? log.receivedAt ?? log.createdAt).toLocaleString()}
                        </span>
                        <Badge variant={log.status === 'SENT' || log.status === 'PROCESSED' ? 'default' : 'secondary'}>
                          {log.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

