# Production Deployment Guide

## 🚀 Overview

This guide explains how to deploy the incident management simulator to production and how authentication works when **not running locally**.

---

## 🔐 How Authentication Works in Production

The password is **baked into the Docker image at build time**. Here's how it works:

### Build Time (When You Create the Image)
1. You set the `AUTH_PASSWORD` environment variable
2. Docker builds the frontend image
3. The password is hashed with BCrypt and stored in the image
4. The image is tagged and pushed to a registry (Docker Hub, AWS ECR, etc.)

### Runtime (When Users Access the App)
1. The Docker container runs from the pre-built image
2. Nginx serves the frontend with authentication enabled
3. Users see a browser login prompt
4. They enter: Username `user` + Your password
5. Authentication happens entirely in the browser/nginx (no backend calls)

**Key Point:** The password is set ONCE when building the image, not when running the container.

---

## 📦 Deployment Options

### Option 1: Docker Compose (VPS/Cloud VM)

Best for: Small deployments, single server

**Step 1: Set up your server**
```bash
# SSH into your server
ssh user@your-server.com

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

**Step 2: Clone your repository**
```bash
git clone https://github.com/yourusername/incident-management-simulator.git
cd incident-management-simulator
```

**Step 3: Set your password**
```bash
# Create .env file with your production password
cat > .env << EOF
AUTH_PASSWORD=YourProductionPassword123!
POSTGRES_PASSWORD=your_db_password_here
# Add other environment variables
EOF
```

**Step 4: Build and run**
```bash
# Build with your password
docker-compose up -d --build

# The password is now baked into the frontend image
```

**Step 5: Access**
- Go to `http://your-server.com:3000`
- Login with: `user` / `YourProductionPassword123!`

---

### Option 2: Build Once, Deploy Anywhere

Best for: Multiple environments, CI/CD pipelines

**Step 1: Build image locally with production password**
```bash
# Set production password
export AUTH_PASSWORD=YourProductionPassword123!

# Build frontend image
docker-compose build frontend

# Tag for your registry
docker tag incident-management-simulator-frontend:latest \
  your-registry/incident-simulator:v1.0.0
```

**Step 2: Push to registry**
```bash
# Docker Hub
docker push your-registry/incident-simulator:v1.0.0

# Or AWS ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/incident-simulator:v1.0.0
```

**Step 3: Deploy on any server**
```bash
# Pull and run the pre-built image
docker pull your-registry/incident-simulator:v1.0.0
docker run -d -p 3000:80 your-registry/incident-simulator:v1.0.0
```

The password is already in the image, no need to set it again!

---

### Option 3: Platform as a Service (Heroku, Railway, Render)

**On Railway/Render:**

1. Connect your GitHub repository
2. Set build environment variable:
   ```
   AUTH_PASSWORD=YourProductionPassword123!
   ```
3. Railway/Render builds the image with your password
4. Deploy!

**On Heroku:**

```bash
# Add Heroku remote
heroku create your-app-name

# Set config var for build
heroku config:set AUTH_PASSWORD=YourProductionPassword123!

# Push and build
git push heroku main
```

---

### Option 4: Kubernetes

**Step 1: Create secret for build**
```bash
kubectl create secret generic frontend-auth \
  --from-literal=password=YourProductionPassword123!
```

**Step 2: Build with CI/CD**

In your CI/CD pipeline (GitHub Actions, GitLab CI, etc.):

```yaml
# .github/workflows/deploy.yml
- name: Build Frontend
  run: |
    docker build \
      --build-arg AUTH_PASSWORD=${{ secrets.AUTH_PASSWORD }} \
      -t your-registry/incident-simulator:${{ github.sha }} \
      ./frontend
    docker push your-registry/incident-simulator:${{ github.sha }}
```

**Step 3: Deploy to Kubernetes**
```yaml
# kubernetes/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: incident-simulator-frontend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: frontend
        image: your-registry/incident-simulator:latest
        ports:
        - containerPort: 80
```

---

## 🔄 Changing Password After Deployment

### Important: You MUST rebuild the image

The password is baked into the Docker image, so to change it:

**Step 1: Rebuild with new password**
```bash
# On your deployment server
export AUTH_PASSWORD=NewPassword456!
docker-compose up -d --build frontend
```

**OR if using a registry:**

```bash
# Build locally with new password
export AUTH_PASSWORD=NewPassword456!
docker-compose build frontend

# Push new version
docker tag incident-management-simulator-frontend:latest \
  your-registry/incident-simulator:v1.0.1
docker push your-registry/incident-simulator:v1.0.1

# Deploy new version on server
docker pull your-registry/incident-simulator:v1.0.1
docker stop frontend
docker rm frontend
docker run -d -p 3000:80 --name frontend \
  your-registry/incident-simulator:v1.0.1
```

**Step 2: Notify users**

Since browsers cache credentials, users may need to:
- Clear their browser cache
- Use incognito/private mode
- Wait for their session to expire

---

## 🌐 DNS and Domain Setup

### Using a Custom Domain

