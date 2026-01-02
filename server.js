// ============================================================================
// PHOENIX FORGE - DIGITAL EMPIRE MULTI-PLATFORM AUTO PUBLISHER
// Version 2.0 - With Dynamic Posting Rules & Rotation
// Supports: Twitter, Facebook, Instagram, Pinterest, Discord
// ============================================================================

const express = require('express');
const fetch = require('node-fetch');
const cron = require('node-cron');
const { TwitterApi } = require('twitter-api-v2');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const app = express();
app.use(express.json());

// ============================================================================
// POSTING HISTORY & ROTATION TRACKING
// ============================================================================
const postingHistory = {
  lastPosted: {},           // { platform: { productId, timestamp, templateIndex } }
  productRotation: [],      // Track order of products posted
  templateRotation: {},     // { platform: [usedTemplateIndices] }
  dailyCount: {},           // { platform: count }
  lastReset: new Date().toDateString(),
};

// Reset daily counts at midnight
function resetDailyCountsIfNeeded() {
  const today = new Date().toDateString();
  if (postingHistory.lastReset !== today) {
    postingHistory.dailyCount = {};
    postingHistory.lastReset = today;
  }
}

// ============================================================================
// PLATFORM CONFIGURATIONS & LIMITS
// ============================================================================
const platforms = {
  twitter: {
    name: 'Twitter/X',
    charLimit: 280,
    style: 'short, punchy, hashtag-heavy',
    enabled: !!process.env.TWITTER_API_KEY,
    dailyLimit: 10,
    minHoursBetween: 4,
  },
  facebook: {
    name: 'Facebook',
    charLimit: 63206,
    optimalLength: 80,
    style: 'storytelling, emotional, engaging',
    enabled: !!process.env.FACEBOOK_PAGE_TOKEN,
    dailyLimit: 5,
    minHoursBetween: 6,
  },
  instagram: {
    name: 'Instagram',
    charLimit: 2200,
    style: 'visual-focused, emoji-rich, hashtag clusters',
    enabled: !!process.env.INSTAGRAM_ACCESS_TOKEN,
    dailyLimit: 3,
    minHoursBetween: 8,
  },
  pinterest: {
    name: 'Pinterest',
    charLimit: 500,
    style: 'descriptive, keyword-rich, actionable',
    enabled: !!process.env.PINTEREST_ACCESS_TOKEN,
    dailyLimit: 10,
    minHoursBetween: 2,
  },
  discord: {
    name: 'Discord',
    charLimit: 2000,
    style: 'community-focused, embed-rich',
    enabled: !!process.env.DISCORD_BOT_TOKEN,
    dailyLimit: 20,
    minHoursBetween: 2,
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
  makeWebhook: process.env.MAKE_WEBHOOK_URL,
  n8nWebhook: process.env.N8N_WEBHOOK_URL || 'http://100.71.190.76:5678/webhook/phoenix-publisher',
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
    hashtags: ["#ChristmasPlanner", "#HolidayPlanning", "#PhoenixEdition", "#BudgetPlanner", "#GiftTracker", "#PrintablePlanner", "#HolidayOrganization"],
    keywords: ["christmas planner", "holiday organization", "gift tracker", "budget planner", "printable planner"],
    category: "planners",
    price: "$24.99",
    seasonal: ["november", "december", "january"],
    timeOfDay: ["morning", "evening"],
  },
  {
    id: 2,
    name: "Budget Mastery Course - Christmas Edition",
    shortDesc: "Stop holiday overspending!",
    description: "Stop holiday overspending! 7-page workbook with budget planning, daily spending tracker, receipt organization, and credit card payoff calculator.",
    story: "Last Christmas, I watched my credit card statement climb higher and higher. The guilt was crushing. Never again. I built this budget system to break the overspending cycle. Now I give generously AND stay debt-free. Financial peace during the holidays IS possible.",
    url: "https://joshuarowland.gumroad.com/l/christmas-budget-mastery",
    image: "https://public-files.gumroad.com/variants/budget-mastery-cover.png",
    hashtags: ["#ChristmasBudget", "#BudgetPlanner", "#MoneyManagement", "#DebtFreeChristmas", "#FinancialPlanning", "#HolidayBudget", "#SaveMoney"],
    keywords: ["christmas budget", "holiday spending", "debt free", "money management", "budget worksheet"],
    category: "finance",
    price: "$15.00",
    seasonal: ["october", "november", "december"],
    timeOfDay: ["morning", "afternoon"],
  },
  {
    id: 3,
    name: "Phoenix Gratitude & Resilience Journal",
    shortDesc: "Rise stronger through the holidays!",
    description: "10-page resilience workbook. Navigate holiday stress with gratitude, mindfulness practices, and emotional strength exercises. Rise stronger!",
    story: "The holidays aren't magical for everyone. Family tensions, loneliness, grief - it's real. This journal helped me find gratitude even in the hard moments. Each page is a step toward resilience. You're stronger than you know. Let this journal help you see it.",
    url: "https://joshuarowland.gumroad.com/l/phoenix-gratitude-journal",
    image: "https://public-files.gumroad.com/variants/gratitude-journal-cover.png",
    hashtags: ["#GratitudeJournal", "#Resilience", "#MentalWellness", "#SelfCare", "#Mindfulness", "#JournalPrompts", "#EmotionalHealth"],
    keywords: ["gratitude journal", "resilience", "mindfulness", "self care", "mental wellness"],
    category: "journals",
    price: "$12.00",
    seasonal: ["all"],
    timeOfDay: ["morning", "evening"],
  },
  {
    id: 4,
    name: "AR Dragon Starter Kit",
    shortDesc: "Gamified learning for your child!",
    description: "Complete AR Dragon learning experience! Includes quest CSV, Replit code, LED scripts, and PDF guide. Build gamified learning for your child.",
    story: "My son Ezra struggles with traditional learning. So I built him a dragon. An AR companion that makes education an adventure. Quests, rewards, LED celebrations. Now he ASKS to do his lessons. This kit lets you build the same magic for your family.",
    url: "https://joshuarowland.gumroad.com/l/ar-dragon-kit",
    image: "https://public-files.gumroad.com/variants/ar-dragon-cover.png",
    hashtags: ["#ARDragon", "#EdTech", "#GamifiedLearning", "#KidsEducation", "#SmartHome", "#ParentingHack", "#LearningGames"],
    keywords: ["AR learning", "gamification", "kids education", "smart home", "LED projects"],
    category: "tech",
    price: "$9.00",
    seasonal: ["all"],
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: 5,
    name: "Holiday Party Planning Kit",
    shortDesc: "Host stress-free celebrations!",
    description: "Complete party planning system! Guest lists, menu planning, decoration checklists, timelines, and shopping lists. Host stress-free celebrations!",
    story: "I used to dread hosting. The mental load was exhausting. Forgetting the appetizers, running out of drinks, decorations half-done. Then I created this system. Now my parties feel effortless. Guests ask how I make it look so easy. This kit is my secret.",
    url: "https://joshuarowland.gumroad.com/l/holiday-party-kit",
    image: "https://public-files.gumroad.com/variants/party-planning-cover.png",
    hashtags: ["#PartyPlanning", "#HolidayParty", "#EventPlanning", "#Entertaining", "#HostessGift", "#PartyHost", "#Celebration"],
    keywords: ["party planning", "holiday hosting", "event checklist", "entertaining", "guest list"],
    category: "planners",
    price: "$14.99",
    seasonal: ["november", "december"],
    timeOfDay: ["morning", "afternoon"],
  },
  {
    id: 6,
    name: "Christmas Recipe Collection",
    shortDesc: "Document your family favorites!",
    description: "Holiday recipe organizer! Christmas cookies, main dishes, sides, beverages, appetizers with dietary accommodations. Document family favorites!",
    story: "Grandma's cookies. Mom's stuffing. The recipes that make Christmas FEEL like Christmas. I almost lost them. Scraps of paper, fading memories. This organizer saved our family traditions. Now every recipe is preserved, organized, ready to pass down. Your family deserves this too.",
    url: "https://joshuarowland.gumroad.com/l/christmas-recipes",
    image: "https://public-files.gumroad.com/variants/recipe-collection-cover.png",
    hashtags: ["#ChristmasRecipes", "#HolidayCooking", "#RecipeOrganizer", "#ChristmasCookies", "#FamilyRecipes", "#HolidayBaking", "#FamilyTraditions"],
    keywords: ["christmas recipes", "recipe organizer", "holiday cooking", "family traditions", "cookbook"],
    category: "recipes",
    price: "$9.99",
    seasonal: ["november", "december"],
    timeOfDay: ["morning", "afternoon"],
  }
];

