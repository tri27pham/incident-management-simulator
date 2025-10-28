# Basic Authentication Configuration

## 🔐 Overview

The incident management simulator is now protected with HTTP Basic Authentication at the nginx level. This ensures **no one can access the application without valid credentials**, including:
- Frontend UI
- All static assets (JS, CSS, images)
- API calls (since they go through the same domain)

## 🚀 Quick Start

### Default Credentials (CHANGE BEFORE DEPLOYING!)

```
Username: admin
Password: changeme
```

### Setting Custom Credentials

**Option 1: Environment Variables (Recommended for Production)**

Create a `.env` file in the project root:

```bash
AUTH_USERNAME=your_secure_username
AUTH_PASSWORD=your_secure_password
```

Then rebuild:

```bash
docker-compose up -d --build frontend
```

**Option 2: Command Line**

```bash
AUTH_USERNAME=myuser AUTH_PASSWORD=mypass docker-compose up -d --build frontend
```

**Option 3: Export Environment Variables**

```bash
export AUTH_USERNAME=myuser
export AUTH_PASSWORD=mypass
docker-compose up -d --build frontend
```

## 🛡️ Security Features

### What's Protected

✅ **Frontend UI** - All pages require authentication
✅ **Static Assets** - JavaScript, CSS, images all protected
✅ **API Endpoints** - Backend APIs accessed through authenticated frontend
✅ **WebSocket Connections** - Real-time updates protected by same auth
✅ **Health Monitor Triggers** - Cannot trigger failures without auth

### How It Works

1. **Nginx Basic Auth**: Credentials are checked at the web server level before any content is served
2. **BCrypt Password Hashing**: Passwords are hashed using htpasswd (BCrypt)
3. **Secure Storage**: Credentials stored in `/etc/nginx/.htpasswd` inside the container
4. **Session Cookie**: Browser saves credentials after first successful login

### Why This Can't Be Bypassed

- Authentication happens at nginx level, before React app loads
- No client-side JavaScript can bypass it
- Even direct API calls require authentication
- Container filesystem is isolated
- No backdoor routes or public endpoints

## 🔧 Advanced Configuration

### Multiple Users

To add multiple users, modify the Dockerfile:

```dockerfile
# Create htpasswd file with multiple users
RUN htpasswd -cb /etc/nginx/.htpasswd "admin" "admin_password" && \
    htpasswd -b /etc/nginx/.htpasswd "user1" "user1_password" && \
    htpasswd -b /etc/nginx/.htpasswd "user2" "user2_password"
```

### Stronger Passwords

Generate a strong password:

```bash
# macOS/Linux
openssl rand -base64 32

# Or use a password manager
# Example: Y8$mK9#nL2@pQ7!wR4&xT6^vZ3*sD1
```

### Custom Auth Realm

Edit `frontend/nginx.conf`:

```nginx
auth_basic "Your Custom Message Here";
```

## 📝 Deployment Checklist

Before deploying to production:

- [ ] Change default username from "admin"
- [ ] Set a strong password (20+ characters, mixed case, numbers, symbols)
- [ ] Store credentials in environment variables, NOT in code
- [ ] Test authentication works
- [ ] Verify no bypass routes exist
- [ ] Document credentials in secure password manager
- [ ] Consider adding HTTPS for encrypted transmission

## 🧪 Testing Authentication

### Test 1: Without Credentials (Should Fail)

```bash
curl http://localhost:3000
# Expected: 401 Unauthorized
```

### Test 2: With Wrong Credentials (Should Fail)

```bash
curl -u wronguser:wrongpass http://localhost:3000
# Expected: 401 Unauthorized
```

### Test 3: With Correct Credentials (Should Succeed)

```bash
curl -u admin:changeme http://localhost:3000
# Expected: 200 OK with HTML content
```

### Test 4: Browser Access

1. Open http://localhost:3000
2. Should see browser authentication popup
3. Enter username and password
4. Should successfully load the application

## 🚨 Security Considerations

### What This Protects Against

✅ Unauthorized access to the application
✅ Anonymous users triggering incidents
✅ Public exposure of your simulator
✅ Accidental discovery of the URL

### What This Does NOT Protect Against

❌ **Man-in-the-middle attacks** - Use HTTPS in production
❌ **Credential sharing** - Users can share credentials
❌ **Brute force attacks** - Consider rate limiting for production
❌ **Session hijacking** - Use HTTPS and secure cookies

### Production Recommendations

1. **Use HTTPS**: Add SSL/TLS certificate
2. **Strong Passwords**: 20+ characters, randomly generated
3. **Rate Limiting**: Add nginx rate limiting
4. **IP Whitelisting**: Restrict to known IPs if possible
5. **Monitoring**: Log authentication attempts
6. **Rotation**: Change passwords periodically

## 🔄 Changing Credentials After Deployment

**Step 1: Update Environment Variables**

```bash
export AUTH_USERNAME=newuser
export AUTH_PASSWORD=newpassword
```

**Step 2: Rebuild Frontend Container**

```bash
docker-compose up -d --build frontend
```

**Step 3: Verify**

```bash
# Old credentials should fail
curl -u admin:changeme http://localhost:3000
# Expected: 401 Unauthorized

# New credentials should work
curl -u newuser:newpassword http://localhost:3000
# Expected: 200 OK
```

## 📚 Additional Resources

- [Nginx Basic Auth Documentation](http://nginx.org/en/docs/http/ngx_http_auth_basic_module.html)
- [htpasswd Documentation](https://httpd.apache.org/docs/2.4/programs/htpasswd.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## ⚠️ IMPORTANT WARNINGS

1. **Default credentials are "admin/changeme"** - Change them immediately!
2. **Basic Auth sends credentials with every request** - Use HTTPS in production
3. **Browsers cache credentials** - Users must clear cache to logout
4. **Passwords are hashed but transmitted in Base64** - Again, use HTTPS!

---

**Last Updated**: October 28, 2025
**Security Level**: Basic (suitable for internal demos, upgrade for production)

