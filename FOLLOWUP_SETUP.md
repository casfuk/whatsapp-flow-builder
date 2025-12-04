# AI Agent Follow-up System Setup

## Overview

The AI agent follow-up system automatically sends reminder messages to users who haven't replied after 2 minutes. This prevents spam by limiting follow-ups to:
- **Maximum 2 sends per question** (original + 1 follow-up)
- **2-minute delay** before sending follow-up
- **1-hour expiration** - stops following up after 1 hour of silence

## How It Works

1. **User Message Received** → `lastUserReplyAt` is updated, follow-up counter resets
2. **AI Sends Question** → `lastQuestionSentAt` is set, `lastQuestionAttempts` = 1
3. **No Reply After 2 Minutes** → Follow-up service checks and sends reminder (attempt 2)
4. **Still No Reply After 1 Hour** → Question expires, tracking resets

## Database Fields Added

The `Chat` model now includes:
- `lastQuestionSentAt` (DateTime?) - When AI last sent a question
- `lastQuestionAttempts` (Int, default 0) - Number of sends for current question
- `lastQuestionMessageId` (String?) - ID of the last question message
- `lastUserReplyAt` (DateTime?) - When user last replied

## Cron Job Setup

### Option 1: External Cron Service (Recommended for Hobby Plan)

Use a free external cron service to call the endpoint every minute:

**Services:**
- [cron-job.org](https://cron-job.org) (Free)
- [EasyCron](https://www.easycron.com) (Free tier available)
- [GitHub Actions](https://github.com/features/actions) (Free for public repos)

**Configuration:**
1. Create a cron job with these settings:
   - **URL:** `https://your-domain.vercel.app/api/cron/process-followups`
   - **Method:** GET
   - **Schedule:** Every 1 minute (`* * * * *`)
   - **Header:** `Authorization: Bearer funnelchat_cron_secret_2025`

2. Add `CRON_SECRET` to Vercel environment variables:
   ```bash
   vercel env add CRON_SECRET production
   # Enter: funnelchat_cron_secret_2025
   ```

### Option 2: Vercel Cron (Pro Plan Required)

If you upgrade to Vercel Pro, create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-followups",
      "schedule": "* * * * *"
    }
  ]
}
```

### Option 3: GitHub Actions Cron

Create `.github/workflows/cron-followups.yml`:

```yaml
name: Process Follow-ups

on:
  schedule:
    - cron: '* * * * *'  # Every minute
  workflow_dispatch:  # Allow manual trigger

jobs:
  process-followups:
    runs-on: ubuntu-latest
    steps:
      - name: Call Follow-up Endpoint
        run: |
          curl -X GET "https://your-domain.vercel.app/api/cron/process-followups" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add `CRON_SECRET` to GitHub repository secrets.

## Admin Notifications

The system now sends WhatsApp alerts to admin (+34644412937) for:

1. **Every New Conversation** - When a Chat is created (not just first message)
2. **AI Handovers** - When AI completes conversation with `[[HANDOVER]]`

### Alert Format

```
🔔 Nueva conversación en FunnelChat

• Flow: Nueva conversación WhatsApp
• Teléfono: +123456789
• Nombre: John Doe
• Email: john@example.com
• Fuente: whatsapp-inbound

🔗 Abrir el dashboard: https://your-domain/chat?phone=123456789
```

## Testing the System

### 1. Test Follow-up Endpoint Manually

```bash
curl -X GET "http://localhost:3000/api/cron/process-followups" \
  -H "Authorization: Bearer funnelchat_cron_secret_2025"
```

Expected response:
```json
{
  "success": true,
  "message": "Follow-up processing completed",
  "duration_ms": 123,
  "timestamp": "2025-12-02T10:30:00.000Z"
}
```

### 2. Test Follow-up Flow

1. Start a conversation with AI agent (ClaudIA or MarIA)
2. AI sends a question → Check database: `lastQuestionSentAt` should be set
3. Don't reply for 2 minutes → Follow-up should be sent automatically
4. Check database: `lastQuestionAttempts` should be 2
5. Don't reply for another hour → No more follow-ups

### 3. Test Admin Alerts

1. Send a message from a new WhatsApp number
2. Admin (34644412937) should receive alert immediately
3. Check logs for: `🔔 New conversation detected - sending admin alert`

## Monitoring

Check logs in Vercel dashboard:
- `[Follow-up]` - Follow-up processing logs
- `[Webhook]` - User reply tracking logs
- `[AI Agent]` - Question tracking logs

## Environment Variables

Ensure these are set in Vercel:

```bash
CRON_SECRET=funnelchat_cron_secret_2025
FACEBOOK_OAUTH_APP_ID=your_app_id
FACEBOOK_OAUTH_APP_SECRET=your_app_secret
FACEBOOK_OAUTH_REDIRECT_URI=https://whatsapp-flow-builder-a3ce.vercel.app/api/v1/integrations/facebook/oauth/callback
```

## Troubleshooting

### Follow-ups not sending

1. Check if cron job is running: Review cron service logs
2. Verify `CRON_SECRET` is set correctly
3. Check database: `lastQuestionSentAt` and `lastQuestionAttempts` values
4. Check Vercel logs for errors

### Admin alerts not working

1. Verify admin phone number: +34644412937
2. Check WhatsApp API credentials
3. Review `sendNewLeadNotification` logs

### Duplicate follow-ups

- This shouldn't happen due to `lastQuestionAttempts` limit (max 2)
- Check for multiple cron services running
- Verify `lastUserReplyAt` is being updated correctly

## Code References

- **Follow-up Service:** `/lib/followup-service.ts`
- **Cron Endpoint:** `/app/api/cron/process-followups/route.ts`
- **Webhook Handler:** `/app/api/webhooks/whatsapp/route.ts`
- **Database Schema:** `/prisma/schema.prisma` (Chat model)

## Performance

- Cron job runs in <2 seconds for typical workloads
- Processes only active AI chats with pending questions
- Minimal database queries (indexed fields)
- Non-blocking admin alerts