// ============================================================================
// SMART PRODUCT SELECTION (No Repeats, Rotation, Seasonal)
// ============================================================================
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

function getCurrentSeason() {
  const month = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();
  return month;
}

function getSmartProduct(platform) {
  const timeOfDay = getTimeOfDay();
  const currentMonth = getCurrentSeason();

  // Filter products by time and season relevance
  let eligibleProducts = products.filter(p => {
    const seasonMatch = p.seasonal.includes('all') || p.seasonal.includes(currentMonth);
    const timeMatch = p.timeOfDay.includes(timeOfDay);
    return seasonMatch && timeMatch;
  });

  // If no seasonal match, use all products
  if (eligibleProducts.length === 0) {
    eligibleProducts = [...products];
  }

  // Remove recently posted products (last 3 posts per platform)
  const recentIds = postingHistory.productRotation.slice(-3);
  const notRecentProducts = eligibleProducts.filter(p => !recentIds.includes(p.id));

  // If all products were recent, reset and use all eligible
  const finalPool = notRecentProducts.length > 0 ? notRecentProducts : eligibleProducts;

  // Pick random from pool
  const selected = finalPool[Math.floor(Math.random() * finalPool.length)];

  // Track rotation
  postingHistory.productRotation.push(selected.id);
  if (postingHistory.productRotation.length > 20) {
    postingHistory.productRotation = postingHistory.productRotation.slice(-10);
  }

  return selected;
}

