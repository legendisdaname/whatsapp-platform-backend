# 🔐 Google OAuth Setup

## 📍 Where to Add Google Credentials

You need to add your Google OAuth credentials in **2 places**:

### **1. Local Development (`.env` file)**

Create a `.env` file in the `backend` folder with:

```bash
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

**Location**: `backend/.env`

**Note**: Never commit `.env` file to Git! It's already in `.gitignore`.

---

### **2. Production (Render Dashboard)**

1. Go to: https://dashboard.render.com
2. Select your backend service: **whatsapp-platform-backend**
3. Click **"Environment"** tab
4. Add or update these variables:

```
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

5. Click **"Save Changes"**
6. Render will automatically redeploy with new environment variables

---

## ✅ Verification

After setting up credentials:

1. **Local**: Restart your backend server (`npm start`)
2. **Production**: Wait for Render to redeploy (check Logs tab)
3. Test Google login on your frontend

---

## 🔗 Google OAuth Redirect URIs

Make sure these are configured in your Google Cloud Console:

- **Local**: `http://localhost:3000/auth/google/callback`
- **Production**: `https://your-frontend-url.vercel.app/auth/google/callback`

---

## 📝 Environment Variables Used

The backend uses these environment variables:

- `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret
- `FRONTEND_URL` - Your frontend URL (for redirect URI)

---

**Your credentials are now set! 🎉**

