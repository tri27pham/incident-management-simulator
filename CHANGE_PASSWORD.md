# How to Change the Password

## 🔐 Quick Guide

The application uses a **fixed username** (`user`) and a **customizable password**.

### Default Login
- Username: `user`
- Password: `changeme`

⚠️ **You MUST change the password before deploying!**

---

## 📝 Step-by-Step Instructions

### Option 1: One-Line Command (Easiest)

Just run this command with your desired password:

```bash
AUTH_PASSWORD=YourSecurePassword123 docker-compose up -d --build frontend
```

**Example:**
```bash
AUTH_PASSWORD=MySecret2025! docker-compose up -d --build frontend
```

That's it! The password is now changed.

---

### Option 2: Using Environment Variables

**Step 1:** Set the environment variable

```bash
export AUTH_PASSWORD=YourSecurePassword123
```

**Step 2:** Rebuild the frontend

```bash
docker-compose up -d --build frontend
```

---

### Option 3: Using a .env File

**Step 1:** Create a `.env` file in the project root

```bash
echo "AUTH_PASSWORD=YourSecurePassword123" > .env
```

**Step 2:** Rebuild the frontend

```bash
docker-compose up -d --build frontend
```

**Note:** The `.env` file is in `.gitignore` so it won't be committed to git.

---

## 🧪 Test the New Password

After changing the password, test it:

```bash
# This should fail (old password)
curl -u user:changeme http://localhost:3000

# This should work (new password)
curl -u user:YourSecurePassword123 http://localhost:3000
```

Or open `http://localhost:3000` in your browser and use:
- Username: `user`
- Password: `YourSecurePassword123`

---

## 💡 Password Requirements

For maximum security, your password should:
- ✅ Be at least 20 characters long
- ✅ Include uppercase and lowercase letters
- ✅ Include numbers
- ✅ Include special characters (!@#$%^&*)
- ✅ Be randomly generated (not a dictionary word)

### Generate a Strong Password

**macOS/Linux:**
```bash
openssl rand -base64 32
```

**Example output:** `7xK2mP9qL4nW8vR5tY3sD6fG1hJ0kZ2c`

---

## 🔄 Changing Password Later

To change the password after initial deployment:

1. Stop the frontend:
   ```bash
   docker-compose stop frontend
   ```

2. Set new password and rebuild:
   ```bash
   AUTH_PASSWORD=NewPassword123 docker-compose up -d --build frontend
   ```

3. Done! New password is active.

---

## 🚨 Important Notes

1. **Username is fixed** - Always `user`, you can't change it (keeps things simple)
2. **Browser caches credentials** - Users need to clear browser cache or use incognito to logout
3. **Password in environment** - The password is stored in the Docker image during build
4. **Rebuild required** - You must rebuild the frontend container to change the password
5. **No API to change password** - Password is set at build time, not runtime

---

## ❓ Troubleshooting

### "Old password still works"
- You didn't rebuild the frontend. Run:
  ```bash
  docker-compose up -d --build frontend
  ```
  The `--build` flag is required!

### "Can't login with new password"
- Check you're using username `user` (not `admin`)
- Make sure no typos in the password
- Try in an incognito window (clears cached credentials)

### "Browser won't ask for password again"
- Browser cached old credentials
- Clear browser cache or use incognito mode
- Or wait for the cached session to expire

---

## 📋 Quick Reference

| Action | Command |
|--------|---------|
| Change password | `AUTH_PASSWORD=newpass docker-compose up -d --build frontend` |
| Generate password | `openssl rand -base64 32` |
| Test password | `curl -u user:newpass http://localhost:3000` |
| View current container | `docker ps \| grep frontend` |

---

**Remember:** The username is always `user`, only the password changes!

