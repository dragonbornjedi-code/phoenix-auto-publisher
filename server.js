// ============================================================================
// PHOENIX FORGE - DIGITAL EMPIRE MULTI-PLATFORM AUTO PUBLISHER
// Supports: Twitter, Facebook, Instagram, Pinterest, Discord
// ============================================================================

const express = require('express');
const fetch = require('node-fetch');
const cron = require('node-cron');
const { TwitterApi } = require('twitter-api-v2');
const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');

const app = express();
app.use(express.json());

// ============================================================================
// PLATFORM CONFIGURATIONS & LIMITS
// ============================================================================
const platforms = {
  twitter: {
    name: 'Twitter/X',
    charLimit: 280,
    style: 'short, punchy, hashtag-heavy',
    enabled: !!process.env.TWITTER_API_KEY,
  },
  facebook: {
    name: 'Facebook',
    charLimit: 63206,
    optimalLength: 80,
    style: 'storytelling, emotional, engaging',
    enabled: !!process.env.FACEBOOK_PAGE_TOKEN,
  },
  instagram: {
    name: 'Instagram',
    charLimit: 2200,
    style: 'visual-focused, emoji-rich, hashtag clusters',
    enabled: !!process.env.INSTAGRAM_ACCESS_TOKEN,
  },
  pinterest: {
    name: 'Pinterest',
    charLimit: 500,
    style: 'descriptive, keyword-rich, actionable',
    enabled: !!process.env.PINTEREST_ACCESS_TOKEN,
  },
  discord: {
    name: 'Discord',
    charLimit: 2000,
    style: 'community-focused, embed-rich',
    enabled: !!process.env.DISCORD_BOT_TOKEN,
  },
};

// ============================================================================
// API CONFIGURATION
// ============================================================================
const config = {
  twitter: {
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  },
  facebook: {
    pageId: process.env.FACEBOOK_PAGE_ID,
    pageToken: process.env.FACEBOOK_PAGE_TOKEN,
  },
  instagram: {
    accountId: process.env.INSTAGRAM_ACCOUNT_ID,
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
  },
  pinterest: {
    accessToken: process.env.PINTEREST_ACCESS_TOKEN,
    boardId: process.env.PINTEREST_BOARD_ID,
  },
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID,
  },
  gumroadStore: 'https://joshuarowland.gumroad.com',
  storeName: 'Phoenix Forge Digital Empire',
};

