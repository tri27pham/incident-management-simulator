# 🚀 GCP Deployment Guide - VM with Containerized PostgreSQL

Complete guide for deploying your Incident Management Simulator to Google Cloud Platform with 24/7 accessibility.

---

## 📋 Overview

This deployment uses a **single GCP VM** running Docker Compose with all services, including a containerized PostgreSQL database.

### **Architecture**

```
┌─────────────────────────────────────────────────────┐
│ Google Compute Engine VM (e2-medium)               │
│ Running 24/7 - Cost: ~$16/month                    │
├─────────────────────────────────────────────────────┤
│  Docker Compose Stack:                              │
│  • Frontend (React)                                 │
│  • Backend (Go)                                     │
│  • AI Diagnosis (Python)                            │
│  • Health Monitor (Python)                          │
│  • Incident Generator (Python)                      │
│  • PostgreSQL (Containerized)                       │
│  • Mock Systems (Redis, Postgres)                   │
│                                                     │
│  Persistent Volume:                                 │
│  • Database data survives restarts                  │
└─────────────────────────────────────────────────────┘
```

### **Why This Approach?**

✅ **Mock systems work** (Docker API access)  
✅ **24/7 accessible** (no manual start/stop)  
✅ **Cost-effective** (~$16/month for everything)  
✅ **Simple** (one system, not two)  
✅ **Persistent data** (database survives reboots)  
✅ **Auto-restart** (services restart on boot)  

---

## 💰 Cost Breakdown

| Resource | Cost/Month |
|----------|------------|
| e2-medium VM (2 vCPU, 4GB RAM) | $14.81 |
| 20GB SSD Persistent Disk | $0.80 |
| Static IP (while attached) | FREE |
| Network egress (minimal) | ~$0.50 |
| **Total** | **~$16/month** |

**Backups**: FREE (within 5GB Cloud Storage free tier)

---

## 🎯 Quick Start (5 Minutes)

### **Prerequisites**

