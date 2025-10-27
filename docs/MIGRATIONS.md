# Database Migrations

## Overview

This project uses SQL migration files to manage database schema changes. Migrations are automatically applied when you start the services.

## Migration Files Location

```
backend/migrations/
├── 00-init-user.sql              # Create users and roles
├── init.sql                      # Create initial tables
├── 01-add-status-history.sql     # Add status history tracking
├── add_generated_by.sql          # Add incident generator tracking
├── add_provider_tracking.sql     # Add AI provider tracking
└── add_status_history.sql        # Legacy status history
```

## Automatic Migration

Migrations are **automatically applied** when you start services:

### Docker Compose
```bash
./scripts/start-docker.sh   # Automatically runs migrations
```

### Local Development
```bash
./scripts/start.sh          # Automatically runs migrations
```

## Manual Migration

If you need to manually run migrations:

```bash
# Auto-detect which database is running
./scripts/run-migrations.sh

# Or specify the mode explicitly
./scripts/run-migrations.sh local          # For local dev (postgres-dev)
./scripts/run-migrations.sh docker-compose # For docker-compose (postgres)
```

## Creating New Migrations

1. Create a new `.sql` file in `backend/migrations/`
2. Name it descriptively (e.g., `02-add-users-table.sql`)
3. Include proper SQL statements:

```sql
-- Switch to app DB context
\connect incident_db

-- Switch to app user
SET ROLE incident_user;

-- Your migration here
CREATE TABLE IF NOT EXISTS your_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- your columns
);
```

4. The migration will automatically run next time you start services

## Two Separate Databases

This project uses **two different PostgreSQL containers**:

| Mode | Container Name | Port | Used By |
|------|---------------|------|---------|
| Docker Compose | `postgres` | 5432 | docker-compose up |
| Local Dev | `postgres-dev` | 5432 | ./scripts/start.sh |

**Important:** When you create a new migration, it needs to be applied to whichever database you're currently using. The scripts handle this automatically.

## Troubleshooting

### Migration Already Applied Error
This is normal! Migrations are idempotent (safe to run multiple times). The script will skip already-applied migrations.

### Missing Table Errors
If you see "relation does not exist" errors:
```bash
./scripts/run-migrations.sh
```

### Switching Between Docker Compose and Local Dev
Each mode has its own database. When you switch modes, you might need to run migrations manually:
```bash
# After switching to local dev
./scripts/run-migrations.sh local

# After switching to docker-compose
./scripts/run-migrations.sh docker-compose
```

### Reset Database
```bash
# Stop services
./scripts/stop.sh  # or ./scripts/stop-docker.sh

# Remove database container
docker rm -f postgres-dev  # or postgres for docker-compose

# Start again (will recreate DB and run migrations)
./scripts/start.sh  # or ./scripts/start-docker.sh
```

## Best Practices

1. ✅ Always use `CREATE TABLE IF NOT EXISTS`
2. ✅ Make migrations idempotent (safe to run multiple times)
3. ✅ Test migrations on both databases
4. ✅ Never modify existing migration files
5. ✅ Name migrations with sequential numbers (00, 01, 02, etc.)
6. ✅ Include comments explaining what the migration does

