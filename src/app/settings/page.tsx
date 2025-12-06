'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { toast } from 'sonner';
import { 
  Mail,
  Key,
  CheckCircle,
  Loader2,
  RefreshCw,
  Brain,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface RFPResult {
  id: string;
}

export default function SettingsPage() {
  const [testingResend, setTestingResend] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [triggeringEmailCheck, setTriggeringEmailCheck] = useState(false);

  async function handleTestResend() {
    setTestingResend(true);
    try {
      const response = await fetch('/api/emails/test', {
        method: 'POST',
      });
      
      if (response.ok) {
        toast.success('Resend connection successful');
      } else {
        const data = await response.json() as { error?: string };
        toast.error(data.error ?? 'Resend test failed');
      }
    } catch {
      toast.error('Resend connection test failed');
    } finally {
      setTestingResend(false);
    }
  }

  async function handleTestAI() {
    setTestingAI(true);
    try {
      const response = await fetch('/api/rfps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRequest: 'Test request for 1 laptop with 8GB RAM',
        }),
      });

      if (response.ok) {
        const result = await response.json() as RFPResult;
        await fetch(`/api/rfps/${result.id}`, { method: 'DELETE' });
        toast.success('AI integration working correctly');
      } else {
        throw new Error('AI test failed');
      }
    } catch {
      toast.error('AI integration test failed');
    } finally {
      setTestingAI(false);
    }
  }

  async function handleTriggerEmailCheck() {
    setTriggeringEmailCheck(true);
    try {
      const response = await fetch('/api/emails/check', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to check emails');
      }

      const result = await response.json() as { processed: number; checked: number };
      
      if (result.processed > 0) {
        toast.success(`Found ${result.processed} new proposal(s)`);
      } else {
        toast.info(`Checked ${result.checked} emails, no new proposals`);
      }
    } catch {
      toast.error('Email check failed');
    } finally {
      setTriggeringEmailCheck(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your RFP management system
        </p>
      </div>

      <div className="grid gap-6">
        {/* Email Configuration - Resend Only */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Configuration
            </CardTitle>
            <CardDescription>
              Configure Resend for sending RFPs to vendors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Resend</h4>
                  <Badge className="bg-green-100 text-green-800">FREE - 100 emails/day</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestResend}
                  disabled={testingResend}
                >
                  {testingResend ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
              </div>
              
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <p className="text-sm text-green-800 mb-3">
                  <strong>Quick Setup Guide:</strong>
                </p>
                <ol className="text-sm text-green-700 space-y-2 list-decimal list-inside">
                  <li>Sign up at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">resend.com</a> (free)</li>
                  <li>Get your API key from the dashboard</li>
                  <li>Add to your <code className="bg-green-100 px-1 rounded">.env.local</code> file:
                    <div className="mt-1 ml-4 font-mono text-xs bg-green-100 p-2 rounded">
                      RESEND_API_KEY=re_xxxxx<br/>
                      RESEND_FROM=onboarding@resend.dev
                    </div>
                  </li>
                  <li>Restart the dev server</li>
                </ol>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resend-key">Resend API Key</Label>
                  <Input
                    id="resend-key"
                    type="password"
                    placeholder="re_••••••••••••"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Set via RESEND_API_KEY env variable</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resend-from">From Address</Label>
                  <Input
                    id="resend-from"
                    placeholder="onboarding@resend.dev"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Set via RESEND_FROM env variable</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Note about receiving emails */}
            <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Receiving Vendor Responses</p>
                <p className="text-amber-700 mt-1">
                  Resend is for sending emails only. To receive vendor proposal responses, 
                  you can manually create proposals in the system or integrate with a separate 
                  email receiving service (IMAP).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Configuration
            </CardTitle>
            <CardDescription>
              Configure AI provider for natural language processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-medium">AI Provider</h4>
                <p className="text-sm text-muted-foreground">
                  Using Hugging Face with Qwen3-8B model
                </p>
              </div>
              <Badge>Active</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hf-key">Hugging Face API Key</Label>
                <Input
                  id="hf-key"
                  type="password"
                  placeholder="hf_••••••••••••"
                  disabled
                />
                <p className="text-xs text-muted-foreground">Set via HUGGINGFACE_API_KEY env variable</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key (Optional)</Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-••••••••••••"
                  disabled
                />
                <p className="text-xs text-muted-foreground">Set via OPENAI_API_KEY env variable</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                AI is used for parsing RFPs, analyzing proposals, and generating recommendations
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestAI}
                disabled={testingAI}
              >
                {testingAI ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Test AI
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Background Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Background Jobs
            </CardTitle>
            <CardDescription>
              Automated email checking and proposal processing powered by Inngest
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-medium">Automatic Email Checking</h4>
                <p className="text-sm text-muted-foreground">
                  Checks for new vendor responses every 5 minutes
                </p>
              </div>
              <Badge variant="secondary">Inngest Cron</Badge>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-medium">Manual Email Check</h4>
                <p className="text-sm text-muted-foreground">
                  Trigger an immediate check for new vendor emails
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleTriggerEmailCheck}
                disabled={triggeringEmailCheck}
              >
                {triggeringEmailCheck ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Check Now
              </Button>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg text-sm">
              <h5 className="font-medium mb-2">Inngest Dashboard</h5>
              <p className="text-muted-foreground mb-2">
                View background job status and logs in the Inngest dashboard.
              </p>
              <p className="text-xs text-muted-foreground">
                Run <code className="bg-muted px-1 py-0.5 rounded">npx inngest-cli@latest dev</code> to start the local dev server
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Environment Variables Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Environment Variables
            </CardTitle>
            <CardDescription>
              Required environment variables for the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre className="whitespace-pre-wrap">
{`# Database
DATABASE_URL="postgresql://..."

# Hugging Face (Free tier available!)
HUGGINGFACE_API_KEY="hf_..."

# Email - Resend (FREE - 100 emails/day)
# Sign up at https://resend.com
RESEND_API_KEY="re_..."
RESEND_FROM="RFP Manager <onboarding@resend.dev>"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
