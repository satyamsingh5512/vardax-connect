"""
Sentinelas ML Service - Main Entry Point
Runs both FastAPI REST server and gRPC server concurrently.
"""

import asyncio
import logging
import os
import signal
import sys
from concurrent import futures
from contextlib import asynccontextmanager
from typing import Optional

import grpc
import redis.asyncio as redis
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.grpc_server import WAFMLServiceServicer, serve_grpc
from app.models.autoencoder import AutoencoderModel
from app.models.classifier import XGBoostClassifier
from app.explainer.shap_explainer import SHAPExplainer
from app.rule_generator.generator import RuleGenerator

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global state
class AppState:
    autoencoder: Optional[AutoencoderModel] = None
    classifier: Optional[XGBoostClassifier] = None
    shap_explainer: Optional[SHAPExplainer] = None
    rule_generator: Optional[RuleGenerator] = None
    redis_client: Optional[redis.Redis] = None
    active_websockets: list[WebSocket] = []
    total_inferences: int = 0
    avg_inference_time_ms: float = 0.0

state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - startup and shutdown."""
    logger.info("Starting Sentinelas ML Service...")
    
    # Load models
    model_path = os.getenv("MODEL_PATH", "/app/saved_models")
    
    try:
        # Load Autoencoder
        state.autoencoder = AutoencoderModel()
        autoencoder_path = os.path.join(model_path, "autoencoder.pt")
        if os.path.exists(autoencoder_path):
            state.autoencoder.load(autoencoder_path)
            logger.info("Autoencoder model loaded successfully")
        else:
            logger.warning(f"Autoencoder model not found at {autoencoder_path}, using untrained model")
        
        # Load XGBoost classifier
        state.classifier = XGBoostClassifier()
        classifier_path = os.path.join(model_path, "xgboost_model.json")
        if os.path.exists(classifier_path):
            state.classifier.load(classifier_path)
            logger.info("XGBoost classifier loaded successfully")
        else:
            logger.warning(f"Classifier not found at {classifier_path}, using untrained model")
        
        # Initialize SHAP explainer
        state.shap_explainer = SHAPExplainer(state.classifier)
        logger.info("SHAP explainer initialized")
        
        # Initialize rule generator
        state.rule_generator = RuleGenerator()
        logger.info("Rule generator initialized")
        
        # Connect to Redis
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        state.redis_client = redis.from_url(redis_url, decode_responses=True)
        await state.redis_client.ping()
        logger.info("Redis connection established")
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        # Continue with degraded functionality
    
    # Start gRPC server in background
    grpc_task = asyncio.create_task(run_grpc_server())
    
    logger.info("Sentinelas ML Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Sentinelas ML Service...")
    grpc_task.cancel()
    if state.redis_client:
        await state.redis_client.close()


async def run_grpc_server():
    """Run gRPC server in asyncio-compatible way."""
    await serve_grpc(state)


# Create FastAPI app
app = FastAPI(
    title="Sentinelas ML Service",
    description="ML-powered WAF decision engine with XAI",
    version="1.0.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# REST Endpoints

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "components": {
            "autoencoder": state.autoencoder is not None,
            "classifier": state.classifier is not None,
            "shap_explainer": state.shap_explainer is not None,
            "redis": state.redis_client is not None,
        },
        "metrics": {
            "total_inferences": state.total_inferences,
            "avg_inference_time_ms": round(state.avg_inference_time_ms, 3),
        }
    }


@app.get("/api/v1/stats")
async def get_stats():
    """Get service statistics."""
    return {
        "total_inferences": state.total_inferences,
        "avg_inference_time_ms": state.avg_inference_time_ms,
        "models_loaded": {
            "autoencoder": state.autoencoder.is_loaded() if state.autoencoder else False,
            "classifier": state.classifier.is_loaded() if state.classifier else False,
        }
    }


@app.get("/api/v1/alerts")
async def get_recent_alerts(limit: int = 100):
    """Get recent alerts from Redis."""
    if not state.redis_client:
        return {"alerts": []}
    
    try:
        alerts = await state.redis_client.lrange("alerts:recent", 0, limit - 1)
        return {"alerts": [eval(a) for a in alerts]}  # Use orjson in production
    except Exception as e:
        logger.error(f"Error fetching alerts: {e}")
        return {"alerts": [], "error": str(e)}


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """WebSocket endpoint for real-time alert streaming."""
    await websocket.accept()
    state.active_websockets.append(websocket)
    logger.info(f"WebSocket client connected, total: {len(state.active_websockets)}")
    
    try:
        while True:
            # Keep connection alive, alerts are pushed via broadcast_alert
            await websocket.receive_text()
    except WebSocketDisconnect:
        state.active_websockets.remove(websocket)
        logger.info(f"WebSocket client disconnected, remaining: {len(state.active_websockets)}")


async def broadcast_alert(alert: dict):
    """Broadcast alert to all connected WebSocket clients."""
    for ws in state.active_websockets:
        try:
            await ws.send_json(alert)
        except Exception as e:
            logger.error(f"Error broadcasting to WebSocket: {e}")


@app.post("/api/v1/analyze")
async def analyze_request(request_data: dict):
    """REST endpoint for request analysis (alternative to gRPC)."""
    import time
    start_time = time.time()
    
    try:
        # Extract features
        features = request_data.get("features", {})
        feature_vector = _dict_to_feature_vector(features)
        
        # Run inference
        anomaly_score = 0.0
        if state.autoencoder:
            anomaly_score = state.autoencoder.predict(feature_vector)
        
        # Classify attack type
        attack_type = "BENIGN"
        confidence = 0.0
        if state.classifier:
            attack_type, confidence = state.classifier.predict(feature_vector)
        
        # Get SHAP explanation
        explanation = {}
        if state.shap_explainer:
            explanation = state.shap_explainer.explain(feature_vector)
        
        # Generate rule if malicious
        recommended_rule = None
        if anomaly_score > 0.7 or attack_type != "BENIGN":
            recommended_rule = state.rule_generator.generate(
                request_data, attack_type, explanation
            )
        
        inference_time_ms = (time.time() - start_time) * 1000
        
        # Update metrics
        state.total_inferences += 1
        state.avg_inference_time_ms = (
            (state.avg_inference_time_ms * (state.total_inferences - 1) + inference_time_ms)
            / state.total_inferences
        )
        
        return {
            "request_id": request_data.get("request_id"),
            "verdict": "BLOCK" if anomaly_score > 0.7 else "ALLOW",
            "anomaly_score": anomaly_score,
            "attack_type": attack_type,
            "confidence": confidence,
            "explanation": explanation,
            "recommended_rule": recommended_rule,
            "inference_time_ms": round(inference_time_ms, 3),
        }
        
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return {"error": str(e), "verdict": "ALLOW"}  # Fail-open


def _dict_to_feature_vector(features: dict) -> list:
    """Convert feature dictionary to ordered vector for model input."""
    feature_names = [
        "header_entropy", "header_count", "cookie_count", "cookie_entropy",
        "uri_length", "query_param_count", "path_depth", "path_entropy",
        "total_arg_length", "max_arg_length", "arg_entropy", "special_char_count",
        "has_sql_keywords", "has_script_tags", "has_path_traversal", "has_command_injection",
        "request_rate", "error_rate", "unique_endpoints"
    ]
    return [features.get(name, 0.0) for name in feature_names]


# Run the server
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("ML_HTTP_PORT", 8000)),
        reload=False,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )
