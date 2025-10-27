// package websocket manages the WebSocket connections and message broadcasting.
package websocket

import (
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients.
	clients map[*websocket.Conn]bool

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
	}
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
