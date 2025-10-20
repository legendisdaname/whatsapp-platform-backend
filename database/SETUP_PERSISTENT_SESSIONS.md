# Setup Persistent WhatsApp Sessions

## Quick Setup (5 Minutes)

### Step 1: Update Database Schema

Go to your Supabase project dashboard → SQL Editor and run these migrations:

#### Migration 1: Add Session Tracking Columns (Required)

```sql
-- Add tracking columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_connected_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_last_connected ON sessions(last_connected_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);

-- Set initial values for existing records
UPDATE sessions 
SET last_connected_at = updated_at 
WHERE status = 'connected' AND last_connected_at IS NULL;
```

#### Migration 2: Add Auth Backup Table (Optional)

Only run this if you want auth data backup tracking:

```sql
CREATE TABLE IF NOT EXISTS session_auth_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE UNIQUE,
    auth_exists BOOLEAN DEFAULT FALSE,
    auth_size_bytes BIGINT,
    last_backup_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_backups_session ON session_auth_backups(session_id);
CREATE INDEX IF NOT EXISTS idx_auth_backups_last_backup ON session_auth_backups(last_backup_at);

ALTER TABLE session_auth_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on session_auth_backups" ON session_auth_backups
    FOR ALL USING (true) WITH CHECK (true);
```

### Step 2: Update Environment Variables (Optional)

Add to your `.env` file if you want auth backup:

```env
# Optional: Enable auth data backup tracking
ENABLE_AUTH_BACKUP=true
```

### Step 3: Restart Your Backend

```bash
cd backend
npm install
node src/server.js
```

### Step 4: Verify Setup

Watch for these messages in the console:

```
✅ Created auth data directory: /path/to/.wwebjs_auth
🔄 Restoring previous sessions...
Found X session(s) with saved authentication
📱 Restoring: Session Name (phone number)
✅ Session restoration initiated
💓 Keepalive started for session
```

## Testing Persistence

### Test 1: Server Restart
1. Start backend with existing sessions
2. Stop the backend (Ctrl+C)
3. Start backend again
4. **Expected**: Sessions should reconnect WITHOUT QR code

### Test 2: Check Keepalive
```sql
-- Run this query every minute
SELECT 
    session_name,
    phone_number,
    status,
    last_seen,
    EXTRACT(EPOCH FROM (NOW() - last_seen)) as seconds_ago
FROM sessions
WHERE status = 'connected'
ORDER BY last_seen DESC;
```

**Expected**: `seconds_ago` should be < 60 (updates every 30 seconds)

### Test 3: Health Check
Wait 5 minutes after startup, then check console logs:

**Expected**: 
```
🔍 Running session health check...
Checking 2 session(s)...
✅ Session My Business is healthy
```

## Troubleshooting

### ❌ Sessions require QR code after restart

**Check 1**: Auth data exists
```bash
ls -la .wwebjs_auth/
# Should show session folders
```

**Check 2**: Database has new columns
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
AND column_name IN ('last_connected_at', 'last_seen');
```

**Check 3**: Server logs show restoration
Look for: `🔄 Restoring previous sessions...`

### ❌ Keepalive not working

Check `last_seen` timestamp:
```sql
SELECT session_name, last_seen, NOW() - last_seen as time_since
FROM sessions 
WHERE status = 'connected';
```

If `time_since` > 5 minutes, check:
- Backend is running
- No errors in console
- Session is actually connected

### ❌ Health check not running

Check console for:
```
✅ Session health check started (every 5 minutes)
```

If missing, ensure:
- Server started completely
- No startup errors
- Waited at least 10 seconds after start

## Success Indicators

✅ **Immediate** (after first connection):
- QR code scanned successfully
- Session status = 'connected'
- `last_connected_at` timestamp set
- Keepalive messages in console
- Auth folder created: `.wwebjs_auth/session-{id}/`

✅ **Short-term** (first few minutes):
- `last_seen` updates every ~30 seconds
- Health check logs appear every 5 minutes
- No disconnection messages

✅ **Long-term** (hours/days):
- Server restarts without QR codes
- Sessions remain connected 24/7
- Automatic reconnection on temporary issues
- No manual intervention needed

## Maintenance

### Weekly Check
```sql
-- Find sessions that haven't been seen recently
SELECT 
    session_name,
    phone_number,
    status,
    last_seen,
    NOW() - last_seen as offline_duration
FROM sessions
WHERE last_seen < NOW() - INTERVAL '1 hour'
ORDER BY last_seen DESC;
```

### Monthly Backup
```bash
# Backup auth data
tar -czf auth-backup-$(date +%Y%m%d).tar.gz .wwebjs_auth/

# Store safely
mv auth-backup-*.tar.gz /path/to/safe/storage/
```

## Need Help?

Check the comprehensive guide: `WHATSAPP_PERSISTENT_CONNECTION_GUIDE.md`

## What Changed?

### Code Changes:
✅ Enhanced `whatsappService.js` with:
- Persistent auth data storage
- Improved session restoration (all sessions, not just 'connected')
- Keepalive mechanism (30-second pings)
- Better reconnection logic

✅ Enhanced `sessionHealthCheck.js`:
- Already good! No changes needed

✅ Added `authBackupService.js`:
- Optional backup tracking
- Auth verification utilities

### Database Changes:
✅ Added columns to `sessions` table:
- `last_connected_at`: Last successful connection
- `last_seen`: Last keepalive ping

✅ Added optional `session_auth_backups` table:
- Tracks auth data existence
- Helps with disaster recovery

### New Files:
- `WHATSAPP_PERSISTENT_CONNECTION_GUIDE.md`: Comprehensive guide
- `backend/src/services/authBackupService.js`: Backup utilities
- `backend/database/migrations/`: Database migration scripts
- This setup guide

## Ready to Deploy?

1. ✅ Run database migrations
2. ✅ Restart backend server  
3. ✅ Test with existing session
4. ✅ Monitor for 24 hours
5. ✅ Enjoy persistent connections! 🎉

