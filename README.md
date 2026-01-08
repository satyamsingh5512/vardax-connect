# VARDAx

**A security platform that actually catches the stuff your WAF misses**

I got tired of expensive WAFs that couldn't catch new attacks, so I built this. VARDAx learns what normal traffic looks like for your specific app, then flags anything weird. Instead of just saying "BLOCKED BY RULE 42069", it actually tells you why something got flagged.

The whole thing started after we got hit by a zero-day that sailed right past our $50k/year WAF. By the time we figured out what happened, the damage was done. That's when I decided to build something that could actually adapt and learn.

---

## Why this exists

Traditional WAFs are basically playing whack-a-mole with known bad stuff:
- They only catch attacks they've seen before
- New attack patterns? Good luck with that
- False positives everywhere because static rules are dumb
- No learning capability - same mistakes forever

VARDAx is different. Instead of "block if it matches this specific pattern", it's more like "block if this request is acting weird compared to what I usually see".

The ML models watch your traffic and learn what's normal. When something deviates significantly, it flags it with an explanation like "this IP just made 340% more requests than usual" or "this request has a weird combination of headers I've never seen together".

**What makes it useful:**
- Learns YOUR specific traffic patterns (not generic rules)
- Catches zero-day attacks by behavioral deviation  
- Explains WHY something got flagged (no more mystery blocks)
- Requires human approval before auto-blocking (because AI isn't perfect)
- Adds about 3ms to request processing (runs async)

---

## Getting it running

### The easy way

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

### With public access (ngrok)

Want to share your VARDAx instance or test webhooks? Use ngrok:

```bash
# Setup ngrok (one-time)
./setup-ngrok.sh
./configure-ngrok.sh

# Start VARDAx with public tunnels
./start-vardax-with-ngrok.sh --ngrok
```

Your VARDAx will be accessible via a public URL like `https://abc123.ngrok.io`. Perfect for:
- Demos and client presentations
- Testing webhook integrations
- Remote team access
- Mobile device testing

See [NGROK_SETUP.md](NGROK_SETUP.md) for detailed setup instructions.

### Manual way (if you enjoy pain)

Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Generate a secure JWT secret first
python ../scripts/generate_jwt_secret.py
# Copy the output to your .env file

uvicorn app.main:app --reload
```

Frontend (new terminal):
```bash
cd frontend
npm install
npm run dev
```

**Important**: You MUST set a secure JWT secret or the backend won't start. Use the script above to generate one.

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

**System health:**
- How fast inference is running
- False positive rates
- Which models are contributing most to decisions

---

## Configuration

Create a `.env` file (copy from `.env.example`):

```bash
# Generate this with: python scripts/generate_jwt_secret.py
VARDAX_JWT_SECRET=your-super-secure-secret-here

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

I obsessed over latency because nobody wants their security tool slowing things down:

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

## Project structure

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

## Security note

This thing is designed to be paranoid by default. It won't auto-block anything without human approval first. The ML models suggest rules, but a human has to review and approve them before they go live.

That said, make sure you:
- Set a strong JWT secret (use the generator script)
- Use HTTPS in production
- Keep your database credentials secure
- Review the generated rules before approving them

---

## License

MIT - do whatever you want with it. If it saves you from getting pwned, that's payment enough.

---

## Contributing

Found a bug? Have an idea? Open an issue or send a PR. 

Just please:
- Test your changes locally first
- Write decent commit messages
- Don't break the existing API without good reason

The codebase is pretty straightforward - backend handles ML stuff, frontend shows pretty graphs. Most of the magic happens in `backend/app/ml/`.

---

*Built because expensive WAFs couldn't catch new attacks. Hopefully it helps you too.*
