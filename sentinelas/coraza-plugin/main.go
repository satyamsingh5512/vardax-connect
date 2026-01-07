// Package main - Coraza WAF Plugin for Sentinelas
// This plugin integrates Coraza WAF with the Python ML service via gRPC
// Build: go build -o coraza-plugin .
// Run: ./coraza-plugin -config config.yaml

package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sentinelas/coraza-plugin/plugin"
)

func main() {
	// Configuration from environment
	mlServiceAddr := getEnv("ML_SERVICE_ADDR", "localhost:50051")
	grpcTimeoutMs := getEnvInt("GRPC_TIMEOUT_MS", 10)
	shadowMode := getEnv("SHADOW_MODE", "false") == "true"
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	listenAddr := getEnv("LISTEN_ADDR", ":8080")

	// Initialize the WAF plugin
	wafPlugin, err := plugin.NewWAFPlugin(plugin.Config{
		MLServiceAddr:  mlServiceAddr,
		GRPCTimeoutMs:  grpcTimeoutMs,
		ShadowMode:     shadowMode,
		RedisAddr:      redisAddr,
		MaxRetries:     3,
		CacheTTLSec:    300,
		BatchSize:      32,
		BatchTimeoutMs: 5,
	})
	if err != nil {
		log.Fatalf("Failed to initialize WAF plugin: %v", err)
	}
	defer wafPlugin.Close()

	// Create HTTP server with WAF middleware
	mux := http.NewServeMux()
	
	// Health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy"}`))
	})

	// Upstream proxy (protected application)
	mux.HandleFunc("/", wafPlugin.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// This would normally proxy to your backend
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message":"Request passed WAF inspection"}`))
	})))

	server := &http.Server{
		Addr:         listenAddr,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		log.Println("Shutting down WAF plugin...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("Sentinelas WAF Plugin starting on %s (shadow_mode=%v)", listenAddr, shadowMode)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		var result int
		if _, err := fmt.Sscanf(val, "%d", &result); err == nil {
			return result
		}
	}
	return defaultVal
}
