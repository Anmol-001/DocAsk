# DocAsk

DocAsk is a production-ready, full-stack web application that allows users to upload PDF documents and ask questions about them. It uses Retrieval-Augmented Generation (RAG) to provide accurate, grounded answers with citations.

## Architecture Overview

DocAsk is built on a modern, robust architecture:

- **Frontend:** Next.js (React), Tailwind CSS, Radix UI components (shadcn/ui).
- **Backend:** Express.js (Node.js) with TypeScript.
- **Database:** MongoDB Atlas (NoSQL Document Store).
- **Vector Search:** MongoDB Atlas Vector Search for semantic retrieval.
- **LLM Orchestration:** LangChain for prompt formatting and QA flows.
- **AI Models:** Google Gemini (`gemini-3.6-flash` for generation, `text-embedding-004` for embeddings).
- **Authentication:** JWT Bearer tokens securely stored in browser `sessionStorage`.

## Key Features

1. **Secure Authentication:** JWT-based user registration and login.
2. **Multi-tenant Data Isolation:** Users can only access and query their own uploaded documents.
3. **Asynchronous Ingestion:** PDFs are parsed, chunked, and embedded in controlled batches to respect API rate limits.
4. **Conversational Memory (Multi-turn RAG):** The AI remembers past messages within a conversation, allowing for natural follow-up questions.
5. **Grounded QA with Citations:** The AI strictly answers based on the uploaded document and provides page-level citations for every claim.
6. **Rate Limiting:** Public and expensive API routes are protected against abuse.

## Prerequisites

- Node.js (v18+)
- MongoDB Atlas Cluster (M0 Free Tier is sufficient)
- Google Gemini API Key

## Setup Instructions

### 1. MongoDB Atlas Vector Search Setup

DocAsk requires a specific Vector Search index to retrieve relevant document chunks.

1. Create a MongoDB Atlas cluster.
2. Go to **Atlas Search** -> **Create Search Index**.
3. Select **JSON Editor**.
4. Target the `docask` database and the `documentchunks` collection.
5. Name the index `vector_index`.
6. Use the following JSON configuration:

```json
{
  "fields": [
    {
      "numDimensions": 768,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    },
    {
      "path": "documentId",
      "type": "filter"
    }
  ]
}
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/docask?retryWrites=true&w=majority

# API Server Configuration
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Authentication Secrets
JWT_SECRET=your_super_secret_jwt_key_here

# Google Gemini Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_EMBEDDING_MODEL=text-embedding-004
GEMINI_GENERATION_MODEL=gemini-3.6-flash
```

### 3. Installation

Install all dependencies (the repository uses a unified package.json for convenience):

```bash
npm install
```

### 4. Running the Application

To start both the Express backend and the Next.js frontend concurrently in development mode:

```bash
npm run dev
```

- The Frontend will be available at `http://localhost:9002` (or 3000 depending on availability).
- The Backend API will be available at `http://localhost:3001`.

To build and run for production:
```bash
npm run build
npm run server
```

## Authentication & RAG Flow

1. **Authentication:** The frontend POSTs credentials to `/api/auth/login`. The Express backend hashes the password, compares it, and issues a signed JWT. The frontend stores this in `sessionStorage` and attaches it as a `Bearer` token to all subsequent API calls.
2. **Ingestion:** A PDF is uploaded via `FormData`. The Express backend parses it, cleans the text, splits it into chunks of 1000 characters, generates vector embeddings in batches of 100 via Gemini, and saves them to MongoDB.
3. **Retrieval (RAG):** When a user asks a question, the backend generates an embedding for the question, executes a `$vectorSearch` aggregation in MongoDB to find the 5 most semantically similar chunks, and checks answerability.
4. **Generation:** The context chunks and the conversation history (last 10 messages) are injected into a LangChain prompt and sent to Gemini to generate a grounded, factual answer.
