# 🛡️ VARDAx SDK Integration Guide

**Protect ANY website with VARDAx using just a few lines of code!**

---

## 🎯 What This Does

The VARDAx SDK is a **JavaScript snippet** you add to any website. It:
- ✅ Intercepts ALL requests (fetch, XHR, forms, navigation)
- ✅ Sends request data to your local VARDAx for ML analysis
- ✅ Works with websites hosted ANYWHERE (Vercel, Netlify, etc.)
- ✅ Your VARDAx stays local (exposed via ngrok)
- ✅ Like Google Analytics, but for security!

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  [Website on Vercel/Netlify/etc]                            │
│   • Has VARDAx SDK embedded                                  │
│   • Runs in user's browser                                   │
│         │                                                     │
│         ▼                                                     │
│  [VARDAx SDK (JavaScript)]                                   │
│   • Intercepts all requests                                  │
│   • Extracts features                                        │
│   • Sends to VARDAx API                                      │
│         │                                                     │
│         ▼ (via ngrok tunnel)                                 │
│  [Your Local VARDAx]                                         │
│   • Receives request data                                    │
│   • ML analyzes in real-time                                 │
│   • Logs in dashboard                                        │
│   • (Optional) Blocks malicious requests                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start (5 Minutes)

### **Step 1: Expose Your Local VARDAx**

```bash
# Terminal 1: Start VARDAx
npm run dev

# Terminal 2: Expose with ngrok
ngrok http 8000
# Copy URL: https://abc123.ngrok.io
```

### **Step 2: Add SDK to Your Website**

Add this to your HTML `<head>`:

```html
<!-- VARDAx Protection SDK -->
<script src="https://your-cdn.com/vardax-sdk.js"></script>
<script>
  VARDAx.init({
    apiUrl: 'https://abc123.ngrok.io', // Your ngrok URL
    apiKey: 'optional-api-key',
    mode: 'monitor', // or 'protect'
    debug: true
  });
</script>
```

### **Step 3: Deploy Your Website**

```bash
# Deploy to Vercel, Netlify, or anywhere
vercel --prod
```

### **Step 4: Test It!**

1. Visit your deployed website
2. Click around, make requests
3. Open your VARDAx dashboard: http://localhost:3000
4. See all traffic being monitored!

---

## 📝 Integration Methods

### **Method 1: Direct Script Tag** (Easiest)

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Protected Website</title>
    
    <!-- VARDAx SDK -->
    <script src="vardax-sdk.js"></script>
    <script>
        VARDAx.init({
            apiUrl: 'https://your-ngrok-url.ngrok.io',
            mode: 'monitor'
        });
    </script>
</head>
<body>
    <!-- Your website content -->
</body>
</html>
```

### **Method 2: React/Next.js**

```javascript
// pages/_app.js or App.js
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Load VARDAx SDK
    const script = document.createElement('script');
    script.src = '/vardax-sdk.js';
    script.onload = () => {
      window.VARDAx.init({
        apiUrl: process.env.NEXT_PUBLIC_VARDAX_URL,
        mode: 'monitor',
        debug: process.env.NODE_ENV === 'development'
      });
    };
    document.head.appendChild(script);
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
```

### **Method 3: Vue.js**

```javascript
// main.js
import { createApp } from 'vue';
import App from './App.vue';

const app = createApp(App);

// Load VARDAx SDK
const script = document.createElement('script');
script.src = '/vardax-sdk.js';
script.onload = () => {
  window.VARDAx.init({
    apiUrl: import.meta.env.VITE_VARDAX_URL,
    mode: 'monitor'
  });
};
document.head.appendChild(script);

app.mount('#app');
```

### **Method 4: WordPress**

Add to your theme's `header.php` before `</head>`:

```php
<!-- VARDAx Protection -->
<script src="<?php echo get_template_directory_uri(); ?>/js/vardax-sdk.js"></script>
<script>
  VARDAx.init({
    apiUrl: '<?php echo get_option('vardax_api_url'); ?>',
    mode: 'monitor'
  });
</script>
```

---

## ⚙️ Configuration Options

```javascript
VARDAx.init({
  // Required: Your VARDAx API URL (ngrok URL)
  apiUrl: 'https://your-ngrok-url.ngrok.io',
  
  // Optional: API key for authentication
  apiKey: 'your-api-key',
  
  // Mode: 'monitor' (log only) or 'protect' (block attacks)
  mode: 'monitor',
  
  // Enable debug logging
  debug: true,
  
  // Custom block page URL
  blockPage: '/blocked.html'
});
```

### **Modes:**

**Monitor Mode** (Recommended for testing):
- ✅ Logs all requests to VARDAx
- ✅ Shows in dashboard
- ✅ Doesn't block anything
- ✅ Safe for production

**Protect Mode** (Active protection):
- ✅ Logs all requests
- ✅ Blocks malicious requests
- ✅ Shows block page
- ⚠️ Test thoroughly first!

---

## 🧪 Testing

### **Test Locally:**

```bash
# 1. Start VARDAx
npm run dev

# 2. Start ngrok
ngrok http 8000

# 3. Open example.html
cd vardax-sdk
open example.html
# Update ngrok URL in the script

# 4. Click test buttons
# 5. Check VARDAx dashboard
```

### **Test on Deployed Site:**

```bash
# 1. Deploy your site with SDK
vercel --prod

