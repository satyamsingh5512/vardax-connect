// Package plugin - Coraza WAF Plugin with ML Integration
// This file contains the core WAF plugin logic with feature extraction,
// gRPC communication, and caching.

package plugin

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/corazawaf/coraza/v3"
	"github.com/corazawaf/coraza/v3/types"
	"github.com/go-redis/redis/v8"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/sentinelas/coraza-plugin/proto"
)

// Config holds WAF plugin configuration
type Config struct {
	MLServiceAddr  string
	GRPCTimeoutMs  int
	ShadowMode     bool
	RedisAddr      string
	MaxRetries     int
	CacheTTLSec    int
	BatchSize      int
	BatchTimeoutMs int
}

// WAFPlugin is the main plugin struct
type WAFPlugin struct {
	config     Config
	waf        coraza.WAF
	grpcClient pb.WAFMLServiceClient
	grpcConn   *grpc.ClientConn
	redis      *redis.Client
	
	// Metrics
	mu              sync.RWMutex
	totalRequests   int64
	blockedRequests int64
	avgLatencyUs    float64
	
	// Batching
	batchChan    chan *batchItem
	batchWorkers int
}

type batchItem struct {
	req      *pb.AnalyzeRequest
	respChan chan *pb.AnalyzeResponse
	errChan  chan error
}

// NewWAFPlugin creates a new WAF plugin instance
func NewWAFPlugin(config Config) (*WAFPlugin, error) {
	// Initialize Coraza WAF
	wafConfig := coraza.NewWAFConfig().
		WithDirectives(`
			SecRuleEngine On
			SecRequestBodyAccess On
			SecResponseBodyAccess On
			SecRequestBodyLimit 13107200
			SecRequestBodyNoFilesLimit 131072
			SecDebugLogLevel 3
		`)

	waf, err := coraza.NewWAF(wafConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Coraza WAF: %w", err)
	}

	// Initialize gRPC connection to ML service
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	grpcConn, err := grpc.DialContext(ctx, config.MLServiceAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		log.Printf("Warning: Failed to connect to ML service: %v (will use fail-open)", err)
	}

	var grpcClient pb.WAFMLServiceClient
	if grpcConn != nil {
		grpcClient = pb.NewWAFMLServiceClient(grpcConn)
	}

	// Initialize Redis for caching
	redisClient := redis.NewClient(&redis.Options{
		Addr:     config.RedisAddr,
		Password: "",
		DB:       0,
	})

	// Test Redis connection
	if _, err := redisClient.Ping(ctx).Result(); err != nil {
		log.Printf("Warning: Redis connection failed: %v (caching disabled)", err)
		redisClient = nil
	}

	plugin := &WAFPlugin{
		config:       config,
		waf:          waf,
		grpcClient:   grpcClient,
		grpcConn:     grpcConn,
		redis:        redisClient,
		batchChan:    make(chan *batchItem, 1000),
		batchWorkers: 4,
	}

	// Start batch workers for high-throughput scenarios
	for i := 0; i < plugin.batchWorkers; i++ {
		go plugin.batchWorker()
	}

	return plugin, nil
}

// Close cleanup resources
func (p *WAFPlugin) Close() error {
	if p.grpcConn != nil {
		p.grpcConn.Close()
	}
	if p.redis != nil {
		p.redis.Close()
	}
	close(p.batchChan)
	return nil
}