// ============================================================================
// PLATFORM-SPECIFIC CONTENT GENERATORS (With Rotation)
// ============================================================================

// TWITTER: Short, punchy, hashtag-focused (280 chars)
const twitterTemplates = [
  (p) => `${p.shortDesc}\n\n${p.url}\n\n${p.hashtags.slice(0, 3).join(' ')}`,
  (p) => `${p.name} - ${p.price}\n\n${p.url}\n\n${p.hashtags.slice(0, 3).join(' ')}`,
  (p) => `Need this: ${p.shortDesc}\n\nGrab it: ${p.url}\n\n${p.hashtags.slice(0, 2).join(' ')}`,
  (p) => `${p.shortDesc} ${p.price}\n\n${p.url}\n\n${p.hashtags.slice(0, 3).join(' ')}`,
  (p) => `New from Phoenix Forge:\n\n${p.name}\n\n${p.url}`,
  (p) => `Transform your ${p.category}!\n\n${p.shortDesc}\n\n${p.url}`,
  (p) => `${p.price} well spent:\n\n${p.shortDesc}\n\n${p.url}`,
  (p) => `Your ${p.category} solution:\n\n${p.name} - ${p.price}\n\n${p.url}`,
];

// FACEBOOK: Storytelling, emotional, longer form
const facebookTemplates = [
  (p) => `${p.story}\n\n${p.name} - ${p.price}\n\nGet yours here: ${p.url}`,
  (p) => `Here's something that changed everything for me...\n\n${p.story}\n\n${p.name}\n${p.price}\n\n${p.url}`,
  (p) => `I want to share something personal.\n\n${p.story}\n\nIf this resonates with you, check out ${p.name}.\n\n${p.url}`,
  (p) => `${p.story}\n\nReady to transform your experience?\n\n${p.name} - ${p.price}\n${p.url}`,
  (p) => `Let me tell you a story...\n\n${p.story}\n\nThis is why I created ${p.name}.\n\n${p.url}`,
  (p) => `Real talk:\n\n${p.story}\n\nIf you're going through something similar, ${p.name} might help.\n\n${p.url}`,
];

