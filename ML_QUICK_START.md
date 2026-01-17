# Quick Start Guide for ML Developers 🚀

> **Get up and running with VARDAx ML components in under 30 minutes**

---

## 🎯 What You'll Learn

This quick start guide will help you:
- Set up the ML development environment
- Understand the core ML models
- Run your first ML inference
- Experiment with the models
- Start contributing ML improvements

---

## ⚡ 5-Minute Setup

### Prerequisites
```bash
- Python 3.11+
- 8GB RAM minimum (16GB recommended)
- Basic understanding of scikit-learn and ML concepts
```

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/satyamsingh5512/vardax-connect.git
cd vardax-connect

# 2. Set up Python virtual environment
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Install ML dependencies
pip install -r requirements.txt

# 4. Verify installation
python -c "import sklearn, numpy, pandas; print('ML environment ready!')"
```

---

## 🧠 Core ML Components Overview

### 1. Isolation Forest (models.py)
**What it does**: Detects individual anomalous requests
**When to use**: Spotting zero-day attacks and novel patterns
**Performance**: ~18ms inference time

```python
# Quick example
from backend.app.ml.models import IsolationForestModel

model = IsolationForestModel(contamination=0.01)
# Train on normal traffic (X is feature matrix)
model.fit(X_normal)
# Predict anomaly
prediction = model.predict(X_new_request)
print(f"Anomaly score: {prediction.anomaly_score}")
```

### 2. Autoencoder (models.py)
**What it does**: Learns normal traffic patterns, flags deviations
**When to use**: Detecting subtle attack combinations
**Performance**: ~15ms inference time

```python
# Quick example
from backend.app.ml.models import AutoencoderModel

autoencoder = AutoencoderModel(input_dim=47, encoding_dim=16)
# Train on normal traffic
autoencoder.fit(X_normal, epochs=50)
# Detect anomaly
prediction = autoencoder.predict(X_new_request)
print(f"Reconstruction error: {prediction.anomaly_score}")
```

### 3. EWMA Baseline (models.py)
**What it does**: Tracks traffic rate anomalies
**When to use**: DDoS detection, brute force attacks
**Performance**: <5ms inference time

```python
# Quick example
from backend.app.ml.models import EWMABaseline

ewma = EWMABaseline(alpha=0.3, std_threshold=3.0)
# Update with traffic rate
ewma.update(current_rate)
# Check for anomaly
is_anomaly = ewma.is_anomaly(current_rate)
```

---

## 🔬 Running Your First ML Experiment

### Experiment 1: Train Models on Sample Data

```bash
# Navigate to ML directory
cd backend/app/ml/

# Run training script
python ../../scripts/train_models.py

# Expected output:
# Training Isolation Forest...
# Training Autoencoder...
# Training EWMA Baseline...
# Models saved to ./models/
```

### Experiment 2: Feature Extraction

```python
# Extract features from HTTP request
from backend.app.ml.feature_extractor import FeatureExtractor

extractor = FeatureExtractor()

# Sample HTTP request data
request_data = {
    "uri": "/api/users?id=123",
    "method": "GET",
    "headers": {"User-Agent": "Mozilla/5.0..."},
    "body": "",
    "ip": "192.168.1.100"
}

# Extract 47 features
features = extractor.extract(request_data)
print(f"Extracted features: {features}")
print(f"Feature count: {len(features)}")
```

### Experiment 3: Ensemble Prediction

```python
# Run all three models and combine predictions
from backend.app.ml.models import AnomalyDetector

detector = AnomalyDetector()

# Load trained models
detector.load_models("./models/")

# Predict on new request
features = extractor.extract(request_data)
result = detector.predict(features)

print(f"Ensemble Score: {result.ensemble_score}")
print(f"Is Anomaly: {result.is_anomaly}")
print(f"Confidence: {result.confidence}")
print(f"Explanations: {result.explanations}")
```

---

## 📊 Understanding the 47 Features

### Feature Categories

**1. Request Features (16 features)**
```python
uri_length, uri_depth, uri_entropy
query_param_count, query_length, query_entropy
body_length, body_entropy, body_printable_ratio
header_count, method_encoded, content_type_encoded
extension_risk_score
```

**2. Session Features (12 features)**
```python
session_request_count, session_unique_uris
session_unique_methods, session_error_rate
session_avg_response_time, session_bytes_sent
session_bytes_received
```

**3. Rate Features (10 features)**
```python
requests_per_minute, requests_per_minute_zscore
errors_per_minute, bytes_per_second
unique_ips_per_window, new_uris_per_window
```

**4. Behavioral Features (9 features)**
```python
user_agent_anomaly_score, bot_likelihood_score
session_duration, click_through_rate
navigation_pattern_score
```

### Feature Importance Analysis

```python
# Analyze which features are most important
import pandas as pd
import matplotlib.pyplot as plt

