# 📜 Scripts Directory

Quick reference for all available scripts.

---

## 🚀 GCP Deployment Scripts

### **Main Deployment**

```bash
./scripts/deploy-vm-standalone.sh
```
Deploy entire application to GCP VM with containerized PostgreSQL.
- Creates VM (e2-medium, 20GB disk)
- Installs Docker
- Deploys all services
- Configures firewall
- Cost: ~$16/month (24/7)

### **Update Application**

```bash
./scripts/update-vm-standalone.sh
```
Update running application without losing data.

**Options:**
1. Pull from Git and rebuild
2. Upload local changes and rebuild
3. Restart services only

### **Setup Backups**

```bash
./scripts/setup-backups.sh
```
Configure automated daily backups.
- Backups to Cloud Storage
- Daily at 2 AM
- 7-day retention
- FREE (within 5GB tier)

### **Cleanup Resources**

```bash
./scripts/cleanup-vm-standalone.sh
```
Delete all GCP resources.
- Deletes VM
- Deletes firewall rules
- Optionally deletes backup bucket

**⚠️ WARNING: Permanent data loss!**

---

## 💻 Local Development Scripts

### **Docker Compose (Recommended)**

```bash
./scripts/local-start.sh     # Start all services with Docker Compose
./scripts/local-stop.sh      # Stop all services
./scripts/local-logs.sh      # View logs (optional: add service name)
./scripts/local-restart.sh   # Restart services (optional: add service name)
```

**Or use Docker Compose directly:**
```bash
docker compose up --build    # Start with rebuild
docker compose down          # Stop
docker compose logs -f       # View logs
docker compose ps            # Check status
```

### **Legacy Scripts (Native Processes)**

```bash
./scripts/start.sh          # Start services without Docker Compose
./scripts/stop.sh           # Stop native services
./scripts/status.sh         # Check service status
./scripts/logs.sh           # View logs from native services
```

### **Database**

```bash
./scripts/reset-db.sh       # Reset database (clear all data)
./scripts/clear-db.sh       # Clear database tables
```

### **Testing**

```bash
./scripts/break-redis-complete.sh   # Test failure injection
./scripts/test-agent.sh             # Test Redis agent
./scripts/test-postgres-agent.sh    # Test Postgres agent
```

### **Utilities**

```bash
./scripts/change-password.sh        # Change frontend password
./scripts/verify-deployment.sh      # Verify everything is working
```

---

## 📖 Quick Start Guide

### **Local Development**

```bash
# 1. Setup
cp .env.example .env
nano .env  # Add API key and set VITE_APP_PASSWORD

# 2. Start (Docker Compose - Recommended)
./scripts/local-start.sh

# OR use Docker Compose directly
docker compose up --build

# 3. Access
open http://localhost:3000
# Password: whatever you set in VITE_APP_PASSWORD (default: changeme)
```

### **GCP Deployment**

```bash
# 1. Setup
cp .env.example .env
nano .env  # Add API key
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Deploy
./scripts/deploy-vm-standalone.sh

# 3. Access
# Script will show: http://YOUR_VM_IP:3000
```

---

## 🆘 Common Tasks

### **View Logs on GCP**

```bash
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose logs -f'
```

### **Restart Services on GCP**

```bash
gcloud compute ssh incident-simulator --zone=us-east1-b \
  --command='cd /opt/incident-simulator && sudo docker compose restart'
```

### **Stop VM (Save Money)**

```bash
gcloud compute instances stop incident-simulator --zone=us-east1-b
```

### **Start VM**

```bash
gcloud compute instances start incident-simulator --zone=us-east1-b
```

---

## 📚 Full Documentation

- **GCP Deployment**: [GCP_DEPLOYMENT_GUIDE.md](../GCP_DEPLOYMENT_GUIDE.md)
- **GitHub Integration**: [GITHUB_SETUP.md](../GITHUB_SETUP.md) (if exists)
- **Main README**: [README.md](../README.md)

---

## 💡 Script Naming Convention

- `*-vm-standalone.sh` - GCP VM deployment scripts
- `start-*.sh`, `stop-*.sh` - Service control
- `break-*.sh`, `fix-*.sh` - Testing utilities
- `test-*.sh` - Testing scripts
- `*-db.sh` - Database operations

---

## 🔧 Script Requirements

### **All Scripts**
- `bash` shell
- Execute permissions (`chmod +x script.sh`)

### **GCP Scripts**
- `gcloud` CLI installed
- Authenticated to GCP
- Project configured
- `.env` file with API keys

### **Local Scripts**
- Docker Desktop running
- `.env` file with API keys
- Port 3000, 8080, 8000 available

---

## 🎯 Decision Tree

**Want to run locally?**
→ Use `./scripts/start.sh`

**Want to deploy to cloud (24/7)?**
→ Use `./scripts/deploy-vm-standalone.sh`

**Want to update cloud deployment?**
→ Use `./scripts/update-vm-standalone.sh`

**Want to delete cloud resources?**
→ Use `./scripts/cleanup-vm-standalone.sh`

**Want automated backups?**
→ Use `./scripts/setup-backups.sh`

---

Happy coding! 🚀

