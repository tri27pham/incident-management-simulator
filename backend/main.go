package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/tri27pham/incident-management-simulator/backend/internal/db"
	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
	"github.com/tri27pham/incident-management-simulator/backend/internal/router"
	"github.com/tri27pham/incident-management-simulator/backend/internal/websocket"
)

func main() {
	err := godotenv.Load("../.env")
	if err != nil {
		log.Println("Note: .env file not found, relying on environment variables")
	}

	db.ConnectDatabase()
	db.DB.AutoMigrate(&models.Incident{}, &models.IncidentAnalysis{}, &models.StatusHistory{}, &models.AgentExecution{})

	// Start the WebSocket hub in a separate goroutine
	go websocket.WSHub.Run()

	r := router.SetupRouter()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Backend running on http://localhost:%s", port)
	r.Run(":" + port)
}
