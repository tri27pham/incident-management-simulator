package main

import (
	"fmt"
	"net/http"
)

func main() {
	fmt.Println("✅ Backend service started on port 8080")

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	})

	// Keeps container running and responds to pings
	if err := http.ListenAndServe(":8080", nil); err != nil {
		panic(err)
	}
}
