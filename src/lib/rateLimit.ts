interface RateLimitRecord {
    count: number
    resetTime: number
}

// In-memory token bucket / sliding window cache
const ipCache = new Map<string, RateLimitRecord>()

// Cleanup interval every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now()
        for (const [key, record] of ipCache.entries()) {
            if (now > record.resetTime) {
                ipCache.delete(key)
            }
        }
    }, 5 * 60 * 1000)
}

export interface RateLimitOptions {
    intervalMs: number // window duration in ms
    maxRequests: number // max allowed requests within window
}

export function rateLimit(identifier: string, options: RateLimitOptions = { intervalMs: 60 * 1000, maxRequests: 30 }) {
    const now = Date.now()
    const record = ipCache.get(identifier)

    if (!record || now > record.resetTime) {
        ipCache.set(identifier, {
            count: 1,
            resetTime: now + options.intervalMs,
        })
        return {
            success: true,
            limit: options.maxRequests,
            remaining: options.maxRequests - 1,
            reset: Math.ceil((now + options.intervalMs) / 1000),
        }
    }

    if (record.count >= options.maxRequests) {
        return {
            success: false,
            limit: options.maxRequests,
            remaining: 0,
            reset: Math.ceil(record.resetTime / 1000),
        }
    }

    record.count += 1
    return {
        success: true,
        limit: options.maxRequests,
        remaining: options.maxRequests - record.count,
        reset: Math.ceil(record.resetTime / 1000),
    }
}

export function getClientIp(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for")
    if (forwarded) {
        return forwarded.split(",")[0].trim()
    }
    const realIp = req.headers.get("x-real-ip")
    if (realIp) {
        return realIp.trim()
    }
    return "127.0.0.1"
}
