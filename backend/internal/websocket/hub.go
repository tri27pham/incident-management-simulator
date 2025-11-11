// package websocket manages the WebSocket connections and message broadcasting.
package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/tri27pham/incident-management-simulator/backend/internal/utils"
)

// User represents a connected user
type User struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Color    string    `json:"color"`
	Emoji    string    `json:"emoji"`
	JoinedAt time.Time `json:"joined_at"`
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients.
	clients map[*websocket.Conn]bool

	// Users mapped to their connections
	users      map[*websocket.Conn]*User
	usersMutex sync.RWMutex

	// Inbound messages from the clients.
	Broadcast chan interface{}

	// Register requests from the clients.
	Register chan *websocket.Conn

	// Unregister requests from clients.
	Unregister chan *websocket.Conn
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	return &Hub{
		Broadcast:  make(chan interface{}, 100), // Buffered channel to prevent blocking
		Register:   make(chan *websocket.Conn),
		Unregister: make(chan *websocket.Conn),
		clients:    make(map[*websocket.Conn]bool),
		users:      make(map[*websocket.Conn]*User),
	}
}

// AddUser adds a user to the hub and broadcasts the updated user list
func (h *Hub) AddUser(conn *websocket.Conn, userName string) {
	h.usersMutex.Lock()
	animal := utils.GenerateRandomAnimal()
	user := &User{
		ID:       utils.GenerateAnonymousName(), // Use animal name as ID for uniqueness
		Name:     userName,
		Color:    utils.GenerateRandomColor(),
		Emoji:    animal.Emoji,
		JoinedAt: time.Now(),
	}
	h.users[conn] = user
	h.usersMutex.Unlock()

	log.Printf("👤 User joined: %s (%s)", userName, animal.Emoji)
	h.BroadcastUserList()
}

// RemoveUser removes a user from the hub and broadcasts the updated user list
func (h *Hub) RemoveUser(conn *websocket.Conn) {
	h.usersMutex.Lock()
	user, exists := h.users[conn]
	if exists {
		log.Printf("👋 User left: %s", user.Name)
		delete(h.users, conn)
	}
	h.usersMutex.Unlock()

	if exists {
		h.BroadcastUserList()
	}
}

// BroadcastUserList sends the current user list to all connected clients
func (h *Hub) BroadcastUserList() {
	h.usersMutex.RLock()
	users := make([]*User, 0, len(h.users))
	for _, user := range h.users {
		users = append(users, user)
	}
	h.usersMutex.RUnlock()

	message := map[string]interface{}{
		"type":  "user_list_update",
		"users": users,
		"count": len(users),
	}

	h.Broadcast <- message
}

// Run starts the hub's event loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.clients[client] = true
			log.Printf("✅ WebSocket client connected (total clients: %d)", len(h.clients))
		case client := <-h.Unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				h.RemoveUser(client) // Remove user and broadcast update
				client.Close()
				log.Printf("❌ WebSocket client disconnected (remaining clients: %d)", len(h.clients))
			}
		case message := <-h.Broadcast:
			// Convert the message to JSON
			jsonMessage, err := json.Marshal(message)
			if err != nil {
				log.Printf("❌ Error marshalling broadcast message: %v", err)
				continue
			}

			log.Printf("📡 Broadcasting to %d clients (message size: %d bytes)", len(h.clients), len(jsonMessage))

			// Send the message to all connected clients
			sentCount := 0
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, jsonMessage)
				if err != nil {
					log.Printf("❌ Error writing message to client: %v", err)
					h.Unregister <- client
				} else {
					sentCount++
				}
			}

			log.Printf("✅ Successfully sent message to %d/%d clients", sentCount, len(h.clients))
		}
	}
}

// Global WebSocket hub instance
var WSHub = NewHub()
