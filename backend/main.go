package main

import (
	"log"

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
	db.DB.AutoMigrate(&models.Incident{})

	r := router.SetupRouter()
	log.Println("🚀 Backend running on http://localhost:8080")
	r.Run(":8080")
}
