# 🏥 Health Monitor Service

Monitors mock services (Redis, PostgreSQL, etc.) and automatically creates incidents when they become unhealthy.

## Overview

The Health Monitor:
- ✅ Polls services every 10 seconds
- ✅ Calculates health percentage based on metrics
- ✅ Automatically creates incidents via Backend API
- ✅ Includes error logs and metrics for AI agent analysis
- ✅ Prevents duplicate incident creation

## Monitored Services

### Redis (redis-test)
- **Port:** 6380
- **Health Metric:** Memory usage
- **Threshold:** < 70% available memory = unhealthy
- **Failure Mode:** Memory exhaustion (OOM)

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:8080` | Backend API URL |
| `CHECK_INTERVAL` | `10` | Seconds between health checks |
| `HEALTH_THRESHOLD` | `70` | Health percentage below which incidents are created |

## Running

### With Docker Compose (Recommended)
```bash
docker-compose up health-monitor -d
docker-compose logs -f health-monitor
```

### Standalone (for development)
```bash
cd health-monitor
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

BACKEND_URL=http://localhost:8080 python app.py
```

## Testing

### 1. Break Redis (Simulate Incident)
```bash
./scripts/break-redis.sh
```

This fills Redis with data until memory is exhausted. The health monitor should:
1. Detect health drop below 70%
2. Create an incident automatically
3. Show the incident in your frontend

### 2. Fix Redis (Simulate Resolution)
```bash
./scripts/fix-redis.sh
```

This clears all Redis data, freeing memory. The health monitor should:
1. Detect health recovery
2. Stop creating incidents

### 3. Check Health Monitor Status
```bash
curl http://localhost:8002/status
```

Returns current health of all monitored services.

## API Endpoints

### GET /health
Health check for the monitor itself.

```bash
curl http://localhost:8002/health
```

Response:
```json
{
  "status": "healthy",
  "monitoring": ["redis-test"],
  "check_interval": 10,
  "health_threshold": 70
}
```

### GET /status
Current status of monitored services.

```bash
curl http://localhost:8002/status
```

Response:
```json
{
  "services": {
    "redis-test": {
      "health": 95,
      "status": "healthy"
    }
  },
  "last_check": "2025-10-26T17:00:00.000000"
}
```

## Incident Format

When a service becomes unhealthy, the monitor creates an incident with:

```json
{
  "message": "Redis memory exhausted - Health: 35%",
  "source": "redis-test",
  "affected_system": "redis-test",
  "error_logs": "[\"Memory usage at 95.2%\", \"Used: 47185920 bytes / Max: 52428800 bytes\", \"OOM errors likely\"]",
  "metrics_snapshot": {
    "used_memory": 47185920,
    "max_memory": 52428800,
    "memory_percent": 95.2,
    "health": 35,
    "timestamp": "2025-10-26T17:00:00.000000"
  }
}
```

These fields are used by the AI agent to:
- Analyze the problem
- Determine the appropriate fix action
- Execute commands to resolve the issue

## Logs

Watch logs in real-time:
```bash
docker-compose logs -f health-monitor
```

Example output:
```
🏥 HEALTH MONITOR STARTING
Backend URL: http://backend:8080
Check Interval: 10s
Health Threshold: 70%
Monitoring Services: redis-test
✅ Scheduler started (checking every 10s)

🏥 Running health checks... (threshold: 70%)
🔍 Redis health: 95% (Memory: 5242880/52428800 bytes)
✅ Health check complete

🏥 Running health checks... (threshold: 70%)
🔍 Redis health: 35% (Memory: 47185920/52428800 bytes)
📤 Creating incident: Redis memory exhausted - Health: 35%
✅ Created incident a1b2c3d4 for redis-test
✅ Health check complete
```

## Troubleshooting

### Health monitor not detecting issues
- Check if Redis container is running: `docker ps | grep redis-test`
- Check health monitor logs: `docker-compose logs health-monitor`
- Verify backend is accessible: `curl http://localhost:8080/api/v1/health`

### Incidents not appearing in frontend
- Check backend logs: `docker-compose logs backend`
- Verify WebSocket connection in browser console
- Check if incidents are in database: `curl http://localhost:8080/api/v1/incidents`

### Docker socket permission errors
The health monitor needs access to `/var/run/docker.sock` to execute commands in containers. This is configured in `docker-compose.yml`:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

## Next Steps

After the health monitor is working:
1. ✅ **AI Agent** - Build the agent service to automatically fix issues
2. ✅ **Frontend Integration** - Add UI for agent execution
3. ✅ **More Services** - Add PostgreSQL monitoring
4. ✅ **More Failure Modes** - Connection exhaustion, slow queries, etc.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  Redis (6380)   │◄────────│ Health Monitor   │
│  Memory: 50MB   │  exec   │  (Port 8002)     │
└─────────────────┘         └────────┬─────────┘
                                     │
                            Polls every 10s
                                     │
                                     ▼
                            Health < 70%?
                                     │
                                    YES
                                     │
                                     ▼
                            ┌────────────────┐
                            │  Backend API   │
                            │  POST /incidents│
                            └────────┬───────┘
                                     │
                                     ▼
                            ┌────────────────┐
                            │  WebSocket     │
                            │  Broadcast     │
                            └────────┬───────┘
                                     │
                                     ▼
                            ┌────────────────┐
                            │   Frontend     │
                            │ (New Incident) │
                            └────────────────┘
```

