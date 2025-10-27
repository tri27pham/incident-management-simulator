import os
import time
import requests
import json
import docker
import psycopg2
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

# Initialize Flask app for health endpoint
app = Flask(__name__)
CORS(app)

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "5"))  # seconds
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
            incident_key = "redis-test"  # Use generic key for service, not health-specific
            
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
                print(f"🚨 Incident created for {incident_key} (will not create another until healthy)")
                
                # Clear old entries (keep last 10)
                if len(reported_incidents) > 10:
                    reported_incidents.clear()
        else:
            # Service is healthy, clear reported incident for this service to allow new ones
            if "redis-test" in reported_incidents:
                print(f"✅ Redis is now healthy - clearing incident tracker")
                reported_incidents.discard("redis-test")
        
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
            # Legacy fields
            "affected_system": source,
            "error_logs": json.dumps(error_logs),
            "metrics_snapshot": json.dumps(metrics),  # Must be a JSON string, not object
            # New classification fields (mark as real system incident)
            "incident_type": "real_system",
            "actionable": True,
            "affected_systems": [source],  # Array of affected systems
            "remediation_mode": "automated",  # Allow agents to take automated actions
            "metadata": {
                "health_monitor_version": "1.0",
                "threshold": HEALTH_THRESHOLD,
                "timestamp": datetime.now().isoformat()
            }
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

def check_postgres_health():
    """Check PostgreSQL idle connections and health"""
    try:
        # Connect to postgres-test
        conn = psycopg2.connect(
            host="postgres-test",
            port=5432,
            database="testdb",
            user="testuser",
            password="testpass",
            connect_timeout=5
        )
        cursor = conn.cursor()
        
        # Get connection statistics
        cursor.execute("""
            SELECT 
                count(*) FILTER (WHERE state = 'idle') as idle_connections,
                count(*) FILTER (WHERE state = 'active') as active_connections,
                count(*) as total_connections,
                (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
            FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
        """)
        
        row = cursor.fetchone()
        idle_connections = row[0]
        active_connections = row[1]
        total_connections = row[2]
        max_connections = row[3]
        
        cursor.close()
        conn.close()
        
        # Calculate health based on idle connection ratio
        # If we have many idle connections (>80% of total), it's unhealthy
        idle_ratio = (idle_connections / max(total_connections, 1)) * 100
        
        # Health degrades as idle connections pile up
        if idle_connections > 15:  # Critical
            health = 0
        elif idle_connections > 12:  # Very bad
            health = 30
        elif idle_connections > 10:  # Bad
            health = 50
        elif idle_connections > 8:  # Degraded
            health = 70
        else:
            health = 100
        
        metrics = {
            "idle_connections": idle_connections,
            "active_connections": active_connections,
            "total_connections": total_connections,
            "max_connections": max_connections,
            "idle_ratio": round(idle_ratio, 2),
            "health": health,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"🔍 PostgreSQL health: {health}% (Idle: {idle_connections}, Active: {active_connections}, Total: {total_connections}/{max_connections})")
        
        # Check if unhealthy
        if health < HEALTH_THRESHOLD:
            incident_key = "postgres-test"
            
            # Only create incident if we haven't reported this issue recently
            if incident_key not in reported_incidents:
                error_logs = [
                    f"Idle connections: {idle_connections} ({idle_ratio:.1f}% of total)",
                    f"Total connections: {total_connections}/{max_connections}",
                    "Connection pool exhausted with idle connections"
                ]
                
                create_incident(
                    message=f"PostgreSQL connection pool exhausted - Health: {health}%",
                    source="postgres-test",
                    error_logs=error_logs,
                    metrics=metrics
                )
                
                reported_incidents.add(incident_key)
                print(f"🚨 Incident created for {incident_key} (will not create another until healthy)")
                
                # Clear old entries (keep last 10)
                if len(reported_incidents) > 10:
                    reported_incidents.clear()
        else:
            # Service is healthy, clear any reported incidents to allow new ones
            if "postgres-test" in reported_incidents:
                print(f"✅ PostgreSQL is now healthy - clearing incident tracker")
                reported_incidents.discard("postgres-test")
        
        return health
        
    except psycopg2.OperationalError as e:
        print(f"⚠️  PostgreSQL connection failed: {e}")
        return None
    except Exception as e:
        print(f"❌ Error checking PostgreSQL health: {e}")
        return None

