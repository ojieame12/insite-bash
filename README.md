# Insite-Bash Portfolio Generator

An AI-powered portfolio generation platform that transforms resumes into professional, data-driven portfolio websites.

## 🚀 Features

- **AI-Powered Content Generation**: Automatically extracts and enhances content from resumes
- **Multi-Pipeline Architecture**: Modular pipelines for logos, achievements, images, and stories
- **Professional Image Generation**: Creates multiple professional portraits from a single photo
- **Smart Logo Retrieval**: Multi-stage fallback system (Brandfetch → Logo.dev → Ideogram)
- **Achievement Ranking**: AI-powered scoring and ranking of career achievements
- **Honest Embellishment Framework (HEF)**: Fills content gaps without compromising trust
- **Static Site Generation**: Fast, SEO-friendly portfolio websites

## 📁 Project Structure

```
insite-bash/
├── backend/                 # TypeScript Express API
│   ├── src/
│   │   ├── api/            # Routes, controllers, middleware
│   │   ├── services/       # Business logic and pipelines
│   │   ├── models/         # Database models
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Utilities and helpers
│   │   └── config/         # Configuration files
│   └── tests/              # Backend tests
├── frontend/               # React/Next.js frontend (TBD)
├── shared/                 # Shared types between frontend/backend
├── docs/                   # Documentation
└── scripts/                # Deployment and utility scripts
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: JWT
- **Queue**: Bull (Redis)
- **AI/LLM**: OpenAI GPT-4, Gemini (Nanobanna)
- **APIs**: Brandfetch, Logo.dev, Ideogram

### Frontend (Coming Soon)
- **Framework**: Next.js 14
- **UI**: React + Tailwind CSS
- **State Management**: Zustand
- **API Client**: Axios

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Supabase account
- Redis (for queue processing)
- API keys for:
  - OpenAI
  - Gemini/Nanobanna
  - Brandfetch (optional)
  - Logo.dev (optional)
  - Ideogram (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ojieame12/insite-bash.git
   cd insite-bash
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up Supabase database**
   - Run the SQL scripts in `/docs/supabase_setup_no_rls.sql`
   - Create storage buckets: `documents`, `assets`

5. **Start the development server**
   ```bash
   pnpm dev
   ```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

### Authentication

#### POST `/api/v1/auth/signup`
Create a new user account.

#### POST `/api/v1/auth/login`
Authenticate and receive JWT token.

### Users

#### GET `/api/v1/users/me`
Get current user profile.

#### PATCH `/api/v1/users/me`
Update user profile.

### Documents

#### POST `/api/v1/documents/upload`
Upload resume (PDF/DOCX) and trigger ingestion pipeline.

#### GET `/api/v1/documents`
List all user documents.

### Pipeline Runs

#### GET `/api/v1/pipeline-runs/:id`
Get pipeline run status.

#### GET `/api/v1/pipeline-runs`
List all pipeline runs with optional filters.

See `/docs/api_spec_users_documents.md` for detailed API documentation.

## 🔄 Pipeline Architecture

### 1. Ingestion Pipeline
- Extracts text from PDF/DOCX
- Parses resume structure
- Creates work experiences, achievements, skills

### 2. Logo Pipeline
- Fetches company logos via Brandfetch
- Falls back to Logo.dev
- Generates typographic wordmarks with Ideogram

### 3. Achievement Pipeline
- Scores achievements based on metrics
- Ranks top 6 achievements
- Applies Honest Embellishment Framework

### 4. Image Pipeline
- Generates 4 professional portrait variations
- Creates hero, formal, desk, and casual archetypes
- Upscales and optimizes images

### 5. Story Pipeline
- Generates compelling opener
- Creates narrative paragraphs
- Adds inspirational quotes

### 6. Render Pipeline
- Compiles Career Graph
- Generates static site
- Deploys to CDN

## 🧪 Testing

```bash
cd backend
pnpm test
```

## 🚀 Deployment

### Backend Deployment (Recommended: Railway/Render)

1. Set environment variables in your hosting platform
2. Deploy from GitHub repository
3. Ensure Redis is available for queue processing

### Frontend Deployment (Coming Soon)

Will be deployed to Vercel with automatic CI/CD.

## 📖 Documentation

- [API Specification](/docs/api_spec_users_documents.md)
- [Database Schema](/docs/supabase_setup_no_rls.sql)
- [Pipeline Architecture](/docs/pipeline_architecture.md) (TBD)
- [Honest Embellishment Framework](/docs/hef_framework.md) (TBD)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see LICENSE file for details.

## 👥 Team

Built by the Insite-Bash Team

## 🔗 Links

- [GitHub Repository](https://github.com/ojieame12/insite-bash)
- [Documentation](https://github.com/ojieame12/insite-bash/tree/main/docs)

---

**Status**: 🚧 In Active Development

For questions or support, please open an issue on GitHub.
