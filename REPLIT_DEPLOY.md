# Deploy to Replit (Free)

## Steps

1. **Create Replit account** at https://replit.com (free)

2. **Import from GitHub:**
   - Click "Create" → "Import from GitHub"
   - Paste: `https://github.com/etfhanstorz/thefloorvr-dev.github.io`
   - Click "Import"

3. **Configure environment:**
   - Replit will auto-detect Node.js project
   - Click "Run" button (it will start the server)
   - Wait for "Listening on http://0.0.0.0:3000"

4. **Get your Replit URL:**
   - Look for the URL in the top-right (something like `https://thefloorvr.replit.dev`)
   - Copy this URL

5. **Update GitHub Pages client:**
   - Edit `client/src/socket-client.js` line 9
   - Change `https://thefloorvr.replit.dev` to your actual Replit URL
   - Commit and push to main

6. **Test:**
   - Go to https://thefloorvr-dev.github.io
   - Should connect to your Replit server
   - Test multiplayer!

## Replit Secrets (Environment Variables)

Add these in Replit dashboard (Secrets icon on left):
- `JWT_SECRET` = random string (e.g., `my-secret-key-123`)
- `ADMIN_SECRET` = another random string
- `NODE_ENV` = `production`

## Keep Server Running

Replit puts projects to sleep after inactivity. To keep it alive:
- Use a monitoring service like **UptimeRobot** (free)
- Or periodically visit the site to keep it warm

## Costs

**Completely free!** Replit doesn't charge for running Node.js servers.

## Troubleshooting

If server doesn't start:
1. Check Replit console for errors
2. Make sure `server/index.js` is present
3. Run: `cd server && npm install`
4. Then click "Run" again
