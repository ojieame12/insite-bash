'", text=
# Insite-Bash API Specification: Users & Documents

This document outlines the backend API endpoints for managing users and their source documents in the Insite-Bash platform. All endpoints should be prefixed with `/api/v1`.

---

## 1. Authentication

Authentication is handled via JWTs (JSON Web Tokens). The `POST /auth/login` endpoint returns a token which must be included in the `Authorization` header of subsequent requests as a Bearer token.

`Authorization: Bearer <your_jwt_token>`

---

## 2. Users API

Endpoints for managing user accounts and authentication.

### `POST /auth/signup`

**Description:** Creates a new user and tenant.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "a-strong-password",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201 Created):**
```json
{
  "userId": "uuid-goes-here",
  "email": "user@example.com",
  "firstName": "John",
  "token": "jwt-token-goes-here"
}
```

### `POST /auth/login`

**Description:** Authenticates a user and returns a JWT.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "a-strong-password"
}
```

**Response (200 OK):**
```json
{
  "userId": "uuid-goes-here",
  "token": "jwt-token-goes-here"
}
```

### `GET /users/me`

**Description:** Retrieves the profile of the currently authenticated user.

**Authentication:** Required.

**Response (200 OK):**
```json
{
  "id": "uuid-goes-here",
  "tenantId": "uuid-goes-here",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "userRole": "Senior Product Manager",
  "photoUrl": "https://...",
  "headline": "Building world-class products..."
}
```

### `PATCH /users/me`

**Description:** Updates the profile of the currently authenticated user.

**Authentication:** Required.

**Request Body:**
```json
{
  "firstName": "Jonathan",
  "userRole": "Lead Product Manager",
  "headline": "Leading teams to build world-class products..."
}
```

**Response (200 OK):**
(Returns the updated user object)

### `DELETE /users/me`

**Description:** Deletes the account of the currently authenticated user. This should be a soft delete.

**Authentication:** Required.

**Response (204 No Content):**
(No response body)

---
## 3. Documents API

Endpoints for managing user-uploaded source documents (resumes, etc.).

### `POST /documents/upload`

**Description:** Uploads a new document (e.g., resume PDF) and triggers the ingestion pipeline.

**Authentication:** Required.

**Request:** `multipart/form-data` with a file field named `document`.

**Response (202 Accepted):**
```json
{
  "documentId": "uuid-goes-here",
  "pipelineRunId": "uuid-goes-here",
  "status": "queued",
  "message": "Document ingestion has started."
}
```

### `GET /documents`

**Description:** Retrieves a list of all documents for the authenticated user.

**Authentication:** Required.

**Response (200 OK):**
```json
[
  {
    "id": "uuid-goes-here",
    "type": "resume_pdf",
    "storageUrl": "https://...",
    "createdAt": "2025-11-02T11:30:00Z"
  }
]
```

### `GET /documents/{id}`

**Description:** Retrieves a single document by its ID.

**Authentication:** Required.

**Response (200 OK):**
(Returns the document object)

### `DELETE /documents/{id}`

**Description:** Deletes a document by its ID.

**Authentication:** Required.

**Response (204 No Content):**
(No response body)

---
## 4. Document Ingestion Pipeline Status

### `GET /pipeline-runs/{id}`

**Description:** Retrieves the status of a pipeline run (e.g., document ingestion).

**Authentication:** Required.

**Response (200 OK):**
```json
{
  "id": "uuid-goes-here",
  "userId": "uuid-goes-here",
  "kind": "ingest",
  "status": "succeeded",
  "input": {
    "documentId": "uuid-goes-here"
  },
  "output": {
    "extractedText": "...",
    "workExperiencesCreated": 3,
    "achievementsCreated": 12
  },
  "createdAt": "2025-11-02T11:30:00Z",
  "updatedAt": "2025-11-02T11:32:00Z"
}
```

### `GET /pipeline-runs`

**Description:** Retrieves all pipeline runs for the authenticated user.

**Authentication:** Required.

**Query Parameters:**
- `kind` (optional): Filter by pipeline kind (e.g., `ingest`, `logos`, `achievements`)
- `status` (optional): Filter by status (e.g., `queued`, `running`, `succeeded`, `failed`)

**Response (200 OK):**
(Returns an array of pipeline run objects)

---

## 5. Implementation Notes

### Storage

**Document Storage:** Use Supabase Storage buckets to store uploaded documents. The `storageUrl` field in the `documents` table should reference the Supabase Storage URL.

**Bucket Structure:**
- Bucket name: `documents`
- Path pattern: `{tenantId}/{userId}/{documentId}.{extension}`

### Text Extraction

When a document is uploaded via `POST /documents/upload`, the backend should:

1. Save the file to Supabase Storage
2. Create a record in the `documents` table
3. Queue a pipeline run of kind `ingest`
4. Extract text from the document using a library like **pdf2text** (for PDFs) or **mammoth** (for DOCX)
5. Store the extracted text in the `text_extracted` field
6. Parse the extracted text using **LlamaIndex** to populate `work_experiences`, `achievements`, `skills`, etc.

### Error Handling

All endpoints should return appropriate HTTP status codes:

- **200 OK:** Request succeeded
- **201 Created:** Resource created successfully
- **202 Accepted:** Request accepted for async processing
- **204 No Content:** Request succeeded with no response body
- **400 Bad Request:** Invalid request parameters
- **401 Unauthorized:** Missing or invalid authentication
- **403 Forbidden:** Authenticated but not authorized
- **404 Not Found:** Resource not found
- **500 Internal Server Error:** Server error

Error responses should include a JSON body:
```json
{
  "error": "Error message here",
  "details": "Additional context if available"
}
```

### Rate Limiting

Consider implementing rate limiting on document uploads to prevent abuse:
- **Limit:** 10 uploads per hour per user
- **Response (429 Too Many Requests):**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 3600
}
```

