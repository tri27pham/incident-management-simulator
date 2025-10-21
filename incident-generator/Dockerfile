# Simple Go container for a scheduled generator
FROM golang:1.25.3-alpine
WORKDIR /app
COPY . .
RUN go mod tidy && go build -o generator main.go
CMD ["./generator"]
