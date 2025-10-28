# 🐛 Bug Fix: Duplicate Incident Creation

## Problem
When triggering a PostgreSQL connection failure, multiple incidents were being created (up to 7 incidents in 15 seconds) instead of just one.

## Root Cause

The health monitor tracks which services have already had incidents created using a `reported_incidents` set. Each service should only have ONE active incident until it becomes healthy again.

### The Bug
In `health-monitor/app.py`, the Redis health check was calling:

```python
# Line 97 (OLD CODE)
reported_incidents.clear()  # ❌ Clears EVERYTHING
```

This cleared the **entire** set, including the `postgres-test` entry. So every 5 seconds:
1. Redis check runs (healthy)
2. Calls `reported_incidents.clear()`
3. PostgreSQL check runs (unhealthy)  
4. Finds `postgres-test` NOT in set (because Redis just cleared it)
5. Creates a NEW incident
6. Adds `postgres-test` back to set
7. Repeat every 5 seconds...

### Why PostgreSQL Also Had This Bug
The PostgreSQL health check had the correct code:

```python
# Line 242 (CORRECT)
reported_incidents.discard("postgres-test")  # ✅ Only removes postgres-test
```

But Redis was wiping out the tracking every 5 seconds, so PostgreSQL's correct logic didn't matter.

## The Fix

Changed Redis health check to match PostgreSQL's pattern:

```python
# Line 97 (NEW CODE)
reported_incidents.discard("redis-test")  # ✅ Only removes redis-test
```

Now each service independently manages its own incident tracking without interfering with other services.

## Files Modified

**`health-monitor/app.py`**:
- Line 97: Changed `reported_incidents.clear()` → `reported_incidents.discard("redis-test")`

## Testing

### Before Fix
```bash
$ curl -X POST http://localhost:8002/trigger/postgres-connections
$ sleep 15
$ curl http://localhost:8080/api/v1/incidents | jq '. | length'
7  # ❌ Multiple incidents created
```

### After Fix
```bash
$ curl -X POST http://localhost:8002/trigger/postgres-connections
$ sleep 15
$ curl http://localhost:8080/api/v1/incidents | jq '. | length'
1  # ✅ Only one incident created
```

## How Incident Deduplication Works

```python
reported_incidents = set()  # Global set to track active incidents

def check_service_health():
    if health < HEALTH_THRESHOLD:
        incident_key = "service-name"
        
        # Only create if not already tracked
        if incident_key not in reported_incidents:
            create_incident(...)
            reported_incidents.add(incident_key)
            print("🚨 Incident created (will not create another until healthy)")
    else:
        # Service is healthy, allow new incidents
        if "service-name" in reported_incidents:
            print("✅ Service healthy - clearing incident tracker")
            reported_incidents.discard("service-name")  # ✅ CORRECT
```

## Key Principle

**Each service should manage only its own incident tracking.**

- ✅ `reported_incidents.discard("redis-test")` - Removes only Redis
- ✅ `reported_incidents.discard("postgres-test")` - Removes only PostgreSQL
- ❌ `reported_incidents.clear()` - Removes EVERYTHING (causes bug)

## Impact

This bug affected **all mock systems** when multiple systems were unhealthy at the same time:
- If Redis was healthy and PostgreSQL was unhealthy → Multiple PostgreSQL incidents
- If PostgreSQL was healthy and Redis was unhealthy → Multiple Redis incidents

The fix ensures proper deduplication regardless of how many systems are being monitored.

## Verification

Run the automated test to verify the fix:

```bash
# Test PostgreSQL deduplication
./scripts/test-postgres-agent.sh

# Or manual test
curl -X POST http://localhost:8002/trigger/postgres-connections
sleep 15
curl http://localhost:8080/api/v1/incidents | jq '. | length'
# Should output: 1
```

## Related Files

- `health-monitor/app.py` - Health monitoring and incident creation
- `scripts/test-postgres-agent.sh` - Automated testing
- `POSTGRES_COMPLETE.md` - PostgreSQL implementation docs

---

**Status**: ✅ Fixed and tested
**Deployed**: Yes (health-monitor container rebuilt)
**Breaking Changes**: None

