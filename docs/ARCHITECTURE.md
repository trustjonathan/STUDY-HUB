# Study Hub Architecture & Data Flow 🏛

This document outlines the technical architecture, data flow pipelines, security boundaries, and external integration points of Study Hub.

---

## 1. High-Level System Architecture

Study Hub is built with a decoupled architecture designed to deliver fast static content over low-bandwidth cellular networks while supporting rich interactive learning tools.

```mermaid
graph TD
    subgraph Client["Learner Browser / Mobile Phone"]
        UI["Astro Static Shell & React Workspaces"]
        Reader["Custom Document & Flipbook Viewer"]
        AI_Tutor["AI Study Assistant Interface (PWA)"]
        SessionStore["Tab SessionStorage (JWT)"]
    end

    subgraph CDN["Static Hosting (GitHub Pages)"]
        HTML["Pre-rendered HTML & Catalogs"]
        Assets["Scripts, Styles, & Flipbook Assets"]
    end

    subgraph BackendAPI["Backend Host (Render Cloud)"]
        Express["Express REST API (Node.js 22)"]
        AuthMid["JWT Auth Middleware"]
        TutorSvc["AI Tutoring & Lesson Guide Service"]
        PaymentSvc["Payment Verification & Stream Controller"]
        VectorSvc["Topic Memory Service"]
    end

    subgraph DataLayer["Supabase & PostgreSQL Cloud"]
        PG[("PostgreSQL Database")]
        VectorExt[("pgvector Extension")]
        SupaStorage["Supabase Storage Buckets"]
        EdgeFn["Supabase Edge Functions"]
    end

    subgraph ExternalAI["External AI Services"]
        Gemini["Google Gemini API (Tutoring & Plans)"]
        OpenAI["OpenAI API (text-embedding-3-small)"]
    end

    UI -->|Loads static pages & catalogs| CDN
    Reader -->|Fetch document stream| PaymentSvc
    Reader -->|Direct resumable upload| SupaStorage
    UI -->|Anonymous suggestions| EdgeFn
    UI -->|Sign-in / Register| Express
    AI_Tutor -->|Academic prompt| TutorSvc

    Express --> AuthMid
    AuthMid --> SessionStore
    TutorSvc --> VectorSvc
    VectorSvc --> VectorExt
    TutorSvc --> Gemini
    VectorSvc --> OpenAI
    PaymentSvc --> PG
    EdgeFn --> SupaStorage
```

---

## 2. Authentication & Session Flow

Study Hub offers browsing and reading without an account. For saved bookmarks, ratings, and personalized AI memory, optional accounts are supported.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Learner Browser
    participant API as Express Backend
    participant SupaAuth as Supabase Auth
    participant DB as PostgreSQL (public.users)

    alt Email & Password Sign-In
        Learner->>API: POST /api/auth/login (email, password)
        API->>DB: Query user by email & verify bcrypt hash
        DB-->>API: User Record
        API->>API: Generate signed JWT (HS256, 32-byte secret)
        API-->>Learner: { token, user: { id, email, role, classLevel } }
        Learner->>Learner: Store token in current tab's sessionStorage
    else Google Sign-In (One Tap)
        Learner->>SupaAuth: signInWithIdToken(Google ID Token)
        SupaAuth-->>Learner: Verified Supabase Session
        Learner->>API: POST /api/auth/google (idToken, email)
        API->>DB: Upsert user record linked to google_id
        API->>API: Generate Study Hub JWT
        API-->>Learner: { token, user }
        Learner->>Learner: Store token in sessionStorage
    end