// ============================================================================
// PRODUCTS DATABASE - Phoenix Forge Digital Empire
// ============================================================================
const products = [
  {
    id: 1,
    name: "Christmas Planner 2025 - Phoenix Edition",
    shortDesc: "85-page complete holiday system!",
    description: "85-page complete holiday system. Gift trackers, budget tools, daily schedules, recipe collection, and gratitude journal. Transform Christmas chaos into organized magic!",
    story: "Every year, the holiday chaos used to overwhelm me. Gifts forgotten, budgets blown, recipes lost. Then I created this system. 85 pages of pure organization magic. Now Christmas feels like joy again, not stress. This planner saved my sanity - let it save yours too.",
    url: "https://joshuarowland.gumroad.com/l/christmas-planner-2025-phoenix",
    image: "https://public-files.gumroad.com/variants/christmas-planner-cover.png",
    hashtags: ["#ChristmasPlanner", "#HolidayPlanning", "#PhoenixEdition", "#BudgetPlanner", "#GiftTracker"],
    keywords: ["christmas planner", "holiday organization", "gift tracker", "budget planner", "printable planner"],
    category: "planners",
    price: "$24.99"
  },
  {
    id: 2,
    name: "Budget Mastery Course - Christmas Edition",
    shortDesc: "Stop holiday overspending!",
    description: "Stop holiday overspending! 7-page workbook with budget planning, daily spending tracker, receipt organization, and credit card payoff calculator.",
    story: "Last Christmas, I watched my credit card statement climb higher and higher. The guilt was crushing. Never again. I built this budget system to break the overspending cycle. Now I give generously AND stay debt-free. Financial peace during the holidays IS possible.",
    url: "https://joshuarowland.gumroad.com/l/christmas-budget-mastery",
    image: "https://public-files.gumroad.com/variants/budget-mastery-cover.png",
    hashtags: ["#ChristmasBudget", "#BudgetPlanner", "#MoneyManagement", "#DebtFreeChristmas", "#FinancialPlanning"],
    keywords: ["christmas budget", "holiday spending", "debt free", "money management", "budget worksheet"],
    category: "finance",
    price: "$15.00"
  },
  {
    id: 3,
    name: "Phoenix Gratitude & Resilience Journal",
    shortDesc: "Rise stronger through the holidays!",
    description: "10-page resilience workbook. Navigate holiday stress with gratitude, mindfulness practices, and emotional strength exercises. Rise stronger!",
    story: "The holidays aren't magical for everyone. Family tensions, loneliness, grief - it's real. This journal helped me find gratitude even in the hard moments. Each page is a step toward resilience. You're stronger than you know. Let this journal help you see it.",
    url: "https://joshuarowland.gumroad.com/l/phoenix-gratitude-journal",
    image: "https://public-files.gumroad.com/variants/gratitude-journal-cover.png",
    hashtags: ["#GratitudeJournal", "#Resilience", "#MentalWellness", "#SelfCare", "#Mindfulness"],
    keywords: ["gratitude journal", "resilience", "mindfulness", "self care", "mental wellness"],
    category: "journals",
    price: "$12.00"
  },
  {
    id: 4,
    name: "AR Dragon Starter Kit",
    shortDesc: "Gamified learning for your child!",
    description: "Complete AR Dragon learning experience! Includes quest CSV, Replit code, LED scripts, and PDF guide. Build gamified learning for your child.",
    story: "My son Ezra struggles with traditional learning. So I built him a dragon. An AR companion that makes education an adventure. Quests, rewards, LED celebrations. Now he ASKS to do his lessons. This kit lets you build the same magic for your family.",
    url: "https://joshuarowland.gumroad.com/l/ar-dragon-kit",
    image: "https://public-files.gumroad.com/variants/ar-dragon-cover.png",
    hashtags: ["#ARDragon", "#EdTech", "#GamifiedLearning", "#KidsEducation", "#SmartHome"],
    keywords: ["AR learning", "gamification", "kids education", "smart home", "LED projects"],
    category: "tech",
    price: "$9.00"
  },
  {
    id: 5,
    name: "Holiday Party Planning Kit",
    shortDesc: "Host stress-free celebrations!",
    description: "Complete party planning system! Guest lists, menu planning, decoration checklists, timelines, and shopping lists. Host stress-free celebrations!",
    story: "I used to dread hosting. The mental load was exhausting. Forgetting the appetizers, running out of drinks, decorations half-done. Then I created this system. Now my parties feel effortless. Guests ask how I make it look so easy. This kit is my secret.",
    url: "https://joshuarowland.gumroad.com/l/holiday-party-kit",
    image: "https://public-files.gumroad.com/variants/party-planning-cover.png",
    hashtags: ["#PartyPlanning", "#HolidayParty", "#EventPlanning", "#Entertaining", "#HostessGift"],
    keywords: ["party planning", "holiday hosting", "event checklist", "entertaining", "guest list"],
    category: "planners",
    price: "$14.99"
  },
  {
    id: 6,
    name: "Christmas Recipe Collection",
    shortDesc: "Document your family favorites!",
    description: "Holiday recipe organizer! Christmas cookies, main dishes, sides, beverages, appetizers with dietary accommodations. Document family favorites!",
    story: "Grandma's cookies. Mom's stuffing. The recipes that make Christmas FEEL like Christmas. I almost lost them. Scraps of paper, fading memories. This organizer saved our family traditions. Now every recipe is preserved, organized, ready to pass down. Your family deserves this too.",
    url: "https://joshuarowland.gumroad.com/l/christmas-recipes",
    image: "https://public-files.gumroad.com/variants/recipe-collection-cover.png",
    hashtags: ["#ChristmasRecipes", "#HolidayCooking", "#RecipeOrganizer", "#ChristmasCookies", "#FamilyRecipes"],
    keywords: ["christmas recipes", "recipe organizer", "holiday cooking", "family traditions", "cookbook"],
    category: "recipes",
    price: "$9.99"
  }
];

// ============================================================================
// PLATFORM-SPECIFIC CONTENT GENERATORS
// ============================================================================

