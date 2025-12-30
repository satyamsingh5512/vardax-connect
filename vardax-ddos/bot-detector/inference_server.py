#!/usr/bin/env python3
"""
vardax-ddos/bot-detector/inference_server.py
VardaX Bot Detection - Inference API Server

FastAPI server for real-time bot detection scoring.
Supports batch inference and micro-batching for efficiency.
"""

import os
import time
import json
import asyncio
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from pathlib import Path
from collections import deque
import threading

import numpy as np
import lightgbm as lgb
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import redis.asyncio as redis
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from starlette.responses import Response

from feature_extractor import FeatureExtractor, RequestContext, FEATURE_NAMES

# Configuration
MODEL_PATH = os.getenv("MODEL_PATH", "models/bot_detector_lgb_latest.txt")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))
BATCH_TIMEOUT_MS = int(os.getenv("BATCH_TIMEOUT_MS", "10"))
CACHE_TTL = int(os.getenv("CACHE_TTL", "60"))

# Prometheus metrics
INFERENCE_REQUESTS = Counter(
    'vardax_bot_inference_requests_total',
    'Total inference requests',
    ['result']
)
INFERENCE_LATENCY = Histogram(
    'vardax_bot_inference_latency_seconds',
    'Inference latency',
    buckets=[0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1]
)
BATCH_SIZE_HISTOGRAM = Histogram(
    'vardax_bot_batch_size',
    'Batch sizes',
    buckets=[1, 5, 10, 25, 50, 100, 200]
)
MODEL_VERSION = Gauge(
    'vardax_bot_model_version',
    'Current model version timestamp'
)
CACHE_HITS = Counter(
    'vardax_bot_cache_hits_total',
    'Cache hits'
)
CACHE_MISSES = Counter(
    'vardax_bot_cache_misses_total',
    'Cache misses'
)

# Request/Response models
class InferenceRequest(BaseModel):
    """Single inference request"""
    ip: str
    method: str = "GET"
    path: str = "/"
    query_string: str = ""
    headers: Dict[str, str] = Field(default_factory=dict)
    body_size: int = 0
    ja3_fingerprint: str = ""
    tls_version: str = ""
    tls_cipher: str = ""
    country_code: str = ""
    asn: int = 0
    challenge_passed: bool = False
    challenge_time_ms: float = 0
    js_signals: Dict[str, Any] = Field(default_factory=dict)


class InferenceResponse(BaseModel):
    """Inference response"""
    score: float
    is_bot: bool
    confidence: float
    action: str  # allow, challenge, block
    features_used: int
    latency_ms: float
    cached: bool = False


class BatchInferenceRequest(BaseModel):
    """Batch inference request"""
    requests: List[InferenceRequest]


class BatchInferenceResponse(BaseModel):
    """Batch inference response"""
    results: List[InferenceResponse]
    batch_size: int
    total_latency_ms: float


class ModelInfo(BaseModel):
    """Model information"""
    version: str
    feature_count: int
    feature_names: List[str]
    thresholds: Dict[str, float]


# Micro-batching queue
@dataclass
class PendingRequest:
    request: InferenceRequest
    future: asyncio.Future
    timestamp: float


class MicroBatcher:
    """Micro-batching for efficient inference"""
    
    def __init__(self, model, feature_extractor, batch_size: int, timeout_ms: int):
        self.model = model
        self.feature_extractor = feature_extractor
        self.batch_size = batch_size
        self.timeout_ms = timeout_ms
        self.queue: deque = deque()
        self.lock = asyncio.Lock()
        self._running = False
        self._task = None
    
    async def start(self):
        """Start the batching loop"""
        self._running = True
        self._task = asyncio.create_task(self._batch_loop())
    
    async def stop(self):
        """Stop the batching loop"""
        self._running = False
        if self._task:
            self._task.cancel()
    
    async def submit(self, request: InferenceRequest) -> InferenceResponse:
        """Submit request for batched inference"""
        future = asyncio.get_event_loop().create_future()
        pending = PendingRequest(
            request=request,
            future=future,
            timestamp=time.time()
        )
        
        async with self.lock:
            self.queue.append(pending)
        
        return await future
    
    async def _batch_loop(self):
        """Main batching loop"""
        while self._running:
            await asyncio.sleep(self.timeout_ms / 1000)
            
            async with self.lock:
                if not self.queue:
                    continue
                
                # Collect batch
                batch = []
                while self.queue and len(batch) < self.batch_size:
                    batch.append(self.queue.popleft())
            
            if batch:
                await self._process_batch(batch)
    
    async def _process_batch(self, batch: List[PendingRequest]):
        """Process a batch of requests"""
        start_time = time.time()
        
        # Extract features
        feature_vectors = []
        for pending in batch:
            ctx = RequestContext(
                ip=pending.request.ip,
                method=pending.request.method,
                path=pending.request.path,
                query_string=pending.request.query_string,
                headers=pending.request.headers,
                body_size=pending.request.body_size,
                ja3_fingerprint=pending.request.ja3_fingerprint,
                tls_version=pending.request.tls_version,
                tls_cipher=pending.request.tls_cipher,
                country_code=pending.request.country_code,
                asn=pending.request.asn,
                challenge_passed=pending.request.challenge_passed,
                challenge_time_ms=pending.request.challenge_time_ms,
                js_signals=pending.request.js_signals,
            )
            fv = self.feature_extractor.extract(ctx)
            feature_vectors.append(fv.to_array(FEATURE_NAMES))
        
        # Batch inference
        X = np.array(feature_vectors)
        scores = self.model.predict(X)
        
        # Create responses
        latency_ms = (time.time() - start_time) * 1000
        
        for i, pending in enumerate(batch):
            score = float(scores[i])
            response = InferenceResponse(
                score=score,
                is_bot=score >= 0.7,
                confidence=abs(score - 0.5) * 2,
                action=self._score_to_action(score),
                features_used=len(FEATURE_NAMES),
                latency_ms=latency_ms / len(batch),
                cached=False,
            )
            pending.future.set_result(response)
        
        # Update metrics
        BATCH_SIZE_HISTOGRAM.observe(len(batch))
        INFERENCE_LATENCY.observe(latency_ms / 1000)
    
    def _score_to_action(self, score: float) -> str:
        """Convert score to action"""
        if score >= 0.8:
            return "block"
        elif score >= 0.5:
            return "challenge"
        else:
            return "allow"


