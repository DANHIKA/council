# Council Permit Portal

A modern, full-stack web application for managing council permit applications online. Built with Next.js 15, React 19, and TypeScript, this portal streamlines the permit application process with role-based workflows for applicants, officers, and administrators.

## 🎯 Project Overview

The Council Permit Portal is a comprehensive permit management system that enables:
- **Citizens** to apply for permits online with document upload
- **Council Officers** to review and decide on applications efficiently
- **Administrators** to manage systems, users, and permit types
- **Real-time communication** between applicants and officers
- **Digital certificates** generation and download

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + PostCSS
- **UI Components**: shadcn/ui, Radix UI
- **Form Handling**: React Hook Form with Zod validation
- **State Management**: Zustand, TanStack Query
- **Maps**: Leaflet + React Leaflet
- **PDF Generation**: @react-pdf/renderer
- **Notifications**: Sonner toast library
- **Icons**: Lucide React, Huge Icons

### Backend
- **Runtime**: Node.js + Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with JWT
- **Email**: Nodemailer (SMTP)
- **File Storage**: Local filesystem (scalable to cloud)

### AI & Advanced Features
- **Large Language Models**: Ollama (local LLM)
- **LLM Framework**: LangChain
- **QR Codes**: qrcode library

## ✨ Features

### For Applicants
- **Permit Applications**
  - Easy-to-use guided application submission
  - Multiple permit types support
  - Location picker with map integration
  - Real-time form validation
  
- **Document Management**
  - Upload required documents according to permit type
  - Document status tracking (Pending, Approved, Rejected)
  - Drag-and-drop file upload
  - Support for multiple file formats
  
- **Dashboard**
  - Overview of application statistics
  - Filter applications by status
  - Quick access to recent applications
  - Status indicators (Submitted, Under Review, Approved, etc.)
  
- **Real-time Notifications**
  - Instant alerts on application status changes
  - Officer comments and feedback
  - Notification center with read/unread status
  
- **Interactive Features**
  - Permit Map: View all applications geographically
  - Comments: Direct communication with officers
  - Certificate Download: Get official permits when approved
  - AI Chat Support: Get help with permit information

### For Council Officers
- **Review Queue Management**
  - View all submitted applications
  - Filter by status
  - Claim applications to manage workload
  
- **Application Review Workflow**
  - Approve, reject, or request corrections
  - Add internal notes (not visible to applicants)
  - Add public comments (visible to applicants)
  - Document review and approval
  
- **Communication Tools**
  - Direct comments on applications
  - Real-time notifications for updates
  - Track application history
  
- **Admin Dashboard**
  - Officer-specific metrics
  - Application queue overview

### For Administrators
- **User Management**
  - Create and manage users
  - Assign roles (Applicant, Officer, Admin)
  - User profile management
  
- **Permit Type Configuration**
  - Create permit types
  - Define required documents per type
  - Set document requirements (mime types, extensions)
  - Order and organize requirements

- **System Monitoring**
  - View all users and their applications
  - System-wide metrics

## 📋 Prerequisites

- **Node.js**: v18.17 or later
- **npm**: v9 or later
- **PostgreSQL**: v12 or later
- **Git**: for version control

### Optional
- **Ollama**: For local LLM support (for AI features)

## 🚀 Installation & Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd council
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/council"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# Email Configuration (Gmail SMTP example)
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"  # Use App Password for Gmail
EMAIL_FROM="noreply@council.gov"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Council Permit Portal"

# AI Services (Optional)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="tinyllama"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Database Setup

#### Create Database
```bash
createdb council
```

#### Run Migrations
```bash
npx prisma migrate deploy
```

#### Seed the Database (Optional)
```bash
npx prisma db seed
```

This creates sample permit types and test data.

### 5. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
council/
├── app/                           # Next.js App Router
│   ├── api/                       # API endpoints
│   │   ├── admin/                # Admin endpoints
│   │   ├── ai/                   # AI features (chat, recommend, summarize)
│   │   ├── applications/         # Application CRUD
│   │   ├── auth/                 # Authentication
│   │   ├── notifications/        # Notification endpoints
│   │   ├── officer/              # Officer features
│   │   ├── permit-types/         # Permit type management
│   │   └── profile/              # User profile
│   ├── applications/             # Application pages
│   ├── auth/                     # Authentication pages
│   ├── admin/                    # Admin dashboard
│   ├── dashboard/                # Main dashboard
│   ├── map/                      # Map visualization
│   ├── officer/                  # Officer interface
│   ├── profile/                  # User profile
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
│
├── components/                    # React components
│   ├── ui/                       # shadcn/ui components
│   ├── providers/                # Context providers
│   ├── map/                      # Map components
│   ├── ai-chat-support.tsx      # AI chat widget
│   ├── file-upload.tsx          # File upload component
│   ├── navigation-header.tsx    # Top navigation
│   ├── sidebar.tsx              # Side navigation
│   └── theme-toggle.tsx         # Dark mode toggle
│
├── lib/                          # Utilities & configs
│   ├── queries/                  # React Query hooks
│   ├── services/                 # API service layer
│   ├── types/                    # TypeScript types
│   ├── ai-scenarios.ts          # AI recommendation logic
│   ├── auth.ts                  # NextAuth configuration
│   ├── ollama.ts                # Ollama wrapper
│   ├── notifications.ts         # Notification utilities
│   ├── prisma.ts                # Prisma client
│   └── utils.ts                 # Helper functions
│
├── prisma/                        # Database
│   ├── schema.prisma            # Data model
│   ├── seed.ts                  # Database seeding
│   └── migrations/              # Database migrations
│
├── public/                        # Static assets
│   └── uploads/                 # User uploads
│
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind configuration
├── postcss.config.mjs          # PostCSS configuration
└── package.json                # Dependencies
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in with credentials
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get current session

