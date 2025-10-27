# Quick Reference Card

## 🚀 Essential Commands

```bash
./scripts/start.sh     # Start everything (handles conflicts automatically)
./scripts/stop.sh      # Stop everything (3-layer cleanup)
./scripts/status.sh    # Check what's running
./scripts/logs.sh      # View all logs
```

---

## 🛡️ Built-in Protections

### Start Script (`./scripts/start.sh`)
✅ Automatically kills old processes on ports 8080, 5173, 8000  
✅ Cleans up stale database connections  
✅ Verifies all services are healthy before completing  
✅ Gives specific error messages if anything fails  

### Stop Script (`./scripts/stop.sh`)
✅ Three-layer cleanup approach:
  1. Kill by PID files
  2. Kill by port numbers (catches orphans)
  3. Kill by process names (final fallback)
✅ Cleans up stale log files  
✅ Stops PostgreSQL container  

---

## 📊 Service Ports

| Service | Port | Health Check |
|---------|------|--------------|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 8080 | http://localhost:8080/api/v1/health |
| AI Diagnosis | 8000 | http://localhost:8000/api/v1/health |
| PostgreSQL | 5432 | `docker ps \| grep postgres` |

---

## 🔧 Troubleshooting Flow

```
Problem?
  ↓
Run: ./scripts/stop.sh
  ↓
Wait 2 seconds
  ↓
Run: ./scripts/start.sh
  ↓
Check: ./scripts/status.sh
  ↓
Still broken? Check logs: ./scripts/logs.sh
```

---

## 💾 Database Commands

```bash
./scripts/clear-db.sh           # Clear all incidents (safe)
./scripts/reset-db.sh           # Nuclear reset (destroys everything)
./scripts/fix-db-connections.sh # Fix DBeaver connection issues
```

---

## 🐛 Common Issues & Fixes

### "Port already in use"
**Solution:** Run `./scripts/stop.sh` then `./scripts/start.sh` again  
**Why it works:** stop.sh kills all processes on those ports

### "Datasource was invalidated"
**Solution:** Run `./scripts/fix-db-connections.sh`  
**Why:** DBeaver has stale connections from restarted PostgreSQL

### "Backend not responding"
**Solution:** Check logs with `./scripts/logs.sh backend`  
**Why:** Might be old backend on port 8080

### "AI diagnosis failing"
**Solution:** Check API quota at https://ai.google.dev/  
**Why:** Free tier has 250 requests/day limit

---

## 📝 Log Files

All logs are in `/tmp/`:
- `/tmp/incident-backend.log` - Backend service
- `/tmp/incident-frontend.log` - Frontend dev server
- `/tmp/incident-ai.log` - AI diagnosis service
- `/tmp/incident-generator.log` - Incident generator

View with: `tail -f /tmp/incident-*.log`

---

## ✅ Daily Workflow

### Morning Start:
```bash
./scripts/start.sh
# Wait for health checks
# Open http://localhost:5173
```

### During Development:
```bash
./scripts/status.sh      # Check what's running
./scripts/logs.sh backend # Debug specific service
```

### End of Day:
```bash
./scripts/stop.sh
```

---

## 🆘 Nuclear Option

If everything is broken and you want to start fresh:

```bash
./scripts/stop.sh
./scripts/reset-db.sh
pkill -9 go node python3  # Kill everything
docker stop $(docker ps -q)
sleep 3
./scripts/start.sh
```

This will give you a completely clean slate.

