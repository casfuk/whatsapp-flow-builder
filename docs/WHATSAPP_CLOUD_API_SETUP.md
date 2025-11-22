# WhatsApp Cloud API Setup & Test Checklist

## Environment Variables
Add to `.env` (local) and Vercel (production):
```
WHATSAPP_CLOUD_API_TOKEN=your_permanent_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WEBHOOK_VERIFY_TOKEN=your_secret_token
```

## Meta Cloud API Configuration
1. Go to https://developers.facebook.com/apps
2. Select your app → WhatsApp → Configuration
3. Set webhook URL: `https://yourapp.vercel.app/api/webhooks/whatsapp`
4. Set verify token: same as `WEBHOOK_VERIFY_TOKEN` or `WHATSAPP_VERIFY_TOKEN`
5. Subscribe to webhook fields: `messages`

**Important:** The webhook URL must be `/api/webhooks/whatsapp` (with an 's') for full flow execution support.

## Test Checklist

### 1. Webhook Verification
```bash
curl "https://yourapp.vercel.app/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=your_secret_token&hub.challenge=test123"
# Should return: test123
```

### 2. Send Text Message (API)
```bash
curl -X POST https://yourapp.vercel.app/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "34644412937",
    "message": "Hello from API"
  }'
```

### 3. Test Auto-Reply
- Send "hola" to your WhatsApp Business number
- Should receive: "¡Hola! Esta es una respuesta automática de pruebas."

### 4. Send Template Message
```bash
node -e "
const fetch = require('node-fetch');
(async () => {
  const res = await fetch('http://localhost:3000/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: '34644412937',
      template: 'hello_world',
      language: 'en'
    })
  });
  console.log(await res.json());
})();
"
```

### 5. Check Logs
- Vercel logs: `vercel logs --follow`
- Local: check console for incoming webhook events

## Common Issues
- **Webhook not receiving**: Check subscription in Meta dashboard
- **Send failing**: Verify `WHATSAPP_CLOUD_API_TOKEN` is permanent token
- **Template not working**: Template must be approved in Meta Business Manager