// INSTAGRAM: Visual, emoji-rich, hashtag clusters at end
const instagramTemplates = [
  (p) => `${p.story}\n\n${p.name}\n${p.price}\n\nLink in bio!\n\n.\n.\n.\n${p.hashtags.join(' ')} #PhoenixForge #DigitalProducts #PrintablePlanner`,
  (p) => `This changed everything for me.\n\n${p.story}\n\n${p.name} - Now available!\n\nLink in bio\n\n.\n.\n.\n${p.hashtags.join(' ')} #ShopSmall #DigitalDownload`,
  (p) => `${p.shortDesc}\n\n${p.description}\n\n${p.price} - Link in bio!\n\n.\n.\n.\n${p.hashtags.join(' ')} #Printables #Organization`,
  (p) => `New drop!\n\n${p.name}\n\n${p.story}\n\nLink in bio!\n\n.\n.\n.\n${p.hashtags.join(' ')} #NewProduct #PhoenixForge`,
];

// PINTEREST: Keyword-rich, descriptive, actionable
const pinterestTemplates = [
  (p) => `${p.name} | ${p.shortDesc} | ${p.keywords.slice(0, 3).join(' | ')} | ${p.price} | Instant Download | ${p.category}`,
  (p) => `${p.description} Perfect for ${p.keywords.slice(0, 2).join(' and ')}. ${p.price} - Instant digital download.`,
  (p) => `${p.shortDesc} ${p.description} Get organized with this ${p.category} resource. ${p.price}`,
  (p) => `Pin this for later! ${p.name} - ${p.shortDesc} ${p.keywords.join(' ')}`,
];

// DISCORD: Community-focused, embed-friendly
const discordTemplates = [
  (p) => ({ title: `${p.name}`, description: `${p.description}\n\n**${p.price}**`, url: p.url }),
  (p) => ({ title: `New Drop: ${p.name}`, description: `${p.story}\n\n**${p.price}**`, url: p.url }),
  (p) => ({ title: `Featured: ${p.name}`, description: `${p.shortDesc}\n\n${p.description}\n\n**${p.price}**`, url: p.url }),
  (p) => ({ title: `Phoenix Forge: ${p.name}`, description: `${p.story.substring(0, 200)}...\n\n**${p.price}**`, url: p.url }),
];

function getSmartTemplate(platform, product) {
  const templates = {
    twitter: twitterTemplates,
    facebook: facebookTemplates,
    instagram: instagramTemplates,
    pinterest: pinterestTemplates,
    discord: discordTemplates,
  }[platform];

  if (!templates) return null;

  // Track used templates per platform
  if (!postingHistory.templateRotation[platform]) {
    postingHistory.templateRotation[platform] = [];
  }

  const usedIndices = postingHistory.templateRotation[platform];
  const availableIndices = templates.map((_, i) => i).filter(i => !usedIndices.includes(i));

  // Reset if all templates used
  let selectedIndex;
  if (availableIndices.length === 0) {
    postingHistory.templateRotation[platform] = [];
    selectedIndex = Math.floor(Math.random() * templates.length);
  } else {
    selectedIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  }

  postingHistory.templateRotation[platform].push(selectedIndex);

  const template = templates[selectedIndex];
  const content = template(product);

  // Apply character limit
  if (typeof content === 'string') {
    return content.substring(0, platforms[platform]?.charLimit || 2000);
  }
  return content;
}