// Handler wraps an HTTP handler with WAF protection
func (p *WAFPlugin) Handler(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		startTime := time.Now()
		
		// Create Coraza transaction
		tx := p.waf.NewTransaction()
		defer tx.Close()

		// Process request URI
		tx.ProcessURI(r.URL.String(), r.Method, r.Proto)

		// Process headers
		for key, values := range r.Header {
			for _, value := range values {
				tx.AddRequestHeader(key, value)
			}
		}

		// Extract request body
		var bodyBytes []byte
		if r.Body != nil {
			bodyBytes, _ = io.ReadAll(r.Body)
			r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			
			if len(bodyBytes) > 0 {
				tx.ProcessRequestBody()
			}
		}

		// Extract features for ML analysis
		features := p.extractFeatures(r, bodyBytes)

		// Create analysis request
		analyzeReq := &pb.AnalyzeRequest{
			RequestId:      generateRequestID(),
			Timestamp:      time.Now().UnixMilli(),
			SourceIp:       getClientIP(r),
			Method:         r.Method,
			Uri:            r.URL.String(),
			Protocol:       r.Proto,
			Host:           r.Host,
			UserAgent:      r.Header.Get("User-Agent"),
			ContentType:    r.Header.Get("Content-Type"),
			ContentLength:  int32(len(bodyBytes)),
			Ja4Fingerprint: extractJA4(r), // JA4 fingerprint
			Features:       features,
			RawHeaders:     serializeHeaders(r.Header),
			RawBody:        bodyBytes,
		}

		// Check cache first
		cacheKey := p.computeCacheKey(analyzeReq)
		if cachedResponse := p.getCachedVerdict(cacheKey); cachedResponse != nil {
			p.handleVerdict(w, r, next, cachedResponse, startTime)
			return
		}

		// ML analysis with timeout
		ctx, cancel := context.WithTimeout(r.Context(), 
			time.Duration(p.config.GRPCTimeoutMs)*time.Millisecond)
		defer cancel()

		var mlResponse *pb.AnalyzeResponse
		var mlErr error

		if p.grpcClient != nil {
			mlResponse, mlErr = p.grpcClient.Analyze(ctx, analyzeReq)
		}

		// Fail-open strategy: if ML fails, allow request but log
		if mlErr != nil {
			log.Printf("ML analysis failed (fail-open): %v", mlErr)
			p.logForShadowMode(analyzeReq, nil, mlErr)
			next.ServeHTTP(w, r)
			return
		}

		// Cache the verdict
		p.cacheVerdict(cacheKey, mlResponse)

		// Handle the verdict
		p.handleVerdict(w, r, next, mlResponse, startTime)
	}
}

// extractFeatures extracts numeric features from the request for ML model
func (p *WAFPlugin) extractFeatures(r *http.Request, body []byte) *pb.RequestFeatures {
	features := &pb.RequestFeatures{}

	// Header analysis
	headerStr := serializeHeadersString(r.Header)
	features.HeaderEntropy = float32(shannonEntropy(headerStr))
	features.HeaderCount = int32(len(r.Header))
	
	// Cookie analysis
	cookies := r.Cookies()
	features.CookieCount = int32(len(cookies))
	cookieStr := ""
	for _, c := range cookies {
		cookieStr += c.Value
	}
	features.CookieEntropy = float32(shannonEntropy(cookieStr))

	// URI analysis
	features.UriLength = int32(len(r.URL.String()))
	features.QueryParamCount = int32(len(r.URL.Query()))
	features.PathDepth = int32(strings.Count(r.URL.Path, "/"))
	features.PathEntropy = float32(shannonEntropy(r.URL.Path))

	// Argument analysis
	totalArgLen := 0
	maxArgLen := 0
	allArgs := ""
	for _, values := range r.URL.Query() {
		for _, v := range values {
			totalArgLen += len(v)
			if len(v) > maxArgLen {
				maxArgLen = len(v)
			}
			allArgs += v
		}
	}
	features.TotalArgLength = int32(totalArgLen)
	features.MaxArgLength = int32(maxArgLen)
	features.ArgEntropy = float32(shannonEntropy(allArgs))
	features.SpecialCharCount = int32(countSpecialChars(allArgs))

	// Payload indicators
	combinedPayload := r.URL.String() + string(body)
	features.HasSqlKeywords = containsSQLKeywords(combinedPayload)
	features.HasScriptTags = containsScriptTags(combinedPayload)
	features.HasPathTraversal = containsPathTraversal(combinedPayload)
	features.HasCommandInjection = containsCommandInjection(combinedPayload)

	return features
}

