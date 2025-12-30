#!/usr/bin/env python3
"""
vardax-ddos/challenge/challenge_service.py
VardaX Challenge Service

Provides JS challenges, browser integrity checks, and CAPTCHA integration.
Progressive challenge escalation based on suspicion level.
"""

import os
import time
import json
import hmac
import hashlib
import secrets
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from fastapi import FastAPI, Request, Response, HTTPException, Cookie
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import redis.asyncio as redis
from prometheus_client import Counter, Histogram, generate_latest
from starlette.responses import Response as StarletteResponse


# Configuration
SECRET_KEY = os.getenv("CHALLENGE_SECRET", secrets.token_hex(32))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CHALLENGE_TTL = int(os.getenv("CHALLENGE_TTL", "3600"))
MAX_FAILURES = int(os.getenv("MAX_FAILURES", "3"))

# Prometheus metrics
CHALLENGES_ISSUED = Counter(
    'vardax_challenges_issued_total',
    'Total challenges issued',
    ['type']
)
CHALLENGES_PASSED = Counter(
    'vardax_challenges_passed_total',
    'Total challenges passed',
    ['type']
)
CHALLENGES_FAILED = Counter(
    'vardax_challenges_failed_total',
    'Total challenges failed',
    ['type']
)
CHALLENGE_LATENCY = Histogram(
    'vardax_challenge_solve_time_seconds',
    'Time to solve challenge',
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30, 60]
)


class ChallengeType(Enum):
    JS_PROOF = "js_proof"           # Invisible JS computation
    BROWSER_CHECK = "browser_check"  # Browser integrity check
    CAPTCHA = "captcha"              # Visual CAPTCHA


@dataclass
class Challenge:
    id: str
    type: ChallengeType
    difficulty: int  # 1-10
    created_at: float
    expires_at: float
    ip: str
    data: Dict


class ChallengeRequest(BaseModel):
    challenge_id: str
    solution: str
    browser_data: Optional[Dict] = None


class ChallengeResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    error: Optional[str] = None
    next_challenge: Optional[str] = None