**Step 1: Point DNS to your server**
```
A Record: incident.yourdomain.com -> your-server-ip
```

**Step 2: Add SSL/TLS (Highly Recommended)**

Using Let's Encrypt with Nginx:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d incident.yourdomain.com
```

**Step 3: Update nginx.conf**

The frontend nginx.conf needs HTTPS configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name incident.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/incident.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/incident.yourdomain.com/privkey.pem;
    
    # Basic auth (same as before)
    auth_basic "Incident Management Simulator";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    # ... rest of config
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name incident.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

**Step 4: Mount SSL certificates in Docker**

```yaml
# docker-compose.yml
services:
  frontend:
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
    ports:
      - "80:80"
      - "443:443"
```

---

## 🔒 Production Security Checklist

Before deploying:

- [ ] Change `AUTH_PASSWORD` from default `changeme`
- [ ] Use a strong password (20+ characters, random)
- [ ] Store password in environment variables (not in code)
- [ ] Use HTTPS/SSL (Let's Encrypt is free!)
- [ ] Change database passwords
- [ ] Change all default credentials
- [ ] Enable firewall (only ports 80, 443, 22)
- [ ] Set up regular backups
- [ ] Configure log monitoring
- [ ] Add rate limiting to nginx (optional)
- [ ] Document credentials in password manager

### Strong Password Example

```bash
# Generate strong password
AUTH_PASSWORD=$(openssl rand -base64 32)

# Save it somewhere secure!
echo "Production password: $AUTH_PASSWORD" >> ~/secure-credentials.txt
chmod 600 ~/secure-credentials.txt

# Build with this password
docker-compose up -d --build frontend
```

---

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Frontend with Auth
        run: |
          docker build \
            --build-arg AUTH_PASSWORD=${{ secrets.FRONTEND_PASSWORD }} \
            -t ghcr.io/yourusername/incident-simulator-frontend:latest \
            ./frontend
      
      - name: Push to Registry
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker push ghcr.io/yourusername/incident-simulator-frontend:latest
      
      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /app/incident-simulator
            docker-compose pull frontend
            docker-compose up -d frontend
```

**Set GitHub Secrets:**
- `FRONTEND_PASSWORD` - Your production password
- `DEPLOY_HOST` - Your server IP
- `DEPLOY_USER` - SSH username
- `DEPLOY_KEY` - SSH private key

---

## 📊 Monitoring After Deployment

### Health Check Endpoints

```bash
# Check if frontend is running
curl https://incident.yourdomain.com/health

# Check backend
curl https://incident.yourdomain.com/api/v1/health
```

### Docker Logs

```bash
# View frontend logs
docker logs frontend

# Follow logs in real-time
docker logs -f frontend

# View all services
docker-compose logs -f
```

---

## 🐛 Troubleshooting Production Issues

### "Can't login with password"

**Problem:** Password doesn't work in production

**Solution:**
1. Check the image was built with correct password:
   ```bash
   docker exec frontend cat /etc/nginx/.htpasswd
   # Should show: user:$apr1$...hashed password...
   ```

2. Verify nginx config:
   ```bash
   docker exec frontend cat /etc/nginx/conf.d/default.conf
   # Should have: auth_basic_user_file /etc/nginx/.htpasswd;
   ```

3. Rebuild if needed:
   ```bash
   AUTH_PASSWORD=YourPassword docker-compose up -d --build frontend
   ```

### "Authentication not working"

**Problem:** Can access without password

**Solution:**
1. Check nginx logs:
   ```bash
   docker logs frontend 2>&1 | grep auth
   ```

2. Verify htpasswd file exists:
   ```bash
   docker exec frontend ls -la /etc/nginx/.htpasswd
   ```

3. Check nginx config is loaded:
   ```bash
   docker exec frontend nginx -t
   ```

### "Can't access from outside localhost"

**Problem:** Works on localhost but not from internet

**Solution:**
1. Check firewall:
   ```bash
   sudo ufw status
   sudo ufw allow 80
   sudo ufw allow 443
   ```

2. Check docker port mapping:
   ```bash
   docker ps | grep frontend
   # Should show: 0.0.0.0:3000->80/tcp
   ```

3. Check if service is listening:
   ```bash
   netstat -tlnp | grep 3000
   ```

---

## 📝 Summary

### Local Development
```bash
# Default password: changeme
docker-compose up -d
# Access: http://localhost:3000
# Login: user / changeme
```

### Production Deployment
```bash
# Set strong password
export AUTH_PASSWORD=$(openssl rand -base64 32)

# Build and deploy
docker-compose up -d --build

# Access: https://your-domain.com
# Login: user / YourStrongPassword
```

### Key Points
- ✅ Password is baked into Docker image at build time
- ✅ Same image can be deployed to multiple servers
- ✅ To change password, rebuild the image
- ✅ Always use HTTPS in production
- ✅ Store passwords securely (env vars, secrets manager)

---

**Need Help?** See `CHANGE_PASSWORD.md` for password management or `AUTH_CONFIG.md` for security details.