# Get feature importance from Isolation Forest
feature_importance = detector.isolation_forest.get_feature_importance()

# Visualize
df = pd.DataFrame({
    'feature': IsolationForestModel.FEATURE_NAMES,
    'importance': feature_importance
})
df.sort_values('importance', ascending=False).head(10).plot(
    kind='barh', x='feature', y='importance'
)
plt.title('Top 10 Most Important Features')
plt.show()
```

---

## 🎯 Common ML Tasks

### Task 1: Tune Anomaly Threshold

```python
# Adjust sensitivity vs false positive rate
detector = AnomalyDetector(
    isolation_threshold=0.6,  # Lower = more sensitive
    autoencoder_threshold=0.02,  # Lower = more sensitive
    ewma_threshold=3.0  # Higher = less sensitive
)

# Test on validation data
results = detector.evaluate(X_validation, y_validation)
print(f"False Positive Rate: {results['fpr']}")
print(f"True Positive Rate: {results['tpr']}")
```

### Task 2: Add New Feature

```python
# Edit feature_extractor.py
class FeatureExtractor:
    def extract(self, request):
        features = {}
        
        # ... existing features ...
        
        # Add your custom feature
        features['custom_ssl_score'] = self._compute_ssl_score(request)
        
        return features
    
    def _compute_ssl_score(self, request):
        """Your custom feature logic"""
        # Example: Score based on TLS version
        tls_version = request.get('tls_version', '')
        if tls_version == 'TLSv1.3':
            return 1.0
        elif tls_version == 'TLSv1.2':
            return 0.7
        else:
            return 0.3
```

### Task 3: Implement Model Comparison

```python
# Compare different algorithms
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import OneClassSVM

models = {
    'IsolationForest': IsolationForestModel(),
    'OneClassSVM': OneClassSVM(),
    'RandomForest': RandomForestClassifier()
}

results = {}
for name, model in models.items():
    model.fit(X_train)
    predictions = model.predict(X_test)
    results[name] = {
        'accuracy': accuracy_score(y_test, predictions),
        'latency_ms': measure_inference_time(model, X_test)
    }

print(pd.DataFrame(results).T)
```

---

## 🚀 ML Development Workflow

### 1. Data Collection
```bash
# Collect training data from live traffic
python scripts/collect_training_data.py --duration 24h

# Output: training_data.csv with labeled requests
```

### 2. Feature Engineering
```bash
# Experiment with new features
python scripts/feature_analysis.py --input training_data.csv

# Output: Feature correlation matrix, importance scores
```

### 3. Model Training
```bash
# Train with hyperparameter search
python scripts/train_models.py \
    --data training_data.csv \
    --tune-hyperparameters \
    --cv-folds 5

# Output: Best model saved to ./models/
```

### 4. Evaluation
```bash
# Evaluate on test set
python scripts/evaluate_models.py \
    --model-path ./models/ \
    --test-data test_data.csv

# Output: Metrics report and ROC curves
```

### 5. Deployment
```bash
# Deploy to production
python scripts/deploy_model.py \
    --model-path ./models/best_model.pkl \
    --environment production

# Output: Model deployed with A/B testing
```

---

## 📚 Learning Resources (30-Day Plan)

### Week 1: Fundamentals
- [ ] **Day 1-2**: Read `models.py` to understand model implementations
- [ ] **Day 3-4**: Study `feature_extractor.py` to learn feature engineering
- [ ] **Day 5-7**: Experiment with threshold tuning and basic predictions

### Week 2: Deep Dive
- [ ] **Day 8-10**: Implement custom features and test effectiveness
- [ ] **Day 11-12**: Study `continuous_learning.py` for online learning
- [ ] **Day 13-14**: Read papers on Isolation Forest and Autoencoders

### Week 3: Advanced Topics
- [ ] **Day 15-17**: Implement SHAP explainability
- [ ] **Day 18-19**: Optimize inference performance
- [ ] **Day 20-21**: Study drift detection mechanisms

### Week 4: Production Skills
- [ ] **Day 22-24**: Learn FastAPI for ML serving
- [ ] **Day 25-26**: Implement A/B testing for models
- [ ] **Day 27-28**: Set up monitoring and alerting
- [ ] **Day 29-30**: Document your learnings and contributions

---

## 🛠 Development Tools

### Essential Tools
```bash
# Install development tools
pip install jupyter notebook ipython
pip install matplotlib seaborn plotly  # Visualization
pip install scikit-optimize  # Hyperparameter tuning
pip install mlflow  # Experiment tracking

