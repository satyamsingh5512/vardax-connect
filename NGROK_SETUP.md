# VARDAx Ngrok Setup Guide

This guide will help you set up ngrok to expose your VARDAx application to the internet for testing, demos, or remote access.

## 🚀 Quick Start

1. **Run the setup script:**
   ```bash
   ./setup-ngrok.sh
   ```

2. **Configure ngrok:**
   ```bash
   ./configure-ngrok.sh
   ```

3. **Start VARDAx with ngrok:**
   ```bash
   ./start-vardax-with-ngrok.sh --ngrok
   ```

## 📋 Prerequisites

- VARDAx project set up and working locally
- Internet connection
- Free ngrok account (sign up at https://ngrok.com)

## 🔧 Installation

Ngrok has been automatically installed to `/usr/local/bin/ngrok`.

To verify installation:
```bash
ngrok version
```

## 🔑 Authentication

1. **Sign up for ngrok:**
   - Go to https://ngrok.com
   - Create a free account

2. **Get your auth token:**
   - Visit https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy your auth token

3. **Configure the token:**
   ```bash
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

## 🌐 Usage Options

### Option 1: All-in-One (Recommended)
Start VARDAx with ngrok in one command:
```bash
./start-vardax-with-ngrok.sh --ngrok
```

### Option 2: Individual Tunnels
Start tunnels separately:

**Frontend only:**
```bash
./start-ngrok-frontend.sh
```

**Backend only:**
```bash
./start-ngrok-backend.sh
```

**Both tunnels:**
```bash
./start-ngrok-all.sh
```

### Option 3: Named Tunnels
Using the configuration file:
```bash
# Start frontend tunnel
ngrok start vardax-frontend

# Start backend tunnel  
ngrok start vardax-backend

# Start both
ngrok start vardax-frontend vardax-backend
```

## 📊 Monitoring

### Ngrok Dashboard
When ngrok is running, access the dashboard at:
- **URL:** http://localhost:4040
- **Features:**
  - View active tunnels
  - See request/response details
  - Monitor traffic
  - Replay requests

### Tunnel URLs
Your public URLs will be displayed in:
1. Terminal output when starting tunnels
2. Ngrok dashboard (http://localhost:4040)
3. Ngrok API: `curl http://localhost:4040/api/tunnels`

## 🛑 Stopping Tunnels

### Stop all ngrok tunnels:
```bash
./stop-ngrok.sh
```

### Stop specific processes:
```bash
# Kill tmux session
tmux kill-session -t ngrok-vardax

# Kill all ngrok processes
pkill -f ngrok
```

## ⚙️ Configuration

### Default Ports
- **Frontend:** 5173 (Vite dev server)
- **Backend:** 8001 (FastAPI)
- **Ngrok Dashboard:** 4040

### Configuration File
The ngrok configuration is stored at:
- **Location:** `~/.config/ngrok/ngrok.yml`
- **Backup:** Created automatically during setup

### Custom Configuration
Edit `~/.config/ngrok/ngrok.yml` to customize:
- Subdomain names (paid plans only)
- Authentication
- Request inspection
- Logging levels

## 🔒 Security Considerations

### Free Plan Limitations
- Random URLs (e.g., `https://abc123.ngrok.io`)
- No custom subdomains
- Limited concurrent tunnels

### Security Best Practices
1. **Don't expose production data** through ngrok tunnels
2. **Use authentication** in your application
3. **Monitor the ngrok dashboard** for unexpected traffic
4. **Rotate URLs regularly** by restarting tunnels
5. **Use HTTPS URLs** when possible (ngrok provides both HTTP and HTTPS)

### Environment Variables
For production-like testing, update your environment variables:
```bash
# Frontend .env
VITE_API_URL=https://your-backend-url.ngrok.io

# Backend .env  
CORS_ORIGINS=https://your-frontend-url.ngrok.io
```

## 🐛 Troubleshooting

### Common Issues

**1. "ngrok not found"**
```bash
# Reinstall ngrok
./setup-ngrok.sh
```

**2. "Authentication required"**
```bash
# Add your auth token
ngrok config add-authtoken YOUR_TOKEN_HERE
```

**3. "Port already in use"**
```bash
# Stop existing processes
./stop-vardax.sh
./stop-ngrok.sh
```

**4. "Tunnel not accessible"**
- Check if VARDAx is running locally first
- Verify ports in ngrok dashboard
- Check firewall settings

**5. "CORS errors"**
Update your backend CORS settings to include the ngrok URL.

### Logs and Debugging

**View ngrok logs:**
```bash
# Real-time logs
tail -f /tmp/ngrok.log

# Frontend tunnel logs
tail -f /tmp/ngrok-frontend.log
```

**Check tunnel status:**
```bash
curl http://localhost:4040/api/tunnels | jq
```

**Test connectivity:**
```bash
# Test local services first
curl http://localhost:5173
curl http://localhost:8001/health

# Then test ngrok URLs
curl https://your-url.ngrok.io
```

## 📚 Advanced Usage

### Multiple Environments
Create different configurations for different environments:

```yaml
# ~/.config/ngrok/ngrok.yml
tunnels:
  vardax-dev:
    proto: http
    addr: 5173
    
  vardax-staging:
    proto: http
    addr: 3000
    
  vardax-api-dev:
    proto: http
    addr: 8001
```

### Webhook Testing
Perfect for testing webhooks with external services:
```bash
# Start backend tunnel
./start-ngrok-backend.sh

# Use the ngrok URL in webhook configurations
# Example: https://abc123.ngrok.io/api/v1/webhooks/alerts
```

### Team Sharing
Share your ngrok URL with team members for:
- Demo purposes
- Testing integrations
- Remote debugging
- Client previews

## 🎯 Use Cases

### Development
- **Remote testing:** Access your local development from anywhere
- **Mobile testing:** Test on mobile devices using ngrok URLs
- **Team collaboration:** Share work-in-progress with team members

### Integration Testing
- **Webhook testing:** Test webhook integrations with external services
- **API testing:** Allow external services to call your local API
- **Third-party integrations:** Test OAuth callbacks and API integrations

### Demos and Presentations
- **Client demos:** Show your work to clients without deployment
- **Conference presentations:** Demo live applications
- **Quick sharing:** Share prototypes instantly

## 📞 Support

### Resources
- **Ngrok Documentation:** https://ngrok.com/docs
- **VARDAx Issues:** Create an issue in the project repository
- **Community:** Join the ngrok community for advanced usage

### Getting Help
If you encounter issues:
1. Check this troubleshooting guide
2. Review ngrok logs
3. Test local services first
4. Check the ngrok dashboard
5. Create an issue with detailed error messages

---

**Happy tunneling! 🚀**