// ============================================================================
// POSTING RULES ENGINE
// ============================================================================
function canPost(platform) {
  resetDailyCountsIfNeeded();

  const config = platforms[platform];
  if (!config || !config.enabled) return { allowed: false, reason: 'Platform not enabled' };

  // Check daily limit
  const todayCount = postingHistory.dailyCount[platform] || 0;
  if (todayCount >= config.dailyLimit) {
    return { allowed: false, reason: `Daily limit reached (${config.dailyLimit})` };
  }

  // Check time since last post
  const lastPost = postingHistory.lastPosted[platform];
  if (lastPost) {
    const hoursSince = (Date.now() - lastPost.timestamp) / (1000 * 60 * 60);
    if (hoursSince < config.minHoursBetween) {
      return { allowed: false, reason: `Too soon (wait ${(config.minHoursBetween - hoursSince).toFixed(1)}h)` };
    }
  }

  return { allowed: true };
}

function recordPost(platform, productId, templateIndex) {
  postingHistory.lastPosted[platform] = {
    productId,
    templateIndex,
    timestamp: Date.now(),
  };
  postingHistory.dailyCount[platform] = (postingHistory.dailyCount[platform] || 0) + 1;
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
    return { success: false, error: 'Not configured', platform: 'twitter' };
  }

  const canPostResult = canPost('twitter');
  if (!canPostResult.allowed) {
    return { success: false, error: canPostResult.reason, platform: 'twitter' };
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
    recordPost('twitter', null, null);
    return { success: true, id: tweet.data.id, platform: 'twitter' };
  } catch (error) {
    console.error('[Twitter] Error:', error.message);
    return { success: false, error: error.message, platform: 'twitter' };
  }
}

// ============================================================================
// FACEBOOK CLIENT
// ============================================================================
async function postToFacebook(text, imageUrl = null) {
  if (!config.facebook.pageToken) {
    return { success: false, error: 'Not configured', platform: 'facebook' };
  }

  const canPostResult = canPost('facebook');
  if (!canPostResult.allowed) {
    return { success: false, error: canPostResult.reason, platform: 'facebook' };
  }

  try {
    const endpoint = imageUrl
      ? `https://graph.facebook.com/v18.0/${config.facebook.pageId}/photos`
      : `https://graph.facebook.com/v18.0/${config.facebook.pageId}/feed`;

    const params = new URLSearchParams({
      access_token: config.facebook.pageToken,
      message: text,
    });
    if (imageUrl) params.append('url', imageUrl);

    const response = await fetch(endpoint, { method: 'POST', body: params });
    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    recordPost('facebook', null, null);
    return { success: true, id: data.id || data.post_id, platform: 'facebook' };
  } catch (error) {
    return { success: false, error: error.message, platform: 'facebook' };
  }
}

// ============================================================================
// INSTAGRAM CLIENT
// ============================================================================
async function postToInstagram(text, imageUrl) {
  if (!config.instagram.accessToken || !imageUrl) {
    return { success: false, error: 'Not configured or image required', platform: 'instagram' };
  }

  const canPostResult = canPost('instagram');
  if (!canPostResult.allowed) {
    return { success: false, error: canPostResult.reason, platform: 'instagram' };
  }

  try {
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

    recordPost('instagram', null, null);
    return { success: true, id: publishData.id, platform: 'instagram' };
  } catch (error) {
    return { success: false, error: error.message, platform: 'instagram' };
  }
}

