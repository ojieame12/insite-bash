# Insite-Bash Setup Guide

Complete step-by-step guide to get Insite-Bash running locally.

## Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 20+** installed ([Download](https://nodejs.org/))
- ✅ **npm** or **pnpm** package manager
- ✅ **Redis** installed or access to Redis Cloud
- ✅ **Git** for cloning the repository

## Step 1: Clone Repository

```bash
git clone https://github.com/ojieame12/insite-bash.git
cd insite-bash/backend
```

## Step 2: Install Dependencies

```bash
npm install
# or
pnpm install
```

## Step 3: Set Up Supabase

### 3.1 Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: insite-bash
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to you
4. Wait for project to be created (~2 minutes)

### 3.2 Get API Credentials

1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

### 3.3 Run Database Setup

1. Go to **SQL Editor** in Supabase Dashboard
2. Open `/docs/supabase_setup_no_rls.sql` from this repository
3. Copy the entire contents
4. Paste into SQL Editor and click **Run**
5. Verify 20+ tables were created in **Table Editor**

### 3.4 Create Storage Buckets

1. Go to **Storage** in Supabase Dashboard
2. Create three buckets:
   - `documents` (for resume uploads)
   - `assets` (for logos and generated content)
   - `portraits` (for AI-generated images)
3. Set all buckets to **Public** access

## Step 4: Set Up Redis

### Option A: Local Redis (Recommended for Development)

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Windows:**
Download from [Redis Windows](https://github.com/microsoftarchive/redis/releases)

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

### Option B: Redis Cloud (Alternative)

1. Go to [Redis Cloud](https://redis.com/try-free/)
2. Create free account and database
3. Get connection details (host, port, password)
4. Update `.env` with Redis Cloud credentials

## Step 5: Get API Keys

### 5.1 OpenAI API Key (REQUIRED)

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)
4. **Important**: Add credits to your OpenAI account

### 5.2 Gemini API Key (REQUIRED)

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key

### 5.3 Ideogram API Key (REQUIRED)

1. Go to [https://ideogram.ai/api](https://ideogram.ai/api)
2. Sign up for API access
3. Get your API key

### 5.4 Brandfetch API Key (Optional)

1. Go to [https://brandfetch.com/api](https://brandfetch.com/api)
2. Sign up for free tier
3. Get API key

### 5.5 Logo.dev API Key (Optional)

1. Go to [https://logo.dev](https://logo.dev)
2. Sign up for API access
3. Get API key

## Step 6: Configure Environment Variables

1. Open `backend/.env` file
2. Fill in all the values:

```env
# Supabase (from Step 3.2)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Redis (from Step 4)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_generated_secret_here

# OpenAI (from Step 5.1)
OPENAI_API_KEY=sk-your-key-here

# Gemini (from Step 5.2)
GEMINI_API_KEY=your_gemini_key_here

# Ideogram (from Step 5.3)
IDEOGRAM_API_KEY=your_ideogram_key_here

# Optional
BRANDFETCH_API_KEY=your_brandfetch_key_here
LOGODEV_API_KEY=your_logodev_key_here
```

3. Generate JWT secret:
```bash
openssl rand -base64 32
```

## Step 7: Start the Application

### Terminal 1: API Server

```bash
cd backend
npm run dev
```

You should see:
```
Server running on port 3000
Pipeline worker started and listening for jobs
```

### Terminal 2: Worker Process (Optional - for production)

```bash
cd backend
npm run worker
```

### Terminal 3: Bull Board (Queue Monitor)

Access at: [http://localhost:3000/admin/queues](http://localhost:3000/admin/queues)

## Step 8: Test the API

### 8.1 Health Check

```bash
curl http://localhost:3000/health
```

Should return: `{"status":"ok"}`

### 8.2 Create Test User

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "fullName": "Test User"
  }'
```

### 8.3 Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

Save the `token` from the response.

### 8.4 Upload Resume

```bash
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@/path/to/your/resume.pdf" \
  -F "type=resume_pdf"
```

### 8.5 Start Pipeline

```bash
curl -X POST http://localhost:3000/api/v1/pipelines/run \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "DOCUMENT_ID_FROM_UPLOAD"
  }'
```

### 8.6 Check Pipeline Status

```bash
curl http://localhost:3000/api/v1/pipelines/status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting

### Redis Connection Error

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution**:
```bash
# Check if Redis is running
redis-cli ping

# If not running, start it
# macOS:
brew services start redis

# Ubuntu:
sudo systemctl start redis
```

### Supabase Connection Error

**Error**: `Invalid API key`

**Solution**:
- Double-check `SUPABASE_URL` and keys in `.env`
- Ensure no extra spaces or quotes
- Verify keys are from the correct project

### OpenAI API Error

**Error**: `Insufficient credits` or `Invalid API key`

**Solution**:
- Verify API key is correct
- Check you have credits: [https://platform.openai.com/account/billing](https://platform.openai.com/account/billing)
- Add payment method if needed

### Port Already in Use

**Error**: `Port 3000 is already in use`

**Solution**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

## Next Steps

Once everything is running:

1. ✅ Test the complete pipeline with a real resume
2. ✅ Monitor jobs in Bull Board: [http://localhost:3000/admin/queues](http://localhost:3000/admin/queues)
3. ✅ Check generated data in Supabase Table Editor
4. ✅ Review logs in `backend/logs/`

## Production Deployment

For deploying to production, see [DEPLOYMENT.md](./DEPLOYMENT.md)

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs in `backend/logs/error.log`
3. Open an issue on [GitHub](https://github.com/ojieame12/insite-bash/issues)

---

**Happy Building! 🚀**
