package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/tri27pham/incident-management-simulator/backend/internal/db"
	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
	"github.com/tri27pham/incident-management-simulator/backend/internal/router"
)

func main() {
	err := godotenv.Load("../.env")
	if err != nil {
		log.Println("Note: .env file not found, relying on environment variables")
	}

	db.ConnectDatabase()
	db.DB.AutoMigrate(&models.Incident{}, &models.IncidentAnalysis{})

	r := router.SetupRouter()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Backend running on http://localhost:%s", port)
	r.Run(":" + port)
}
