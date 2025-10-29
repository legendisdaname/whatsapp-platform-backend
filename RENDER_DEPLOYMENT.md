# 🚀 Render Deployment Guide - Backend

## 📋 **Prerequisites**

1. **Render Account**: Sign up at https://render.com
2. **GitHub Repository**: Backend code pushed to GitHub
3. **Supabase Project**: Database credentials ready
4. **Google OAuth**: Credentials (optional, for Google login)

## 🔧 **Step 1: Create New Web Service**

1. Go to: https://dashboard.render.com
2. Click **"New +"** > **"Web Service"**
3. Connect your GitHub repository
4. Select the repository containing your backend code
5. Fill in the details:
   - **Name**: `whatsapp-platform-backend` (or your preferred name)
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `backend` (if backend is in a subfolder)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free` (or paid if you need more resources)

## 🔐 **Step 2: Environment Variables**

Click **"Environment"** tab and add these variables:

### **Required Variables**

```bash
# Node Environment
NODE_ENV=production

# Server Port (Render sets this automatically, but include for clarity)
PORT=10000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT Secret (use a strong random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

### **Optional but Recommended**

```bash
# Frontend URL (for CORS and OAuth redirects)
FRONTEND_URL=https://whatsapp-platform-frontends.vercel.app

# Admin Panel URL (optional)
ADMIN_URL=https://admin.yourdomain.com

# Backend URL (for keep-alive service)
BACKEND_URL=https://whatsapp-platform-backend.onrender.com

# Google OAuth (for Google login feature)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### **How to Get Supabase Credentials**

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** > **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Important**: Keep `SUPABASE_SERVICE_ROLE_KEY` secret! It bypasses Row Level Security.

### **How to Generate JWT_SECRET**

```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 2: OpenSSL
openssl rand -hex 64

# Option 3: Online Generator
# Visit: https://randomkeygen.com/
```

Copy a 64+ character random string.

## 🎯 **Step 3: Deploy**

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Run `npm install`
   - Start your server with `npm start`
3. Wait 2-5 minutes for deployment
4. Check **"Logs"** tab for deployment progress

## ✅ **Step 4: Verify Deployment**

### **Test Health Endpoint**

```bash
curl https://your-service-name.onrender.com/health
```

Should return:
```json
{
  "success": true,
  "message": "WhatsApp Platform API is running",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### **Check Logs**

1. Go to Render Dashboard
2. Click your service
3. Click **"Logs"** tab
4. Look for:
   - ✅ `🚀 WhatsApp Platform API Starting...`
   - ✅ `✅ All required environment variables are set`
   - ✅ `🔔 Starting keep-alive service...`
   - ✅ `✅ Server is ready and running!`

### **Test API**

```bash
# Get root endpoint
curl https://your-service-name.onrender.com/

# Should return API information
```

## 🔔 **Step 5: Keep-Alive Service**

The backend includes a built-in keep-alive service that pings itself every 14 minutes to prevent Render free tier from sleeping.

**Verify it's running:**
- Check logs for: `✅ Keep-alive service started`
- Every 14 minutes: `✅ Keep-alive ping successful`

**If keep-alive isn't working:**
1. Set `BACKEND_URL` environment variable to your Render URL
2. Restart the service
3. Check logs after 14 minutes

## 🐛 **Troubleshooting**

### **Issue: "Missing required environment variables"**

**Solution**:
1. Go to Render Dashboard > Environment tab
2. Verify all required variables are set
3. Check for typos (no spaces, correct case)
4. Restart service after adding variables

### **Issue: "Failed to restore sessions"**

**Cause**: Database not configured or sessions table missing

**Solution**:
1. Verify Supabase credentials are correct
2. Run database migrations (see `database/schema.sql`)
3. Check Supabase logs for errors

### **Issue: "CORS Error"**

**Cause**: Frontend URL not in allowed origins

**Solution**:
1. Set `FRONTEND_URL` environment variable
2. Make sure it matches your frontend domain exactly
3. Restart backend service

### **Issue: "Service sleeping"**

**Cause**: Free tier spun down due to inactivity

**Solution**:
1. Wait 30-60 seconds for wake-up
2. Verify keep-alive service is running
3. Check logs for keep-alive pings
4. Consider upgrading to paid plan for 24/7 uptime

### **Issue: "Port already in use"**

**Cause**: Render sets PORT automatically

**Solution**:
- Don't hardcode PORT in code
- Use `process.env.PORT || 5000` (already done)

### **Issue: "Build failed"**

**Cause**: Dependencies not installing

**Solution**:
1. Check `package.json` exists
2. Verify `engines.node` is set (>=16.0.0)
3. Check logs for specific npm errors
4. Try clearing build cache in Render

### **Issue: "Module not found"**

**Cause**: Missing dependency

**Solution**:
1. Add missing package to `package.json`
2. Commit and push to GitHub
3. Render will auto-redeploy

## 📊 **Monitoring**

### **Check Service Status**

- **Active**: Service is running
- **Sleeping**: Free tier spun down (will wake on request)
- **Deploying**: Build in progress
- **Failed**: Deployment error (check logs)

### **View Logs**

1. Render Dashboard > Your Service
2. Click **"Logs"** tab
3. Filter by:
   - All logs
   - Build logs
   - Runtime logs

### **Set Up Alerts**

1. Go to **Settings** > **Notifications**
2. Enable email alerts for:
   - Deployment failures
   - Service crashes
   - Build errors

## 🔒 **Security Best Practices**

1. ✅ **Never commit `.env` files** to GitHub
2. ✅ **Use strong JWT_SECRET** (64+ characters)
3. ✅ **Rotate secrets regularly**
4. ✅ **Enable HTTPS** (automatic on Render)
5. ✅ **Set up CORS** properly (already configured)
6. ✅ **Monitor logs** for suspicious activity
7. ✅ **Keep dependencies updated**

## 📝 **Environment Variables Checklist**

Before deploying, ensure you have:

- [ ] `NODE_ENV=production`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `JWT_SECRET`
- [ ] `FRONTEND_URL` (for CORS and OAuth)
- [ ] `BACKEND_URL` (for keep-alive, optional)
- [ ] `GOOGLE_CLIENT_ID` (for Google login, optional)
- [ ] `GOOGLE_CLIENT_SECRET` (for Google login, optional)

## 🎉 **Deployment Complete!**

Once deployed:
1. ✅ Backend URL: `https://your-service-name.onrender.com`
2. ✅ Health check: `/health`
3. ✅ API docs: `/api-docs`
4. ✅ Keep-alive: Running automatically

## 🔄 **Updating Deployment**

Render auto-deploys on Git push:
1. Make changes to code
2. Commit and push to GitHub
3. Render detects changes
4. Auto-builds and deploys (2-5 minutes)

To manually deploy:
1. Render Dashboard > Your Service
2. Click **"Manual Deploy"**
3. Select branch/commit
4. Click **"Deploy"**

## 📞 **Support**

- **Render Docs**: https://render.com/docs
- **Render Support**: support@render.com
- **Your Logs**: Check Render Dashboard > Logs tab

---

**Your backend is now ready for production! 🚀**

