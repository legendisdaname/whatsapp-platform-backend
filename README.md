# WhatsApp Platform Backend

Backend API for WhatsApp Platform built with Express.js, whatsapp-web.js, and Supabase.

## 🚀 Quick Start

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Environment Variables**:
   Create a `.env` file:
   ```bash
   NODE_ENV=development
   PORT=5000
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   JWT_SECRET=your-jwt-secret-min-32-chars
   FRONTEND_URL=http://localhost:3000
   ```

3. **Start Server**:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. **Verify**:
   ```bash
   curl http://localhost:5000/health
   ```

### Production Deployment (Render)

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for complete deployment guide.

## 📋 Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGc...` |
| `JWT_SECRET` | Secret for JWT tokens | `your-secret-key` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `5000` |
| `SUPABASE_ANON_KEY` | Supabase anon key | - |
| `FRONTEND_URL` | Frontend URL (for CORS) | `http://localhost:3000` |
| `ADMIN_URL` | Admin panel URL (for CORS) | - |
| `BACKEND_URL` | Backend URL (for keep-alive) | Auto-detected |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - |

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── supabase.js  # Supabase client setup
│   │   └── swagger.js    # Swagger/OpenAPI docs
│   ├── middleware/      # Express middleware
│   │   ├── auth.js      # JWT authentication
│   │   └── adminAuth.js # Admin authentication
│   ├── routes/          # API routes
│   │   ├── authRoutes.js
│   │   ├── sessionRoutes.js
│   │   ├── messageRoutes.js
│   │   └── ...
│   ├── services/        # Business logic
│   │   ├── whatsappService.js
│   │   ├── botService.js
│   │   └── keepAlive.js
│   └── server.js        # Main server file
├── database/            # Database schemas
│   └── schema.sql
├── render.yaml          # Render deployment config
└── package.json
```

## 🔌 API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/google` - Initiate Google OAuth
- `POST /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Sessions
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `DELETE /api/sessions/:id` - Delete session

### Messages
- `POST /api/messages/send` - Send message
- `GET /api/messages/history/:sessionId` - Get message history

### Bots
- `GET /api/bots` - List all bots
- `POST /api/bots` - Create bot
- `PUT /api/bots/:id` - Update bot
- `DELETE /api/bots/:id` - Delete bot

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Add contact
- `PUT /api/contacts/:id` - Update contact

### WooCommerce
- `GET /api/woocommerce/settings` - Get settings
- `POST /api/woocommerce/settings` - Save settings
- `POST /api/woocommerce/webhook` - Webhook endpoint

### Admin
- `POST /api/admin/auth/login` - Admin login
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id/block` - Block user
- `GET /api/admin/analytics` - Get analytics

See `/api-docs` for complete Swagger documentation.

## 🔒 Security Features

- ✅ JWT authentication
- ✅ CORS protection
- ✅ Environment variable validation
- ✅ Production error hiding
- ✅ Admin authentication
- ✅ User blocking system
- ✅ API key authentication

## 🔔 Keep-Alive Service

Prevents Render free tier from sleeping by pinging `/health` every 14 minutes.

- **Auto-starts** in production mode
- **Disabled** in development
- **Configurable** via `BACKEND_URL` environment variable

## 📊 Database

Uses Supabase (PostgreSQL) for data storage.

### Required Tables
- `users` - User accounts
- `sessions` - WhatsApp sessions
- `messages` - Message history
- `bots` - Automated bots
- `contacts` - Contact list
- `woocommerce_settings` - WooCommerce configuration
- `admins` - Admin accounts (optional)

See `database/schema.sql` for schema definitions.

## 🐛 Troubleshooting

### Server won't start
- Check environment variables are set
- Verify Supabase credentials
- Check port is available

### CORS errors
- Set `FRONTEND_URL` environment variable
- Verify frontend domain matches exactly

### Sessions not restoring
- Check database connection
- Verify sessions table exists
- Check Supabase logs

### Keep-alive not working
- Set `NODE_ENV=production`
- Set `BACKEND_URL` to your Render URL
- Check logs for errors

## 📚 Documentation

- [Render Deployment Guide](./RENDER_DEPLOYMENT.md)
- [Keep-Alive Guide](../KEEP_ALIVE_GUIDE.md)
- [API Documentation](./src/config/swagger.js)

## 📝 License

ISC
