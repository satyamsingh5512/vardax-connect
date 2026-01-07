"""
Sentinelas gRPC Server
Handles high-performance ML inference requests from Coraza WAF plugin.
"""

import asyncio
import logging
import os
import time
from concurrent import futures
from typing import AsyncIterator

import grpc
from grpc import aio

# These will be generated from waf_ml.proto
# Run: python -m grpc_tools.protoc -I./proto --python_out=./app --grpc_python_out=./app ./proto/waf_ml.proto
import app.waf_ml_pb2 as pb2
import app.waf_ml_pb2_grpc as pb2_grpc

logger = logging.getLogger(__name__)


class WAFMLServiceServicer(pb2_grpc.WAFMLServiceServicer):
    """gRPC service implementation for WAF ML analysis."""
    
    def __init__(self, app_state):
        self.state = app_state
        self.feature_names = [
            "header_entropy", "header_count", "cookie_count", "cookie_entropy",
            "uri_length", "query_param_count", "path_depth", "path_entropy",
            "total_arg_length", "max_arg_length", "arg_entropy", "special_char_count",
            "has_sql_keywords", "has_script_tags", "has_path_traversal", "has_command_injection",
            "request_rate", "error_rate", "unique_endpoints"
        ]
    
    async def Analyze(self, request: pb2.AnalyzeRequest, context) -> pb2.AnalyzeResponse:
        """Analyze a single request and return verdict."""
        start_time = time.time()
        
        try:
            # Extract feature vector from request
            feature_vector = self._extract_feature_vector(request.features)
            
            # Get anomaly score from autoencoder
            anomaly_score = 0.0
            if self.state.autoencoder:
                anomaly_score = self.state.autoencoder.predict(feature_vector)
            
            # Get classification from XGBoost
            attack_type = pb2.AttackType.ATTACK_TYPE_BENIGN
            confidence = 0.0
            attack_subtype = ""
            
            if self.state.classifier:
                attack_label, confidence = self.state.classifier.predict(feature_vector)
                attack_type = self._map_attack_type(attack_label)
                attack_subtype = attack_label
            
            # Determine verdict
            verdict = self._compute_verdict(anomaly_score, attack_type, confidence)
            
            # Get SHAP explanation
            explanation = pb2.ShapExplanation()
            if self.state.shap_explainer and (anomaly_score > 0.5 or attack_type != pb2.AttackType.ATTACK_TYPE_BENIGN):
                shap_result = self.state.shap_explainer.explain(feature_vector)
                explanation = self._build_shap_explanation(shap_result)
            
            # Generate rule if blocking
            recommended_rule = None
            if verdict == pb2.Verdict.VERDICT_BLOCK:
                rule_result = self.state.rule_generator.generate(
                    self._request_to_dict(request),
                    attack_subtype,
                    self._shap_to_dict(explanation)
                )
                recommended_rule = self._build_recommended_rule(rule_result)
            
            # Calculate inference time
            inference_time_us = int((time.time() - start_time) * 1_000_000)
            
            # Update metrics
            self.state.total_inferences += 1
            inference_time_ms = inference_time_us / 1000
            self.state.avg_inference_time_ms = (
                (self.state.avg_inference_time_ms * (self.state.total_inferences - 1) + inference_time_ms)
                / self.state.total_inferences
            )
            
            # Build response
            response = pb2.AnalyzeResponse(
                request_id=request.request_id,
                verdict=verdict,
                anomaly_score=anomaly_score,
                confidence=confidence,
                attack_type=attack_type,
                attack_subtype=attack_subtype,
                explanation=explanation,
                inference_time_us=inference_time_us,
                cache_key=self._compute_cache_key(request),
                cache_ttl_seconds=300,
            )
            
            if recommended_rule:
                response.recommended_rule.CopyFrom(recommended_rule)
            
            # Log and broadcast if blocking
            if verdict == pb2.Verdict.VERDICT_BLOCK:
                await self._broadcast_alert(request, response)
            
            return response
            
        except Exception as e:
            logger.error(f"Analyze error: {e}")
            # Fail-open: return ALLOW on error
            return pb2.AnalyzeResponse(
                request_id=request.request_id,
                verdict=pb2.Verdict.VERDICT_ALLOW,
                anomaly_score=0.0,
                confidence=0.0,
                attack_type=pb2.AttackType.ATTACK_TYPE_UNKNOWN,
                inference_time_us=int((time.time() - start_time) * 1_000_000),
            )
    
    async def AnalyzeBatch(self, request: pb2.AnalyzeBatchRequest, context) -> pb2.AnalyzeBatchResponse:
        """Batch analyze multiple requests."""
        start_time = time.time()
        
        responses = []
        for req in request.requests:
            resp = await self.Analyze(req, context)
            responses.append(resp)
        
        return pb2.AnalyzeBatchResponse(
            responses=responses,
            total_inference_time_us=int((time.time() - start_time) * 1_000_000),
        )
    
    async def GetCachedVerdict(self, request: pb2.CacheRequest, context) -> pb2.CacheResponse:
        """Get cached verdict from Redis."""
        if not self.state.redis_client:
            return pb2.CacheResponse(found=False)
        
        try:
            import json
            cached = await self.state.redis_client.get(f"verdict:{request.cache_key}")
            if cached:
                # Deserialize cached response
                data = json.loads(cached)
                response = pb2.AnalyzeResponse()
                # Populate from cached data...
                return pb2.CacheResponse(found=True, cached_response=response)
        except Exception as e:
            logger.error(f"Cache lookup error: {e}")
        
        return pb2.CacheResponse(found=False)
    
    async def StreamAlerts(self, request: pb2.AlertSubscription, context) -> AsyncIterator[pb2.Alert]:
        """Stream alerts to subscribed clients."""
        logger.info(f"Alert stream started with filters: {request}")
        
        try:
            # Subscribe to Redis pub/sub for alerts
            if self.state.redis_client:
                pubsub = self.state.redis_client.pubsub()
                await pubsub.subscribe("alerts:stream")
                
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        import json
                        alert_data = json.loads(message["data"])
                        
                        # Apply filters
                        if request.attack_types and alert_data.get("attack_type") not in request.attack_types:
                            continue
                        if alert_data.get("severity", 0) < request.min_severity:
                            continue
                        
                        yield self._build_alert(alert_data)
            else:
                # Fallback: yield nothing if no Redis
                while True:
                    await asyncio.sleep(60)
                    
        except asyncio.CancelledError:
            logger.info("Alert stream cancelled")
        except Exception as e:
            logger.error(f"Alert stream error: {e}")
    
    async def HealthCheck(self, request: pb2.HealthRequest, context) -> pb2.HealthResponse:
        """Health check endpoint."""
        return pb2.HealthResponse(
            healthy=True,
            status="operational",
            component_status={
                "autoencoder": "loaded" if self.state.autoencoder else "not_loaded",
                "classifier": "loaded" if self.state.classifier else "not_loaded",
                "shap": "ready" if self.state.shap_explainer else "not_ready",
                "redis": "connected" if self.state.redis_client else "disconnected",
            },
            uptime_seconds=0,  # Would track actual uptime
            model_status=pb2.ModelStatus(
                autoencoder_loaded=self.state.autoencoder is not None,
                classifier_loaded=self.state.classifier is not None,
                shap_explainer_ready=self.state.shap_explainer is not None,
                total_inferences=self.state.total_inferences,
                avg_inference_time_ms=self.state.avg_inference_time_ms,
            ),
        )
    
    def _extract_feature_vector(self, features: pb2.RequestFeatures) -> list:
        """Extract feature vector from protobuf message."""
        return [
            features.header_entropy,
            features.header_count,
            features.cookie_count,
            features.cookie_entropy,
            features.uri_length,
            features.query_param_count,
            features.path_depth,
            features.path_entropy,
            features.total_arg_length,
            features.max_arg_length,
            features.arg_entropy,
            features.special_char_count,
            1.0 if features.has_sql_keywords else 0.0,
            1.0 if features.has_script_tags else 0.0,
            1.0 if features.has_path_traversal else 0.0,
            1.0 if features.has_command_injection else 0.0,
            features.request_rate,
            features.error_rate,
            features.unique_endpoints,
        ]
    
    def _compute_verdict(self, anomaly_score: float, attack_type: int, confidence: float) -> int:
        """Compute verdict based on scores."""
        # High anomaly score or classified attack
        if anomaly_score > 0.8 and confidence > 0.7:
            return pb2.Verdict.VERDICT_BLOCK
        
        # Moderate anomaly with attack classification
        if anomaly_score > 0.6 and attack_type != pb2.AttackType.ATTACK_TYPE_BENIGN:
            return pb2.Verdict.VERDICT_BLOCK
        
        # Suspicious but not blocking
        if anomaly_score > 0.5:
            return pb2.Verdict.VERDICT_LOG_ONLY
        
        return pb2.Verdict.VERDICT_ALLOW
    
    def _map_attack_type(self, attack_label: str) -> int:
        """Map attack label string to protobuf enum."""
        mapping = {
            "sqli": pb2.AttackType.ATTACK_TYPE_SQLI,
            "xss": pb2.AttackType.ATTACK_TYPE_XSS,
            "lfi": pb2.AttackType.ATTACK_TYPE_LFI,
            "rfi": pb2.AttackType.ATTACK_TYPE_RFI,
            "rce": pb2.AttackType.ATTACK_TYPE_RCE,
            "ssrf": pb2.AttackType.ATTACK_TYPE_SSRF,
            "xxe": pb2.AttackType.ATTACK_TYPE_XXE,
            "path_traversal": pb2.AttackType.ATTACK_TYPE_PATH_TRAVERSAL,
            "bot": pb2.AttackType.ATTACK_TYPE_BOT,
            "scanner": pb2.AttackType.ATTACK_TYPE_SCANNER,
            "dos": pb2.AttackType.ATTACK_TYPE_DOS,
            "anomaly": pb2.AttackType.ATTACK_TYPE_ANOMALY,
            "benign": pb2.AttackType.ATTACK_TYPE_BENIGN,
        }
        return mapping.get(attack_label.lower(), pb2.AttackType.ATTACK_TYPE_UNKNOWN)
    
    def _build_shap_explanation(self, shap_result: dict) -> pb2.ShapExplanation:
        """Build SHAP explanation protobuf message."""
        contributions = []
        for feature_name, value, shap_value in zip(
            shap_result.get("feature_names", []),
            shap_result.get("feature_values", []),
            shap_result.get("shap_values", []),
        ):
            contributions.append(pb2.FeatureContribution(
                feature_name=feature_name,
                feature_value=float(value),
                shap_value=float(shap_value),
                impact_percent=abs(float(shap_value)) * 100,
            ))
        
        # Sort by absolute impact
        contributions.sort(key=lambda x: abs(x.shap_value), reverse=True)
        
        # Generate summary
        top_features = [c.feature_name for c in contributions[:3]]
        summary = f"Top contributing features: {', '.join(top_features)}"
        
        return pb2.ShapExplanation(
            base_value=shap_result.get("base_value", 0.0),
            contributions=contributions,
            summary=summary,
        )
    
    def _build_recommended_rule(self, rule_result: dict) -> pb2.RecommendedRule:
        """Build recommended rule protobuf message."""
        if not rule_result:
            return pb2.RecommendedRule(has_rule=False)
        
        return pb2.RecommendedRule(
            has_rule=True,
            secrule=rule_result.get("secrule", ""),
            rule_id=rule_result.get("rule_id", 0),
            pattern=rule_result.get("pattern", ""),
            is_redos_safe=rule_result.get("is_redos_safe", False),
            estimated_fp_rate=rule_result.get("estimated_fp_rate", 0.0),
            mitigation_type=rule_result.get("mitigation_type", "BLOCK"),
            metadata=str(rule_result.get("metadata", {})),
        )
    
    def _build_alert(self, alert_data: dict) -> pb2.Alert:
        """Build alert protobuf message."""
        return pb2.Alert(
            alert_id=alert_data.get("alert_id", ""),
            timestamp=alert_data.get("timestamp", 0),
            source_ip=alert_data.get("source_ip", ""),
            attack_type=self._map_attack_type(alert_data.get("attack_type", "")),
            severity=alert_data.get("severity", 0.0),
            description=alert_data.get("description", ""),
            explanation=self._build_shap_explanation(alert_data.get("explanation", {})) if alert_data.get("explanation") else None,
            rule=self._build_recommended_rule(alert_data.get("recommended_rule", {})) if alert_data.get("recommended_rule") else None,
        )
    
    def _request_to_dict(self, request: pb2.AnalyzeRequest) -> dict:
        """Convert protobuf request to dict for rule generator."""
        return {
            "request_id": request.request_id,
            "source_ip": request.source_ip,
            "method": request.method,
            "uri": request.uri,
            "user_agent": request.user_agent,
            "content_type": request.content_type,
            "raw_body": request.raw_body.decode("utf-8", errors="ignore") if request.raw_body else "",
        }
    
    def _shap_to_dict(self, explanation: pb2.ShapExplanation) -> dict:
        """Convert SHAP explanation to dict."""
        return {
            "base_value": explanation.base_value,
            "contributions": [
                {"feature": c.feature_name, "value": c.feature_value, "shap": c.shap_value}
                for c in explanation.contributions
            ],
        }
    
    def _compute_cache_key(self, request: pb2.AnalyzeRequest) -> str:
        """Compute cache key for request."""
        import hashlib
        data = f"{request.source_ip}:{request.method}:{request.uri}:{request.user_agent}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    async def _broadcast_alert(self, request: pb2.AnalyzeRequest, response: pb2.AnalyzeResponse):
        """Broadcast alert to Redis pub/sub and connected WebSocket clients."""
        import json
        import time
        
        alert_data = {
            "alert_id": f"alert-{int(time.time() * 1000)}",
            "timestamp": int(time.time() * 1000),
            "request_id": request.request_id,
            "source_ip": request.source_ip,
            "attack_type": response.attack_subtype,
            "severity": response.anomaly_score,
            "description": response.explanation.summary if response.explanation else "",
            "uri": request.uri,
            "explanation": self._shap_to_dict(response.explanation) if response.explanation else None,
            "recommended_rule": self._recommended_rule_to_dict(response.recommended_rule) if response.recommended_rule.has_rule else None,
        }
        
        if self.state.redis_client:
            try:
                # Publish to stream
                await self.state.redis_client.publish("alerts:stream", json.dumps(alert_data))
                # Store in list
                await self.state.redis_client.lpush("alerts:recent", json.dumps(alert_data))
                await self.state.redis_client.ltrim("alerts:recent", 0, 999)
            except Exception as e:
                logger.error(f"Error broadcasting alert: {e}")

    def _recommended_rule_to_dict(self, rule: pb2.RecommendedRule) -> dict:
        """Convert recommended rule protobuf to dict."""
        import json
        metadata = {}
        try:
            if rule.metadata:
                # Handle single quotes from string representation
                meta_str = rule.metadata.replace("'", '"')
                metadata = json.loads(meta_str)
        except:
            pass
            
        return {
            "has_rule": rule.has_rule,
            "secrule": rule.secrule,
            "rule_id": rule.rule_id,
            "pattern": rule.pattern,
            "is_redos_safe": rule.is_redos_safe,
            "estimated_fp_rate": rule.estimated_fp_rate,
            "mitigation_type": rule.mitigation_type,
            "metadata": metadata,
        }


async def serve_grpc(app_state):
    """Start the gRPC server."""
    server = aio.server(futures.ThreadPoolExecutor(max_workers=10))
    pb2_grpc.add_WAFMLServiceServicer_to_server(WAFMLServiceServicer(app_state), server)
    
    port = int(os.getenv("ML_GRPC_PORT", 50051))
    server.add_insecure_port(f"[::]:{port}")
    
    logger.info(f"gRPC server starting on port {port}")
    await server.start()
    
    try:
        await server.wait_for_termination()
    except asyncio.CancelledError:
        await server.stop(5)
