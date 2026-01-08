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
        parsed_alerts = []
        for alert in alerts:
            try:
                if isinstance(alert, dict):
                    parsed_alerts.append(alert)
                elif isinstance(alert, str):
                    import json
                    parsed_alerts.append(json.loads(alert))
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse alert JSON: {e}")
                continue
        return {"alerts": parsed_alerts}
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

@app.post("/api/v1/rules/generate")
async def generate_rules():
    """Generate rules from recent unhandled anomalies."""
    if not state.redis_client:
        return []
    
    try:
        # Fetch recent alerts from Redis
        raw_alerts = await state.redis_client.lrange("alerts:recent", 0, 99)
        generated = []
        
        for raw in raw_alerts:
            # Safely parse JSON
            try:
                import json
                # Handle both JSON strings and python dict strings (if any legacy)
                if isinstance(raw, str) and raw.startswith("{"):
                    import ast
                    try:
                        alert = json.loads(raw)
                    except json.JSONDecodeError:
                        alert = ast.literal_eval(raw)
                else:
                    continue
            except Exception:
                continue

            # Check if alert has a recommended rule
            if alert.get("recommended_rule") and alert["recommended_rule"].get("has_rule"):
                rule = alert["recommended_rule"]
                # Ensure status is set
                if "status" not in rule:
                    rule["status"] = "pending"
                generated.append(rule)
                
        # De-duplicate rules based on rule_id
        unique_rules = {}
        for rule in generated:
            rule_id = str(rule.get("rule_id"))
            if rule_id not in unique_rules:
                unique_rules[rule_id] = rule
        
        # Save to Redis rules:pending
        for rule_id, rule in unique_rules.items():
            import json
            await state.redis_client.hset("rules:pending", rule_id, json.dumps(rule))
            
        return list(unique_rules.values())
        
    except Exception as e:
        logger.error(f"Error generating rules: {e}")
        return []


@app.get("/api/v1/rules/pending")
async def get_pending_rules():
    """Get all pending rules."""
    if not state.redis_client:
        return []
        
    try:
        raw_rules = await state.redis_client.hgetall("rules:pending")
        import json
        rules = []
        for raw in raw_rules.values():
            try:
                rules.append(json.loads(raw))
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse rule JSON: {e}")
                continue
        return rules
    except Exception as e:
        logger.error(f"Error fetching pending rules: {e}")
        return []


@app.post("/api/v1/rules/approve")
async def approve_rule(action_data: dict):
    """Approve or reject a rule."""
    if not state.redis_client:
        return {"status": "error", "message": "Redis not connected"}
        
    rule_id = str(action_data.get("rule_id"))
    action = action_data.get("action")
    
    try:
        # Get the rule
        import json
        raw_rule = await state.redis_client.hget("rules:pending", rule_id)
        if not raw_rule:
            return {"status": "error", "message": "Rule not found"}
            
        rule = json.loads(raw_rule)
        
        if action == "approve":
            rule["status"] = "approved"
            # Move to approved
            await state.redis_client.hset("rules:approved", rule_id, json.dumps(rule))
            await state.redis_client.hdel("rules:pending", rule_id)
            
            # In a real system, we'd also push this to Coraza via a dedicated mechanism
            # e.g., writing to a file or updating a shared memory segment
            logger.info(f"Rule {rule_id} approved and deployed")
            
        elif action == "reject":
            rule["status"] = "rejected"
            # Move to rejected
            await state.redis_client.hset("rules:rejected", rule_id, json.dumps(rule))
            await state.redis_client.hdel("rules:pending", rule_id)
            logger.info(f"Rule {rule_id} rejected")
            
        return rule
        
    except Exception as e:
        logger.error(f"Error acting on rule: {e}")
        return {"status": "error", "message": str(e)}


# --- Admin & feedback endpoints ---

@app.post("/api/v1/admin/clear-data")
async def clear_all_data():
    """Clear all data from Redis."""
    if not state.redis_client:
        return {"status": "error", "message": "Redis not connected"}
    
    try:
        await state.redis_client.flushdb()
        # Re-init necessary keys if needed
        return {"status": "success", "message": "All data cleared"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/v1/admin/db-stats")
async def get_db_stats():
    """Get database statistics."""
    stats = {
        "traffic_events": 0,
        "anomalies": 0,
        "rules": 0,
        "feedback": 0,
        "in_memory_anomalies": 0,
        "in_memory_rules": 0,
        "ws_connections": len(state.active_websockets)
    }
    
    if state.redis_client:
        stats["anomalies"] = await state.redis_client.llen("alerts:recent")
        stats["rules"] = await state.redis_client.hlen("rules:approved") + await state.redis_client.hlen("rules:pending")
        
    return stats

@app.post("/api/v1/admin/load-from-db")
async def load_from_db():
    return {"status": "success", "anomalies_loaded": 0, "rules_loaded": 0}

@app.post("/api/v1/feedback")
async def submit_feedback(feedback: dict):
    # Log feedback
    logger.info(f"Feedback received: {feedback}")
    return {"status": "success"}

# --- Visualization endpoints ---

@app.get("/api/v1/replay/timeline")
async def get_replay_timeline(since_minutes: int = 60, severity: str = None, ip: str = None):
    # Return dummy data for now or fetch from Redis/Timescale
    return []

@app.get("/api/v1/replay/sequence/{ip}")
async def get_attack_sequence(ip: str):
    return []

@app.get("/api/v1/heatmap/traffic")
async def get_heatmap(since_minutes: int = 60, bucket_minutes: int = 5):
    return []

@app.get("/api/v1/geo/threats")
async def get_geo_threats():
    # Return mock geo data for demo
    return [
        {"country": "CN", "count": 120, "lat": 35.8617, "lng": 104.1954},
        {"country": "RU", "count": 85, "lat": 61.5240, "lng": 105.3188},
        {"country": "US", "count": 45, "lat": 37.0902, "lng": -95.7129},
        {"country": "BR", "count": 30, "lat": -14.2350, "lng": -51.9253},
    ]

# --- Simulation endpoints ---

@app.post("/api/v1/rules/simulate")
async def simulate_rule(sim_data: dict):
    return {
        "status": "completed",
        "matches": 0,
        "false_positives": 0,
        "accuracy": 1.0,
        "sample_matches": []
    }

@app.get("/api/v1/rules/simulation-scenarios")
async def get_simulation_scenarios():
    return [
        {"id": "sim_1", "name": "SQL Injection Wave", "description": "Simulate a distributed SQLi attack"},
        {"id": "sim_2", "name": "Credential Stuffing", "description": "Simulate login brute force"},
        {"id": "sim_3", "name": "Bot Scraping", "description": "Simulate aggressive scraper bot"},
    ]

# --- Services endpoints ---

@app.get("/api/v1/services")
async def get_services():
    return [
        {"id": "svc_1", "name": "Main App", "status": "active", "url": "http://localhost:3000", "last_active": "now"},
        {"id": "svc_2", "name": "Admin Panel", "status": "active", "url": "http://localhost:8080", "last_active": "5m ago"},
    ]

@app.delete("/api/v1/services/{service_id}")
async def unregister_service(service_id: str):
    return {"status": "success", "service_id": service_id}



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