# JS Challenge HTML Template
JS_CHALLENGE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Check - VardaX</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            backdrop-filter: blur(10px);
            max-width: 400px;
        }
        .logo {
            width: 80px;
            height: 80px;
            margin-bottom: 20px;
        }
        h1 { font-size: 24px; margin-bottom: 10px; }
        p { color: #a0a0a0; margin-bottom: 20px; }
        .spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: #00d4ff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .progress {
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 20px;
        }
        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #00d4ff, #7b2cbf);
            width: 0%;
            transition: width 0.3s;
        }
        .status { font-size: 14px; color: #666; margin-top: 10px; }
        .error { color: #ff4757; }
        .success { color: #2ed573; }
        noscript {
            display: block;
            padding: 20px;
            background: #ff4757;
            border-radius: 8px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <svg class="logo" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="45" stroke="url(#grad)" stroke-width="3"/>
            <path d="M50 20 L75 40 L75 70 L50 90 L25 70 L25 40 Z" stroke="url(#grad)" stroke-width="2" fill="none"/>
            <circle cx="50" cy="50" r="15" fill="url(#grad)"/>
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#00d4ff"/>
                    <stop offset="100%" style="stop-color:#7b2cbf"/>
                </linearGradient>
            </defs>
        </svg>
        <h1>Security Check</h1>
        <p>Verifying your browser...</p>
        <div class="spinner" id="spinner"></div>
        <div class="progress">
            <div class="progress-bar" id="progress"></div>
        </div>
        <div class="status" id="status">Initializing...</div>
        <noscript>
            <strong>JavaScript Required</strong><br>
            Please enable JavaScript to continue.
        </noscript>
    </div>

    <script>
    (function() {
        const CHALLENGE_ID = '{{CHALLENGE_ID}}';
        const DIFFICULTY = {{DIFFICULTY}};
        const NONCE = '{{NONCE}}';
        const RETURN_URL = '{{RETURN_URL}}';
        
        const status = document.getElementById('status');
        const progress = document.getElementById('progress');
        const spinner = document.getElementById('spinner');
        
        // Collect browser fingerprint
        function collectFingerprint() {
            return {
                userAgent: navigator.userAgent,
                language: navigator.language,
                languages: navigator.languages,
                platform: navigator.platform,
                hardwareConcurrency: navigator.hardwareConcurrency,
                deviceMemory: navigator.deviceMemory,
                screenWidth: screen.width,
                screenHeight: screen.height,
                colorDepth: screen.colorDepth,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                timezoneOffset: new Date().getTimezoneOffset(),
                cookieEnabled: navigator.cookieEnabled,
                doNotTrack: navigator.doNotTrack,
                plugins: Array.from(navigator.plugins || []).map(p => p.name),
                webgl: getWebGLInfo(),
                canvas: getCanvasFingerprint(),
                audio: getAudioFingerprint(),
                fonts: detectFonts(),
                touchSupport: getTouchSupport(),
            };
        }
        
        function getWebGLInfo() {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) return null;
                return {
                    vendor: gl.getParameter(gl.VENDOR),
                    renderer: gl.getParameter(gl.RENDERER),
                };
            } catch (e) { return null; }
        }
        
        function getCanvasFingerprint() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('VardaX Security', 2, 2);
                return canvas.toDataURL().slice(-50);
            } catch (e) { return null; }
        }
        
        function getAudioFingerprint() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                return ctx.sampleRate;
            } catch (e) { return null; }
        }
        
        function detectFonts() {
            const testFonts = ['Arial', 'Helvetica', 'Times', 'Courier', 'Verdana', 'Georgia'];
            const detected = [];
            const testString = 'mmmmmmmmmmlli';
            const testSize = '72px';
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const baseWidth = {};
            ['monospace', 'sans-serif', 'serif'].forEach(base => {
                ctx.font = testSize + ' ' + base;
                baseWidth[base] = ctx.measureText(testString).width;
            });
            
            testFonts.forEach(font => {
                let detected_font = false;
                ['monospace', 'sans-serif', 'serif'].forEach(base => {
                    ctx.font = testSize + ' "' + font + '",' + base;
                    if (ctx.measureText(testString).width !== baseWidth[base]) {
                        detected_font = true;
                    }
                });
                if (detected_font) detected.push(font);
            });
            
            return detected;
        }
        
        function getTouchSupport() {
            return {
                maxTouchPoints: navigator.maxTouchPoints || 0,
                touchEvent: 'ontouchstart' in window,
                touchPoints: navigator.msMaxTouchPoints || 0,
            };
        }
        
        // Proof of work computation
        async function computeProof(nonce, difficulty) {
            const target = '0'.repeat(difficulty);
            let counter = 0;
            const startTime = Date.now();
            
            while (true) {
                const data = nonce + ':' + counter;
                const hash = await sha256(data);
                
                if (hash.startsWith(target)) {
                    return {
                        counter: counter,
                        hash: hash,
                        time: Date.now() - startTime,
                    };
                }
                
                counter++;
                
                // Update progress every 1000 iterations
                if (counter % 1000 === 0) {
                    const elapsed = Date.now() - startTime;
                    const estimatedTotal = (elapsed / counter) * Math.pow(16, difficulty);
                    const progressPct = Math.min(95, (elapsed / estimatedTotal) * 100);
                    progress.style.width = progressPct + '%';
                    status.textContent = 'Computing... ' + counter.toLocaleString() + ' hashes';
                    
                    // Yield to prevent blocking
                    await new Promise(r => setTimeout(r, 0));
                }
                
                // Timeout after 60 seconds
                if (Date.now() - startTime > 60000) {
                    throw new Error('Challenge timeout');
                }
            }
        }
        
        async function sha256(message) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        
        // Submit solution
        async function submitSolution(proof, fingerprint) {
            status.textContent = 'Verifying...';
            progress.style.width = '100%';
            
            const response = await fetch('/.vardax/challenge/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challenge_id: CHALLENGE_ID,
                    solution: JSON.stringify(proof),
                    browser_data: fingerprint,
                }),
            });
            
            const result = await response.json();
            
            if (result.success) {
                status.textContent = 'Verified! Redirecting...';
                status.className = 'status success';
                spinner.style.borderTopColor = '#2ed573';
                
                // Set cookie and redirect
                document.cookie = 'vardax_challenge=' + result.token + '; path=/; max-age=3600; SameSite=Strict';
                setTimeout(() => {
                    window.location.href = RETURN_URL || '/';
                }, 500);
            } else {
                status.textContent = result.error || 'Verification failed';
                status.className = 'status error';
                spinner.style.borderTopColor = '#ff4757';
                
                if (result.next_challenge) {
                    setTimeout(() => {
                        window.location.href = result.next_challenge;
                    }, 2000);
                }
            }
        }
        
        // Main execution
        async function main() {
            try {
                status.textContent = 'Collecting browser data...';
                const fingerprint = collectFingerprint();
                
                status.textContent = 'Computing proof of work...';
                const proof = await computeProof(NONCE, DIFFICULTY);
                
                await submitSolution(proof, fingerprint);
            } catch (error) {
                status.textContent = 'Error: ' + error.message;
                status.className = 'status error';
                spinner.style.borderTopColor = '#ff4757';
            }
        }
        
        // Start after DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', main);
        } else {
            main();
        }
    })();
    </script>
