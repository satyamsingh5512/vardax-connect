--[[
VARDAx Edge Enforcement Layer (Lua)

This script runs in NGINX to:
1. Extract basic features from requests
2. Call ML API for high-risk patterns
3. Enforce BLOCK/CHALLENGE/ALLOW decisions
4. Add minimal latency (< 5ms for most requests)

DESIGN:
- Fast path: Most requests bypass ML (pattern matching only)
- Slow path: Suspicious requests get ML scoring
- Fail-open: If ML API fails, request proceeds with logging
]]

local http = require "resty.http"
local cjson = require "cjson"

-- Configuration
local ML_API_URL = os.getenv("VARDAX_ML_API") or "http://backend:8000/api/v1/ml/analyze"
local ML_API_TIMEOUT = 50  -- milliseconds
local ML_API_KEY = os.getenv("VARDAX_API_KEY") or "change-me-in-production"

-- Risk thresholds
local BLOCK_THRESHOLD = 0.8
local CHALLENGE_THRESHOLD = 0.5

-- ============================================================================
-- FEATURE EXTRACTION (Fast Path)
-- ============================================================================

local function calculate_entropy(str)
    if not str or #str == 0 then return 0 end
    
    local freq = {}
    for i = 1, #str do
        local c = str:sub(i, i)
        freq[c] = (freq[c] or 0) + 1
    end
    
    local entropy = 0
    local len = #str
    for _, count in pairs(freq) do
        local p = count / len
        entropy = entropy - (p * math.log(p) / math.log(2))
    end
    
    return entropy
end

local function extract_basic_features()
    local uri = ngx.var.uri
    local method = ngx.var.request_method
    local user_agent = ngx.var.http_user_agent or ""
    local query_string = ngx.var.query_string or ""
    
    return {
        uri = uri,
        uri_length = #uri,
        uri_entropy = calculate_entropy(uri),
        method = method,
        user_agent = user_agent,
        query_length = #query_string,
        query_entropy = calculate_entropy(query_string),
        client_ip = ngx.var.remote_addr,
        has_cookie = ngx.var.http_cookie ~= nil
    }
end

-- ============================================================================
-- FAST PATH CHECKS (No ML needed)
-- ============================================================================

local function check_fast_path_rules(features)
    -- Check 1: Known bad user agents
    local ua_lower = string.lower(features.user_agent)
    local bad_patterns = {"curl", "wget", "python-requests", "nikto", "sqlmap", "nmap", "masscan"}
    
    for _, pattern in ipairs(bad_patterns) do
        if string.find(ua_lower, pattern, 1, true) then
            return {
                action = "BLOCK",
                reason = "Known scanner user agent: " .. pattern,
                score = 1.0
            }
        end
    end
    
    -- Check 2: Excessive URI length (possible buffer overflow)
    if features.uri_length > 2000 then
        return {
            action = "BLOCK",
            reason = "URI length exceeds safe limit",
            score = 0.9
        }
    end
    
    -- Check 3: High entropy (possible encoded attack)
    if features.uri_entropy > 5.0 or features.query_entropy > 5.5 then
        return {
            action = "CHALLENGE",
            reason = "High entropy detected - possible encoding",
            score = 0.6
        }
    end
    
    -- Check 4: Missing user agent (bot indicator)
    if not features.user_agent or #features.user_agent == 0 then
        return {
            action = "CHALLENGE",
            reason = "Missing user agent",
            score = 0.5
        }
    end
    
    -- All fast checks passed
    return nil
end

-- ============================================================================
-- ML API CALL (Slow Path)
-- ============================================================================

local function call_ml_api(features)
    local httpc = http.new()
    httpc:set_timeout(ML_API_TIMEOUT)
    
    -- Prepare request payload
    local payload = {
        request_id = ngx.var.request_id,
        timestamp = ngx.time(),
        client_ip = features.client_ip,
        method = features.method,
        uri = features.uri,
        query_string = ngx.var.query_string or "",
        user_agent = features.user_agent,
        body_length = tonumber(ngx.var.content_length) or 0,
        has_cookie = features.has_cookie
    }
    
    local res, err = httpc:request_uri(ML_API_URL, {
        method = "POST",
        body = cjson.encode(payload),
        headers = {
            ["Content-Type"] = "application/json",
            ["X-API-Key"] = ML_API_KEY,
            ["X-Request-ID"] = ngx.var.request_id
        }
    })
    
    if not res then
        ngx.log(ngx.ERR, "ML API call failed: ", err)
        return nil
    end
    
    if res.status ~= 200 then
        ngx.log(ngx.WARN, "ML API returned status: ", res.status)
        return nil
    end
    
    local ok, result = pcall(cjson.decode, res.body)
    if not ok then
        ngx.log(ngx.ERR, "Failed to parse ML API response")
        return nil
    end
    
    return result
