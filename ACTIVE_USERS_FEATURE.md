# 👥 Active Users Feature

## Overview

Live user presence tracker that shows who's currently viewing the Incident Management Simulator, similar to Google Docs. Each user gets a random anonymous animal name.

---

## ✨ Features

- **🦁 Random Animal Names**: Each user is assigned an anonymous name like "Anonymous Panda", "Anonymous Tiger", etc.
- **🎨 Colored Avatars**: Each user has a unique colored avatar with initials
- **🟢 Live Counter**: Shows how many users are currently online
- **👤 User List**: Displays up to 5 avatars, with overflow indicator
- **💾 Persistent Names**: Names are stored in localStorage and persist across page reloads
- **🔄 Real-time Updates**: Uses existing WebSocket connection to broadcast joins/leaves

---

## 🏗️ Architecture

### Backend Components

#### **`backend/internal/utils/names.go`**
- Generates random animal names
- Provides random colors for avatars
- 50+ animal options

#### **`backend/internal/websocket/hub.go`**
- Tracks active users with `User` struct (id, name, color, joined_at)
- `AddUser()` - Adds user and broadcasts list
- `RemoveUser()` - Removes user and broadcasts list
- `BroadcastUserList()` - Sends user list to all clients

#### **`backend/internal/handlers/incident_handler.go`**
- WebSocket handler processes `user_join` messages
- Automatically removes users on disconnect

### Frontend Components

#### **`frontend/src/utils/nameGenerator.ts`**
- Generates anonymous animal names on frontend
- `getUserName()` - Gets or creates persistent name
- Stores name in localStorage

#### **`frontend/src/components/ActiveUsers.tsx`**
- Displays active users bar at top of page
- Shows colored avatars with initials
- Tooltips with full names
- "You" indicator for current user

#### **`frontend/src/App.tsx`**
- Manages `activeUsers` state
- Sends `user_join` message on WebSocket connect
- Handles `user_list_update` messages
- Displays `<ActiveUsers>` component

---

## 🔄 Data Flow

### User Joins:

```
1. User opens page
   ↓
2. Frontend generates/retrieves animal name from localStorage
   ↓
3. WebSocket connects
   ↓
4. Frontend sends: { type: "user_join", name: "Anonymous Panda" }
   ↓
5. Backend adds user to hub with random color
   ↓
6. Backend broadcasts to ALL clients: { type: "user_list_update", users: [...] }
   ↓
7. All frontends update their active users display
```

### User Leaves:

```
1. User closes tab/browser
   ↓
2. WebSocket disconnects
   ↓
3. Backend removes user from hub
   ↓
4. Backend broadcasts updated user list to remaining clients
```

---

## 🎨 UI Design

```
┌─────────────────────────────────────────────────────────────┐
│ 🟢 3 online  🐼  🐯  🦊  Anonymous Panda, Anonymous...     │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Green pulsing dot for "online" status
- User count
- Colored circle avatars with 2-letter initials
- Blue dot on current user's avatar
- Tooltip on hover showing full name
- "+N" indicator if more than 5 users

---

## 📦 Testing Locally

```bash
# 1. Rebuild with new features
docker compose down
docker compose up --build -d

# 2. Open multiple browsers
open -a Safari http://localhost:3000
open -a "Google Chrome" http://localhost:3000
open -a Firefox http://localhost:3000

# 3. Watch users appear in the active users bar!
```

---

## 🚀 Deploy to VM

```bash
# 1. Switch to VM mode
./scripts/env-switch.sh vm

# 2. Deploy
./scripts/update-vm-standalone.sh
# Choose option 2

# 3. Switch back
./scripts/env-switch.sh local

# 4. Test from multiple devices
# Visit: http://35.231.199.112:3000
```

---

## 💡 Interview Talking Points

**Feature demonstrates:**
- ✅ **WebSocket expertise**: Real-time bidirectional communication
- ✅ **State management**: Tracking users across connections
- ✅ **UX thinking**: Friendly anonymous names, visual feedback
- ✅ **Scalability awareness**: What happens with 100+ users?
- ✅ **Production readiness**: LocalStorage persistence, reconnection handling

**The pitch:**
> "I added Google Docs-style live user presence to demonstrate real-time collaboration capabilities. During incident response, multiple team members need to coordinate - seeing who's actively working on an incident prevents duplicate effort and enables better communication. I implemented this using the existing WebSocket infrastructure with minimal overhead."

---

## 🎯 Technical Details

### Backend:
- **Language**: Go
- **Concurrency**: `sync.RWMutex` for thread-safe user map access
- **Memory**: ~100 bytes per user (negligible)
- **Network**: Broadcasts on join/leave only (minimal traffic)

### Frontend:
- **Storage**: LocalStorage for persistent names
- **State**: React useState for user list
- **Rendering**: Optimized to show max 5 avatars + count

### WebSocket Messages:
```typescript
// Client → Server
{
  type: "user_join",
  name: "Anonymous Panda"
}

// Server → All Clients
{
  type: "user_list_update",
  users: [
    { id: "...", name: "Anonymous Panda", color: "#EF4444", joined_at: "..." },
    { id: "...", name: "Anonymous Tiger", color: "#3B82F6", joined_at: "..." }
  ],
  count: 2
}
```

---

## 🔮 Future Enhancements

- [ ] Show what incident each user is viewing
- [ ] Idle detection (mark away after 5 min)
- [ ] User cursor/activity indicators
- [ ] "Typing..." indicators in incident comments
- [ ] User click to expand full list
- [ ] Admin panel to see all users
- [ ] Analytics: peak users, average session time

---

## 📊 Cost Impact

**None!**
- Uses existing WebSocket connection
- Minimal memory overhead (~100 bytes/user)
- No database storage required
- Broadcasts only on join/leave (not continuous)

---

## ✅ Complete!

The feature is fully implemented and ready to use. Just rebuild and deploy!

**Quick test:**
```bash
# Local
docker compose up --build -d
# Open http://localhost:3000 in multiple browsers

# VM
./scripts/env-switch.sh vm && ./scripts/update-vm-standalone.sh
# Open http://35.231.199.112:3000 from multiple devices
```

Enjoy your Google Docs-style live collaboration! 🦁🐼🦊