---

## 6. Database Schema Reference

### Users Table

| Column | Type | Description |
|:---|:---|:---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Foreign key to tenants |
| `email` | CITEXT | Unique email address |
| `password_hash` | TEXT | Hashed password |
| `first_name` | TEXT | User's first name |
| `last_name` | TEXT | User's last name |
| `user_role` | TEXT | Current job title/role |
| `photo_url` | TEXT | Profile photo URL |
| `headline` | TEXT | Professional headline |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### Documents Table

| Column | Type | Description |
|:---|:---|:---|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to users |
| `type` | TEXT | Document type (resume_pdf, resume_docx, linkedin, manual) |
| `storage_url` | TEXT | URL in Supabase Storage |
| `text_extracted` | TEXT | Extracted text content |
| `created_at` | TIMESTAMPTZ | Upload timestamp |

---

## 7. Security Considerations

### Password Hashing

Use **bcrypt** or **Argon2** to hash passwords before storing them in the database. Never store plaintext passwords.

### JWT Configuration

- **Algorithm:** HS256 or RS256
- **Expiration:** 24 hours
- **Refresh tokens:** Consider implementing refresh tokens for better UX

### Input Validation

Validate all user inputs:
- **Email:** Must be a valid email format
- **Password:** Minimum 8 characters, must include uppercase, lowercase, number, and special character
- **File uploads:** Validate file type and size (max 10MB for documents)

### CORS

Configure CORS to allow requests only from your frontend domain(s).

---

## 8. Example Implementation (Node.js/Express)

Here's a skeleton implementation for the Users API:

```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware to verify JWT
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /auth/signup
app.post('/auth/signup', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Create tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .insert({ name: `${firstName} ${lastName}'s Workspace` })
    .select()
    .single();
  
  // Create user
  const { data: user } = await supabase
    .from('users')
    .insert({
      tenant_id: tenant.id,
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName
    })
    .select()
    .single();
  
  // Generate JWT
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
  
  res.status(201).json({
    userId: user.id,
    email: user.email,
    firstName: user.first_name,
    token
  });
});

// GET /users/me
app.get('/users/me', authenticate, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.userId)
    .single();
  
  res.json(user);
});

// PATCH /users/me
app.patch('/users/me', authenticate, async (req, res) => {
  const updates = req.body;
  
  const { data: user } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.userId)
    .select()
    .single();
  
  res.json(user);
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## 9. Next Steps

After implementing the Users and Documents APIs, you should:

1. **Implement the Pipeline Orchestration System** to handle document ingestion asynchronously
2. **Build the Logo Pipeline API** to fetch and generate company logos
3. **Create the Achievement Ranking API** to score and rank user achievements
4. **Develop the Image Generation API** to create professional portraits using Nanobanna
5. **Implement the Story Generation API** to create narrative content
6. **Build the Site Publishing API** to generate and deploy portfolio websites

---

**Author:** Manus AI  
**Date:** November 2, 2025