// ============================================================================
// PINTEREST CLIENT
// ============================================================================
async function postToPinterest(text, imageUrl, product) {
  if (!config.pinterest.accessToken) {
    return { success: false, error: 'Not configured', platform: 'pinterest' };
  }

  const canPostResult = canPost('pinterest');
  if (!canPostResult.allowed) {
    return { success: false, error: canPostResult.reason, platform: 'pinterest' };
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
        media_source: { source_type: 'image_url', url: imageUrl },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Pinterest API error');

    recordPost('pinterest', null, null);
    return { success: true, id: data.id, platform: 'pinterest' };
  } catch (error) {
    return { success: false, error: error.message, platform: 'pinterest' };
  }
}

// ============================================================================
// DISCORD CLIENT
// ============================================================================
let discordClient = null;
if (config.discord.token) {
  discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });
  discordClient.on('ready', () => console.log(`[Discord] Logged in as ${discordClient.user.tag}`));
  discordClient.login(config.discord.token).catch(console.error);
}

async function postToDiscord(embedData, imageUrl = null) {
  if (!discordClient || !config.discord.channelId) {
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
    recordPost('discord', null, null);
    return { success: true, platform: 'discord' };
  } catch (error) {
    return { success: false, error: error.message, platform: 'discord' };
  }
}

// ============================================================================
// WEBHOOK INTEGRATIONS (n8n + Make.com)
// ============================================================================
async function notifyWebhooks(event, data) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    source: 'phoenix-auto-publisher',
    ...data,
  };

  // Notify n8n (self-hosted, primary)
  if (config.n8nWebhook) {
    try {
      await fetch(config.n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('[n8n] Webhook notified:', event);
    } catch (error) {
      console.log('[n8n] Webhook unreachable (server may be off):', error.message);
    }
  }

  // Notify Make.com (backup/cloud)
  if (config.makeWebhook) {
    try {
      await fetch(config.makeWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('[Make.com] Webhook notified:', event);
    } catch (error) {
      console.error('[Make.com] Webhook error:', error.message);
    }
  }
}

// Alias for backwards compatibility
const notifyMakeWebhook = notifyWebhooks;

// ============================================================================
// SMART MULTI-PLATFORM POSTING
// ============================================================================
async function smartPostToAllPlatforms() {
  const results = {};
  const product = getSmartProduct();

  // Twitter
  if (platforms.twitter.enabled) {
    const content = getSmartTemplate('twitter', product);
    results.twitter = await postToTwitter(content, product.image);
  }

  // Facebook
  if (platforms.facebook.enabled) {
    const content = getSmartTemplate('facebook', product);
    results.facebook = await postToFacebook(content, product.image);
  }

  // Instagram
  if (platforms.instagram.enabled) {
    const content = getSmartTemplate('instagram', product);
    results.instagram = await postToInstagram(content, product.image);
  }

  // Pinterest
  if (platforms.pinterest.enabled) {
    const content = getSmartTemplate('pinterest', product);
    results.pinterest = await postToPinterest(content, product.image, product);
  }

  // Discord
  if (platforms.discord.enabled) {
    const embedData = getSmartTemplate('discord', product);
    results.discord = await postToDiscord(embedData, product.image);
  }

  // Notify Make.com
  await notifyMakeWebhook('posts_published', { product: product.name, results });

  return { product: product.name, results };
}

// ============================================================================
// SCHEDULED POSTS
// ============================================================================
cron.schedule('0 */6 * * *', async () => {
  console.log('[Scheduler] Running smart multi-platform post...');
  const results = await smartPostToAllPlatforms();
  console.log('[Scheduler] Results:', JSON.stringify(results, null, 2));
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    status: 'Phoenix Forge Multi-Platform Auto Publisher v2.0',
    features: ['Smart rotation', 'No repeats', 'Seasonal content', 'Rate limiting', 'Make.com integration'],
    platforms: Object.entries(platforms).map(([key, val]) => ({
      platform: key,
      name: val.name,
      enabled: val.enabled,
      charLimit: val.charLimit,
      dailyLimit: val.dailyLimit,
    })),
    endpoints: {
      '/trigger': 'POST - Smart post to all platforms',
      '/trigger/:platform': 'POST - Post to specific platform',
      '/products': 'GET - List products',
      '/preview/:platform': 'GET - Preview content',
      '/status': 'GET - Platform status',
      '/history': 'GET - Posting history',
      '/rules': 'GET - Posting rules',
    }
  });
});

