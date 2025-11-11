# ⚡ Quick Start Guide

Choose your path:

---

## 🏠 Local Development (Free)

```bash
# 1. Setup
cp .env.example .env
nano .env  # Add GROQ_API_KEY or GEMINI_API_KEY

# 2. Start
./scripts/start.sh

# 3. Access
open http://localhost:3000
```

**Password**: `changeme` (or what you set in `.env`)

---

## ☁️ Deploy to Google Cloud (~$16/month)

```bash
# 1. Setup
cp .env.example .env
nano .env  # Add API key

# 2. Login to GCP
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 3. Deploy (takes ~5 minutes)
./scripts/deploy-vm-standalone.sh

# 4. Access
# Script shows: http://YOUR_VM_IP:3000
```

**Features:**
- ✅ Runs 24/7
- ✅ Auto-restarts on reboot
- ✅ All features work (including mock systems)
- ✅ Optional automated backups

📖 **Full guide**: [GCP_DEPLOYMENT_GUIDE.md](./GCP_DEPLOYMENT_GUIDE.md)

---

## 🔑 Get Free API Keys

You need **at least ONE** of these (both are free):

### Groq (Recommended)
1. Go to https://console.groq.com/keys
2. Sign up / Log in
3. Create API key
4. Add to `.env`: `GROQ_API_KEY=gsk_...`

### Gemini (Fallback)
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with Google
3. Create API key
4. Add to `.env`: `GEMINI_API_KEY=...`

---

## 🎯 Common Commands

### Local

```bash
./scripts/start.sh          # Start all services
./scripts/stop.sh           # Stop all services
./scripts/status.sh         # Check what's running
./scripts/logs.sh           # View logs
```

### GCP

```bash
# Update code
./scripts/update-vm-standalone.sh

# Setup backups (optional)
./scripts/setup-backups.sh

# Delete everything
./scripts/cleanup-vm-standalone.sh

# View logs
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose logs -f'
```

---

## 🆘 Troubleshooting

### Local Issues

```bash
# Stop everything and restart
./scripts/stop.sh
./scripts/start.sh

# Check Docker is running
docker ps

# Reset database (if broken)
./scripts/reset-db.sh
```

### GCP Issues

```bash
# Check services
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='sudo docker ps'

# Restart services
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose restart'

# Get VM IP
gcloud compute instances describe incident-simulator --zone=us-east1-b \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

---

## 📚 Full Documentation

- **[README.md](./README.md)** - Main documentation
- **[GCP_DEPLOYMENT_GUIDE.md](./GCP_DEPLOYMENT_GUIDE.md)** - Complete GCP guide
- **[scripts/README.md](./scripts/README.md)** - All available scripts

---

## 💰 Cost Comparison

| Option | Cost | Best For |
|--------|------|----------|
| **Local** | $0 | Development, testing |
| **GCP VM** | ~$16/month | Portfolio, demos, 24/7 access |
| **GCP VM (stopped)** | ~$0.80/month | Between uses |

---

## ✅ What You Get

- ✅ AI-powered incident diagnosis
- ✅ Real-time incident board
- ✅ Automated incident generation
- ✅ Failure injection (mock systems)
- ✅ Status tracking & history
- ✅ Light/Dark theme
- ✅ WebSocket live updates

---

**Ready?** Pick your deployment method above and get started! 🚀