def check_postgres_bloat():
    """Check PostgreSQL table bloat (dead tuples needing vacuum)"""
    try:
        conn = psycopg2.connect(
            host="postgres-test",
            port=5432,
            database="testdb",
            user="testuser",
            password="testpass",
            connect_timeout=5
        )
        cursor = conn.cursor()
        
        # Get bloat statistics - check for tables with high dead tuple ratio
        cursor.execute("""
            SELECT 
                schemaname,
                relname as table_name,
                n_dead_tup,
                n_live_tup,
                CASE 
                    WHEN n_live_tup > 0 THEN (n_dead_tup::float / n_live_tup) * 100 
                    ELSE 0 
                END as dead_tuple_ratio,
                last_vacuum,
                last_autovacuum
            FROM pg_stat_user_tables
            WHERE n_dead_tup > 0
            ORDER BY n_dead_tup DESC
            LIMIT 1
        """)
        
        row = cursor.fetchone()
        
        if row:
            schema, table_name, dead_tup, live_tup, dead_ratio, last_vacuum, last_autovacuum = row
            
            # Calculate health based on dead tuple ratio
            # 0-20% dead = 100% health (excellent)
            # 20-40% dead = 70% health (ok)
            # 40-60% dead = 40% health (degraded)
            # 60%+ dead = 0% health (critical)
            if dead_ratio < 20:
                health = 100
            elif dead_ratio < 40:
                health = 70
            elif dead_ratio < 60:
                health = 40
            else:
                health = 0
            
            metrics = {
                "table_name": table_name,
                "dead_tuples": dead_tup,
                "live_tuples": live_tup,
                "dead_ratio": round(dead_ratio, 2),
                "last_vacuum": str(last_vacuum) if last_vacuum else "never",
                "last_autovacuum": str(last_autovacuum) if last_autovacuum else "never",
                "health": health,
                "timestamp": datetime.now().isoformat()
            }
            
            cursor.close()
            conn.close()
            
            print(f"🔍 PostgreSQL bloat: {health}% (Table: {table_name}, Dead: {dead_tup}, Live: {live_tup}, Ratio: {dead_ratio:.1f}%)")
            
            # Check if unhealthy
            if health < HEALTH_THRESHOLD:
                incident_key = "postgres-test-bloat"
                
                if incident_key not in reported_incidents:
                    error_logs = [
                        f"Table '{table_name}' has {dead_tup} dead tuples ({dead_ratio:.1f}% of total)",
                        f"Live tuples: {live_tup}",
                        f"Last vacuum: {metrics['last_vacuum']}",
                        "Table bloat requires VACUUM to reclaim space and improve performance"
                    ]
                    
                    create_incident(
                        message=f"PostgreSQL table bloat detected - Health: {health}%",
                        source="postgres-test",
                        error_logs=error_logs,
                        metrics=metrics
                    )
                    
                    reported_incidents.add(incident_key)
                    print(f"🚨 Incident created for {incident_key} (will not create another until healthy)")
                    
                    if len(reported_incidents) > 10:
                        reported_incidents.clear()
            else:
                if "postgres-test-bloat" in reported_incidents:
                    print(f"✅ PostgreSQL bloat resolved - clearing incident tracker")
                    reported_incidents.discard("postgres-test-bloat")
            
            return health
        else:
            # No tables with dead tuples
            if "postgres-test-bloat" in reported_incidents:
                reported_incidents.discard("postgres-test-bloat")
            return 100
        
    except psycopg2.OperationalError as e:
        print(f"⚠️  PostgreSQL connection failed: {e}")
        return None
    except Exception as e:
        print(f"❌ Error checking PostgreSQL bloat: {e}")
        return None

def health_check_loop():
    """Run health checks on all monitored services"""
    print(f"🏥 Running health checks... (threshold: {HEALTH_THRESHOLD}%)")
    
    # Check Redis
    redis_health = check_redis_health()
    
    # Check PostgreSQL connections
    postgres_health = check_postgres_health()
    
    # Check PostgreSQL bloat
    postgres_bloat_health = check_postgres_bloat()
    
    print(f"✅ Health check complete")

