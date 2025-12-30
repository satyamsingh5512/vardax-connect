-- vardax-ddos/edge-proxy/lua/vardax/rate_limiter.lua
-- VardaX Rate Limiter using Redis + Lua for distributed rate limiting

local _M = {}

local redis = require "resty.redis"
local cjson = require "cjson"

-- Configuration
local config = {
    redis_host = os.getenv("REDIS_HOST") or "127.0.0.1",
    redis_port = tonumber(os.getenv("REDIS_PORT")) or 6379,
    redis_timeout = 100,  -- ms
    redis_pool_size = 100,
    
    -- Default limits
    default_limit = 100,  -- requests per window
    default_window = 1,   -- seconds
    default_burst = 200,
    
    -- Per-path limits (can be overridden)
    path_limits = {
        ["/api/login"] = {limit = 10, window = 60},
        ["/api/register"] = {limit = 5, window = 60},
        ["/api/password-reset"] = {limit = 3, window = 300},
    },
}

-- Redis Lua script for sliding window rate limiting
local RATE_LIMIT_SCRIPT = [[
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local burst = tonumber(ARGV[4])

-- Remove old entries outside the window
local window_start = now - window * 1000000
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Count current requests in window
local current = redis.call('ZCARD', key)

-- Check if over limit
if current >= limit then
    -- Calculate how much over limit
    local over_factor = current / limit
    return {0, current, over_factor}
end

-- Add current request
redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))

-- Set expiry on key
redis.call('EXPIRE', key, window + 1)

-- Return success with current count
return {1, current + 1, 0}
]]

-- Shared dictionary for local caching
local rate_limit_cache = ngx.shared.rate_limit

-- Get Redis connection from pool
local function get_redis()
    local red = redis:new()
    red:set_timeout(config.redis_timeout)
    
    local ok, err = red:connect(config.redis_host, config.redis_port)
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
        return nil, err
    end
    
    return red
end

-- Return Redis connection to pool
local function close_redis(red)
    if not red then return end
    
    local ok, err = red:set_keepalive(10000, config.redis_pool_size)
    if not ok then
        ngx.log(ngx.ERR, "Failed to set Redis keepalive: ", err)
    end
end

-- Get limit configuration for path
local function get_limit_config(path)
    -- Check exact match first
    local path_config = config.path_limits[path]
    if path_config then
        return path_config.limit, path_config.window, path_config.burst or path_config.limit * 2
    end
    
    -- Check prefix matches
    for pattern, cfg in pairs(config.path_limits) do
        if string.sub(path, 1, #pattern) == pattern then
            return cfg.limit, cfg.window, cfg.burst or cfg.limit * 2
        end
    end
    
    -- Return defaults
    return config.default_limit, config.default_window, config.default_burst
end

-- Check rate limit for IP and path
-- Returns: allowed (bool), info (table with current count, over_limit_factor)
function _M.check(ip, path)
    local limit, window, burst = get_limit_config(path)
    
    -- Try local cache first for performance
    local cache_key = "rl:" .. ip .. ":" .. path
    local cached = rate_limit_cache:get(cache_key)
    if cached then
        local data = cjson.decode(cached)
        if data.blocked_until and data.blocked_until > ngx.now() then
            return false, {current = data.count, over_limit_factor = 10}
        end
    end
    
    -- Check Redis
    local red, err = get_redis()
    if not red then
        -- Redis unavailable, use local fallback
        ngx.log(ngx.WARN, "Redis unavailable, using local rate limit")
        return _M.check_local(ip, path, limit, window)
    end
    
    local redis_key = "vardax:ratelimit:" .. ip .. ":" .. path
    local now = ngx.now() * 1000000  -- microseconds
    
    local res, err = red:eval(RATE_LIMIT_SCRIPT, 1, redis_key, limit, window, now, burst)
    close_redis(red)
    
    if not res then
        ngx.log(ngx.ERR, "Rate limit script error: ", err)
        return true, {current = 0, over_limit_factor = 0}  -- Fail open
    end
    
    local allowed = res[1] == 1
    local current = res[2]
    local over_factor = res[3]
    
    -- Update local cache
    rate_limit_cache:set(cache_key, cjson.encode({
        count = current,
        blocked_until = not allowed and (ngx.now() + window) or nil,
    }), window)
    
    return allowed, {
        current = current,
        limit = limit,
        window = window,
        over_limit_factor = over_factor,
    }
end

-- Local fallback rate limiting using shared dict
function _M.check_local(ip, path, limit, window)
    local key = "local_rl:" .. ip .. ":" .. path
    
    local count, err = rate_limit_cache:incr(key, 1, 0, window)
    if not count then
        ngx.log(ngx.ERR, "Local rate limit error: ", err)
        return true, {current = 0, over_limit_factor = 0}
    end
    
    local allowed = count <= limit
    local over_factor = count > limit and (count / limit) or 0
    
    return allowed, {
        current = count,
        limit = limit,
        window = window,
        over_limit_factor = over_factor,
    }
end

-- Adaptive rate limiting based on server load
function _M.check_adaptive(ip, path)
    -- Get current server load
    local load_factor = 1.0
    
    -- Check connection count
    local conn_count = ngx.var.connections_active or 0
    if tonumber(conn_count) > 10000 then
        load_factor = 0.5  -- Reduce limits by half under high load
    elseif tonumber(conn_count) > 5000 then
        load_factor = 0.75
    end
    
    local limit, window, burst = get_limit_config(path)
    limit = math.floor(limit * load_factor)
    burst = math.floor(burst * load_factor)
    
    return _M.check(ip, path)
end

-- Initialize module
function _M.init(custom_config)
    if custom_config then
        for k, v in pairs(custom_config) do
            config[k] = v
        end
    end
    
    ngx.log(ngx.INFO, "VardaX rate limiter initialized")
end

-- Set custom path limit
function _M.set_path_limit(path, limit, window, burst)
    config.path_limits[path] = {
        limit = limit,
        window = window,
        burst = burst or limit * 2,
    }
end

return _M
