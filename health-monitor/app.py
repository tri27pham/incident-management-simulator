import os
import time
import requests
import json
import docker
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

# Initialize Flask app for health endpoint
app = Flask(__name__)
CORS(app)

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "10"))  # seconds
HEALTH_THRESHOLD = int(os.getenv("HEALTH_THRESHOLD", "70"))  # percent

# Docker client
docker_client = docker.from_env()

# Track reported incidents to avoid duplicates
reported_incidents = set()

def check_redis_health():
    """Check Redis memory usage and health"""
    try:
        container = docker_client.containers.get("redis-test")
        
        # Execute INFO memory command
        result = container.exec_run(["redis-cli", "INFO", "memory"])
        if result.exit_code != 0:
            print(f"❌ Redis command failed: {result.output.decode()}")
            return None
        
        output = result.output.decode()
        
        # Parse memory info
        memory_info = {}
        for line in output.split('\n'):
            if ':' in line and not line.startswith('#'):
                key, value = line.split(':', 1)
                memory_info[key.strip()] = value.strip()
        
        # Get memory values
        used_memory = int(memory_info.get('used_memory', 0))
        max_memory = int(memory_info.get('maxmemory', 1))
        
        # Calculate health percentage
        if max_memory > 0:
            memory_percent = (used_memory / max_memory * 100)
            health = max(0, 100 - int(memory_percent))
        else:
            health = 100
        
        metrics = {
            "used_memory": used_memory,
            "max_memory": max_memory,
            "memory_percent": round(memory_percent, 2) if max_memory > 0 else 0,
            "health": health,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"🔍 Redis health: {health}% (Memory: {used_memory}/{max_memory} bytes)")
        
        # Check if unhealthy
        if health < HEALTH_THRESHOLD:
            incident_key = f"redis-test-{health}"
            
            # Only create incident if we haven't reported this issue recently
            if incident_key not in reported_incidents:
                error_logs = [
                    f"Memory usage at {memory_percent:.1f}%",
                    f"Used: {used_memory} bytes / Max: {max_memory} bytes",
                    "OOM errors likely - Redis rejecting commands"
                ]
                
                create_incident(
                    message=f"Redis memory exhausted - Health: {health}%",
                    source="redis-test",
                    error_logs=error_logs,
                    metrics=metrics
                )
                
                reported_incidents.add(incident_key)
                
                # Clear old entries (keep last 10)
                if len(reported_incidents) > 10:
                    reported_incidents.clear()
        else:
            # Service is healthy, clear any reported incidents
            reported_incidents.clear()
        
        return health
        
    except docker.errors.NotFound:
        print("⚠️  Redis container 'redis-test' not found")
        return None
    except Exception as e:
        print(f"❌ Error checking Redis health: {e}")
        return None

def create_incident(message, source, error_logs, metrics):
    """Create incident via backend API"""
    try:
        incident_data = {
            "message": message,
            "source": source,
            "affected_system": source,
            "error_logs": json.dumps(error_logs),
            "metrics_snapshot": json.dumps(metrics)  # Must be a JSON string, not object
        }
        
        print(f"📤 Creating incident: {message}")
        
        response = requests.post(
            f"{BACKEND_URL}/api/v1/incidents",
            json=incident_data,
            timeout=10
        )
        
        if response.status_code == 201:
            incident_id = response.json().get('id', 'unknown')
            print(f"✅ Created incident {incident_id[:8]} for {source}")
        else:
            print(f"⚠️  Backend responded with status {response.status_code}: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to backend at {BACKEND_URL}")
    except requests.exceptions.Timeout:
        print(f"❌ Backend request timed out")
    except Exception as e:
        print(f"❌ Error creating incident: {e}")

def health_check_loop():
    """Run health checks on all monitored services"""
    print(f"🏥 Running health checks... (threshold: {HEALTH_THRESHOLD}%)")
    
    # Check Redis
    redis_health = check_redis_health()
    
    # Add more services here in the future
    # postgres_health = check_postgres_health()
    
    print(f"✅ Health check complete")

# Flask routes
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint for the monitor itself"""
    return jsonify({
        "status": "healthy",
        "monitoring": ["redis-test"],
        "check_interval": CHECK_INTERVAL,
        "health_threshold": HEALTH_THRESHOLD
    }), 200

@app.route('/status', methods=['GET'])
def status():
    """Get current status of monitored services"""
    redis_health = check_redis_health()
    
    return jsonify({
        "services": {
            "redis-test": {
                "health": redis_health,
                "status": "healthy" if redis_health and redis_health >= HEALTH_THRESHOLD else "unhealthy"
            }
        },
        "last_check": datetime.now().isoformat()
    }), 200

@app.route('/trigger/redis-memory', methods=['POST'])
def trigger_redis_memory():
    """Trigger Redis memory exhaustion for testing"""
    try:
        print("🔥 Triggering Redis memory exhaustion...")
        
        container = docker_client.containers.get("redis-test")
        
        # Use redis-benchmark to quickly fill memory
        # -t set = only SET operations
        # -r 200000 = use random keys in range
        # -n 150000 = 150,000 operations
        # -d 500 = 500 bytes per value
        # -q = quiet mode
        result = container.exec_run(
            ["redis-benchmark", "-t", "set", "-r", "200000", "-n", "150000", "-d", "500", "-q"],
            demux=False
        )
        
        if result.exit_code == 0 or "requests per second" in result.output.decode():
            # Check current health
            health = check_redis_health()
            
            print(f"✅ Redis memory fill complete (Health: {health}%)")
            
            return jsonify({
                "status": "success",
                "message": "Redis memory exhaustion triggered",
                "health": health,
                "note": "Incident will be created within 10 seconds if health < 70%"
            }), 200
        else:
            print(f"⚠️  Redis benchmark completed with warnings: {result.output.decode()}")
            health = check_redis_health()
            return jsonify({
                "status": "success",
                "message": "Redis memory fill attempted (may already be full)",
                "health": health
            }), 200
            
    except docker.errors.NotFound:
        return jsonify({
            "status": "error",
            "message": "Redis container 'redis-test' not found"
        }), 404
    except Exception as e:
        print(f"❌ Error triggering Redis memory exhaustion: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

def start_scheduler():
    """Start the background scheduler"""
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        health_check_loop,
        'interval',
        seconds=CHECK_INTERVAL,
        id='health_check',
        name='Health Check Loop'
    )
    scheduler.start()
    print(f"✅ Scheduler started (checking every {CHECK_INTERVAL}s)")
    return scheduler

if __name__ == "__main__":
    print("=" * 60)
    print("🏥 HEALTH MONITOR STARTING")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Check Interval: {CHECK_INTERVAL}s")
    print(f"Health Threshold: {HEALTH_THRESHOLD}%")
    print(f"Monitoring Services: redis-test")
    print("=" * 60)
    
    # Start background scheduler
    scheduler = start_scheduler()
    
    # Run Flask app
    try:
        app.run(host='0.0.0.0', port=8002, debug=False)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down health monitor...")
        scheduler.shutdown()
        print("✅ Shutdown complete")