// handleVerdict processes the ML verdict and takes action
func (p *WAFPlugin) handleVerdict(w http.ResponseWriter, r *http.Request, 
	next http.Handler, resp *pb.AnalyzeResponse, startTime time.Time) {
	
	// Update metrics
	p.mu.Lock()
	p.totalRequests++
	latencyUs := float64(time.Since(startTime).Microseconds())
	p.avgLatencyUs = (p.avgLatencyUs*float64(p.totalRequests-1) + latencyUs) / float64(p.totalRequests)
	p.mu.Unlock()

	// Shadow mode: log but don't block
	if p.config.ShadowMode {
		p.logForShadowMode(&pb.AnalyzeRequest{RequestId: resp.RequestId}, resp, nil)
		next.ServeHTTP(w, r)
		return
	}

	switch resp.Verdict {
	case pb.Verdict_VERDICT_BLOCK:
		p.mu.Lock()
		p.blockedRequests++
		p.mu.Unlock()

		// Add SHAP explanation to response headers for debugging
		w.Header().Set("X-Sentinelas-Blocked", "true")
		w.Header().Set("X-Sentinelas-Attack-Type", resp.AttackType.String())
		w.Header().Set("X-Sentinelas-Score", fmt.Sprintf("%.4f", resp.AnomalyScore))
		
		// Log with explanation
		log.Printf("BLOCKED: %s %s from %s - Attack: %s, Score: %.4f, Reason: %s",
			r.Method, r.URL.Path, getClientIP(r),
			resp.AttackType.String(), resp.AnomalyScore,
			resp.Explanation.Summary)

		// Return 403 Forbidden
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":       "Request blocked by WAF",
			"request_id":  resp.RequestId,
			"attack_type": resp.AttackType.String(),
		})

	case pb.Verdict_VERDICT_RATE_LIMIT:
		w.Header().Set("Retry-After", "60")
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"error":"Rate limit exceeded"}`))

	case pb.Verdict_VERDICT_CHALLENGE:
		// Return challenge (CAPTCHA placeholder)
		w.Header().Set("X-Sentinelas-Challenge", "required")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Challenge required","challenge_type":"captcha"}`))

	default:
		// Allow request
		next.ServeHTTP(w, r)
	}

	// If ML generated a rule, apply it dynamically
	if resp.RecommendedRule != nil && resp.RecommendedRule.HasRule {
		p.applyDynamicRule(resp.RecommendedRule)
	}
}

// applyDynamicRule adds a generated SecRule to Coraza
func (p *WAFPlugin) applyDynamicRule(rule *pb.RecommendedRule) {
	if !rule.IsRedosSafe {
		log.Printf("Skipping unsafe rule (ReDoS risk): %d", rule.RuleId)
		return
	}

	log.Printf("Applying dynamic SecRule: ID=%d, Pattern=%s", rule.RuleId, rule.Pattern)
	// In production, this would update Coraza's ruleset
	// p.waf.UpdateRules(rule.Secrule)
}

// getCachedVerdict retrieves a cached verdict from Redis
func (p *WAFPlugin) getCachedVerdict(key string) *pb.AnalyzeResponse {
	if p.redis == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer cancel()

	data, err := p.redis.Get(ctx, "verdict:"+key).Bytes()
	if err != nil {
		return nil
	}

	var resp pb.AnalyzeResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil
	}

	return &resp
}

// cacheVerdict stores a verdict in Redis
func (p *WAFPlugin) cacheVerdict(key string, resp *pb.AnalyzeResponse) {
	if p.redis == nil || resp == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer cancel()

	data, err := json.Marshal(resp)
	if err != nil {
		return
	}

	ttl := time.Duration(p.config.CacheTTLSec) * time.Second
	p.redis.Set(ctx, "verdict:"+key, data, ttl)
}

// computeCacheKey generates a cache key for request fingerprinting
func (p *WAFPlugin) computeCacheKey(req *pb.AnalyzeRequest) string {
	h := sha256.New()
	h.Write([]byte(req.SourceIp))
	h.Write([]byte(req.Method))
	h.Write([]byte(req.Uri))
	h.Write([]byte(req.UserAgent))
	h.Write(req.RawBody)
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// logForShadowMode logs request for shadow mode analysis
func (p *WAFPlugin) logForShadowMode(req *pb.AnalyzeRequest, resp *pb.AnalyzeResponse, err error) {
	logEntry := map[string]interface{}{
		"timestamp":  time.Now().Unix(),
		"request_id": req.RequestId,
		"mode":       "shadow",
	}
	if resp != nil {
		logEntry["verdict"] = resp.Verdict.String()
		logEntry["score"] = resp.AnomalyScore
		logEntry["attack_type"] = resp.AttackType.String()
	}
	if err != nil {
		logEntry["error"] = err.Error()
	}

	data, _ := json.Marshal(logEntry)
	log.Printf("SHADOW: %s", string(data))
}

// batchWorker processes requests in batches for improved throughput
func (p *WAFPlugin) batchWorker() {
	batch := make([]*batchItem, 0, p.config.BatchSize)
	ticker := time.NewTicker(time.Duration(p.config.BatchTimeoutMs) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case item, ok := <-p.batchChan:
			if !ok {
				return
			}
			batch = append(batch, item)
			if len(batch) >= p.config.BatchSize {
				p.processBatch(batch)
				batch = batch[:0]
			}

		case <-ticker.C:
			if len(batch) > 0 {
				p.processBatch(batch)
				batch = batch[:0]
			}
		}
	}
}

