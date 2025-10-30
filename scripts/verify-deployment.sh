#!/bin/bash

# Deployment Verification Script
# Tests all critical functionality after deployment

set -e

echo "🔍 Incident Management Simulator - Deployment Verification"
echo "============================================================"
echo ""

# Configuration
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
AI_URL="${AI_URL:-http://localhost:8000}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8002}"

PASSED=0
FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function test_endpoint() {
  local name=$1
  local url=$2
  local expected_code=${3:-200}
  
  echo -n "Testing $name... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  
  if [ "$response" = "$expected_code" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (HTTP $response)"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC} (Expected $expected_code, got $response)"
    ((FAILED++))
  fi
}

function test_json_endpoint() {
  local name=$1
  local url=$2
  local method=${3:-GET}
  local data=${4:-}
  
  echo -n "Testing $name... "
  
  if [ "$method" = "POST" ]; then
    if [ -n "$data" ]; then
      response=$(curl -s -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
    else
      response=$(curl -s -X POST "$url" 2>/dev/null)
    fi
  else
    response=$(curl -s "$url" 2>/dev/null)
  fi
  
  if [ -n "$response" ] && [ "$response" != "null" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC} (No response or null)"
    ((FAILED++))
  fi
}

function test_service_health() {
  local name=$1
  local service_key=$2
  
  echo -n "Testing $name health... "
  
  health=$(curl -s "$HEALTH_URL/status" 2>/dev/null | jq -r ".services[\"$service_key\"].health" 2>/dev/null || echo "0")
  
  if [ "$health" != "null" ] && [ "$health" != "0" ] && [ -n "$health" ]; then
    if [ "$health" -ge 70 ]; then
      echo -e "${GREEN}✓ PASSED${NC} (Health: $health%)"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠ WARNING${NC} (Health: $health% - degraded)"
      ((PASSED++))
    fi
  else
    echo -e "${RED}✗ FAILED${NC} (No health data)"
    ((FAILED++))
  fi
}

echo "1. Infrastructure Tests"
echo "-----------------------"
test_endpoint "Frontend" "$FRONTEND_URL"
test_endpoint "Backend API" "$BACKEND_URL/api/v1/health" 404  # No health endpoint, but should respond
test_endpoint "AI Diagnosis Service" "$AI_URL/api/v1/health" 200
test_endpoint "Health Monitor" "$HEALTH_URL/status" 200
echo ""

echo "2. Service Health Tests"
echo "-----------------------"
test_service_health "Redis" "redis-test"
test_service_health "PostgreSQL Connections" "postgres-test"
test_service_health "PostgreSQL Bloat" "postgres-bloat"
test_service_health "Disk Space" "disk-space"
echo ""

echo "3. AI Service Tests"
echo "-------------------"
test_json_endpoint "AI Diagnosis" "$AI_URL/api/v1/diagnosis" "POST" '{"description":"Test incident"}'
test_json_endpoint "AI Solution" "$AI_URL/api/v1/suggested-fix" "POST" '{"description":"Test incident"}'
echo ""

echo "4. Failure Injection Tests"
echo "---------------------------"
echo -n "Testing Redis failure injection... "
redis_response=$(curl -s -X POST "$HEALTH_URL/trigger/redis-memory" 2>/dev/null)
if echo "$redis_response" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  ((FAILED++))
fi

echo -n "Testing PostgreSQL connection failure injection... "
pg_response=$(curl -s -X POST "$HEALTH_URL/trigger/postgres-connections" 2>/dev/null)
if echo "$pg_response" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  ((FAILED++))
fi

echo -n "Testing PostgreSQL bloat failure injection... "
bloat_response=$(curl -s -X POST "$HEALTH_URL/trigger/postgres-bloat" 2>/dev/null)
if echo "$bloat_response" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  ((FAILED++))
fi

echo -n "Testing Disk space failure injection... "
disk_response=$(curl -s -X POST "$HEALTH_URL/trigger/disk-full" 2>/dev/null)
if echo "$disk_response" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  ((FAILED++))
fi
echo ""

echo "5. Recovery Tests"
echo "-----------------"
echo "Waiting 3 seconds for failures to stabilize..."
sleep 3

echo -n "Testing Redis recovery... "
redis_clear=$(curl -s -X POST "$HEALTH_URL/clear/redis" 2>/dev/null)
if echo "$redis_clear" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  ((FAILED++))
fi

echo -n "Testing PostgreSQL connection recovery... "
pg_clear=$(curl -s -X POST "$HEALTH_URL/clear/postgres" 2>/dev/null)
if echo "$pg_clear" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  ((FAILED++))
fi

echo -n "Testing PostgreSQL bloat recovery... "
bloat_clear=$(curl -s -X POST "$HEALTH_URL/clear/postgres-bloat" 2>/dev/null)
if echo "$bloat_clear" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  ((FAILED++))
fi

echo -n "Testing Disk space recovery... "
disk_clear=$(curl -s -X POST "$HEALTH_URL/clear/disk" 2>/dev/null)
if echo "$disk_clear" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  ((FAILED++))
fi
echo ""

echo "6. Database Reset Test"
echo "----------------------"
echo -n "Testing database reset... "
reset_response=$(curl -s -X POST "$BACKEND_URL/api/v1/reset" 2>/dev/null)
if echo "$reset_response" | jq -e '.message' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  ((FAILED++))
fi
echo ""

# Summary
echo "============================================================"
echo "Test Summary"
echo "============================================================"
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed! Deployment is healthy.${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some tests failed. Please review the errors above.${NC}"
  exit 1
fi

