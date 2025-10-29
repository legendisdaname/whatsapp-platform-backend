# Phone Number Formatting Guide

## Overview
All phone numbers are automatically normalized before sending WhatsApp messages. The normalization handles:
- Leading zeros after country codes (e.g., `+212 0655-927999` → `212655927999`)
- Various international formats with spaces, dashes, parentheses
- Automatic `@c.us` suffix addition
- Support for all countries worldwide

## Where Messages Are Sent

### ✅ Already Using Normalization

1. **Direct Message Sending** (`/api/messages/send`)
   - **Route**: `backend/src/routes/messageRoutes.js`
   - **Service**: `whatsappService.sendMessage()`
   - **Status**: ✅ Uses normalization

2. **Automated Bots**
   - **Route**: `backend/src/routes/botRoutes.js`
   - **Service**: `botService.executeBotTask()` → `whatsappService.sendMessage()`
   - **Status**: ✅ Uses normalization

3. **WooCommerce Order Notifications**
   - **Routes**: `backend/src/routes/woocommerceRoutes.js`
     - `/api/woocommerce/order-created`
     - `/api/woocommerce/order-status-changed`
   - **Service**: `whatsappService.sendMessage()`
   - **Status**: ✅ Updated to use normalization (passes original phone number)

4. **Frontend Messages Page**
   - **File**: `frontend/src/pages/Messages.js`
   - **API**: `messageAPI.send()` → `/api/messages/send`
   - **Status**: ✅ Uses normalization

## Phone Number Formats Supported

All these formats will work automatically:

```
✅ +212 665-927999
✅ +212 0655-927999 (leading zero removed automatically)
✅ 212665927999
✅ 212 665-927999
✅ +1 (555) 123-4567
✅ +44 20 7946 0958
✅ 212665927999@c.us (already formatted)
✅ Any format with spaces, dashes, parentheses, etc.
```

## Normalization Function

Located in: `backend/src/services/whatsappService.js`

The `normalizePhoneNumber()` function:
1. Extracts all digits
2. Detects and removes leading zeros after country codes (1-3 digits)
3. Validates length (7-15 digits)
4. Returns normalized digits ready for `@c.us` suffix

## Important Notes

⚠️ **DO NOT** manually format phone numbers before calling `whatsappService.sendMessage()`:
- ❌ Bad: `phone.replace(/[^0-9]/g, '')` before calling sendMessage
- ✅ Good: Pass original phone number, let sendMessage normalize it

All formatting happens automatically in `whatsappService.sendMessage()`.

## Testing

To test phone number formatting:

```bash
# Test with various formats
curl -X POST http://localhost:5000/api/messages/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sessionId": "your-session-id",
    "to": "+212 0655-927999",
    "message": "Test message"
  }'
```

Check backend logs for normalization details:
```
[sendMessage] Original phone number: "+212 0655-927999"
[normalizePhoneNumber] Removed leading zero: 2120655927999 -> 212655927999
[sendMessage] Normalized and auto-added @c.us, formatted: 212655927999@c.us
[sendMessage] Final formatted number: +212 0655-927999 -> 212655927999@c.us
```