# Launch Jupyter for experimentation
jupyter notebook
```

### Debugging ML Models

```python
# Debug feature extraction
from backend.app.ml.feature_extractor import FeatureExtractor

extractor = FeatureExtractor()
features = extractor.extract(request_data)

# Print feature details
for name, value in features.items():
    print(f"{name:30s}: {value:10.4f}")

# Debug model prediction
prediction = model.predict(features)
print(f"Model decision: {prediction.is_anomaly}")
print(f"Contributing features: {prediction.feature_contributions}")
```

### Performance Profiling

```python
import cProfile
import pstats

# Profile inference
profiler = cProfile.Profile()
profiler.enable()

for _ in range(1000):
    detector.predict(features)

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(20)  # Top 20 slowest functions
```

---

## 🎓 Mini-Projects for Learning

### Project 1: Feature Importance Dashboard (2 hours)
Create a web dashboard showing feature importance in real-time
- **Tools**: Flask/FastAPI + Plotly
- **Skills**: Feature analysis, visualization, web development

### Project 2: Custom Attack Detector (4 hours)
Train a model to detect a specific attack type (e.g., SQLi)
- **Tools**: scikit-learn, pandas
- **Skills**: Supervised learning, classification, evaluation

### Project 3: Model Drift Monitor (6 hours)
Implement system to detect when model performance degrades
- **Tools**: Statistical tests, alerting
- **Skills**: Model monitoring, time-series analysis

### Project 4: Automated Hyperparameter Tuning (8 hours)
Build pipeline for automatic model optimization
- **Tools**: Optuna or scikit-optimize
- **Skills**: AutoML, optimization, cross-validation

---

## 💡 Pro Tips

### Performance Optimization
```python
# Tip 1: Use NumPy vectorization
# Bad: Loop over features
for i in range(len(features)):
    result += features[i] * weights[i]

# Good: Vectorized operation
result = np.dot(features, weights)

# Tip 2: Batch predictions
# Bad: One at a time
for request in requests:
    predict(request)

# Good: Batch processing
predict_batch(requests)

# Tip 3: Cache expensive computations
from functools import lru_cache

@lru_cache(maxsize=1000)
def extract_features(request_hash):
    # Expensive feature extraction
    return features
```

### Model Debugging
```python
# Tip 1: Always validate input shapes
assert features.shape == (1, 47), f"Expected (1, 47), got {features.shape}"

# Tip 2: Check for NaN/Inf values
assert not np.isnan(features).any(), "Features contain NaN"
assert not np.isinf(features).any(), "Features contain Inf"

# Tip 3: Log predictions for analysis
import logging
logger.info(f"Prediction: {prediction}, Features: {features[:5]}...")
```

---

## 🤝 Getting Help

### Common Issues

**Issue 1: Import errors**
```bash
# Solution: Ensure you're in the virtual environment
source venv/bin/activate
pip install -r requirements.txt
```

**Issue 2: Model not loading**
```python
# Solution: Check model file exists
from pathlib import Path
model_path = Path("./models/isolation_forest.pkl")
assert model_path.exists(), f"Model not found at {model_path}"
```

**Issue 3: Low accuracy**
```python
# Solution: Check data quality and feature scaling
print(f"Training samples: {len(X_train)}")
print(f"Feature stats:\n{pd.DataFrame(X_train).describe()}")
# May need StandardScaler or MinMaxScaler
```

### Where to Ask

- **GitHub Issues**: Technical bugs and feature requests
- **Discussions**: General questions and ideas
- **Stack Overflow**: Tag with `vardax` and `machine-learning`
- **Discord/Slack**: Real-time help from community

---

## 📈 Next Steps

After completing this quick start:

1. **Read the full ML Developer Guide**: `ML_DEVELOPER_GUIDE.md`
2. **Explore advanced components**: Sentinelas ML service, Bot detector
3. **Contribute improvements**: See `CONTRIBUTING.md`
4. **Build portfolio projects**: Use VARDAx as base for your projects
5. **Share your learnings**: Write blog posts, give talks

---

## 🎯 Success Checklist

- [ ] Environment set up and verified
- [ ] Run first ML inference successfully
- [ ] Understand the 47 features
- [ ] Train models on sample data
- [ ] Experiment with thresholds
- [ ] Implement custom feature
- [ ] Profile inference performance
- [ ] Read main ML Developer Guide
- [ ] Complete first mini-project
- [ ] Make first contribution

---

**Ready to dive deeper?** Check out `ML_DEVELOPER_GUIDE.md` for comprehensive ML training and career guidance.

**Questions?** Open an issue with the `ml-help` label!

---

*Last Updated: January 2026*
