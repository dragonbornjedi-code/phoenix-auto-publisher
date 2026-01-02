// ============================================================================
// PHOENIX FORGE - DIGITAL EMPIRE AUTO PUBLISHER
// Runs on Glitch.com - Always online, auto-posts to social media
// ============================================================================

const express = require('express');
const fetch = require('node-fetch');
const cron = require('node-cron');
const { TwitterApi } = require('twitter-api-v2');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const app = express();
app.use(express.json());

// ============================================================================
// CONFIGURATION - Set these in Glitch's .env file
// ============================================================================
const config = {
  // Twitter API (get from developer.twitter.com)
  twitter: {
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  },

  // Discord Bot (get from discord.com/developers)
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID,
  },

  // Pinterest (optional)
  pinterest: {
    accessToken: process.env.PINTEREST_ACCESS_TOKEN,
  },

  // Your products/content
  gumroadStore: 'https://joshuarowland.gumroad.com',

  // Perchance generators for content variety
  generators: {
    productPromo: 'digital-product-promo', // Create this generator
    hashtags: 'product-hashtags',
  }
};

// ============================================================================
// PRODUCTS DATABASE - Your Digital Empire products
// ============================================================================
const products = [
  {
    id: 1,
    name: "Quest Category System",
    description: "Complete gamification system for child learning",
    url: "https://joshuarowland.gumroad.com/l/quest-system",
    image: "https://your-image-url.com/quest.png",
    hashtags: ["#gamification", "#learning", "#parenting", "#education"],
    category: "education"
  },
  {
    id: 2,
    name: "Home Automation Templates",
    description: "Smart home automation blueprints for Home Assistant",
    url: "https://joshuarowland.gumroad.com/l/ha-templates",
    image: "https://your-image-url.com/ha.png",
    hashtags: ["#smarthome", "#homeassistant", "#automation", "#iot"],
    category: "tech"
  },
  // Add more products here...
];

// ============================================================================
// CONTENT GENERATORS
// ============================================================================

// Get varied content from Perchance
async function generateContent(generatorName, listName = 'output') {
  try {
    const url = `https://perchance.org/api/downloadGenerator?generatorName=${generatorName}&__cacheBust=${Math.random()}`;
    // Note: Full Perchance integration requires JSDOM - simplified here
    return null; // Will use templates instead
  } catch (error) {
    console.error('Perchance error:', error);
    return null;
  }
}

// Content templates for variety
const promoTemplates = [
  (p) => `🚀 Check out ${p.name}!\n\n${p.description}\n\n${p.url}\n\n${p.hashtags.join(' ')}`,
  (p) => `✨ New product alert!\n\n${p.name} is now available.\n\n${p.description}\n\n👉 ${p.url}\n\n${p.hashtags.join(' ')}`,
  (p) => `💡 Looking for ${p.category} solutions?\n\n${p.name} might be exactly what you need!\n\n${p.url}\n\n${p.hashtags.join(' ')}`,
  (p) => `🎯 ${p.name}\n\n${p.description}\n\nGet it here: ${p.url}\n\n${p.hashtags.join(' ')}`,
  (p) => `⭐ Featured: ${p.name}\n\n${p.description}\n\n🔗 ${p.url}\n\n${p.hashtags.join(' ')}`,
];

function getRandomPromo(product) {
  const template = promoTemplates[Math.floor(Math.random() * promoTemplates.length)];
  return template(product);
}

function getRandomProduct() {
  return products[Math.floor(Math.random() * products.length)];
}

// ============================================================================
// TWITTER POSTING
// ============================================================================

let twitterClient = null;
if (config.twitter.appKey) {
  twitterClient = new TwitterApi({
    appKey: config.twitter.appKey,
    appSecret: config.twitter.appSecret,
    accessToken: config.twitter.accessToken,
    accessSecret: config.twitter.accessSecret,
  });
}

async function postToTwitter(text, imageUrl = null) {
  if (!twitterClient) {
    console.log('[Twitter] Not configured');
    return { success: false, error: 'Not configured' };
  }

  try {
    let mediaId = null;

    // Upload image if provided
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.buffer();
      mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });
    }

    const tweet = await twitterClient.v2.tweet({
      text: text.substring(0, 280), // Twitter limit
      ...(mediaId && { media: { media_ids: [mediaId] } })
    });

    console.log('[Twitter] Posted:', tweet.data.id);
    return { success: true, id: tweet.data.id };
  } catch (error) {
    console.error('[Twitter] Error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DISCORD POSTING
// ============================================================================

let discordClient = null;
if (config.discord.token) {
  discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });
  discordClient.login(config.discord.token).catch(console.error);
}