### Applications
- `GET /api/applications` - List all applications
- `GET /api/applications/[id]` - Get specific application
- `POST /api/applications` - Create new application
- `PUT /api/applications/[id]` - Update application
- `POST /api/applications/[id]/submit` - Submit for review
- `POST /api/applications/[id]` - Update application status

### Documents
- `POST /api/applications/[id]/upload` - Upload document
- `DELETE /api/applications/[id]/documents/[docId]` - Delete document

### Comments
- `POST /api/applications/[id]/comments` - Add comment
- `GET /api/applications/[id]/comments` - Get comments

### Permits
- `GET /api/permit-types` - List permit types
- `POST /api/permit-types` - Create permit type (Admin)
- `DELETE /api/permit-types/[id]` - Delete permit type (Admin)

### Notifications
- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/[id]` - Mark as read

### AI Features
- `POST /api/ai/chat` - Chat with AI support
- `POST /api/ai/recommend-permit` - Get permit recommendations
- `POST /api/ai/summarize-application` - Summarize application

### Officer Features
- `GET /api/officer/applications` - Get applications assigned to officer
- `POST /api/officer/applications/[id]/assign` - Assign application

### Admin Features
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `DELETE /api/admin/users/[id]` - Delete user

## 💾 Database Schema

### Key Models

**User**
- Roles: APPLICANT, OFFICER, ADMIN
- Manages authentication and profile

**PermitApplication**
- Tracks application status (SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, REQUIRES_CORRECTION)
- Links to permit type, applicant, and assigned officer

**PermitType**
- Defines permit categories
- Has associated requirements

**Document**
- Uploaded files linked to requirements
- Has approval status

**Comment**
- Officer and applicant communication
- Can be internal (officer-only) or public

**Certificate**
- Generated when application is approved
- Includes QR code for verification
- Tracks download count

**Notification**
- Real-time updates for status changes
- Tracks read/unread status

## 🔐 Authentication & Authorization

### Session Strategy
- JWT-based authentication with NextAuth.js
- User roles determine access to features

### Role-Based Access Control

| Feature | Applicant | Officer | Admin |
|---------|-----------|---------|-------|
| Create Application | ✅ | ❌ | ❌ |
| View Own Applications | ✅ | ❌ | ✅ |
| View All Applications | ❌ | ✅ | ✅ |
| Review Applications | ❌ | ✅ | ❌ |
| Comment | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |
| Manage Permits | ❌ | ❌ | ✅ |

## 📊 Development Workflow

### Build
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Lint Code
```bash
npm run lint
```

### Database Commands
```bash
# Create migration
npx prisma migrate dev --name migration_name

# Studio (Database GUI)
npx prisma studio

# Reset database
npx prisma migrate reset
```

## 🐛 Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure database exists

### NextAuth Not Working
- Generate and set `NEXTAUTH_SECRET`
- Verify `NEXTAUTH_URL` matches your domain
- Check credentials provider configuration

### Email Not Sending
- Enable "Less secure app access" for Gmail or use App Password
- Verify SMTP credentials in `.env`
- Check email server logs

### AI Features Not Working
- For Ollama, verify it's running on correct port (default: 11434)
- Check that the model is available in Ollama
- Check LangChain configuration

## 🚢 Deployment

### Prerequisites
- Heroku, Vercel, or similar platform account
- PostgreSQL database (cloud or managed)
- Email service configured

### Environment Variables for Production
```env
DATABASE_URL=<production-database-url>
NEXTAUTH_SECRET=<strong-random-secret>
NEXTAUTH_URL=<your-production-domain>
EMAIL_SERVER_HOST=<smtp-host>
EMAIL_SERVER_PORT=<port>
EMAIL_SERVER_USER=<email>
EMAIL_SERVER_PASSWORD=<password>
EMAIL_FROM=<sender-email>
NEXT_PUBLIC_APP_URL=<production-domain>
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

### Deploy to Heroku
```bash
heroku login
heroku create your-app-name
git push heroku main
heroku run npx prisma migrate deploy
```

## 📝 Contributing

### Development Setup
1. Fork repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Make changes and commit: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit pull request

### Code Standards
- Use TypeScript strict mode
- Follow ESLint configuration
- Format code with Prettier
- Write meaningful commits

## 📜 License

This project is licensed under the MIT License - see LICENSE file for details.

## 👥 Support & Contact

For issues, questions, or suggestions:
- Create an issue in the repository
- Contact the development team
- Check existing documentation

## 🎉 Features Highlights

- ⚡ Built with latest Next.js 15 and React 19
- 🔐 Secure JWT-based authentication
- 📧 Email notifications
- 🗺️ Geographic mapping of applications
- 🤖 AI-powered recommendations and support
- 📱 Responsive design for mobile and desktop
- 🌓 Dark mode support
- ♿ Accessibility compliant
- 📊 Real-time updates with React Query
- 🎨 Modern UI with Tailwind CSS
