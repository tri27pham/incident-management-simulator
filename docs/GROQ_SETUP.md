# Groq API Setup Guide

Get free AI-powered incident diagnosis with Groq.

## Why Groq?

- **Free tier:** 30 requests/minute
- **Fast:** 10x faster than alternatives
- **No credit card required**
- **Fallback:** Works alongside Gemini for reliability

## Setup Instructions

### Step 1: Get Your API Key

1. Go to https://console.groq.com/keys
2. Sign up (free)
3. Click "Create API Key"
4. Copy your key (starts with `gsk_...`)

### Step 2: Add to .env

Add this to your `.env` file:

```bash
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
```

**Optional:** Add Gemini as fallback:
```bash
GEMINI_API_KEY=your_gemini_key_here
```

### Step 3: Restart Services

**With Docker Compose:**
```bash
./scripts/local-stop.sh
./scripts/local-start.sh
```

**Or restart directly:**
```bash
docker compose restart ai-diagnosis
```

## How It Works

The system tries providers in this order:
1. **Groq** (primary - fast & reliable)
2. **Gemini** (fallback if Groq fails)

You only need one API key, but having both provides redundancy.

## Available Models

| Model | Speed | Best For |
|-------|-------|----------|
| `llama-3.3-70b-versatile` | Fast | General use (default) |
| `llama-3.1-8b-instant` | Ultra-fast | Simple tasks |
| `mixtral-8x7b-32768` | Fast | Long context |

To change models, edit `ai-diagnosis/app.py`:
```python
model="llama-3.1-8b-instant",  # For maximum speed
```

## Testing

**Check which API is being used:**
```bash
docker compose logs -f ai-diagnosis
```

Look for:
- `✅ Used Groq API` (success)
- `⚠️ Groq failed, trying Gemini...` (fallback)

**Test Groq directly:**
```bash
curl http://localhost:8000/api/v1/health
```

## Troubleshooting

**"API key not configured"**
- Verify `GROQ_API_KEY` is in your `.env` file
- Restart the ai-diagnosis service

**"Authentication error"**
- Your API key is invalid
- Get a new one from https://console.groq.com/keys

**Service not responding**
```bash
docker compose ps              # Check if running
docker compose logs ai-diagnosis  # Check for errors
docker compose restart ai-diagnosis  # Restart service
```

## Rate Limits

**Free tier:**
- 30 requests/minute
- 14,400 requests/day
- More than enough for development

**If you need more:**
- Groq Pro: 14,400 RPM (~$1/month)
- Add Gemini fallback (free)

## Alternative: Gemini

Don't want to use Groq? Use Google Gemini instead:

1. Go to https://ai.google.dev/
2. Get API key
3. Add to `.env`: `GEMINI_API_KEY=your_key_here`

The system will automatically use Gemini if Groq isn't configured.

---

**Need help?** Check `docker compose logs ai-diagnosis` for detailed error messages.
