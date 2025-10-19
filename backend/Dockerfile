# Use small official Go image with Alpine for minimal size
FROM golang:1.25.3-alpine

# Set working directory inside the container
WORKDIR /app

# Copy go.mod/go.sum first for better build caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code after dependencies
COPY . .

# Compile binary (faster startup than 'go run' in production)
RUN go build -o server main.go

# Expose backend API port
EXPOSE 8080

# Default command to start server
CMD ["./server"]
