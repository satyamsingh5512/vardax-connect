# VARDAx

**Because traditional WAFs suck at catching new attacks**

So I built this thing after getting tired of signature-based WAFs missing zero-day exploits. VARDAx learns what normal traffic looks like for your app, then freaks out when something weird happens. It's like having a security analyst who never sleeps and actually remembers patterns.

The dashboard is pretty neat - shows you exactly why something got flagged instead of just "BLOCKED BY RULE 42069".

---

## Why I built this

Got burned by a zero-day that slipped past our expensive WAF. The attack was completely new, no signatures existed, and by the time we figured out what happened, damage was done.

Traditional WAFs are basically playing whack-a-mole with known bad stuff:
- They only catch attacks they've seen before
- New attack patterns? Good luck with that
- False positives everywhere because static rules are dumb
- No learning, just the same mistakes over and over

## What VARDAx does differently

Instead of "block if it matches this specific pattern", it's more like "block if this request is acting weird compared to what I usually see".

The ML models watch your traffic and learn what's normal. When something deviates significantly, it flags it with an explanation like "this IP just made 340% more requests than usual" or "this request has a weird combination of headers I've never seen together".

**Key stuff:**
- Learns YOUR specific traffic patterns (not generic rules)
- Catches zero-day attacks by behavioral deviation  
- Explains WHY something got flagged (no more mystery blocks)
- Requires human approval before auto-blocking (because AI isn't perfect)
- Adds like 3ms to request processing (runs async)

---

## Getting it running

### The lazy way (recommended)

```bash
git clone https://github.com/your-username/vardax.git
cd vardax
npm install
npm run dev
```

Then go to http://localhost:3000 and you should see the dashboard.

### Docker way

```bash
docker-compose up -d
```

### Manual way (if you hate yourself)

Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend (new terminal):
```bash
cd frontend
npm install
npm run dev
```

---

## How it works

```
Your traffic → NGINX → ModSecurity → Your app
                ↓
         (copies requests to)
                ↓
         Redis → Feature extraction → ML models → Dashboard
                                          ↓
                                   Rule suggestions
```

I use three different ML models because each one is good at catching different types of weirdness:

1. **Isolation Forest** - spots individual weird requests
2. **Autoencoder** - finds unusual combinations of features
3. **EWMA Baseline** - catches traffic volume anomalies

They vote on whether something is suspicious, and if enough of them agree, it gets flagged.

---

## What the dashboard shows you

**Live stuff:**
- Requests per second (with a nice graph)
- How many anomalies we're catching
- Severity breakdown (green/yellow/red)

**Anomaly details:**
- Timeline of weird stuff that happened
- Click on anything to see why it got flagged
- Buttons to mark false positives (helps the models learn)

**Rule management:**
- Auto-generated ModSecurity rules based on patterns
- Approve/reject workflow (because automation without oversight is dangerous)
- Shows you exactly what each rule would block

**Model health:**
- How fast inference is running
- False positive rates
- Which models are contributing most to decisions

---

## Configuration

Create a `.env` file:

```bash
# Database (SQLite works fine for testing)
VARDAX_DATABASE_URL=sqlite:///./vardax.db

# Redis (for real-time stuff)
VARDAX_REDIS_URL=redis://localhost:6379

# ML tuning (these defaults work pretty well)
VARDAX_ANOMALY_THRESHOLD=0.7
VARDAX_SESSION_WINDOW_SECONDS=300
VARDAX_RATE_WINDOW_SECONDS=60
```

For production, you'll want PostgreSQL instead of SQLite, and probably a managed Redis instance.

---

## Performance notes

I obsessed over latency because nobody wants their WAF slowing things down:

- Adds ~3ms to request processing (everything runs async)
- Handles 12k+ requests/second on decent hardware
- ML inference takes about 18ms
- False positive rate around 1.8% (constantly improving as it learns)

The secret is that feature extraction and ML inference happen completely separate from your request flow. NGINX mirrors traffic to us, we process it async, and flag stuff after the fact.

---

## What it catches

**Zero-day exploits** - If an attack uses a completely new technique, traditional WAFs miss it. VARDAx catches it because the behavior is still abnormal.

**API abuse** - Weird sequences of API calls that look suspicious even if each individual call is "valid".

**Bot attacks** - Bots have different patterns than humans, even sophisticated ones.

**Credential stuffing** - Unusual patterns in login attempts across multiple accounts.

**Reconnaissance** - When someone is poking around your endpoints in suspicious ways.

**Low-and-slow attacks** - Attacks spread over long time periods to avoid rate limits.

---

## Project layout

```
vardax/
├── backend/           # FastAPI + ML models
├── frontend/          # React dashboard  
├── nginx/             # WAF config
├── models/            # Trained ML models go here
├── docker-compose.yml # Everything in containers
└── scripts/           # Deployment helpers
```

The backend does all the heavy lifting (ML inference, feature extraction, rule generation). Frontend is just a pretty dashboard to see what's happening and manage rules.

---

## Stuff I want to add

- Kubernetes deployment (because Docker Compose doesn't scale)
- Prometheus metrics (for proper monitoring)
- SIEM integration (export to Splunk/ELK)
- Better models (maybe try some transformer stuff)
- Threat intel feeds (IP reputation, etc.)

Pull requests welcome if you want to help with any of this.

---

## License

MIT - do whatever you want with it. If it saves you from getting pwned, buy me a coffee.

---

## Contributing

Found a bug? Have an idea? Open an issue or send a PR. 

Just please:
- Test your changes locally first
- Write decent commit messages
- Don't break the existing API without good reason

---

*Built because I got tired of expensive WAFs that couldn't catch new attacks. Hope it helps you too.*