// TWITTER: Short, punchy, hashtag-focused (280 chars)
const twitterTemplates = [
  (p) => `${p.shortDesc}\n\n${p.url}\n\n${p.hashtags.slice(0, 3).join(' ')}`,
  (p) => `${p.name} - ${p.price}\n\n${p.url}\n\n${p.hashtags.slice(0, 3).join(' ')}`,
  (p) => `Need this: ${p.shortDesc}\n\nGrab it: ${p.url}\n\n${p.hashtags.slice(0, 2).join(' ')}`,
  (p) => `${p.shortDesc} ${p.price}\n\n${p.url}\n\n${p.hashtags.slice(0, 3).join(' ')}`,
];

// FACEBOOK: Storytelling, emotional, longer form
const facebookTemplates = [
  (p) => `${p.story}\n\n${p.name} - ${p.price}\n\nGet yours here: ${p.url}`,
  (p) => `Here's something that changed everything for me...\n\n${p.story}\n\n${p.name}\n${p.price}\n\n${p.url}`,
  (p) => `I want to share something personal.\n\n${p.story}\n\nIf this resonates with you, check out ${p.name}.\n\n${p.url}`,
  (p) => `${p.story}\n\nReady to transform your experience?\n\n${p.name} - ${p.price}\n${p.url}`,
];

// INSTAGRAM: Visual, emoji-rich, hashtag clusters at end
const instagramTemplates = [
  (p) => `${p.story}\n\n${p.name}\n${p.price}\n\nLink in bio!\n\n.\n.\n.\n${p.hashtags.join(' ')} #PhoenixForge #DigitalProducts #PrintablePlanner`,
  (p) => `This changed everything for me.\n\n${p.story}\n\n${p.name} - Now available!\n\nLink in bio\n\n.\n.\n.\n${p.hashtags.join(' ')} #ShopSmall #DigitalDownload`,
  (p) => `${p.shortDesc}\n\n${p.description}\n\n${p.price} - Link in bio!\n\n.\n.\n.\n${p.hashtags.join(' ')} #Printables #Organization`,
];

// PINTEREST: Keyword-rich, descriptive, actionable
const pinterestTemplates = [
  (p) => `${p.name} | ${p.shortDesc} | ${p.keywords.slice(0, 3).join(' | ')} | ${p.price} | Instant Download | ${p.category}`,
  (p) => `${p.description} Perfect for ${p.keywords.slice(0, 2).join(' and ')}. ${p.price} - Instant digital download.`,
  (p) => `${p.shortDesc} ${p.description} Get organized with this ${p.category} resource. ${p.price}`,
];

// DISCORD: Community-focused, embed-friendly
const discordTemplates = [
  (p) => ({ title: `${p.name}`, description: `${p.description}\n\n**${p.price}**`, url: p.url }),
  (p) => ({ title: `New Drop: ${p.name}`, description: `${p.story}\n\n**${p.price}**`, url: p.url }),
  (p) => ({ title: `Featured: ${p.name}`, description: `${p.shortDesc}\n\n${p.description}\n\n**${p.price}**`, url: p.url }),
];

function generateContent(product, platform) {
  let templates, template, content;

  switch (platform) {
    case 'twitter':
      templates = twitterTemplates;
      template = templates[Math.floor(Math.random() * templates.length)];
      content = template(product);
      return content.substring(0, platforms.twitter.charLimit);

    case 'facebook':
      templates = facebookTemplates;
      template = templates[Math.floor(Math.random() * templates.length)];
      content = template(product);
      return content.substring(0, platforms.facebook.charLimit);

    case 'instagram':
      templates = instagramTemplates;
      template = templates[Math.floor(Math.random() * templates.length)];
      content = template(product);
      return content.substring(0, platforms.instagram.charLimit);

    case 'pinterest':
      templates = pinterestTemplates;
      template = templates[Math.floor(Math.random() * templates.length)];
      content = template(product);
      return content.substring(0, platforms.pinterest.charLimit);

    case 'discord':
      templates = discordTemplates;
      template = templates[Math.floor(Math.random() * templates.length)];
      return template(product); // Returns embed object

    default:
      return product.description;
  }
}

function getRandomProduct() {
  return products[Math.floor(Math.random() * products.length)];
}

// ============================================================================
// TWITTER CLIENT
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
    if (imageUrl) {
      try {
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.buffer();
        mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });
      } catch (imgError) {
        console.log('[Twitter] Image upload failed, posting without image');
      }
    }

    const tweet = await twitterClient.v2.tweet({
      text: text.substring(0, 280),
      ...(mediaId && { media: { media_ids: [mediaId] } })
    });

    console.log('[Twitter] Posted:', tweet.data.id);
    return { success: true, id: tweet.data.id, platform: 'twitter' };
  } catch (error) {
    console.error('[Twitter] Error:', error.message);
    return { success: false, error: error.message, platform: 'twitter' };
  }
}