1. Google Cloud account ([sign up here](https://cloud.google.com/))
2. `gcloud` CLI installed ([install guide](https://cloud.google.com/sdk/docs/install))
3. At least one AI API key (Groq or Gemini - both free)

### **Step 1: Set Up Environment**

```bash
# Copy example env file
cp .env.example .env

# Edit it with your API key
nano .env  # or use your preferred editor
```

Add at least ONE API key:

```bash
# Option 1: Groq (recommended - faster)
GROQ_API_KEY=your_groq_key_here
# Get free key: https://console.groq.com/keys

# Option 2: Gemini (fallback)
GEMINI_API_KEY=your_gemini_key_here
# Get free key: https://aistudio.google.com/app/apikey

# Change password if desired
VITE_APP_PASSWORD=changeme
```

### **Step 2: Authenticate to GCP**

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Find your project ID here: https://console.cloud.google.com/
```

### **Step 3: Deploy!**

```bash
# Run the deployment script
./scripts/deploy-vm-standalone.sh
```

**What happens:**
- ✓ Creates VM (~60 seconds)
- ✓ Installs Docker (~90 seconds)
- ✓ Uploads your code (~30 seconds)
- ✓ Builds containers (~90 seconds)
- ✓ Configures firewall
- ✓ Starts all services

**Total time**: ~5 minutes

### **Step 4: Access Your App**

The script will display your URLs:

```
Frontend:  http://YOUR_VM_IP:3000
Backend:   http://YOUR_VM_IP:8080
```

Open the frontend URL in your browser and log in with your password!

---

## 🔧 Management Commands

### **View Logs**

```bash
# All services
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose logs -f'

# Specific service
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose logs -f backend'
```

### **Check Service Status**

```bash
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose ps'
```

### **Restart Services**

```bash
# Restart all
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose restart'

# Restart one service
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose restart backend'
```

### **Update Application**

```bash
# Run update script (multiple options)
./scripts/update-vm-standalone.sh

# Options:
# 1. Pull from Git and rebuild (if using GitHub)
# 2. Upload local changes and rebuild
# 3. Restart services only (no rebuild)
```

### **Stop/Start VM** (Save Money When Not Using)

```bash
# Stop VM (saves ~$15/month)
gcloud compute instances stop incident-simulator --zone=us-east1-b

# Start VM
gcloud compute instances start incident-simulator --zone=us-east1-b
# Wait ~60 seconds for services to start
```

### **Delete Everything**

```bash
# Run cleanup script
./scripts/cleanup-vm-standalone.sh

# Will delete:
# - VM instance
# - Firewall rules
# - Backup bucket (optional)
```

---

## 💾 Backups (Optional but Recommended)

### **Setup Automated Backups**

```bash
# Run backup setup script
./scripts/setup-backups.sh
```

**What this does:**
- ✓ Creates Cloud Storage bucket
- ✓ Configures daily backups (2 AM)
- ✓ 7-day retention policy
- ✓ FREE (within 5GB tier)

### **Manual Backup**

```bash
# Run backup now
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='sudo /usr/local/bin/backup-postgres.sh'
```

### **List Backups**

```bash
gsutil ls gs://YOUR_PROJECT_ID-incident-backups/
```

### **Restore from Backup**

```bash
# List available backups first
gsutil ls gs://YOUR_PROJECT_ID-incident-backups/

# Restore specific backup
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='sudo /usr/local/bin/restore-postgres.sh postgres_backup_20250109_020000.sql.gz'
```

### **Download Backup Locally**

```bash
gsutil cp gs://YOUR_PROJECT_ID-incident-backups/postgres_backup_20250109_020000.sql.gz .
```

---

## 🔍 Troubleshooting

### **Services Not Starting**

```bash
# Check logs
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose logs'

# Check Docker status
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='sudo docker ps'

# Restart services
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose restart'
```

### **Can't Access Frontend**

```bash
# Get VM IP
gcloud compute instances describe incident-simulator --zone=us-east1-b \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'

# Check firewall rules
gcloud compute firewall-rules list | grep incident

# Should see:
# - allow-incident-frontend (tcp:3000)
# - allow-incident-backend (tcp:8080)
```

### **Database Issues**

```bash
# Check database logs
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose logs postgres'

# Access database directly
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='sudo docker exec -it postgres psql -U incidentuser -d incidents'
```

### **Out of Disk Space**

```bash
# Check disk usage
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='df -h'

# Clean up Docker
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='sudo docker system prune -a'
```

---

## 🔐 Security Best Practices

### **Change Default Password**

```bash
# Edit .env
nano .env

# Change this line:
VITE_APP_PASSWORD=your_secure_password_here

# Rebuild frontend
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose up -d --build frontend'
```

### **Use Strong Database Password**

```bash
# Edit .env
POSTGRES_PASSWORD=your_strong_password_here

# Rebuild
./scripts/update-vm-standalone.sh
```

### **Restrict IP Access (Optional)**

```bash
# Allow only your IP
gcloud compute firewall-rules update allow-incident-frontend \
  --source-ranges=YOUR_IP_ADDRESS/32

gcloud compute firewall-rules update allow-incident-backend \
  --source-ranges=YOUR_IP_ADDRESS/32

# Find your IP: curl ifconfig.me
```

---

## 🎓 Common Scenarios

### **Scenario 1: Daily Development**

```bash
# Morning: Start working
./scripts/update-vm-standalone.sh
# Choose option 2 (upload local changes)

# Check logs if needed
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose logs -f backend'
```

### **Scenario 2: Demo Day**

```bash
# Ensure everything is running
gcloud compute instances list | grep incident-simulator
# Should show "RUNNING"

# Get your demo URL
gcloud compute instances describe incident-simulator --zone=us-east1-b \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'

# Share: http://YOUR_IP:3000
```

### **Scenario 3: Not Using for a While**

```bash
# Stop VM to save money
gcloud compute instances stop incident-simulator --zone=us-east1-b

# Cost while stopped: ~$0.80/month (just disk storage)

# When you need it again:
gcloud compute instances start incident-simulator --zone=us-east1-b
# Wait 60 seconds, then access as normal
```

### **Scenario 4: Project Complete**

```bash
# Delete everything
./scripts/cleanup-vm-standalone.sh

# Type "DELETE" to confirm

# Cost after cleanup: $0
```

---

## 📊 Monitoring

### **Check VM Resource Usage**

```bash
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='top -bn1 | head -20'
```

### **Check Memory Usage**

```bash
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='free -h'
```

### **Check Container Stats**

```bash
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='sudo docker stats --no-stream'
```

---

## 🔗 Connect to GitHub

Want to update your app by pushing to GitHub?

See: [GitHub Integration Guide](./GITHUB_SETUP.md)

**Quick version:**

1. Push your code to GitHub
2. SSH to VM and clone your repo
3. Use `./scripts/update-vm-standalone.sh` option 1 (pull from Git)

---

## 🆘 Getting Help

### **Check All Services**

```bash
# One command to check everything
gcloud compute ssh incident-simulator --zone=us-east1-b --command='
  echo "=== VM Status ==="
  uptime
  echo ""
  echo "=== Docker Status ==="
  sudo docker ps
  echo ""
  echo "=== Service Health ==="
  curl -s http://localhost:8080/health || echo "Backend: Not responding"
  echo ""
  echo "=== Disk Space ==="
  df -h | grep -E "Filesystem|/dev/sda1"
'
```

### **Full Restart**

```bash
# Nuclear option: restart everything
gcloud compute ssh incident-simulator --zone=us-east1-b --command='
  cd /opt/incident-simulator
  sudo docker compose down
  sudo docker compose up -d --build
'
```

---

## 📚 Script Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy-vm-standalone.sh` | Initial deployment | `./scripts/deploy-vm-standalone.sh` |
| `update-vm-standalone.sh` | Update application | `./scripts/update-vm-standalone.sh` |
| `setup-backups.sh` | Setup automated backups | `./scripts/setup-backups.sh` |
| `cleanup-vm-standalone.sh` | Delete all resources | `./scripts/cleanup-vm-standalone.sh` |

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Frontend accessible at `http://YOUR_IP:3000`
- [ ] Can log in with password
- [ ] Can generate incidents
- [ ] Can inject failures
- [ ] Mock systems are working
- [ ] Backend health check passes: `curl http://YOUR_IP:8080/health`

---

## 💡 Pro Tips

1. **Bookmark your VM IP** - You'll use it often
2. **Set up SSH alias** - Add to `~/.ssh/config`:
   ```
   Host incident-vm
     HostName YOUR_VM_IP
     User YOUR_USERNAME
   ```
3. **Monitor costs** - Check [GCP Billing](https://console.cloud.google.com/billing)
4. **Enable budget alerts** - Get notified if costs spike
5. **Use tmux on VM** - For long-running commands:
   ```bash
   gcloud compute ssh incident-simulator --zone=us-east1-b
   tmux
   # Your commands here
   # Ctrl+B, then D to detach
   ```

---

## 🎉 You're All Set!

Your Incident Management Simulator is now:
- ✅ Running 24/7 on GCP
- ✅ Accessible from anywhere
- ✅ Backed up daily (if you ran setup-backups.sh)
- ✅ Auto-restarts on reboot
- ✅ Costs ~$16/month

**Questions?** Check the troubleshooting section above!

**Ready to deploy?** Run: `./scripts/deploy-vm-standalone.sh` 🚀

