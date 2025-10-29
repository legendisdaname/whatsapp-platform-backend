# ⚡ Quick Google OAuth Setup

## ✅ Your Credentials

Add these in your `.env` file and Render dashboard:

```
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

**Important**: Replace `your-google-client-id-here` and `your-google-client-secret-here` with your actual credentials!

---

## 🚀 Where to Add Them

### **Option 1: Local Development** ✅ (Already Done!)

I've created `backend/.env` file for you with your credentials.

**Just restart your backend server:**
```bash
cd backend
npm start
```

---

### **Option 2: Production (Render)** 📍

1. **Go to**: https://dashboard.render.com
2. **Click** your backend service: `whatsapp-platform-backend`
3. **Click** "Environment" tab (left sidebar)
4. **Add/Update** these variables:

   ```
   GOOGLE_CLIENT_ID = your-google-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET = your-google-client-secret-here
   ```

5. **Click** "Save Changes"
6. **Wait** for automatic redeploy (~30 seconds)

---

## ✅ Done!

After updating:
- **Local**: Restart server ✅
- **Production**: Wait for redeploy ✅
- **Test**: Try Google login button! 🎉

---

## 📋 Checklist

- [x] Local `.env` file created
- [ ] Production Render environment variables updated
- [ ] Redirect URI configured in Google Cloud Console
- [ ] Tested Google login

---

**Need help?** Check `GOOGLE_OAUTH_SETUP.md` for detailed instructions.