# 2. Visit your site
# 3. Open browser console (F12)
# 4. You should see: [VARDAx] Initializing...
# 5. Make requests
# 6. Check VARDAx dashboard
```

---

## 📊 What Gets Monitored

The SDK captures:
- ✅ **Fetch requests** - All API calls
- ✅ **XMLHttpRequest** - AJAX calls
- ✅ **Form submissions** - POST forms
- ✅ **Page navigation** - URL changes
- ✅ **SPA routing** - React Router, etc.

### **Data Sent to VARDAx:**

```javascript
{
  request_id: "sdk-1234567890-abc",
  timestamp: "2024-01-01T12:00:00Z",
  method: "GET",
  uri: "/api/users",
  query_string: "id=123",
  user_agent: "Mozilla/5.0...",
  referer: "https://example.com",
  origin: "https://example.com",
  has_cookie: true,
  body_length: 0,
  page_url: "https://example.com/dashboard"
}
```

---

## 🎬 Demo Scenarios

### **Scenario 1: Monitor Your Own Website**

```bash
# 1. Add SDK to your website
# 2. Deploy to Vercel
# 3. Start VARDAx locally
# 4. Expose with ngrok
# 5. Visit your website
# 6. See all traffic in VARDAx dashboard!
```

### **Scenario 2: Demo to Recruiters**

```bash
# 1. Deploy example.html to Vercel
# 2. Start VARDAx + ngrok
# 3. Share Vercel URL with recruiter
# 4. They click buttons on the site
# 5. You show detections in your dashboard
# 6. Impressive live demo!
```

### **Scenario 3: Protect Client Website**

```bash
# 1. Add SDK to client's website
# 2. Run VARDAx on your server
# 3. Client's traffic analyzed in real-time
# 4. You monitor from dashboard
# 5. Professional security service!
```

---

## 🌐 Hosting the SDK

### **Option 1: Self-Host**

```bash
# Copy SDK to your website's public folder
cp vardax-sdk/vardax-sdk.js public/

# Reference in HTML
<script src="/vardax-sdk.js"></script>
```

### **Option 2: CDN (GitHub Pages)**

```bash
# 1. Create GitHub repo
# 2. Upload vardax-sdk.js
# 3. Enable GitHub Pages
# 4. Use URL:
<script src="https://yourusername.github.io/vardax-sdk/vardax-sdk.js"></script>
```

### **Option 3: npm Package** (Future)

```bash
npm install vardax-sdk
```

```javascript
import VARDAx from 'vardax-sdk';
VARDAx.init({ ... });
```

---

## 🔒 Security Considerations

### **1. CORS Configuration**

Your VARDAx backend needs CORS enabled:

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### **2. API Key (Optional)**

Add API key validation:

```python
# backend/app/api/routes.py
@router.post("/traffic/ingest")
async def ingest_traffic(request: Request):
    api_key = request.headers.get("X-API-Key")
    if api_key != settings.api_key:
        raise HTTPException(403, "Invalid API key")
    # ...
```

### **3. Rate Limiting**

Prevent SDK abuse:

```python
# Limit requests per IP
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@router.post("/traffic/ingest")
@limiter.limit("100/minute")
async def ingest_traffic():
    # ...
```

---

## 📈 Monitoring

### **Check SDK Status:**

```javascript
// In browser console
VARDAx.getStatus()
// Returns: { active: true, mode: 'monitor', apiUrl: '...' }
```

### **View Dashboard:**

```bash
# Open VARDAx dashboard
open http://localhost:3000

# Check:
# - Live Traffic tab: See all requests from SDK
# - Anomalies tab: See detected attacks
# - Geo Map: See where traffic comes from
```

---

## 🐛 Troubleshooting

### **SDK Not Working:**

```javascript
// Enable debug mode
VARDAx.init({
  apiUrl: 'https://your-url.ngrok.io',
  debug: true  // Check browser console
});
```

### **CORS Errors:**

```bash
# Check VARDAx CORS settings
# Make sure allow_origins includes your website domain
```

### **No Traffic in Dashboard:**

```bash
# 1. Check ngrok is running
curl https://your-ngrok-url.ngrok.io/health

# 2. Check browser console for errors
# 3. Verify apiUrl is correct
# 4. Check VARDAx is running
```

---

## 💡 Pro Tips

### **1. Use Environment Variables:**

```javascript
// Don't hardcode ngrok URL
VARDAx.init({
  apiUrl: process.env.VARDAX_API_URL || 'https://fallback.com'
});
```

### **2. Conditional Loading:**

```javascript
// Only load in production
if (process.env.NODE_ENV === 'production') {
  VARDAx.init({ ... });
}
```

### **3. Custom Block Page:**

```javascript
VARDAx.init({
  mode: 'protect',
  blockPage: '/custom-blocked.html'
});
```

### **4. Analytics Integration:**

```javascript
// Log to Google Analytics
VARDAx.init({
  apiUrl: '...',
  onBlock: (reason, score) => {
    gtag('event', 'security_block', {
      reason: reason,
      score: score
    });
  }
});
```

---

## ✅ Checklist

- [ ] VARDAx running locally
- [ ] ngrok exposing VARDAx
- [ ] SDK added to website
- [ ] ngrok URL configured in SDK
- [ ] Website deployed
- [ ] Test: Visit website
- [ ] Test: Make requests
- [ ] Verify: Check VARDAx dashboard
- [ ] Verify: See traffic logged

---

## 🚀 Next Steps

1. **Add SDK to your website**
2. **Deploy to Vercel/Netlify**
3. **Start VARDAx + ngrok**
4. **Test it works**
5. **Show to recruiters!**

---

## 📚 Examples

- `example.html` - Full demo page
- `vardax-sdk.js` - SDK source code
- Integration examples for React, Vue, WordPress

---

**You can now protect ANY website with VARDAx!** 🛡️
