# The Floor VR - Deployment Guide

## GitHub Pages (Static Client)

The client is automatically deployed to GitHub Pages at: **https://thefloorvr-dev.github.io**

### How it works:
1. Push to `main` branch
2. GitHub Actions workflow triggers automatically
3. Client files are copied to `_site/` directory
4. GitHub Pages serves the static site

### Current status:
- ✅ Workflow configured
- ✅ Pages enabled in repo settings
- ✅ Client builds successfully
- ⏳ Site should be live soon (DNS may take 5-10 minutes)

## Game Server Deployment

The game server needs to be deployed separately since GitHub Pages only serves static files.

### Option 1: Fly.io (Recommended for Free Tier)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Create app
flyctl launch

# Deploy
flyctl deploy
```

### Option 2: Heroku

```bash
# Install Heroku CLI
brew install heroku/brew/heroku

# Login
heroku login

# Create app
heroku create thefloorvr

# Deploy
git push heroku main
```

### Option 3: DigitalOcean / AWS

Deploy the Node.js server to your preferred cloud provider.

## Environment Variables

Set these on your production server:

```
PORT=9000
JWT_SECRET=<strong-random-string>
ADMIN_SECRET=<strong-random-string>
NODE_ENV=production
ALLOWED_ORIGINS=https://thefloorvr-dev.github.io,https://<your-server-url>
```

## Database

Currently using in-memory database. For production, migrate to:
- PostgreSQL (recommended)
- MongoDB
- SQLite with persistent storage

## Testing

1. **Local development:** `http://localhost:9000`
2. **GitHub Pages client:** `https://thefloorvr-dev.github.io`
3. **Production server:** Update `SERVER_URL` in `client/src/socket-client.js`

## Checklist

- [ ] Server deployed to production
- [ ] CORS configured correctly
- [ ] HTTPS enabled on server
- [ ] Update GitHub Pages server URL in socket-client.js
- [ ] Test multiplayer from GitHub Pages
- [ ] Configure persistent database
- [ ] Set strong JWT secrets
- [ ] Enable SSL/TLS on server
- [ ] Set up monitoring/logging