# Flask routes
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint for the monitor itself"""
    return jsonify({
        "status": "healthy",
        "monitoring": ["redis-test", "postgres-test"],
        "check_interval": CHECK_INTERVAL,
        "health_threshold": HEALTH_THRESHOLD
    }), 200

@app.route('/status', methods=['GET'])
def status():
    """Get current status of monitored services with detailed metrics"""
    services = {}
    
    # Get Redis status
    try:
        container = docker_client.containers.get("redis-test")
        result = container.exec_run(["redis-cli", "INFO", "memory"])
        if result.exit_code == 0:
            output = result.output.decode()
            memory_info = {}
            for line in output.split('\n'):
                if ':' in line and not line.startswith('#'):
                    key, value = line.split(':', 1)
                    memory_info[key.strip()] = value.strip()
            
            used_memory = int(memory_info.get('used_memory', 0))
            max_memory = int(memory_info.get('maxmemory', 1))
            
            if max_memory > 0:
                memory_percent = round((used_memory / max_memory * 100), 2)
                health = max(0, 100 - int(memory_percent))
            else:
                memory_percent = 0
                health = 100
            
            services["redis-test"] = {
                "health": health,
                "memory_used": used_memory,
                "memory_max": max_memory,
                "memory_percent": memory_percent,
                "status": "healthy" if health >= HEALTH_THRESHOLD else "unhealthy",
                "will_trigger_incident": memory_percent >= (100 - HEALTH_THRESHOLD)
            }
    except Exception as e:
        print(f"Error getting Redis status: {e}")
    
    # Get PostgreSQL status
    try:
        conn = psycopg2.connect(
            host="postgres-test",
            port=5432,
            database="testdb",
            user="testuser",
            password="testpass",
            connect_timeout=5
        )
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                count(*) FILTER (WHERE state = 'idle') as idle_connections,
                count(*) FILTER (WHERE state = 'active') as active_connections,
                count(*) as total_connections,
                (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
            FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
        """)
        
        row = cursor.fetchone()
        idle_connections = row[0]
        active_connections = row[1]
        total_connections = row[2]
        max_connections = row[3]
        
        cursor.close()
        conn.close()
        
        # Calculate health
        if idle_connections > 15:
            health = 0
        elif idle_connections > 12:
            health = 30
        elif idle_connections > 10:
            health = 50
        elif idle_connections > 8:
            health = 70
        else:
            health = 100
        
        idle_ratio = round((idle_connections / max(total_connections, 1)) * 100, 2)
        
        services["postgres-test"] = {
            "health": health,
            "idle_connections": idle_connections,
            "active_connections": active_connections,
            "total_connections": total_connections,
            "max_connections": max_connections,
            "idle_ratio": idle_ratio,
            "status": "healthy" if health >= HEALTH_THRESHOLD else "unhealthy",
            "will_trigger_incident": health < HEALTH_THRESHOLD
        }
    except Exception as e:
        print(f"Error getting PostgreSQL status: {e}")
    
    return jsonify({
        "services": services,
        "last_check": datetime.now().isoformat()
    }), 200

