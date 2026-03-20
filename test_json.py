import json

traffic_event = {
    "is_anomaly": True,
    "explanations": [{"name": "test"}]
}
try:
    print(json.dumps(traffic_event))
except Exception as e:
    print(e)