async function postToDiscord(text, imageUrl = null, embedData = null) {
  if (!discordClient || !config.discord.channelId) {
    console.log('[Discord] Not configured');
    return { success: false, error: 'Not configured' };
  }

  try {
    const channel = await discordClient.channels.fetch(config.discord.channelId);

    if (embedData) {
      const embed = new EmbedBuilder()
        .setTitle(embedData.title)
        .setDescription(embedData.description)
        .setURL(embedData.url)
        .setColor(0x7289da);

      if (imageUrl) embed.setImage(imageUrl);

      await channel.send({ embeds: [embed] });
    } else {
      await channel.send(text);
    }

    console.log('[Discord] Posted to channel');
    return { success: true };
  } catch (error) {
    console.error('[Discord] Error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SCHEDULED POSTS
// ============================================================================

// Post to Twitter every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[Scheduler] Running Twitter promo...');
  const product = getRandomProduct();
  const content = getRandomPromo(product);
  await postToTwitter(content, product.image);
});

// Post to Discord daily at 10am
cron.schedule('0 10 * * *', async () => {
  console.log('[Scheduler] Running Discord promo...');
  const product = getRandomProduct();
  await postToDiscord(null, product.image, {
    title: product.name,
    description: product.description,
    url: product.url
  });
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'Phoenix Forge Auto Publisher is running!',
    endpoints: {
      '/post/twitter': 'POST - Send tweet',
      '/post/discord': 'POST - Send Discord message',
      '/post/all': 'POST - Post to all platforms',
      '/products': 'GET - List products',
      '/trigger': 'POST - Trigger scheduled post now'
    }
  });
});

// Manual post to Twitter
app.post('/post/twitter', async (req, res) => {
  const { text, imageUrl } = req.body;
  const result = await postToTwitter(text, imageUrl);
  res.json(result);
});

// Manual post to Discord
app.post('/post/discord', async (req, res) => {
  const { text, imageUrl, embed } = req.body;
  const result = await postToDiscord(text, imageUrl, embed);
  res.json(result);
});

// Post to all platforms
app.post('/post/all', async (req, res) => {
  const { text, imageUrl, product } = req.body;

  const productData = product || getRandomProduct();
  const content = text || getRandomPromo(productData);

  const results = {
    twitter: await postToTwitter(content, imageUrl || productData.image),
    discord: await postToDiscord(null, imageUrl || productData.image, {
      title: productData.name,
      description: productData.description,
      url: productData.url
    })
  };

  res.json(results);
});

// Trigger scheduled post now
app.post('/trigger', async (req, res) => {
  const { platform } = req.body;
  const product = getRandomProduct();
  const content = getRandomPromo(product);

  let result;
  if (platform === 'twitter') {
    result = await postToTwitter(content, product.image);
  } else if (platform === 'discord') {
    result = await postToDiscord(null, product.image, {
      title: product.name,
      description: product.description,
      url: product.url
    });
  } else {
    result = {
      twitter: await postToTwitter(content, product.image),
      discord: await postToDiscord(null, product.image, {
        title: product.name,
        description: product.description,
        url: product.url
      })
    };
  }

  res.json(result);
});

// List products
app.get('/products', (req, res) => {
  res.json(products);
});

// Webhook receiver (for Gumroad sales, etc.)
app.post('/webhook/sale', async (req, res) => {
  const sale = req.body;
  console.log('[Webhook] Sale received:', sale);

  // Announce sale on Discord
  await postToDiscord(`🎉 New sale! Someone just purchased a product!`, null, null);

  res.json({ received: true });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Phoenix Forge Auto Publisher running on port ${PORT}`);
  console.log('Scheduled posts: Twitter every 6 hours, Discord daily at 10am');
});

// Keep Glitch awake (ping every 5 minutes)
setInterval(() => {
  fetch(`https://${process.env.PROJECT_DOMAIN}.glitch.me/`).catch(() => {});
}, 300000);