@app.route('/trigger/redis-memory', methods=['POST'])
def trigger_redis_memory():
    """Trigger Redis memory exhaustion gradually for testing"""
    try:
        print("🔥 Triggering gradual Redis memory exhaustion...")
        
        container = docker_client.containers.get("redis-test")
        
        # Fill Redis in batches to allow progress tracking
        # Each batch fills ~20-25% of memory over ~2 seconds
        batches = [
            {"n": 30000, "d": 500, "r": 50000},   # ~20% (2-3 sec)
            {"n": 30000, "d": 500, "r": 100000},  # ~40% total (2-3 sec)
            {"n": 30000, "d": 500, "r": 150000},  # ~60% total (2-3 sec)
            {"n": 30000, "d": 500, "r": 200000},  # ~80% total (2-3 sec)
            {"n": 20000, "d": 500, "r": 250000},  # ~95% total (1-2 sec)
        ]
        
        for i, batch in enumerate(batches):
            print(f"📦 Filling batch {i+1}/{len(batches)}...")
            result = container.exec_run(
                ["redis-benchmark", "-t", "set", 
                 "-r", str(batch["r"]), 
                 "-n", str(batch["n"]), 
                 "-d", str(batch["d"]), 
                 "-q"],
                demux=False
            )
            
            # Check if we've hit the limit
            if "OOM" in result.output.decode():
                print(f"✅ Redis full after batch {i+1}")
                break
            
            # Small delay between batches for smoother progress
            time.sleep(0.5)
        
        # Check final health
        health = check_redis_health()
        print(f"✅ Redis memory fill complete (Health: {health}%)")
        
        return jsonify({
            "status": "success",
            "message": "Redis memory exhaustion triggered",
            "health": health,
            "note": "Incident will be created within 5 seconds if health < 70%"
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

@app.route('/clear/redis', methods=['POST'])
def clear_redis():
    """Clear Redis memory"""
    try:
        container = docker_client.containers.get("redis-test")
        
        # Execute FLUSHALL command
        result = container.exec_run(["redis-cli", "FLUSHALL"])
        
        if result.exit_code == 0:
            print("✅ Redis cleared successfully")
            # Clear reported incidents to allow new incident creation
            reported_incidents.clear()
            
            return jsonify({
                "status": "success",
                "message": "Redis cleared successfully"
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": "Failed to clear Redis"
            }), 500
            
    except docker.errors.NotFound:
        return jsonify({
            "status": "error",
            "message": "Redis container 'redis-test' not found"
        }), 404
    except Exception as e:
        print(f"❌ Error clearing Redis: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# Global storage for idle connections (kept open)
idle_postgres_connections = []

@app.route('/trigger/postgres-connections', methods=['POST'])
def trigger_postgres_connections():
    """Create many idle PostgreSQL connections for testing"""
    global idle_postgres_connections
    
    try:
        print("🔥 Creating idle PostgreSQL connections...")
        
        # Clear old connections first
        for conn in idle_postgres_connections:
            try:
                conn.close()
            except:
                pass
        idle_postgres_connections = []
        
        # Create 12 idle connections (will trigger health < 70%)
        for i in range(12):
            try:
                conn = psycopg2.connect(
                    host="postgres-test",
                    port=5432,
                    database="testdb",
                    user="testuser",
                    password="testpass",
                    connect_timeout=5
                )
                idle_postgres_connections.append(conn)
                print(f"  Created connection {i+1}/12")
            except Exception as e:
                print(f"  Failed to create connection {i+1}: {e}")
                break
        
        # Check health after creating connections
        time.sleep(1)
        health = check_postgres_health()
        
        print(f"✅ Created {len(idle_postgres_connections)} idle connections (Health: {health}%)")
        print(f"   Note: Connections stored globally and will remain open")
        
        return jsonify({
            "status": "success",
            "message": f"Created {len(idle_postgres_connections)} idle PostgreSQL connections",
            "health": health,
            "note": "Incident will be created within 5 seconds if health < 70%",
            "warning": "Connections remain open - restart container or call /clear/postgres to cleanup"
        }), 200
        
    except Exception as e:
        print(f"❌ Error creating PostgreSQL connections: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/clear/postgres', methods=['POST'])
def clear_postgres():
    """Kill idle PostgreSQL connections"""
    try:
        conn = psycopg2.connect(
            host="postgres-test",
            port=5432,
            database="testdb",
            user="testuser",
            password="testpass",
            connect_timeout=5
        )
        cursor = conn.cursor()
        
        # Kill all idle connections (except our own)
        cursor.execute("""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE state = 'idle' 
            AND pid <> pg_backend_pid()
            AND datname = 'testdb'
        """)
        
        # Count how many were killed
        cursor.execute("""
            SELECT count(*) FROM pg_stat_activity 
            WHERE state = 'idle' AND pid <> pg_backend_pid()
        """)
        remaining = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        print(f"✅ PostgreSQL idle connections cleared (remaining: {remaining})")
        # Clear reported incidents to allow new incident creation
        reported_incidents.discard("postgres-test")
        
        return jsonify({
            "status": "success",
            "message": "PostgreSQL idle connections cleared",
            "remaining_idle": remaining
        }), 200
        
    except psycopg2.OperationalError as e:
        return jsonify({
            "status": "error",
            "message": f"PostgreSQL connection failed: {e}"
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/trigger/postgres-bloat', methods=['POST'])
def trigger_postgres_bloat():
    """Create table bloat by generating dead tuples"""
    try:
        print("🔥 Creating PostgreSQL table bloat...")
        
        conn = psycopg2.connect(
            host="postgres-test",
            port=5432,
            database="testdb",
            user="testuser",
            password="testpass",
            connect_timeout=5
        )
        cursor = conn.cursor()
        
        # Create a test table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bloat_test (
                id SERIAL PRIMARY KEY,
                data TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        conn.commit()
        
        # Insert rows
        print("  Inserting 1000 rows...")
        cursor.execute("""
            INSERT INTO bloat_test (data)
            SELECT 'test_data_' || generate_series(1, 1000)
        """)
        conn.commit()
        print("  ✅ 1000 rows inserted")
        
        # Update and delete to create dead tuples (50% dead ratio)
        print("  Creating dead tuples (deleting 50% of rows)...")
        cursor.execute("DELETE FROM bloat_test WHERE id % 2 = 0")
        conn.commit()
        print("  ✅ Dead tuples created")
        
        # Get stats
        cursor.execute("""
            SELECT n_live_tup, n_dead_tup,
                   CASE WHEN n_live_tup > 0 
                        THEN (n_dead_tup::float / n_live_tup) * 100 
                        ELSE 0 
                   END as dead_ratio
            FROM pg_stat_user_tables
            WHERE relname = 'bloat_test'
        """)
        stats = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        # Check health
        time.sleep(1)
        health = check_postgres_bloat()
        
        if stats:
            live, dead, ratio = stats
            print(f"✅ Bloat created (Live: {live}, Dead: {dead}, Ratio: {ratio:.1f}%, Health: {health}%)")
        
        return jsonify({
            "status": "success",
            "message": "PostgreSQL table bloat created",
            "health": health,
            "live_tuples": int(stats[0]) if stats else 0,
            "dead_tuples": int(stats[1]) if stats else 0,
            "dead_ratio": round(stats[2], 2) if stats else 0,
            "note": "Incident will be created within 5 seconds if health < 70%"
        }), 200
        
    except Exception as e:
        print(f"❌ Error creating PostgreSQL bloat: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/clear/postgres-bloat', methods=['POST'])
def clear_postgres_bloat():
    """Run VACUUM to clear table bloat"""
    try:
        print("🧹 Running VACUUM to clear bloat...")
        
        conn = psycopg2.connect(
            host="postgres-test",
            port=5432,
            database="testdb",
            user="testuser",
            password="testpass",
            connect_timeout=5
        )
        conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Run VACUUM ANALYZE on the bloat_test table
        cursor.execute("VACUUM ANALYZE bloat_test")
        
        # Get updated stats
        cursor.execute("""
            SELECT n_live_tup, n_dead_tup,
                   CASE WHEN n_live_tup > 0 
                        THEN (n_dead_tup::float / n_live_tup) * 100 
                        ELSE 0 
                   END as dead_ratio
            FROM pg_stat_user_tables
            WHERE relname = 'bloat_test'
        """)
        stats = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if stats:
            live, dead, ratio = stats
            print(f"✅ VACUUM complete (Live: {live}, Dead: {dead}, Ratio: {ratio:.1f}%)")
        
        # Clear reported incident
        reported_incidents.discard("postgres-test-bloat")
        
        return jsonify({
            "status": "success",
            "message": "PostgreSQL bloat cleared with VACUUM",
            "live_tuples": int(stats[0]) if stats else 0,
            "dead_tuples": int(stats[1]) if stats else 0,
            "dead_ratio": round(stats[2], 2) if stats else 0
        }), 200
        
    except Exception as e:
        print(f"❌ Error clearing PostgreSQL bloat: {e}")
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
    print(f"Monitoring Services: redis-test, postgres-test")
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

