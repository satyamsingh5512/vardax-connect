# VARDAx Deployment Guide

## Architecture Overview

```
Frontend (Vercel)
│
├─ React Dashboard
├─ Live UI, animations
└─ API calls → Backend

Backend (Render)
│
├─ FastAPI ML Engine
├─ WebSocket server
├─ Rule simulation
├─ Replay timeline
└─ GeoIP lookup

WAF (Docker/Self-hosted)
│
└─ ModSecurity integration
```

---

## 🚀 Frontend Deployment (Vercel)

### Prerequisites
- GitHub account
- Vercel account (free tier works)

### Steps

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/vardax.git
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Vite
     - **Root Directory**: `frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`

3. **Environment Variables**
   Add in Vercel dashboard:
   ```
   VITE_API_URL=https://vardax-backend.onrender.com
   VITE_WS_URL=wss://vardax-backend.onrender.com
   ```

4. **Deploy**
   - Click "Deploy"
   - Your app will be live at: `https://vardax.vercel.app`

### Custom Domain (Optional)
- Go to Project Settings → Domains
- Add your custom domain
- Update DNS records as instructed

---

## 🔧 Backend Deployment (Render)

### Prerequisites
- GitHub account
- Render account (free tier works)

### Steps

1. **Create Web Service**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service**
   ```
   Name: vardax-backend
   Region: Oregon (or closest to you)
   Branch: main
   Root Directory: backend
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

3. **Environment Variables**
   Add in Render dashboard:
   ```
   VARDAX_DATABASE_URL=sqlite:///./vardax.db
   VARDAX_ANOMALY_THRESHOLD=0.7
   VARDAX_SESSION_WINDOW_SECONDS=300
   VARDAX_RATE_WINDOW_SECONDS=60
   VARDAX_JWT_SECRET=your-secret-key-here
   PYTHON_VERSION=3.11.0
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Your API will be live at: `https://vardax-backend.onrender.com`

5. **Update Frontend**
   - Go back to Vercel
   - Update `VITE_API_URL` with your Render URL
   - Redeploy frontend

### Database (Optional - PostgreSQL)
For production, upgrade to PostgreSQL:

1. In Render, create a PostgreSQL database
2. Copy the Internal Database URL
3. Update `VARDAX_DATABASE_URL` environment variable
4. Redeploy

---

## 🐳 WAF Deployment (Docker)

### Option 1: Docker Compose (Recommended for testing)

```bash
# Clone repository
git clone https://github.com/your-username/vardax.git
cd vardax

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f
```

Services will be available at:
- NGINX + ModSecurity: `http://localhost:80`
- Backend API: `http://localhost:8000`
- Frontend: `http://localhost:3000`

### Option 2: Production Server

1. **Install Docker**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. **Configure Environment**
   ```bash
   # Create .env file
   cat > .env << EOF
   VARDAX_DATABASE_URL=postgresql://user:pass@db:5432/vardax
   VARDAX_REDIS_URL=redis://redis:6379
   EOF
   ```

3. **Deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **SSL/TLS (Let's Encrypt)**
   ```bash
   # Install certbot
   sudo apt install certbot python3-certbot-nginx
   
   # Get certificate
   sudo certbot --nginx -d yourdomain.com
   ```

---

## 🔐 Security Configuration

### Backend Security

1. **Generate JWT Secret**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   Add to Render environment variables as `VARDAX_JWT_SECRET`

2. **CORS Configuration**
   Update `backend/app/config.py`:
   ```python
   cors_origins: list = [
       "https://yourdomain.com",
       "https://vardax.vercel.app",
   ]
   ```

3. **Rate Limiting**
   Already configured in NGINX

### Frontend Security

1. **Environment Variables**
   Never commit `.env` files
   Use Vercel's environment variable system

2. **API Keys**
   Store sensitive keys in Vercel environment variables

---

## 📊 Monitoring & Logs

### Vercel
- Dashboard → Your Project → Deployments
- View build logs and runtime logs
- Analytics available in Pro plan

### Render
- Dashboard → Your Service → Logs
- Real-time log streaming
- Metrics: CPU, Memory, Network

### Docker
```bash
# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Restart services
docker-compose restart
```

---

## 🔄 CI/CD Pipeline

### Automatic Deployments

Both Vercel and Render support automatic deployments:

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Update feature"
   git push
   ```

2. **Automatic Build**
   - Vercel: Builds and deploys frontend automatically
   - Render: Builds and deploys backend automatically

3. **Preview Deployments**
   - Vercel creates preview URLs for pull requests
   - Test before merging to main

---

## 🧪 Testing Deployment

### Frontend
```bash
curl https://vardax.vercel.app
```

### Backend
```bash
# Health check
curl https://vardax-backend.onrender.com/health

# API test
curl https://vardax-backend.onrender.com/api/v1/stats/live
```

### Full Stack
1. Open `https://vardax.vercel.app`
2. Check browser console for errors
3. Verify API calls are working
4. Test WebSocket connection

---

## 🐛 Troubleshooting

### Frontend Issues

**Build fails on Vercel**
- Check Node.js version (should be 18+)
- Verify all dependencies are in `package.json`
- Check build logs for specific errors

**API calls fail**
- Verify `VITE_API_URL` is set correctly
- Check CORS configuration in backend
- Inspect browser network tab

### Backend Issues

**Deployment fails on Render**
- Check Python version (3.11+)
- Verify `requirements.txt` is complete
- Check build logs

**Database errors**
- Verify `VARDAX_DATABASE_URL` is set
- Check database connection
- Ensure migrations are run

**WebSocket not connecting**
- Verify WebSocket URL uses `wss://` for HTTPS
- Check firewall rules
- Ensure Render plan supports WebSockets

---

## 💰 Cost Estimate

### Free Tier (Recommended for Demo)
- **Vercel**: Free (100GB bandwidth/month)
- **Render**: Free (750 hours/month)
- **Total**: $0/month

### Production Tier
- **Vercel Pro**: $20/month
- **Render Starter**: $7/month (backend)
- **Render PostgreSQL**: $7/month (database)
- **Total**: ~$34/month

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [Docker Documentation](https://docs.docker.com)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Vite Deployment](https://vitejs.dev/guide/static-deploy.html)

---

## 🆘 Support

For issues or questions:
1. Check logs in Vercel/Render dashboard
2. Review this deployment guide
3. Check GitHub Issues
4. Contact: support@vardax.io
