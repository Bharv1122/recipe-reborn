# Recipe Reborn 🍳

Transform processed food ingredients into fresh, healthy recipes with the power of AI.

## 🌟 Features

- **User Authentication**: Secure login and signup with JWT tokens
- **Cloud Database**: Upstash Redis for reliable data storage
- **Modern Stack**: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Production Ready**: Optimized for Vercel deployment

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Upstash Redis account (free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Bharv1122/recipe-reborn.git
   cd recipe-reborn
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your credentials:
   - Get Redis credentials from [Upstash Console](https://console.upstash.com/redis)
   - Generate a JWT secret: `openssl rand -base64 32`

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
recipe-reborn/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/auth/        # Authentication API routes
│   │   ├── login/           # Login page
│   │   ├── signup/          # Signup page
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home page
│   │   └── globals.css      # Global styles
│   ├── components/          # React components
│   │   ├── Header.tsx       # Navigation header
│   │   ├── HeroSection.tsx  # Landing hero
│   │   └── HeroLogo.tsx     # Logo component
│   └── lib/                 # Utilities
│       ├── auth.ts          # JWT authentication
│       └── db.ts            # Database operations
├── public/                  # Static assets
│   └── logo.png             # App logo
├── data/                    # Local data (development)
│   └── users.json           # Sample users
├── .env.example             # Environment template
├── next.config.ts           # Next.js configuration
├── tsconfig.json            # TypeScript config
├── tailwind.config.js       # Tailwind CSS config
└── package.json             # Dependencies
```

## 🔐 Authentication Flow

1. **Signup**: Creates user with hashed password in Redis
2. **Login**: Validates credentials, issues JWT token
3. **Session**: HTTP-only cookie stores JWT (7-day expiry)
4. **Logout**: Clears authentication cookie

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|----------|
| Next.js | 16.1.4 | React framework |
| React | 19.2.3 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| Upstash Redis | 1.36.1 | Database |
| bcryptjs | 3.0.3 | Password hashing |
| jose | 6.1.3 | JWT handling |

## 🚀 Deployment (Vercel)

1. **Connect to Vercel**
   - Import your GitHub repository
   - Framework preset: Next.js

2. **Configure Environment Variables**
   ```
   JWT_SECRET=your-production-secret
   UPSTASH_REDIS_REST_URL=your-redis-url
   UPSTASH_REDIS_REST_TOKEN=your-redis-token
   ```

3. **Deploy**
   - Automatic deployments on every push to main

## 📝 API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create new user |
| `/api/auth/login` | POST | Authenticate user |

### Signup Request
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

### Login Request
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

## 🧪 Test Account

For development (when using in-memory storage):
```
Email: test@test.com
Password: (check data/users.json - password is hashed)
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

**Recipe Reborn** - Cook healthier, live better! 🥗
