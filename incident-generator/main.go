package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("✅ Incident Generator service running...")

	for {
		fmt.Println("📡 Waiting to generate incidents...")
		time.Sleep(15 * time.Second)
	}
}