app.post('/trigger', async (req, res) => {
  const results = await smartPostToAllPlatforms();
  res.json(results);
});

app.post('/trigger/:platform', async (req, res) => {
  const { platform } = req.params;
  const product = getSmartProduct(platform);
  const content = getSmartTemplate(platform, product);

  let result;
  switch (platform) {
    case 'twitter': result = await postToTwitter(content, product.image); break;
    case 'facebook': result = await postToFacebook(content, product.image); break;
    case 'instagram': result = await postToInstagram(content, product.image); break;
    case 'pinterest': result = await postToPinterest(content, product.image, product); break;
    case 'discord': result = await postToDiscord(content, product.image); break;
    default: return res.status(400).json({ error: 'Unknown platform' });
  }

  res.json({ platform, product: product.name, result });
});

app.get('/preview/:platform', (req, res) => {
  const { platform } = req.params;
  const product = getSmartProduct(platform);
  const content = getSmartTemplate(platform, product);
  const canPostResult = canPost(platform);

  res.json({
    platform,
    canPost: canPostResult,
    product: product.name,
    content,
    charCount: typeof content === 'string' ? content.length : 'N/A',
    charLimit: platforms[platform]?.charLimit,
  });
});

app.get('/products', (req, res) => res.json(products));

app.get('/status', (req, res) => {
  resetDailyCountsIfNeeded();
  res.json({
    platforms: Object.entries(platforms).map(([key, val]) => ({
      platform: key,
      enabled: val.enabled,
      canPost: canPost(key),
      todayCount: postingHistory.dailyCount[key] || 0,
      dailyLimit: val.dailyLimit,
    })),
    discordConnected: discordClient?.isReady() || false,
  });
});

app.get('/history', (req, res) => res.json(postingHistory));

app.get('/rules', (req, res) => {
  res.json({
    platforms: Object.entries(platforms).map(([key, val]) => ({
      platform: key,
      dailyLimit: val.dailyLimit,
      minHoursBetween: val.minHoursBetween,
      charLimit: val.charLimit,
    })),
    rotation: {
      recentProducts: postingHistory.productRotation.slice(-5),
      templateUsage: postingHistory.templateRotation,
    }
  });
});

app.post('/webhook/sale', async (req, res) => {
  const sale = req.body;
  console.log('[Webhook] Sale received:', sale);

  await notifyMakeWebhook('sale', sale);

  if (platforms.discord.enabled) {
    await postToDiscord({
      title: 'New Sale!',
      description: `Someone just purchased ${sale.product_name || 'a product'}!`,
      url: config.gumroadStore,
    });
  }

  res.json({ received: true });
});

app.post('/webhook/make', async (req, res) => {
  const { action, data } = req.body;
  console.log('[Make.com] Received:', action, data);

  switch (action) {
    case 'trigger_post':
      const results = await smartPostToAllPlatforms();
      res.json(results);
      break;
    case 'post_platform':
      // Handle specific platform post from Make.com
      res.json({ received: true, action });
      break;
    default:
      res.json({ received: true });
  }
});

// ============================================================================
// START SERVER
// ============================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Phoenix Forge Auto Publisher v2.0 running on port ${PORT}`);
  console.log('Features: Smart rotation, No repeats, Seasonal content, Rate limiting');
  console.log('Enabled platforms:');
  Object.entries(platforms).forEach(([key, val]) => {
    console.log(`  - ${val.name}: ${val.enabled ? 'YES' : 'NO'} (${val.dailyLimit}/day, ${val.minHoursBetween}h between)`);
  });
});