func (p *WAFPlugin) processBatch(batch []*batchItem) {
	if p.grpcClient == nil || len(batch) == 0 {
		return
	}

	requests := make([]*pb.AnalyzeRequest, len(batch))
	for i, item := range batch {
		requests[i] = item.req
	}

	ctx, cancel := context.WithTimeout(context.Background(), 
		time.Duration(p.config.GRPCTimeoutMs*2)*time.Millisecond)
	defer cancel()

	resp, err := p.grpcClient.AnalyzeBatch(ctx, &pb.AnalyzeBatchRequest{Requests: requests})
	if err != nil {
		for _, item := range batch {
			item.errChan <- err
		}
		return
	}

	for i, item := range batch {
		if i < len(resp.Responses) {
			item.respChan <- resp.Responses[i]
		} else {
			item.errChan <- fmt.Errorf("missing response for request %d", i)
		}
	}
}

// Helper functions

func generateRequestID() string {
	return fmt.Sprintf("%d-%x", time.Now().UnixNano(), time.Now().UnixNano()%1000000)
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	return strings.Split(r.RemoteAddr, ":")[0]
}

func serializeHeaders(h http.Header) []byte {
	data, _ := json.Marshal(h)
	return data
}

func serializeHeadersString(h http.Header) string {
	var sb strings.Builder
	for k, v := range h {
		sb.WriteString(k)
		sb.WriteString(": ")
		sb.WriteString(strings.Join(v, ", "))
		sb.WriteString("\n")
	}
	return sb.String()
}

func shannonEntropy(s string) float64 {
	if len(s) == 0 {
		return 0
	}
	
	freq := make(map[rune]float64)
	for _, c := range s {
		freq[c]++
	}
	
	var entropy float64
	length := float64(len(s))
	for _, count := range freq {
		p := count / length
		if p > 0 {
			entropy -= p * math.Log2(p)
		}
	}
	return entropy
}

func countSpecialChars(s string) int {
	specialChars := regexp.MustCompile(`[<>'";&|$(){}[\]\\]`)
	return len(specialChars.FindAllString(s, -1))
}

func containsSQLKeywords(s string) bool {
	sqlKeywords := regexp.MustCompile(`(?i)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR\s+\d+=\d+|AND\s+\d+=\d+|'--|;--)`)
	return sqlKeywords.MatchString(s)
}

func containsScriptTags(s string) bool {
	scriptPattern := regexp.MustCompile(`(?i)(<script|javascript:|on\w+\s*=|<iframe|<object|<embed)`)
	return scriptPattern.MatchString(s)
}

func containsPathTraversal(s string) bool {
	pathPattern := regexp.MustCompile(`(\.\./|\.\.\\|%2e%2e%2f|%2e%2e/|\.%2e/|%2e\./)`)
	return pathPattern.MatchString(strings.ToLower(s))
}

func containsCommandInjection(s string) bool {
	cmdPattern := regexp.MustCompile("(;|\\||`|\\$\\(|&&|\\|\\|)")
	return cmdPattern.MatchString(s)
}

// extractJA4 extracts JA4 TLS fingerprint from request context
// This is a stub - in production, integrate with ja4 library
func extractJA4(r *http.Request) string {
	// JA4 fingerprint would be extracted from TLS connection state
	// For now, return placeholder - see J) for full implementation
	if r.TLS != nil {
		// In production: use github.com/FoxIO-LLC/ja4 or similar
		return "t13d1516h2_8daaf6152771_02713d6af862" // Placeholder
	}
	return ""
}
