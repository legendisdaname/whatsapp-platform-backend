# WhatsApp Platform - Backend

Backend API server for WhatsApp Platform built with Express.js, whatsapp-web.js, and Supabase.

## 🚀 Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NODE_ENV=development
```

3. Set up database:
- Go to your Supabase project
- Run the SQL from `database/schema.sql` in SQL Editor

4. Start the server:
```bash
npm run dev
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── supabase.js       # Supabase client configuration
│   │   └── swagger.js         # Swagger/OpenAPI configuration
│   ├── services/
│   │   ├── whatsappService.js # WhatsApp session management
│   │   └── botService.js      # Bot automation logic
│   ├── routes/
│   │   ├── sessionRoutes.js   # Session API endpoints
│   │   ├── messageRoutes.js   # Message API endpoints
│   │   └── botRoutes.js       # Bot API endpoints
│   └── server.js              # Main server file
├── database/
│   └── schema.sql             # Database schema
├── package.json
└── .env.example
```

## 🔌 API Documentation

Once the server is running, visit:
- **Swagger UI**: `/api-docs` (Production: https://whatapi.streamfinitytv.com/api-docs)
- **API Root**: `/` (Production: https://whatapi.streamfinitytv.com)

## 🛠️ Technologies

- **Express.js**: Web framework
- **whatsapp-web.js**: WhatsApp Web API
- **Supabase**: Database and authentication
- **Swagger**: API documentation
- **node-cron**: Task scheduling
- **QRCode**: QR code generation

## 📝 Environment Variables

| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 5000) |
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_ANON_KEY | Supabase anonymous key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key (admin) |
| FRONTEND_URL | Frontend URL for OAuth redirects (default: https://whatsapp.streamfinitytv.com) |
| GOOGLE_CLIENT_ID | Google OAuth Client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret |
| API_URL | Backend API URL for Swagger/docs (default: https://whatapi.streamfinitytv.com) |
| NODE_ENV | Environment (development/production) |

## 🔄 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

## 📊 Database Tables

- **sessions**: WhatsApp session data
- **messages**: Sent messages
- **received_messages**: Received messages
- **bots**: Bot configurations
- **bot_executions**: Bot execution logs

## 🤖 Bot Service

The bot service supports:
- Scheduled message sending (cron patterns)
- Multiple target recipients
- Dynamic message templates
- Manual triggering
- Execution logging

### Cron Pattern Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

## 🔐 Security

- Use service role key only server-side
- Enable RLS (Row Level Security) in Supabase for production
- Validate all inputs
- Rate limit API endpoints in production
- Never expose .env files

## 🐛 Debugging

Enable debug logs:
```bash
DEBUG=* npm run dev
```

Check logs for:
- WhatsApp connection status
- Message sending errors
- Bot execution results
- Database queries

## 📦 Production Deployment

1. Set `NODE_ENV=production`
2. Use process manager (PM2):
```bash
npm install -g pm2
pm2 start src/server.js --name whatsapp-api
```

3. Configure reverse proxy (nginx/Apache)
4. Set up SSL certificate
5. Configure persistent storage for `.wwebjs_auth/`

## ⚠️ Important Notes

- WhatsApp session data is stored in `.wwebjs_auth/`
- Keep this directory persistent across deployments
- One WhatsApp number = one session
- WhatsApp may ban for spam/automation abuse
- Always follow WhatsApp Terms of Service