end

-- ============================================================================
-- DECISION ENFORCEMENT
-- ============================================================================

local function enforce_decision(decision)
    if decision.action == "BLOCK" then
        ngx.status = 403
        ngx.header["X-VARDAx-Blocked"] = "true"
        ngx.header["X-VARDAx-Reason"] = decision.reason
        ngx.header["X-VARDAx-Score"] = string.format("%.2f", decision.score)
        ngx.say(cjson.encode({
            error = "Request blocked by VARDAx",
            reason = decision.reason,
            request_id = ngx.var.request_id,
            support = "Contact support with request ID if you believe this is an error"
        }))
        ngx.exit(403)
        
    elseif decision.action == "CHALLENGE" then
        -- In production, this would serve a CAPTCHA or JS challenge
        -- For now, we'll add headers and allow with warning
        ngx.header["X-VARDAx-Challenge"] = "true"
        ngx.header["X-VARDAx-Reason"] = decision.reason
        ngx.header["X-VARDAx-Score"] = string.format("%.2f", decision.score)
        
        -- Could redirect to challenge page:
        -- ngx.redirect("/vardax/challenge?token=" .. generate_challenge_token())
        
    elseif decision.action == "ALLOW" then
        -- Add monitoring headers
        ngx.header["X-VARDAx-Checked"] = "true"
        ngx.header["X-VARDAx-Score"] = string.format("%.2f", decision.score or 0)
    end
end

-- ============================================================================
-- MAIN EXECUTION
-- ============================================================================

local function main()
    -- Extract basic features
    local features = extract_basic_features()
    
    -- Fast path: Check simple rules first
    local fast_decision = check_fast_path_rules(features)
    if fast_decision then
        ngx.log(ngx.WARN, "Fast path decision: ", fast_decision.action, " - ", fast_decision.reason)
        enforce_decision(fast_decision)
        return
    end
    
    -- Slow path: Call ML API for suspicious patterns
    -- Only call ML for:
    -- 1. POST/PUT/DELETE requests
    -- 2. Requests with query parameters
    -- 3. Requests to sensitive endpoints
    local needs_ml_check = false
    
    if features.method ~= "GET" and features.method ~= "HEAD" then
        needs_ml_check = true
    elseif features.query_length > 50 then
        needs_ml_check = true
    elseif string.find(features.uri, "/admin") or 
           string.find(features.uri, "/api") or
           string.find(features.uri, "/login") then
        needs_ml_check = true
    end
    
    if needs_ml_check then
        local ml_result = call_ml_api(features)
        
        if ml_result then
            local score = ml_result.scores and ml_result.scores.ensemble or 0
            local decision = {
                score = score,
                reason = ml_result.explanations and ml_result.explanations[1] and 
                        ml_result.explanations[1].description or "ML anomaly detected"
            }
            
            if score >= BLOCK_THRESHOLD then
                decision.action = "BLOCK"
                enforce_decision(decision)
                return
            elseif score >= CHALLENGE_THRESHOLD then
                decision.action = "CHALLENGE"
                enforce_decision(decision)
                return
            end
        else
            -- ML API failed - fail open but log
            ngx.log(ngx.WARN, "ML API unavailable - allowing request with logging")
            ngx.header["X-VARDAx-Fallback"] = "true"
        end
    end
    
    -- Allow request
    enforce_decision({action = "ALLOW", score = 0})
end

-- Execute
local ok, err = pcall(main)
if not ok then
    ngx.log(ngx.ERR, "VARDAx Lua error: ", err)
    -- Fail open - allow request but log error
    ngx.header["X-VARDAx-Error"] = "true"
end
