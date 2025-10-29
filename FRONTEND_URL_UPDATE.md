# 🌐 Frontend URL Configuration

## 📍 Your Frontend URL

**Production Frontend**: `https://whatsapp.streamfinitytv.com/`

---

## 🔧 Where to Configure

### **1. Backend Environment Variables (Render)**

Update in Render Dashboard:

1. Go to: https://dashboard.render.com
2. Select: `whatsapp-platform-backend`
3. Click: **"Environment"** tab
4. Add/Update:

```
FRONTEND_URL=https://whatsapp.streamfinitytv.com
```

**Note**: No trailing slash needed, but it works with or without.

5. Click **"Save Changes"**
6. Backend will automatically redeploy

---

### **2. What This Updates**

✅ **CORS Configuration**: Allows requests from your frontend  
✅ **Google OAuth Redirect**: Sets correct redirect URI  
✅ **API Access**: Enables frontend to communicate with backend  

---

## 🔗 Google OAuth Redirect URI

After updating `FRONTEND_URL`, your Google OAuth redirect URI will be:
```
https://whatsapp.streamfinitytv.com/auth/google/callback
```

**Make sure this is added in Google Cloud Console!**

1. Go to: https://console.cloud.google.com
2. Select your project
3. Go to **APIs & Services** > **Credentials**
4. Click your OAuth 2.0 Client ID
5. Add authorized redirect URI: `https://whatsapp.streamfinitytv.com/auth/google/callback`
6. Save

---

## ✅ Checklist

- [ ] Backend `FRONTEND_URL` updated in Render
- [ ] Google Cloud Console redirect URI added
- [ ] CORS working (test login)
- [ ] Google OAuth working (test Google login)

---

**After updating, your frontend at https://whatsapp.streamfinitytv.com/ will be fully connected! 🎉**

