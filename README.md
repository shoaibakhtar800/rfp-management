# AI-Powered RFP Management System

A single-user web application that helps procurement managers create RFPs using natural language, manage vendors, send RFPs via email, receive and parse vendor proposals with AI, and compare proposals to get intelligent recommendations.

## 📋 Table of Contents

1. [Project Setup](#-project-setup)
2. [Tech Stack](#-tech-stack)
3. [API Documentation](#-api-documentation)
4. [Decisions & Assumptions](#-decisions--assumptions)
5. [AI Tools Usage](#-ai-tools-usage)

---

## 🚀 Project Setup

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18+ | Required for Next.js 15 |
| npm | 11+ | Package manager |
| PostgreSQL | 14+ | Or use Neon/Supabase hosted DB |
| Hugging Face Account | - | FREE tier available at [huggingface.co](https://huggingface.co) |
| Resend Account | - | For email sending at [resend.com](https://resend.com) |

### Installation Steps

#### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd rfp-management
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# ===================================
# DATABASE
# ===================================
DATABASE_URL="postgresql://username:password@localhost:5432/rfp_management"

# ===================================
# AI CONFIGURATION
# ===================================
# Hugging Face (FREE - Recommended)
# Get token from: https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY="hf_your_token_here"

# OpenAI (Optional - for better accuracy)
OPENAI_API_KEY="sk_your_key_here"

# ===================================
# EMAIL CONFIGURATION (Resend)
# ===================================
# Get API key from: https://resend.com/api-keys
RESEND_API_KEY="re_your_api_key_here"
RESEND_FROM="RFP Manager <onboarding@resend.dev>"

# ===================================
# APPLICATION
# ===================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

#### 4. Set Up the Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (for development)
npm run db:push

# OR run migrations (for production)
npm run db:generate
npm run db:migrate
```

#### 5. Start the Development Server

```bash
npm run dev
```

#### 6. Start Inngest Dev Server (Required for Background Jobs)

Open a new terminal and run:

```bash
npx inngest-cli@latest dev
```

#### 7. Access the Application

- **Application**: [http://localhost:3000](http://localhost:3000)
- **Inngest Dashboard**: [http://localhost:8288](http://localhost:8288)
- **Prisma Studio**: Run `npm run db:studio` → [http://localhost:5555](http://localhost:5555)

### Email Configuration

This project uses **Resend** for transactional emails:

1. Create a free account at [resend.com](https://resend.com)
2. Get your API key from [resend.com/api-keys](https://resend.com/api-keys)
3. For development, use the default sender: `onboarding@resend.dev`
4. For production, verify your domain and update `RESEND_FROM`

> **Note**: The free tier allows 100 emails/day which is sufficient for testing.

### Seed Data (Optional)

No seed data is required. The application can be used immediately after setup. You can:
- Create vendors manually via the Vendors page
- Create RFPs using natural language via the New RFP page

---

## 🛠 Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Frontend** | Next.js 15, React 19, TypeScript | Modern React framework with App Router |
| **Styling** | Tailwind CSS 4, Shadcn/ui | Utility-first CSS with accessible components |
| **Icons** | Lucide React | Beautiful, consistent icon set |
| **Backend** | Next.js API Routes | Serverless API endpoints |
| **Background Jobs** | Inngest | Reliable background job processing with retries |
| **Database** | PostgreSQL with Prisma ORM | Type-safe database access |
| **AI Provider** | Hugging Face (Qwen3-8B) | Natural language processing and parsing |
| **AI SDK** | Vercel AI SDK | Structured output generation |
| **Email** | Resend | Transactional email service |
| **Validation** | Zod | Runtime type validation |
| **Forms** | React Hook Form | Form state management |
| **Charts** | Recharts | Data visualization |

### Key Libraries

```json
{
  "@ai-sdk/huggingface": "AI SDK integration for Hugging Face",
  "ai": "Vercel AI SDK for structured outputs",
  "inngest": "Background job processing",
  "@prisma/client": "Database ORM",
  "resend": "Email API",
  "zod": "Schema validation"
}
```

---

## 📡 API Documentation

### RFPs

#### List All RFPs

```
GET /api/rfps
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `DRAFT`, `SENT`, `RECEIVING_PROPOSALS`, `EVALUATING`, `AWARDED`, `CANCELLED` |

**Success Response (200):**
```json
[
  {
    "id": "clx123...",
    "title": "Procurement: Laptops, Monitors",
    "description": "I need to procure laptops...",
    "userRequest": "I need to procure 20 laptops...",
    "budget": 50000,
    "currency": "USD",
    "deliveryDays": 30,
    "paymentTerms": "Net 30",
    "warranty": "1 Year",
    "items": [
      { "name": "Laptops", "quantity": 20, "specifications": "16GB RAM" }
    ],
    "status": "DRAFT",
    "createdAt": "2024-12-06T10:00:00.000Z",
    "vendors": [],
    "proposals": [],
    "_count": { "proposals": 0, "vendors": 0 }
  }
]
```

#### Create RFP from Natural Language

```
POST /api/rfps
```

**Request Body:**
```json
{
  "userRequest": "I need to procure 20 laptops with 16GB RAM and 512GB SSD. Budget is $50,000. Need delivery within 30 days.",
  "dueDate": "2024-12-31",
  "async": true
}
```

**Success Response (202 - Async Mode):**
```json
{
  "jobId": "clx456...",
  "status": "PENDING",
  "message": "RFP creation started in background"
}
```

**Success Response (201 - Sync Mode with `async: false`):**
```json
{
  "id": "clx123...",
  "title": "Procurement: Laptops",
  "description": "Procurement of 20 laptops with 16GB RAM...",
  "budget": 50000,
  "status": "DRAFT"
}
```

**Error Response (400):**
```json
{
  "error": "Validation error",
  "details": [{ "path": ["userRequest"], "message": "User request is required" }]
}
```

#### Get Single RFP

```
GET /api/rfps/[id]
```

**Success Response (200):**
```json
{
  "id": "clx123...",
  "title": "Procurement: Laptops",
  "vendors": [
    {
      "id": "clx789...",
      "vendor": { "id": "...", "name": "Tech Corp", "email": "vendor@example.com" },
      "status": "SENT",
      "sentAt": "2024-12-06T10:30:00.000Z"
    }
  ],
  "proposals": [
    {
      "id": "clxabc...",
      "vendor": { "name": "Tech Corp" },
      "totalPrice": 45000,
      "aiScore": 85,
      "status": "PARSED"
    }
  ]
}
```

**Error Response (404):**
```json
{ "error": "RFP not found" }
```

#### Send RFP to Vendors

```
POST /api/rfps/[id]/send
```

**Request Body:**
```json
{
  "vendorIds": ["vendor_id_1", "vendor_id_2"]
}
```

**Success Response (200):**
```json
{
  "message": "RFP sending initiated",
  "vendorCount": 2
}
```

#### Award RFP to Vendor

```
POST /api/rfps/[id]/award
```

**Request Body:**
```json
{
  "vendorId": "vendor_id",
  "notes": "Selected due to best value and delivery timeline",
  "sendNotification": true
}
```

**Success Response (200):**
```json
{
  "id": "clx123...",
  "status": "AWARDED",
  "awardedVendorId": "vendor_id",
  "awardedAt": "2024-12-06T15:00:00.000Z"
}
```

---

### Vendors

#### List All Vendors

```
GET /api/vendors
```

**Success Response (200):**
```json
[
  {
    "id": "clxv123...",
    "name": "Tech Solutions Inc",
    "email": "sales@techsolutions.com",
    "phone": "+1-555-0100",
    "company": "Tech Solutions Inc",
    "category": "IT Equipment",
    "rating": 4.5
  }
]
```

#### Create Vendor

```
POST /api/vendors
```

**Request Body:**
```json
{
  "name": "Tech Solutions Inc",
  "email": "sales@techsolutions.com",
  "phone": "+1-555-0100",
  "company": "Tech Solutions Inc",
  "category": "IT Equipment",
  "notes": "Preferred vendor for laptops"
}
```

**Success Response (201):**
```json
{
  "id": "clxv123...",
  "name": "Tech Solutions Inc",
  "email": "sales@techsolutions.com"
}
```

**Error Response (400):**
```json
{ "error": "Email already exists" }
```

#### Update Vendor

```
PUT /api/vendors/[id]
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "rating": 4.8
}
```

#### Delete Vendor

```
DELETE /api/vendors/[id]
```

**Success Response (200):**
```json
{ "message": "Vendor deleted successfully" }
```

---

### Proposals

#### List All Proposals

```
GET /api/proposals
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `rfpId` | string | Filter by RFP ID |
| `vendorId` | string | Filter by Vendor ID |

**Success Response (200):**
```json
[
  {
    "id": "clxp123...",
    "rfpId": "clx123...",
    "vendorId": "clxv123...",
    "totalPrice": 45000,
    "currency": "USD",
    "deliveryDays": 25,
    "warranty": "2 Years",
    "aiScore": 85,
    "aiSummary": "Excellent proposal. Within budget with 10% savings.",
    "aiStrengths": ["Competitive pricing", "Fast delivery"],
    "aiWeaknesses": ["No itemized breakdown"],
    "status": "PARSED",
    "vendor": { "name": "Tech Solutions Inc" },
    "rfp": { "title": "Procurement: Laptops" }
  }
]
```

#### Create and Parse Proposal

```
POST /api/proposals
```

**Request Body:**
```json
{
  "rfpId": "clx123...",
  "vendorId": "clxv123...",
  "emailContent": "Dear Procurement Team,\n\nWe are pleased to submit our proposal...\n\nTotal: $45,000\nDelivery: 25 days\nWarranty: 2 years\n\nBest regards,\nTech Solutions",
  "async": true
}
```

**Success Response (202 - Async Mode):**
```json
{
  "jobId": "clxj456...",
  "status": "PENDING",
  "message": "Proposal parsing started in background"
}
```

#### Compare Proposals

```
POST /api/proposals/compare
```

**Request Body:**
```json
{
  "rfpId": "clx123...",
  "async": true
}
```

**Success Response (202):**
```json
{
  "jobId": "clxj789...",
  "status": "PENDING",
  "message": "Comparison started in background"
}
```

---

### Emails

#### Check for New Vendor Responses

```
POST /api/emails/check
```

**Success Response (200):**
```json
{
  "checked": 5,
  "processed": 2,
  "proposals": [
    { "vendor": "Tech Corp", "rfp": "Laptop Procurement", "score": 82 }
  ]
}
```

---

### AI Jobs

#### Get Job Status

```
GET /api/ai-jobs/[id]
```

**Success Response (200):**
```json
{
  "id": "clxj123...",
  "type": "PARSE_RFP",
  "status": "COMPLETED",
  "progress": 100,
  "stepDescription": "RFP created successfully!",
  "outputData": {
    "rfpId": "clx123...",
    "title": "Procurement: Laptops"
  },
  "completedAt": "2024-12-06T10:01:00.000Z"
}
```

**Job Status Values:**
- `PENDING` - Job queued
- `PROCESSING` - Currently being processed
- `COMPLETED` - Successfully finished
- `FAILED` - Error occurred (check `error` field)

---

## 🎯 Decisions & Assumptions

### Key Design Decisions

#### 1. Data Model Design

```
RFP (1) ←→ (Many) RFPVendor ←→ (1) Vendor
 │                              │
 └──── (1) ←→ (Many) ──────────→ Proposal
```

- **RFP** stores both original user request and AI-structured data
- **RFPVendor** junction table tracks sending status per vendor
- **Proposal** stores raw email content + AI-extracted structured data
- **EmailLog** provides audit trail for all email communications
- **AIJob** enables async processing with progress tracking

#### 2. AI Processing Strategy

- **Default: Asynchronous Processing** - All AI operations run via Inngest background jobs
  - Prevents request timeouts
  - Provides real-time progress updates
  - Automatic retries on failure
- **Fallback: Regex Parsing** - If AI fails, basic regex extraction ensures data is captured
- **Model Choice**: Hugging Face Qwen3-8B (FREE tier) with optional OpenAI fallback

#### 3. Scoring Algorithm

Proposals are scored on a 0-100 scale with the following weights:

| Factor | Weight | Criteria |
|--------|--------|----------|
| Price | 40% | Comparison to budget (bonus for savings) |
| Delivery | 25% | Meeting or beating timeline |
| Warranty | 20% | Warranty period offered |
| Completeness | 15% | Detailed breakdown, payment terms |

#### 4. Email Architecture

- **Sending**: Resend API (reliable, good deliverability)
- **Receiving**: Currently via manual "Check Emails" or scheduled cron job (every 5 minutes)
- **Matching**: Vendor identified by sender email → matched to most recent pending RFP

#### 5. UI/UX Choices

- **Dashboard-first approach** rather than chat-like interface
- **Card-based layouts** for easy scanning
- **Real-time progress indicators** for AI processing
- **Mobile-responsive** design using Tailwind CSS

### Assumptions

1. **Single User System** - No authentication required per assignment scope
2. **Vendor Email Matching** - Vendor responses come from their registered email address
3. **One Proposal per Vendor per RFP** - Subsequent responses update existing proposal
4. **Currency** - Default USD, but supports multi-currency display
5. **Email Format** - Vendor responses are in plain text or simple HTML (not complex PDFs)
6. **Timezone** - All dates stored in UTC

### Known Limitations

- Complex PDF attachments require manual review
- Email parsing relies on consistent vendor email addresses
- No OAuth email integration (uses API-based email service)
- Single-user only (no multi-tenancy)

---

## 🤖 AI Tools Usage

### Tools Used During Development

| Tool | Purpose |
|------|---------|
| **Cursor IDE** | Primary development environment with AI assistance |
| **Claude (Anthropic)** | Architecture planning, code generation, debugging |
| **GitHub Copilot** | Code completion and suggestions |

### What AI Helped With

1. **Project Architecture**
   - Database schema design with relationships
   - API route structure following Next.js conventions
   - Background job patterns with Inngest

2. **Code Generation**
   - Prisma schema with proper relations and indexes
   - API routes with Zod validation
   - React components with Shadcn/ui patterns
   - Email templates with responsive HTML

3. **AI Integration Code**
   - Structured output prompts using Vercel AI SDK
   - Fallback parsing with regex patterns
   - Scoring algorithm implementation

4. **Debugging**
   - TypeScript type issues
   - Prisma query optimization
   - React hydration errors
   - Inngest function configuration

### Notable Prompts/Approaches

**For RFP Parsing:**
```
"You are a procurement expert. Parse the following natural language 
procurement request into a structured RFP. Extract: title, description, 
budget, delivery timeline, payment terms, warranty, items with quantities 
and specifications, and additional requirements."
```

**For Proposal Scoring:**
```
"Analyze this vendor proposal against RFP requirements. Score based on:
price competitiveness (40%), delivery timeline (25%), warranty (20%),
and completeness (15%). Provide strengths, weaknesses, and summary."
```

### Key Learnings

1. **Structured Outputs** - Using Zod schemas with AI SDK produces more reliable JSON extraction than free-form prompts

2. **Fallback Patterns** - Always implement regex/basic parsing as fallback when AI is unavailable

3. **Background Processing** - For production apps, async AI processing is essential to avoid timeouts

4. **Progress Feedback** - Users appreciate seeing AI processing progress rather than a generic spinner

5. **Error Recovery** - Inngest's automatic retry mechanism handles transient AI API failures gracefully

---

## 📁 Project Structure

```
rfp-management/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── rfps/          # RFP endpoints
│   │   │   ├── vendors/       # Vendor endpoints
│   │   │   ├── proposals/     # Proposal endpoints
│   │   │   ├── emails/        # Email checking
│   │   │   ├── ai-jobs/       # Job status polling
│   │   │   └── inngest/       # Inngest webhook
│   │   ├── rfps/              # RFP pages
│   │   ├── vendors/           # Vendor management page
│   │   ├── proposals/         # Proposals list page
│   │   ├── compare/           # Comparison page
│   │   └── page.tsx           # Dashboard
│   ├── components/
│   │   ├── ui/                # Shadcn/ui components
│   │   └── layout/            # Layout components
│   ├── inngest/
│   │   ├── client.ts          # Inngest client
│   │   └── functions.ts       # Background job functions
│   ├── lib/
│   │   ├── ai/
│   │   │   └── rfp-parser.ts  # AI parsing logic
│   │   └── email/
│   │       └── email-service.ts # Email service
│   └── server/
│       └── db.ts              # Prisma client
├── .env.local                 # Environment variables (create this)
└── package.json
```

---

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

---

## 📄 License

MIT