# FastAPI app
app = FastAPI(
    title="VardaX Bot Detection API",
    description="Real-time bot detection scoring service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
model = None
feature_extractor = None
redis_client = None
micro_batcher = None
model_info = None


@app.on_event("startup")
async def startup():
    """Initialize on startup"""
    global model, feature_extractor, redis_client, micro_batcher, model_info
    
    # Load model
    print(f"Loading model from {MODEL_PATH}")
    model = lgb.Booster(model_file=MODEL_PATH)
    
    # Get model info
    model_path = Path(MODEL_PATH)
    model_info = ModelInfo(
        version=model_path.stem.split('_')[-1] if '_' in model_path.stem else "unknown",
        feature_count=len(FEATURE_NAMES),
        feature_names=FEATURE_NAMES,
        thresholds={
            "challenge": 0.5,
            "block": 0.8,
        }
    )
    MODEL_VERSION.set(hash(model_info.version) % 1000000)
    
    # Initialize feature extractor
    feature_extractor = FeatureExtractor()
    
    # Connect to Redis
    try:
        redis_client = redis.from_url(REDIS_URL)
        await redis_client.ping()
        print(f"Connected to Redis at {REDIS_URL}")
    except Exception as e:
        print(f"Redis not available: {e}")
        redis_client = None
    
    # Start micro-batcher
    micro_batcher = MicroBatcher(
        model=model,
        feature_extractor=feature_extractor,
        batch_size=BATCH_SIZE,
        timeout_ms=BATCH_TIMEOUT_MS,
    )
    await micro_batcher.start()
    
    print("Bot detection service started")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    if micro_batcher:
        await micro_batcher.stop()
    if redis_client:
        await redis_client.close()


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": model is not None}


@app.get("/info", response_model=ModelInfo)
async def info():
    """Get model information"""
    return model_info


@app.post("/score", response_model=InferenceResponse)
async def score(request: InferenceRequest):
    """Score a single request"""
    start_time = time.time()
    
    # Check cache
    if redis_client:
        cache_key = f"vardax:score:{request.ip}:{hash(request.path)}"
        cached = await redis_client.get(cache_key)
        if cached:
            CACHE_HITS.inc()
            response = InferenceResponse(**json.loads(cached))
            response.cached = True
            return response
        CACHE_MISSES.inc()
    
    # Use micro-batcher for inference
    response = await micro_batcher.submit(request)
    
    # Cache result
    if redis_client:
        await redis_client.setex(
            cache_key,
            CACHE_TTL,
            json.dumps(response.dict())
        )
    
    # Update metrics
    INFERENCE_REQUESTS.labels(result=response.action).inc()
    
    return response


@app.post("/score/batch", response_model=BatchInferenceResponse)
async def score_batch(request: BatchInferenceRequest):
    """Score a batch of requests"""
    start_time = time.time()
    
    # Process all requests
    tasks = [micro_batcher.submit(req) for req in request.requests]
    results = await asyncio.gather(*tasks)
    
    total_latency = (time.time() - start_time) * 1000
    
    return BatchInferenceResponse(
        results=results,
        batch_size=len(results),
        total_latency_ms=total_latency,
    )


@app.post("/feedback")
async def feedback(
    ip: str,
    is_bot: bool,
    score: float,
    background_tasks: BackgroundTasks,
):
    """Submit feedback for online learning"""
    # Store feedback for model retraining
    if redis_client:
        feedback_data = {
            "ip": ip,
            "is_bot": is_bot,
            "score": score,
            "timestamp": time.time(),
        }
        await redis_client.lpush("vardax:feedback", json.dumps(feedback_data))
        await redis_client.ltrim("vardax:feedback", 0, 100000)  # Keep last 100k
    
    return {"status": "received"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(
        content=generate_latest(),
        media_type="text/plain"
    )


# gRPC service for Envoy ext_authz (optional)
# This would be implemented separately using grpcio


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "inference_server:app",
        host="0.0.0.0",
        port=8083,
        workers=4,
        log_level="info",
    )
