#!/bin/bash
# Sentinelas Evaluation Script
# Run sqlmap, synthetic attacks, and measure metrics

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAF_URL="${WAF_URL:-http://localhost:8080}"
RESULTS_DIR="${SCRIPT_DIR}/../tests/results"

mkdir -p "$RESULTS_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "           Sentinelas WAF Evaluation Suite"
echo "═══════════════════════════════════════════════════════════════"
echo

# 1. SQLMap Test
echo "[1/4] Running SQLMap test..."
if command -v sqlmap >/dev/null 2>&1; then
    sqlmap -u "${WAF_URL}/search?id=1" \
        --batch \
        --level=2 \
        --risk=2 \
        --timeout=10 \
        --retries=0 \
        --output-dir="$RESULTS_DIR/sqlmap" \
        2>&1 | tee "$RESULTS_DIR/sqlmap_output.txt"
    
    if grep -q "blocked by WAF" "$RESULTS_DIR/sqlmap_output.txt" 2>/dev/null; then
        echo "✓ SQLMap attacks were blocked"
    fi
else
    echo "⚠ SQLMap not installed, skipping"
fi

# 2. Synthetic Attack Test
echo
echo "[2/4] Running synthetic attacks..."

ATTACKS=(
    "GET /search?id=1'+UNION+SELECT+*+FROM+users--"
    "GET /page?file=../../../../etc/passwd"
    "GET /cmd?exec=;cat+/etc/shadow"
    "GET /xss?q=<script>document.location='http://evil.com'</script>"
    "GET /api?callback=<img+src=x+onerror=alert(1)>"
    "POST /login username=admin'--&password=x"
    "GET /files?path=....//....//....//etc/passwd"
    "GET /rce?cmd=\$(whoami)"
)

BLOCKED=0
TOTAL=${#ATTACKS[@]}

for attack in "${ATTACKS[@]}"; do
    method=$(echo "$attack" | cut -d' ' -f1)
    path=$(echo "$attack" | cut -d' ' -f2-)
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${WAF_URL}${path}" 2>/dev/null)
    
    if [ "$response" == "403" ]; then
        echo "  ✓ BLOCKED: $path"
        ((BLOCKED++))
    else
        echo "  ✗ ALLOWED (HTTP $response): $path"
    fi
done

DETECTION_RATE=$(echo "scale=2; $BLOCKED * 100 / $TOTAL" | bc)
echo
echo "Detection Rate: ${BLOCKED}/${TOTAL} (${DETECTION_RATE}%)"

# 3. Latency Test
echo
echo "[3/4] Running latency test..."

LATENCIES=()
for i in {1..100}; do
    # Normal request
    latency=$(curl -s -o /dev/null -w "%{time_total}" "${WAF_URL}/health" 2>/dev/null)
    latency_ms=$(echo "$latency * 1000" | bc)
    LATENCIES+=("$latency_ms")
done

# Calculate avg and p99
AVG_LATENCY=$(printf '%s\n' "${LATENCIES[@]}" | awk '{sum+=$1} END {print sum/NR}')
P99_LATENCY=$(printf '%s\n' "${LATENCIES[@]}" | sort -n | awk 'NR==int(0.99*NR) {print}')

echo "Average Latency: ${AVG_LATENCY}ms"
echo "P99 Latency: ${P99_LATENCY:-N/A}ms"

# 4. False Positive Test
echo
echo "[4/4] Running false positive test..."

LEGIT_REQUESTS=(
    "GET /products?category=electronics&sort=price"
    "GET /users/profile"
    "POST /api/comments content=Great+article!"
    "GET /search?q=best+laptops+2024"
    "GET /blog/how-to-secure-your-application"
    "POST /contact name=John+Doe&email=john@example.com"
    "GET /api/v1/data?format=json"
    "GET /dashboard?filter=active"
)

FP_COUNT=0
LEGIT_TOTAL=${#LEGIT_REQUESTS[@]}

for request in "${LEGIT_REQUESTS[@]}"; do
    method=$(echo "$request" | cut -d' ' -f1)
    path=$(echo "$request" | cut -d' ' -f2-)
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${WAF_URL}${path}" 2>/dev/null)
    
    if [ "$response" == "403" ]; then
        echo "  ✗ FALSE POSITIVE: $path"
        ((FP_COUNT++))
    else
        echo "  ✓ Allowed: $path"
    fi
done

FP_RATE=$(echo "scale=2; $FP_COUNT * 100 / $LEGIT_TOTAL" | bc)
echo
echo "False Positive Rate: ${FP_COUNT}/${LEGIT_TOTAL} (${FP_RATE}%)"

# Summary
echo
echo "═══════════════════════════════════════════════════════════════"
echo "                     EVALUATION SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo "Detection Rate:      ${DETECTION_RATE}% (target: >99%)"
echo "False Positive Rate: ${FP_RATE}% (target: <1%)"
echo "Average Latency:     ${AVG_LATENCY}ms (target: <2ms)"
echo "═══════════════════════════════════════════════════════════════"

# Save results
cat > "$RESULTS_DIR/metrics.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "detection_rate": ${DETECTION_RATE},
    "false_positive_rate": ${FP_RATE},
    "avg_latency_ms": ${AVG_LATENCY},
    "attacks_blocked": ${BLOCKED},
    "attacks_total": ${TOTAL},
    "false_positives": ${FP_COUNT},
    "legitimate_total": ${LEGIT_TOTAL}
}
EOF

echo
echo "Results saved to: $RESULTS_DIR/metrics.json"
