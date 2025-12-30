-- vardax-ddos/edge-proxy/lua/vardax/main.lua
-- VardaX Main Protection Module for Nginx/OpenResty
-- Orchestrates rate limiting, WAF, bot detection, and challenge flow

local _M = {}

local rate_limiter = require "vardax.rate_limiter"
local waf = require "vardax.waf"
local bot_detector = require "vardax.bot_detector"
local challenge = require "vardax.challenge"
local blocklist = require "vardax.blocklist"
local metrics = require "vardax.metrics"

-- Configuration
local config = {
    -- Rate limiting thresholds
    rate_limit = {
        requests_per_second = 100,
        burst = 200,
        block_duration = 300,  -- 5 minutes
    },
    
    -- Bot detection thresholds
    bot_detection = {
        score_threshold_challenge = 0.5,
        score_threshold_block = 0.8,
        cache_ttl = 60,
    },
    
    -- Challenge settings
    challenge = {
        max_failures = 3,
        token_ttl = 3600,
    },
    
    -- WAF settings
    waf = {
        enabled = true,
        paranoia_level = 1,
    },
    
    -- Bypass paths (health checks, etc.)
    bypass_paths = {
        "/health",
        "/ready",
        "/metrics",
    },
}

-- Check if path should bypass protection
local function should_bypass(path)
    for _, bypass_path in ipairs(config.bypass_paths) do
        if path == bypass_path or string.sub(path, 1, #bypass_path) == bypass_path then
            return true
        end
    end
    return false
end

-- Main protection function
-- Returns: action ("allow", "block", "challenge", "throttle"), reason
function _M.protect(ctx)
    local start_time = ngx.now()
    
    -- Check bypass paths
    if should_bypass(ctx.path) then
        return "allow", "bypass"
    end
    
    -- 1. Check blocklist first (fastest check)
    local blocked, block_reason = blocklist.is_blocked(ctx.ip)
    if blocked then
        metrics.increment("requests_blocked", {reason = "blocklist"})
        return "block", "blocklist: " .. (block_reason or "unknown")
    end
    
    -- 2. Check rate limits
    local rate_ok, rate_info = rate_limiter.check(ctx.ip, ctx.path)
    if not rate_ok then
        metrics.increment("requests_blocked", {reason = "rate_limit"})
        
        -- Auto-block if severely over limit
        if rate_info.over_limit_factor > 5 then
            blocklist.add(ctx.ip, config.rate_limit.block_duration, "rate_limit_exceeded")
            return "block", "rate_limit_exceeded"
        end
        
        return "throttle", "rate_limited"
    end
    
    -- 3. Check challenge token (if previously challenged)
    local challenge_token = ctx.headers["X-Vardax-Challenge"] or ngx.var.cookie_vardax_challenge
    if challenge_token then
        local valid, challenge_info = challenge.verify_token(challenge_token, ctx.ip)
        if valid then
            -- Challenge passed, allow request
            metrics.increment("challenges_passed")
            return "allow", "challenge_passed"
        end
    end
    
    -- 4. WAF inspection
    if config.waf.enabled then
        local waf_ok, waf_rule = waf.inspect(ctx)
        if not waf_ok then
            metrics.increment("requests_blocked", {reason = "waf", rule = waf_rule})
            
            -- Log WAF block for analysis
            ngx.log(ngx.WARN, string.format(
                "WAF block: rule=%s ip=%s path=%s ua=%s",
                waf_rule, ctx.ip, ctx.path, ctx.user_agent
            ))
            
            return "block", "waf_rule: " .. waf_rule
        end
    end
    
    -- 5. Bot detection (ML-based)
    local bot_score, bot_info = bot_detector.score(ctx)
    ctx.bot_score = bot_score
    ngx.var.http_x_bot_score = tostring(bot_score)
    
    if bot_score >= config.bot_detection.score_threshold_block then
        metrics.increment("requests_blocked", {reason = "bot_detected"})
        
        -- Auto-block high-confidence bots
        blocklist.add(ctx.ip, 3600, "bot_detected")
        
        return "block", string.format("bot_detected: score=%.2f", bot_score)
    end
    
    if bot_score >= config.bot_detection.score_threshold_challenge then
        -- Check if already failed challenges
        local failures = challenge.get_failure_count(ctx.ip)
        if failures >= config.challenge.max_failures then
            metrics.increment("requests_blocked", {reason = "challenge_failed"})
            blocklist.add(ctx.ip, 1800, "challenge_failed")
            return "block", "challenge_failed_max"
        end
        
        metrics.increment("challenges_issued")
        return "challenge", string.format("suspicious: score=%.2f", bot_score)
    end
    
    -- 6. All checks passed
    local elapsed = ngx.now() - start_time
    metrics.observe("protection_latency", elapsed)
    metrics.increment("requests_allowed")
    
    return "allow", "passed"
end

-- Initialize module
function _M.init(custom_config)
    if custom_config then
        for k, v in pairs(custom_config) do
            config[k] = v
        end
    end
    
    ngx.log(ngx.INFO, "VardaX protection module initialized")
end

return _M
