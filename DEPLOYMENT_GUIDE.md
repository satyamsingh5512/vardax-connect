# VARDAx External Website Deployment Guide

This guide explains how to deploy the VARDAx frontend to an external website while keeping the backend processing on your local system.

## 🏗️ Architecture

```
External Website (Frontend) → Ngrok Tunnel → Your Local Backend → Process Traffic Locally
```

- **Frontend**: Hosted on external web server (Netlify, Vercel, Apache, Nginx, etc.)
- **Backend**: Runs locally on your system
- **Ngrok**: Creates secure tunnel to expose your local backend API
- **Traffic Processing**: All analysis happens on your local system

## 🚀 Quick Deployment

### 1. Configure Environment
Update the ngrok URL in the production build:

```bash
# Edit frontend/.env.production
VITE_API_URL=https://your-ngrok-url.ngrok-free.dev
VITE_WS_URL=wss://your-ngrok-url.ngrok-free.dev
```

### 2. Build for Production
```bash
cd frontend
npm run build
```

### 3. Deploy Built Files
Upload the contents of `frontend/dist/` to your web server:

**For Netlify/Vercel:**
- Drag and drop the `dist` folder
- Or connect to your Git repository

**For Traditional Web Server:**
```bash
# Copy files to your web server
scp -r frontend/dist/* user@yourserver.com:/var/www/html/
```

### 4. Start Local Backend with Ngrok
```bash
# Start your local backend
./start-vardax.sh

# In another terminal, start ngrok tunnel
ngrok http 8001
```

## 📋 Current Setup Status

### ✅ What's Ready - ALL ISSUES RESOLVED
- **Backend API**: Configured for external connections
- **CORS**: Enabled for cross-origin requests
- **Ngrok Tunnel**: Active at `https://spectrological-cinda-unfunereally.ngrok-free.dev`
- **Production Build**: Ready in `frontend/dist/`
- **CSS Issues**: ✅ FIXED - All missing CSS classes added (`btn-ghost`, `btn-warning`, `btn-sm`)
- **TypeScript Errors**: ✅ FIXED - Zero compilation errors
- **Build Process**: ✅ WORKING - Both dev and production builds successful

### 🔧 Current Configuration
- **Local Backend**: http://localhost:8001
- **Local Frontend**: http://localhost:5173 (development)
- **Ngrok API Tunnel**: https://spectrological-cinda-unfunereally.ngrok-free.dev
- **Built Frontend**: Ready for deployment in `frontend/dist/`

## 🌐 Deployment Options

### Option 1: Netlify (Recommended)
1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `frontend/dist` folder
3. Your site will be live instantly

### Option 2: Vercel
1. Go to [vercel.com](https://vercel.com)
2. Import your project or upload the `dist` folder
3. Deploy with one click

### Option 3: Traditional Web Server
```bash
# Apache/Nginx
sudo cp -r frontend/dist/* /var/www/html/
sudo systemctl reload apache2  # or nginx
```

### Option 4: GitHub Pages
1. Push the `dist` contents to a `gh-pages` branch
2. Enable GitHub Pages in repository settings

## 🔒 Security Considerations

### Ngrok Free Plan
- ⚠️ **Warning Page**: Users see ngrok warning before accessing
- 🔄 **URL Changes**: URL changes when you restart ngrok
- 🌐 **Public Access**: Anyone with URL can access your API

### Production Recommendations
1. **Upgrade Ngrok**: Get a paid plan for custom domains
2. **Authentication**: Add API authentication if needed
3. **Rate Limiting**: Already configured in backend
4. **Monitoring**: Monitor ngrok dashboard for traffic

## 🧪 Testing the Setup

### Test Local Backend
```bash
curl http://localhost:8001/api/v1/stats/live
```

### Test Ngrok Tunnel
```bash
curl https://spectrological-cinda-unfunereally.ngrok-free.dev/api/v1/stats/live
```

### Test External Website
Once deployed, your website should:
1. Load the VARDAx dashboard
2. Show "Connected" status
3. Display real-time data from your local system

## 🔄 Workflow

### Daily Usage
1. **Start Local System**: `./start-vardax.sh`
2. **Start Ngrok**: `ngrok http 8001`
3. **Update Website**: If ngrok URL changed, rebuild and redeploy frontend
4. **Monitor**: Watch traffic processing on your local system

### For Demos/Presentations
1. Start your local system
2. Share the external website URL
3. All traffic analysis happens on your local machine
4. Audience sees the dashboard but processing is local

## 📊 Monitoring

### Local System
- **Backend Logs**: Check `vardax.log`
- **System Resources**: Monitor CPU/memory usage
- **Database**: Local SQLite database grows with traffic

### Ngrok Dashboard
- **URL**: http://localhost:4040
- **Traffic**: See all incoming requests
- **Performance**: Monitor response times

### External Website
- **Analytics**: Add Google Analytics if needed
- **Uptime**: Monitor website availability
- **Performance**: Check loading times

## 🐛 Troubleshooting

### "Disconnected" Status
1. Check if ngrok tunnel is running
2. Verify ngrok URL in frontend build
3. Check CORS settings in backend
4. Test API endpoint directly

### Slow Performance
1. Check your internet connection
2. Monitor local system resources
3. Consider ngrok paid plan for better performance

### URL Changes
1. Ngrok free URLs change on restart
2. Rebuild frontend with new URL
3. Redeploy to external website

## 📞 Support

### Quick Fixes
```bash
# Restart everything
./stop-vardax.sh
./start-vardax.sh
ngrok http 8001

# Rebuild frontend
cd frontend
npm run build

# Test connection
curl https://your-ngrok-url.ngrok-free.dev/api/v1/stats/live
```

---

**Your VARDAx system is now ready for external website deployment while keeping all processing local!** 🚀