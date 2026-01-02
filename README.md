# Phoenix Forge Auto Publisher

Runs on Glitch.com for 24/7 social media automation. Posts your Digital Empire products to Twitter and Discord automatically.

## Setup on Glitch

### 1. Open Your Project
Go to: https://glitch.com/edit/#!/almond-pruner-stool

### 2. Upload These Files
Copy `server.js` and `package.json` to your Glitch project (replace existing files)

### 3. Set Environment Variables
In Glitch, click the `.env` file (it's hidden) and add:

```
# Twitter API - Get from developer.twitter.com
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_SECRET=your_token_secret

# Discord - Get from discord.com/developers
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CHANNEL_ID=your_channel_id
```

### 4. Update Products
Edit the `products` array in `server.js` with your actual Gumroad products:

```javascript
const products = [
  {
    id: 1,
    name: "Your Product Name",
    description: "What it does",
    url: "https://joshuarowland.gumroad.com/l/your-product",
    image: "https://your-image-url.com/image.png",
    hashtags: ["#tag1", "#tag2", "#tag3"],
    category: "your-category"
  },
  // Add more products...
];
```

### 5. Test It
Visit: https://almond-pruner-stool.glitch.me/

You should see the status page with available endpoints.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check, shows all endpoints |
| `/products` | GET | List all products |
| `/post/twitter` | POST | Manual tweet |
| `/post/discord` | POST | Manual Discord message |
| `/post/all` | POST | Post to all platforms |
| `/trigger` | POST | Trigger scheduled post now |
| `/webhook/sale` | POST | Receive Gumroad sale webhooks |

## Scheduled Posts

The server automatically posts:
- **Twitter**: Every 6 hours (0:00, 6:00, 12:00, 18:00)
- **Discord**: Daily at 10 AM

## Getting API Keys

### Twitter Developer Account
1. Go to developer.twitter.com
2. Create a project and app
3. Enable "Read and Write" permissions
4. Generate API keys and access tokens

### Discord Bot
1. Go to discord.com/developers/applications
2. Create New Application
3. Go to Bot section, click "Add Bot"
4. Copy the token
5. Enable MESSAGE CONTENT INTENT
6. Go to OAuth2 > URL Generator
7. Select "bot" scope, "Send Messages" permission
8. Use the URL to add bot to your server
9. Get channel ID (enable Developer Mode, right-click channel)

## Connect Gumroad Webhooks

1. Go to your Gumroad settings
2. Find Webhooks section
3. Add webhook URL: `https://almond-pruner-stool.glitch.me/webhook/sale`
4. Select "sale" event

Now when you make a sale, it auto-announces on Discord!

## Keep Alive

Glitch free projects sleep after 5 minutes. The server includes a keep-alive ping every 5 minutes to stay awake.

For guaranteed uptime, consider:
- UptimeRobot (free) - pings your URL every 5 min
- Freshping (free) - alternative monitoring

## Manual Testing

```bash
# Test trigger a post
curl -X POST https://almond-pruner-stool.glitch.me/trigger

# Post to Twitter
curl -X POST https://almond-pruner-stool.glitch.me/post/twitter \
  -H "Content-Type: application/json" \
  -d '{"text": "Test tweet!"}'

# Post to Discord
curl -X POST https://almond-pruner-stool.glitch.me/post/discord \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message!"}'
```
