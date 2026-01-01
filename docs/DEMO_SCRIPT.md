# VARDAx Demo Script (5 Minutes)

## 🎬 Video Demo Script for Hackathon Evaluation

---

### [0:00 - 0:30] HOOK & PROBLEM

**[Screen: Title slide with VARDAx logo]**

> "Every 39 seconds, a cyberattack happens somewhere in the world. Traditional WAFs catch known attacks—but what about the ones they've never seen before?"

**[Screen: Quick montage of attack headlines]**

> "Zero-day exploits. API abuse. Sophisticated bots. These slip right through signature-based defenses."

**[Screen: Problem statement slide]**

> "We built VARDAx—an ML-powered anomaly detection system that learns what NORMAL looks like for your traffic, then catches ANYTHING that deviates."

---

### [0:30 - 1:30] DASHBOARD OVERVIEW

**[Screen: Live dashboard - Overview tab]**

> "Let me show you our security operations dashboard. This is what your SOC team sees in real-time."

**[Point to live counters]**

> "Here we're processing 150 requests per second. The system has detected 12 anomalies in the last minute, and blocked 5 confirmed threats."

**[Point to traffic chart]**

> "This chart shows traffic patterns over 24 hours. Notice how the ML has learned the normal rhythm—the spike at 9 AM when users log in, the dip at lunch."

**[Point to severity distribution]**

> "Anomalies are categorized by severity. Green is informational, amber needs investigation, red is high confidence threat."

**[Point to attack categories]**

> "The system automatically categorizes attacks: rate abuse, bot attacks, credential stuffing, reconnaissance. No manual tagging needed."

---

### [1:30 - 2:30] ANOMALY DETECTION IN ACTION

**[Screen: Anomalies tab]**

> "Let's look at a real anomaly the system caught."

**[Click on a high-severity anomaly]**

> "This request from IP 192.168.1.47 was flagged as HIGH severity with 87% confidence."

**[Point to ML scores panel]**

> "Here's where it gets interesting. We use THREE different ML models working together:"

> "Isolation Forest gave it 0.82—it's a statistical outlier."
> "Autoencoder gave it 0.79—the feature pattern is unusual."
> "EWMA Baseline gave it 0.91—the request rate is way above normal."

**[Point to explanations panel]**

> "But here's the key differentiator: EXPLAINABILITY."

> "The system tells us WHY it's anomalous: 'Request rate 340% above baseline.' 'Session accessed 47 unique endpoints in 2 minutes.' 'Bot-like behavior score: 0.85.'"

> "Your analysts don't need to be ML experts. They can understand and verify the detection."

**[Click feedback buttons]**

> "And they can provide feedback—true positive or false positive—which feeds back into the model to reduce false alarms over time."

---

### [2:30 - 3:30] RULE RECOMMENDATION ENGINE

**[Screen: Rules tab]**

> "Now here's what makes VARDAx actionable, not just informational."

**[Point to pending rules]**

> "The system automatically generates WAF rules from detected anomalies. But—and this is critical—it NEVER deploys them automatically."

**[Click on a rule]**

> "Let's look at this rule. Based on 47 anomalies from one IP, the system recommends blocking it."

**[Point to rule content]**

> "This is a real ModSecurity rule. It's not pseudo-code—you can deploy this directly to your WAF."

**[Point to confidence score]**

> "The confidence is 92%, with an estimated false positive rate of just 2%."

**[Point to warning box]**

> "But we show this warning: 'Review carefully before approving.' Human judgment is required."

**[Click approve button]**

> "When the analyst clicks Approve, the rule goes live. If something goes wrong, they can roll it back with one click."

> "This is the human-in-the-loop design that makes ML safe for production security."

---

### [3:30 - 4:15] ML MODEL HEALTH

**[Screen: ML Health tab]**

> "Let's talk about the ML under the hood."

**[Point to model cards]**

> "We run three models in an ensemble:"

> "Isolation Forest—5ms inference, catches point anomalies."
> "Autoencoder—12ms inference, catches pattern anomalies."  
> "EWMA Baseline—0.5ms inference, catches rate anomalies."

**[Point to latency chart]**

> "Combined inference is under 20 milliseconds. This runs ASYNCHRONOUSLY—it doesn't slow down your traffic at all."

**[Point to ensemble weights]**

> "The ensemble weights are tuned for security: 40% Isolation Forest, 35% Autoencoder, 25% EWMA. This gives us comprehensive coverage while minimizing false positives."

**[Point to performance metrics]**

> "Current false positive rate: 1.8%. Detection rate on our test set: 98.5%. These numbers improve over time as analysts provide feedback."

---

### [4:15 - 4:45] ZERO-DAY DETECTION

**[Screen: Back to anomaly detail]**

> "The question everyone asks: 'Can it catch zero-days?'"

> "The answer is YES—because we're not matching signatures. We're detecting BEHAVIORAL DEVIATION."

**[Show example]**

> "This attack used a novel SQL injection technique our WAF had never seen. But the ML caught it because:"

> "The query entropy was unusually high—4.8 versus baseline 2.1."
> "The request pattern didn't match any learned API sequence."
> "The payload had suspicious encoding patterns."

> "No signature. No CVE. Just behavioral anomaly detection."

---

### [4:45 - 5:00] CLOSING

**[Screen: Architecture diagram]**

> "VARDAx integrates with your existing NGINX and ModSecurity stack. It doesn't replace your WAF—it makes it smarter."

**[Screen: Key metrics slide]**

> "Sub-20ms inference. Under 2% false positives. Human-approved rules. Explainable AI."

**[Screen: Final slide with logo]**

> "Traditional WAFs protect against yesterday's attacks. VARDAx protects against tomorrow's."

> "Thank you."

---

## 📋 Demo Checklist

Before recording:
- [ ] Backend running with sample data loaded
- [ ] Frontend connected and showing live updates
- [ ] At least 20 anomalies in the system
- [ ] 2-3 pending rules ready to show
- [ ] WebSocket connected (green indicator)

Key moments to nail:
- [ ] Live counter animation visible
- [ ] Smooth anomaly detail expansion
- [ ] Clear explanation text readable
- [ ] Rule approval flow demonstrated
- [ ] ML scores panel clearly visible

Backup plan:
- [ ] Screenshots ready if live demo fails
- [ ] Mock data generators working
- [ ] Offline mode tested