// ============================================================================
// FACEBOOK CLIENT (Graph API)
// ============================================================================
async function postToFacebook(text, imageUrl = null) {
  if (!config.facebook.pageToken) {
    console.log('[Facebook] Not configured');
    return { success: false, error: 'Not configured', platform: 'facebook' };
  }

  try {
    const endpoint = imageUrl
      ? `https://graph.facebook.com/v18.0/${config.facebook.pageId}/photos`
      : `https://graph.facebook.com/v18.0/${config.facebook.pageId}/feed`;

    const params = new URLSearchParams({
      access_token: config.facebook.pageToken,
      message: text,
    });

    if (imageUrl) {
      params.append('url', imageUrl);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      body: params,
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    console.log('[Facebook] Posted:', data.id || data.post_id);
    return { success: true, id: data.id || data.post_id, platform: 'facebook' };
  } catch (error) {
    console.error('[Facebook] Error:', error.message);
    return { success: false, error: error.message, platform: 'facebook' };
  }
}

// ============================================================================
// INSTAGRAM CLIENT (Graph API via Facebook)
// ============================================================================
async function postToInstagram(text, imageUrl) {
  if (!config.instagram.accessToken || !imageUrl) {
    console.log('[Instagram] Not configured or no image provided');
    return { success: false, error: 'Not configured or image required', platform: 'instagram' };
  }

  try {
    // Step 1: Create media container
    const containerResponse = await fetch(
      `https://graph.facebook.com/v18.0/${config.instagram.accountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: text,
          access_token: config.instagram.accessToken,
        }),
      }
    );

    const containerData = await containerResponse.json();
    if (containerData.error) throw new Error(containerData.error.message);

    // Step 2: Publish the container
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${config.instagram.accountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: config.instagram.accessToken,
        }),
      }
    );

    const publishData = await publishResponse.json();
    if (publishData.error) throw new Error(publishData.error.message);

    console.log('[Instagram] Posted:', publishData.id);
    return { success: true, id: publishData.id, platform: 'instagram' };
  } catch (error) {
    console.error('[Instagram] Error:', error.message);
    return { success: false, error: error.message, platform: 'instagram' };
  }
}

// ============================================================================
// PINTEREST CLIENT
// ============================================================================
async function postToPinterest(text, imageUrl, product) {
  if (!config.pinterest.accessToken) {
    console.log('[Pinterest] Not configured');
    return { success: false, error: 'Not configured', platform: 'pinterest' };
  }

  try {
    const response = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.pinterest.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board_id: config.pinterest.boardId,
        title: product.name,
        description: text,
        link: product.url,
        media_source: {
          source_type: 'image_url',
          url: imageUrl,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Pinterest API error');
    }

    console.log('[Pinterest] Posted:', data.id);
    return { success: true, id: data.id, platform: 'pinterest' };
  } catch (error) {
    console.error('[Pinterest] Error:', error.message);
    return { success: false, error: error.message, platform: 'pinterest' };
  }
}

// ============================================================================
// DISCORD CLIENT
// ============================================================================
let discordClient = null;

if (config.discord.token) {
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordClient.on('ready', () => {
    console.log(`[Discord] Logged in as ${discordClient.user.tag}`);
  });

  discordClient.login(config.discord.token).catch(console.error);
}

async function postToDiscord(embedData, imageUrl = null) {
  if (!discordClient || !config.discord.channelId) {
    console.log('[Discord] Not configured');
    return { success: false, error: 'Not configured', platform: 'discord' };
  }

  try {
    const channel = await discordClient.channels.fetch(config.discord.channelId);

    const embed = new EmbedBuilder()
      .setTitle(embedData.title)
      .setDescription(embedData.description)
      .setURL(embedData.url)
      .setColor(0xFF6B35);

    if (imageUrl) embed.setImage(imageUrl);

    await channel.send({ embeds: [embed] });

    console.log('[Discord] Posted to channel');
    return { success: true, platform: 'discord' };
  } catch (error) {
    console.error('[Discord] Error:', error.message);
    return { success: false, error: error.message, platform: 'discord' };
  }
}

// ============================================================================
// MULTI-PLATFORM POSTING
// ============================================================================
async function postToAllPlatforms(product) {
  const results = {};

  // Twitter
  if (platforms.twitter.enabled) {
    const content = generateContent(product, 'twitter');
    results.twitter = await postToTwitter(content, product.image);
  }

  // Facebook
  if (platforms.facebook.enabled) {
    const content = generateContent(product, 'facebook');
    results.facebook = await postToFacebook(content, product.image);
  }

  // Instagram
  if (platforms.instagram.enabled) {
    const content = generateContent(product, 'instagram');
    results.instagram = await postToInstagram(content, product.image);
  }

  // Pinterest
  if (platforms.pinterest.enabled) {
    const content = generateContent(product, 'pinterest');
    results.pinterest = await postToPinterest(content, product.image, product);
  }

  // Discord
  if (platforms.discord.enabled) {
    const embedData = generateContent(product, 'discord');
    results.discord = await postToDiscord(embedData, product.image);
  }

  return results;
}

// ============================================================================
// SCHEDULED POSTS
// ============================================================================

// Post to all platforms every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[Scheduler] Running multi-platform post...');
  const product = getRandomProduct();
  const results = await postToAllPlatforms(product);
  console.log('[Scheduler] Results:', results);
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    status: 'Phoenix Forge Multi-Platform Auto Publisher',
    platforms: Object.entries(platforms).map(([key, val]) => ({
      platform: key,
      name: val.name,
      enabled: val.enabled,
      charLimit: val.charLimit,
      style: val.style,
    })),
    endpoints: {
      '/trigger': 'POST - Trigger post to all platforms',
      '/trigger/:platform': 'POST - Trigger post to specific platform',
      '/products': 'GET - List products',
      '/preview/:platform': 'GET - Preview content for platform',
      '/status': 'GET - Check platform status',
    }
  });
});

// Trigger post to all platforms
app.post('/trigger', async (req, res) => {
  const product = req.body.productId
    ? products.find(p => p.id === req.body.productId)
    : getRandomProduct();
  const results = await postToAllPlatforms(product);
  res.json({ product: product.name, results });
});

// Trigger post to specific platform
app.post('/trigger/:platform', async (req, res) => {
  const { platform } = req.params;
  const product = req.body.productId
    ? products.find(p => p.id === req.body.productId)
    : getRandomProduct();

  let result;
  const content = generateContent(product, platform);

  switch (platform) {
    case 'twitter':
      result = await postToTwitter(content, product.image);
      break;
    case 'facebook':
      result = await postToFacebook(content, product.image);
      break;
    case 'instagram':
      result = await postToInstagram(content, product.image);
      break;
    case 'pinterest':
      result = await postToPinterest(content, product.image, product);
      break;
    case 'discord':
      result = await postToDiscord(content, product.image);
      break;
    default:
      return res.status(400).json({ error: 'Unknown platform' });
  }

  res.json({ platform, product: product.name, result });
});

// Preview content for a platform
app.get('/preview/:platform', (req, res) => {
  const { platform } = req.params;
  const product = getRandomProduct();
  const content = generateContent(product, platform);

  res.json({
    platform,
    charLimit: platforms[platform]?.charLimit,
    style: platforms[platform]?.style,
    product: product.name,
    content,
    charCount: typeof content === 'string' ? content.length : 'N/A (embed)',
  });
});

// List products
app.get('/products', (req, res) => {
  res.json(products);
});

// Platform status
app.get('/status', (req, res) => {
  res.json({
    platforms: Object.entries(platforms).map(([key, val]) => ({
      platform: key,
      name: val.name,
      enabled: val.enabled,
    })),
    discordConnected: discordClient?.isReady() || false,
  });
});

// Webhook for Gumroad sales
app.post('/webhook/sale', async (req, res) => {
  const sale = req.body;
  console.log('[Webhook] Sale received:', sale);

  if (platforms.discord.enabled) {
    await postToDiscord({
      title: 'New Sale!',
      description: `Someone just purchased a product!\n\n${sale.product_name || 'Product'}`,
      url: config.gumroadStore,
    });
  }

  res.json({ received: true });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Phoenix Forge Multi-Platform Auto Publisher running on port ${PORT}`);
  console.log('Enabled platforms:');
  Object.entries(platforms).forEach(([key, val]) => {
    console.log(`  - ${val.name}: ${val.enabled ? 'YES' : 'NO (needs API keys)'}`);
  });
  console.log('Schedule: Posts to all platforms every 6 hours');
});