</body>
</html>
"""


app = FastAPI(title="VardaX Challenge Service")

# Global state
redis_client = None


@app.on_event("startup")
async def startup():
    global redis_client
    try:
        redis_client = redis.from_url(REDIS_URL)
        await redis_client.ping()
        print(f"Connected to Redis at {REDIS_URL}")
    except Exception as e:
        print(f"Redis not available: {e}")
        redis_client = None


@app.on_event("shutdown")
async def shutdown():
    if redis_client:
        await redis_client.close()


def generate_challenge_id() -> str:
    """Generate unique challenge ID"""
    return secrets.token_urlsafe(32)


def generate_nonce() -> str:
    """Generate challenge nonce"""
    return secrets.token_hex(16)


def generate_token(ip: str, challenge_id: str) -> str:
    """Generate verification token"""
    data = f"{ip}:{challenge_id}:{int(time.time())}"
    signature = hmac.new(
        SECRET_KEY.encode(),
        data.encode(),
        hashlib.sha256
    ).hexdigest()[:32]
    return f"{data}:{signature}"


def verify_token(token: str, ip: str) -> Tuple[bool, Optional[Dict]]:
    """Verify challenge token"""
    try:
        parts = token.split(":")
        if len(parts) != 4:
            return False, None
        
        token_ip, challenge_id, timestamp, signature = parts
        
        # Check IP matches
        if token_ip != ip:
            return False, {"error": "IP mismatch"}
        
        # Check expiry
        if int(timestamp) + CHALLENGE_TTL < time.time():
            return False, {"error": "Token expired"}
        
        # Verify signature
        data = f"{token_ip}:{challenge_id}:{timestamp}"
        expected_sig = hmac.new(
            SECRET_KEY.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()[:32]
        
        if not hmac.compare_digest(signature, expected_sig):
            return False, {"error": "Invalid signature"}
        
        return True, {"challenge_id": challenge_id, "timestamp": int(timestamp)}
    except Exception as e:
        return False, {"error": str(e)}


def get_difficulty(ip: str, failure_count: int) -> int:
    """Get challenge difficulty based on failure count"""
    base_difficulty = 4  # ~65k hashes
    return min(base_difficulty + failure_count, 8)  # Max ~16M hashes


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/challenge", response_class=HTMLResponse)
async def get_challenge(
    request: Request,
    return_url: str = "/",
    type: str = "js_proof",
):
    """Generate and serve challenge page"""
    ip = request.client.host
    
    # Get failure count
    failure_count = 0
    if redis_client:
        failures = await redis_client.get(f"vardax:challenge:failures:{ip}")
        failure_count = int(failures) if failures else 0
    
    # Check if blocked
    if failure_count >= MAX_FAILURES:
        CHALLENGES_FAILED.labels(type="blocked").inc()
        return HTMLResponse(
            content="<h1>Access Denied</h1><p>Too many failed attempts.</p>",
            status_code=403
        )
    
    # Generate challenge
    challenge_id = generate_challenge_id()
    nonce = generate_nonce()
    difficulty = get_difficulty(ip, failure_count)
    
    # Store challenge
    challenge_data = {
        "id": challenge_id,
        "type": type,
        "nonce": nonce,
        "difficulty": difficulty,
        "ip": ip,
        "created_at": time.time(),
        "return_url": return_url,
    }
    
    if redis_client:
        await redis_client.setex(
            f"vardax:challenge:{challenge_id}",
            300,  # 5 minute expiry
            json.dumps(challenge_data)
        )
    
    CHALLENGES_ISSUED.labels(type=type).inc()
    
    # Render challenge page
    html = JS_CHALLENGE_HTML.replace("{{CHALLENGE_ID}}", challenge_id)
    html = html.replace("{{DIFFICULTY}}", str(difficulty))
    html = html.replace("{{NONCE}}", nonce)
    html = html.replace("{{RETURN_URL}}", return_url)
    
    return HTMLResponse(content=html)


@app.post("/challenge/verify", response_model=ChallengeResponse)
async def verify_challenge(
    request: Request,
    data: ChallengeRequest,
):
    """Verify challenge solution"""
    ip = request.client.host
    
    # Get challenge data
    if not redis_client:
        return ChallengeResponse(success=False, error="Service unavailable")
    
    challenge_json = await redis_client.get(f"vardax:challenge:{data.challenge_id}")
    if not challenge_json:
        CHALLENGES_FAILED.labels(type="expired").inc()
        return ChallengeResponse(success=False, error="Challenge expired or invalid")
    
    challenge = json.loads(challenge_json)
    
    # Verify IP matches
    if challenge["ip"] != ip:
        CHALLENGES_FAILED.labels(type="ip_mismatch").inc()
        return ChallengeResponse(success=False, error="IP mismatch")
    
    # Verify solution
    try:
        solution = json.loads(data.solution)
        nonce = challenge["nonce"]
        difficulty = challenge["difficulty"]
        
        # Verify proof of work
        proof_data = f"{nonce}:{solution['counter']}"
        proof_hash = hashlib.sha256(proof_data.encode()).hexdigest()
        
        target = "0" * difficulty
        if not proof_hash.startswith(target):
            raise ValueError("Invalid proof of work")
        
        # Record solve time
        solve_time = solution.get("time", 0) / 1000  # Convert to seconds
        CHALLENGE_LATENCY.observe(solve_time)
        
        # Verify browser data (basic checks)
        if data.browser_data:
            # Check for headless browser indicators
            if data.browser_data.get("webgl") is None:
                # Suspicious but not blocking
                pass
        
        # Success - generate token
        token = generate_token(ip, data.challenge_id)
        
        # Clear failure count
        await redis_client.delete(f"vardax:challenge:failures:{ip}")
        
        # Delete used challenge
        await redis_client.delete(f"vardax:challenge:{data.challenge_id}")
        
        CHALLENGES_PASSED.labels(type=challenge["type"]).inc()
        
        return ChallengeResponse(success=True, token=token)
        
    except Exception as e:
        # Increment failure count
        await redis_client.incr(f"vardax:challenge:failures:{ip}")
        await redis_client.expire(f"vardax:challenge:failures:{ip}", 3600)
        
        failure_count = int(await redis_client.get(f"vardax:challenge:failures:{ip}") or 0)
        
        CHALLENGES_FAILED.labels(type="invalid_solution").inc()
        
        if failure_count >= MAX_FAILURES:
            return ChallengeResponse(
                success=False,
                error="Too many failed attempts",
            )
        
        return ChallengeResponse(
            success=False,
            error=str(e),
            next_challenge=f"/.vardax/challenge?return={challenge.get('return_url', '/')}",
        )


@app.get("/challenge/verify-token")
async def verify_token_endpoint(
    request: Request,
    token: str = Cookie(None, alias="vardax_challenge"),
):
    """Verify existing challenge token"""
    if not token:
        return JSONResponse({"valid": False, "error": "No token"})
    
    ip = request.client.host
    valid, info = verify_token(token, ip)
    
    return JSONResponse({"valid": valid, **(info or {})})


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return StarletteResponse(
        content=generate_latest(),
        media_type="text/plain"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)