```

### Security Properties
- **No Third-Party Cookies:** Token is stored in `sessionStorage`, isolating sessions per browser tab and bypassing cross-site cookie restrictions.
- **Client ID Isolation:** The Google Client ID is public in the frontend; the Google Client Secret remains strictly inside Supabase Auth dashboard.

---

## 3. Resource Contribution & Staging Flow

Learners and educators can submit revision notes anonymously. To protect the public catalog from spam and malicious uploads, files land in an isolated staging bucket before manual review.

```mermaid
sequenceDiagram
    autonumber
    actor Contributor as Contributor Browser
    participant Reader as Upload Controller (Tus client)
    participant Staging as Supabase Private Staging Bucket
    participant Edge as Edge Function (finalize-contribution)
    participant Inbox as Supabase Private Contribution Inbox
    actor Moderator as Platform Administrator

    Contributor->>Reader: Select files (max 50MB/file, 250MB/batch)
    Reader->>Staging: Resumable 3-parallel chunked upload (Tus protocol)
    Staging-->>Reader: Transfer Complete
    Reader->>Edge: POST /functions/v1/finalize-resource-contribution
    Edge->>Edge: Verify batch size, file extensions, and checksums
    Edge->>Inbox: Move validated files to private inbox/
    Edge-->>Reader: 200 OK (Contribution received)
    Note over Staging: Expired incomplete batches deleted hourly via cron
    Moderator->>Inbox: Review notes in private queue & curate into library
```

---

## 4. Document Payment & One-Time Download Flow

Study Hub provides an optional offline download pipeline for students who need physical printing or offline revision, funded by a nominal UGX 1,000 Mobile Money fee.

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student (Mobile Phone)
    participant Checkout as Payment Page (/document-payment.html)
    participant API as Express Backend
    participant DB as PostgreSQL (public.document_payments)
    actor Admin as Admin Verifier

    Student->>Checkout: Select Document & Click "Download"
    Checkout->>Student: Display UGX 1,000 instructions & business number (070...)
    Student->>Student: Dials *185# on MTN/Airtel SIM to complete transfer
    Student->>Checkout: Enters sender telephone number
    Checkout->>API: POST /api/document-payments/requests (JWT, phone, resourceUrl)
    API->>DB: Insert request (status: 'pending', amount: 1000)
    API-->>Checkout: Request Recorded

    Admin->>API: GET /api/document-payments/admin/requests (Admin JWT)
    API->>DB: Fetch pending verification queue
    DB-->>Admin: Display sender phone & matching transaction
    Admin->>API: POST /api/document-payments/admin/requests/:id/verify
    API->>DB: Update status to 'approved'

    Student->>API: GET /api/document-payments/requests/:id/download (Student JWT)
    API->>DB: Check status == 'approved' and owner matches JWT
    API->>API: Stream requested file bytes directly to client
    API->>DB: Update status to 'consumed' (One-time download protection)
```

---

## 5. AI Tutoring, Study Planning & Vector Memory Flow

Study Hub integrates Google Gemini for academic tutoring and OpenAI embeddings + pgvector for long-term memory.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Learner (AI Study Workspace)
    participant API as Express Backend
    participant VectorDB as PostgreSQL (pgvector)
    participant OpenAI as OpenAI API
    participant Gemini as Google Gemini API

    Learner->>API: POST /api/ai-study-companion/ask (question, context, JWT)
    API->>API: Validate prompt length & academic topic boundaries

    opt Signed-in Learner Topic Memory
        API->>OpenAI: Generate embedding (text-embedding-3-small)
        OpenAI-->>API: 1536-dimension float vector
        API->>VectorDB: Cosine similarity search scoped to learner_id
        VectorDB-->>API: Top relevant past study topics
    end

    API->>Gemini: Prompt Gemini 3.5 Flash (with question + curriculum context)
    alt Gemini 3.5 Flash Success
        Gemini-->>API: Educational guide & explanation
    else Primary Model Busy / Rate Limited
        API->>Gemini: Failover to Gemini 3.5 Flash-Lite
        Gemini-->>API: Fallback explanation
    end

    API-->>Learner: Markdown response + study tips
    Learner->>Learner: Cache response in browser localStorage (up to 20 guides)
```
