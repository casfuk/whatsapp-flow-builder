# AI Agent Setup Guide

## Overview

The AI Agent feature allows WhatsApp flows to automatically respond to users using OpenAI's GPT models. This guide explains how to set up and test the AI Agent functionality.

## Required Environment Variable

### `OPENAI_API_KEY`

The AI Agent requires an OpenAI API key to function.

**How to get an API key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (it starts with `sk-...`)

## Setup Instructions

### Local Development

1. Create or edit `.env.local` in the project root:
   ```bash
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

2. Restart your development server:
   ```bash
   npm run dev
   ```

### Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-your-actual-key-here`
   - **Environment**: Production (and optionally Preview/Development)
4. Click **Save**
5. Redeploy your project for changes to take effect

## Code Location

### Main AI Agent Handler
- **File**: `/app/api/ai-agent/route.ts`
- **Purpose**: Processes incoming messages and generates AI responses using OpenAI
- **Key features**:
  - Validates API key before making requests
  - Loads conversation history from database
  - Builds comprehensive system prompts with language, tone, and goal
  - Handles turn limits (max exchanges)
  - Returns fallback messages on errors

### Integration Points
The AI Agent is triggered from:
1. **WhatsApp Webhook** (`/app/api/webhooks/whatsapp/route.ts`)
   - Auto-responses for chats assigned to AI agents
2. **Third-Party Webhook** (`/app/api/v1/integrations/[triggerId]/webhook/route.ts`)
   - Initial greeting when flow assigns to AI agent
3. **Runtime Engine** (`/lib/runtime-engine.ts`)
   - Updates Chat record with AI agent assignment

## Testing

### Test Locally

1. Ensure `OPENAI_API_KEY` is set in `.env.local`
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Check the console for:
   ```
   [AI Agent] ✓ OPENAI_API_KEY found, initializing OpenAI client...
   ```
4. Trigger an AI agent in your flow (via WhatsApp or test webhook)
5. Check logs for:
   ```
   [AI Agent] Incoming message: "..."
   [AI Agent] ✅ OpenAI reply received (X chars)
   [AI Agent] OpenAI reply: "..."
   ```

### Test in Production (Vercel)

1. Add `OPENAI_API_KEY` to Vercel environment variables (see above)
2. Deploy your application
3. Send a message to WhatsApp that triggers the AI agent
4. Check Vercel logs (Runtime Logs) for:
   ```
   [AI Agent] ✓ OPENAI_API_KEY found, initializing OpenAI client...
   [AI Agent] Incoming message: "..."
   [AI Agent] OpenAI reply: "..."
   ```
5. User should receive the AI response in WhatsApp

### Expected Behavior

**When API key is set correctly:**
- ✅ User receives AI-generated responses
- ✅ Logs show: `[AI Agent] ✓ OPENAI_API_KEY found, initializing OpenAI client...`
- ✅ Logs show: `[AI Agent] OpenAI reply: "..."`

**When API key is missing:**
- ⚠️ User receives fallback message: "Ahora mismo no puedo pensar 😅 Vuelve a intentarlo en unos minutos."
- ⚠️ Logs show: `[AI Agent] ❌ ERROR: OPENAI_API_KEY is not set in environment`
- ⚠️ No system crash - graceful degradation

**When OpenAI API fails:**
- ⚠️ User receives fallback message
- ⚠️ Logs show: `[AI Agent] ❌ OpenAI API error: ...`
- ⚠️ Logs show: `[AI Agent] Using fallback reply due to OpenAI error`

## Troubleshooting

### "Missing credentials" Error

**Symptom**: Logs show `Missing credentials. Please pass an apiKey, or set the OPENAI_API_KEY environment variable`

**Solution**:
1. Verify `OPENAI_API_KEY` is set in environment variables
2. For Vercel: Redeploy after adding the environment variable
3. For local: Restart the dev server after adding to `.env.local`

### No AI Response Sent

**Check**:
1. Is the Chat assigned to an AI agent? (Check `assignedAgentType: "AI"` in database)
2. Are there errors in the logs?
3. Is the OpenAI API quota exceeded? (Check https://platform.openai.com/usage)

### AI Responses Not in Expected Language

**Check**:
1. AI Agent configuration in database (`language` field)
2. System prompt in logs - should show correct language
3. Conversation history - previous messages influence tone

## Configuration

AI Agents can be configured via the UI at `/agentes-ia`:

- **Name**: Agent's name (used in system prompt)
- **Language**: es, en, pt, fr
- **Tone**: professional, friendly, casual, etc.
- **Goal**: What the agent should accomplish
- **System Prompt**: Base instructions for the AI
- **Max Turns**: Maximum conversation exchanges (default: 10)

## Cost Considerations

- Model used: `gpt-4o-mini` (cost-effective)
- Max tokens per response: 500
- Temperature: 0.7 (balanced creativity)

Check your OpenAI usage at: https://platform.openai.com/usage

## Security Notes

- ✅ API key is **only** used server-side
- ✅ No `NEXT_PUBLIC_` prefix (not exposed to client)
- ✅ Only accessible via API routes (server environment)
- ⚠️ Never commit `.env.local` to git
- ⚠️ Rotate API keys regularly
- ⚠️ Set usage limits in OpenAI dashboard

## Support

For issues or questions:
1. Check Vercel logs for detailed error messages
2. Verify environment variables are set
3. Test locally first before deploying to production
