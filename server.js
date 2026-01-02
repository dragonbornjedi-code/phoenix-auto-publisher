// ============================================================================
// PHOENIX FORGE - DIGITAL EMPIRE AUTO PUBLISHER
// With Discord Approval System - React ✅ to approve, ❌ to reject
// ============================================================================

const express = require('express');
const fetch = require('node-fetch');
const cron = require('node-cron');
const { TwitterApi } = require('twitter-api-v2');
const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');

const app = express();
app.use(express.json());

// ============================================================================
// CONFIGURATION
// ============================================================================
const config = {
  twitter: {
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  },
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    approvalChannelId: process.env.DISCORD_APPROVAL_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID,
    announcementChannelId: process.env.DISCORD_CHANNEL_ID,
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
    description: "85-page complete holiday system. Gift trackers, budget tools, daily schedules, recipe collection, and gratitude journal. Transform Christmas chaos into organized magic!",
    url: "https://joshuarowland.gumroad.com/l/christmas-planner-2025-phoenix",
    image: "https://public-files.gumroad.com/variants/christmas-planner-cover.png",
    hashtags: ["#ChristmasPlanner", "#HolidayPlanning", "#PhoenixEdition", "#BudgetPlanner", "#GiftTracker"],
    category: "planners",
    price: "$24.99"
  },
  {
    id: 2,
    name: "Budget Mastery Course - Christmas Edition",
    description: "Stop holiday overspending! 7-page workbook with budget planning, daily spending tracker, receipt organization, and credit card payoff calculator.",
    url: "https://joshuarowland.gumroad.com/l/christmas-budget-mastery",
    image: "https://public-files.gumroad.com/variants/budget-mastery-cover.png",
    hashtags: ["#ChristmasBudget", "#BudgetPlanner", "#MoneyManagement", "#DebtFreeChristmas", "#FinancialPlanning"],
    category: "finance",
    price: "$15.00"
  },
  {
    id: 3,
    name: "Phoenix Gratitude & Resilience Journal",
    description: "10-page resilience workbook. Navigate holiday stress with gratitude, mindfulness practices, and emotional strength exercises. Rise stronger!",
    url: "https://joshuarowland.gumroad.com/l/phoenix-gratitude-journal",
    image: "https://public-files.gumroad.com/variants/gratitude-journal-cover.png",
    hashtags: ["#GratitudeJournal", "#Resilience", "#MentalWellness", "#SelfCare", "#Mindfulness"],
    category: "journals",
    price: "$12.00"
  },
  {
    id: 4,
    name: "AR Dragon Starter Kit",
    description: "Complete AR Dragon learning experience! Includes quest CSV, Replit code, LED scripts, and PDF guide. Build gamified learning for your child.",
    url: "https://joshuarowland.gumroad.com/l/ar-dragon-kit",
    image: "https://public-files.gumroad.com/variants/ar-dragon-cover.png",
    hashtags: ["#ARDragon", "#EdTech", "#GamifiedLearning", "#KidsEducation", "#SmartHome"],
    category: "tech",
    price: "$9.00"
  },
  {
    id: 5,
    name: "Holiday Party Planning Kit",
    description: "Complete party planning system! Guest lists, menu planning, decoration checklists, timelines, and shopping lists. Host stress-free celebrations!",
    url: "https://joshuarowland.gumroad.com/l/holiday-party-kit",
    image: "https://public-files.gumroad.com/variants/party-planning-cover.png",
    hashtags: ["#PartyPlanning", "#HolidayParty", "#EventPlanning", "#Entertaining", "#HostessGift"],
    category: "planners",
    price: "$14.99"
  },
  {
    id: 6,
    name: "Christmas Recipe Collection",
    description: "Holiday recipe organizer! Christmas cookies, main dishes, sides, beverages, appetizers with dietary accommodations. Document family favorites!",
    url: "https://joshuarowland.gumroad.com/l/christmas-recipes",
    image: "https://public-files.gumroad.com/variants/recipe-collection-cover.png",
    hashtags: ["#ChristmasRecipes", "#HolidayCooking", "#RecipeOrganizer", "#ChristmasCookies", "#FamilyRecipes"],
    category: "recipes",
    price: "$9.99"
  }
];

// ============================================================================
// PENDING POSTS QUEUE (for approval workflow)
// ============================================================================
const pendingPosts = new Map(); // messageId -> { text, imageUrl, product, platform, createdAt }

// ============================================================================
// CONTENT GENERATORS
// ============================================================================
const promoTemplates = [
  (p) => `🚀 Check out ${p.name}!\n\n${p.description}\n\n${p.url}\n\n${p.hashtags.join(' ')}`,
  (p) => `✨ New product alert!\n\n${p.name} is now available.\n\n${p.description}\n\n👉 ${p.url}\n\n${p.hashtags.join(' ')}`,
  (p) => `💡 Looking for ${p.category} solutions?\n\n${p.name} might be exactly what you need!\n\n${p.url}\n\n${p.hashtags.join(' ')}`,
  (p) => `🎯 ${p.name}\n\n${p.description}\n\nGet it here: ${p.url}\n\n${p.hashtags.join(' ')}`,
  (p) => `⭐ Featured: ${p.name}\n\n${p.description}\n\n🔗 ${p.url}\n\n${p.hashtags.join(' ')}`,
  (p) => `🔥 ${p.name} - ${p.price}\n\n${p.description}\n\nGrab yours: ${p.url}\n\n${p.hashtags.join(' ')}`,
];

function getRandomPromo(product) {
  const template = promoTemplates[Math.floor(Math.random() * promoTemplates.length)];
  return template(product);
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
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.buffer();
      mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });
    }

    const tweet = await twitterClient.v2.tweet({
      text: text.substring(0, 280),
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
// DISCORD CLIENT WITH APPROVAL SYSTEM
// ============================================================================
let discordClient = null;

if (config.discord.token) {
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Reaction],
  });

  discordClient.on('ready', () => {
    console.log(`[Discord] Logged in as ${discordClient.user.tag}`);
  });

  // Listen for reactions on approval messages
  discordClient.on('messageReactionAdd', async (reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;

    // Fetch partial reactions
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('[Discord] Error fetching reaction:', error);
        return;
      }
    }

    const messageId = reaction.message.id;
    const pending = pendingPosts.get(messageId);

    if (!pending) return; // Not a pending approval message

    const emoji = reaction.emoji.name;

    if (emoji === '✅') {
      // APPROVED - Post to Twitter
      console.log('[Approval] Post approved! Posting to Twitter...');

      const result = await postToTwitter(pending.text, pending.imageUrl);

      if (result.success) {
        await reaction.message.reply(`✅ **POSTED TO TWITTER!**\nTweet ID: ${result.id}`);
      } else {
        await reaction.message.reply(`❌ **Twitter Error:** ${result.error}`);
      }

      pendingPosts.delete(messageId);

    } else if (emoji === '❌') {
      // REJECTED
      console.log('[Approval] Post rejected');
      await reaction.message.reply('❌ **Post rejected.** Will not be posted.');
      pendingPosts.delete(messageId);

    } else if (emoji === '✏️') {
      // EDIT REQUEST
      await reaction.message.reply('✏️ **Edit requested.** Reply to this message with your edited text.');
    }
  });

  // Listen for edit replies
  discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.reference) return; // Not a reply

    try {
      const repliedTo = await message.channel.messages.fetch(message.reference.messageId);
      const pending = pendingPosts.get(repliedTo.id);

      if (pending) {
        // Update the pending post text
        pending.text = message.content;
        pendingPosts.set(repliedTo.id, pending);
        await message.reply('✅ **Text updated!** React with ✅ to approve the new version.');
      }
    } catch (error) {
      // Not a reply to a pending post
    }
  });

  discordClient.login(config.discord.token).catch(console.error);
}

// ============================================================================
// SEND POST FOR APPROVAL (instead of direct posting)
// ============================================================================
async function sendForApproval(text, imageUrl, product) {
  if (!discordClient || !config.discord.approvalChannelId) {
    console.log('[Approval] Discord not configured, posting directly');
    return await postToTwitter(text, imageUrl);
  }

  try {
    const channel = await discordClient.channels.fetch(config.discord.approvalChannelId);

    const embed = new EmbedBuilder()
      .setTitle('📋 PENDING APPROVAL - Twitter Post')
      .setDescription(text.substring(0, 280))
      .setColor(0xFFA500)
      .addFields(
        { name: 'Product', value: product.name, inline: true },
        { name: 'Price', value: product.price, inline: true },
        { name: 'Character Count', value: `${text.length}/280`, inline: true },
      )
      .setFooter({ text: '✅ Approve | ❌ Reject | ✏️ Edit (reply with new text)' });

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    const message = await channel.send({ embeds: [embed] });

    // Add reaction options
    await message.react('✅');
    await message.react('❌');
    await message.react('✏️');

    // Store in pending queue
    pendingPosts.set(message.id, {
      text,
      imageUrl,
      product,
      platform: 'twitter',
      createdAt: new Date(),
    });

    console.log('[Approval] Post queued for approval:', message.id);
    return { success: true, status: 'pending_approval', messageId: message.id };

  } catch (error) {
    console.error('[Approval] Error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DIRECT DISCORD POST (for announcements, not Twitter)
// ============================================================================
async function postToDiscord(text, imageUrl = null, embedData = null) {
  if (!discordClient || !config.discord.announcementChannelId) {
    console.log('[Discord] Not configured');
    return { success: false, error: 'Not configured' };
  }

  try {
    const channel = await discordClient.channels.fetch(config.discord.announcementChannelId);

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
// SCHEDULED POSTS (Now goes to approval queue)
// ============================================================================

// Generate Twitter post for approval every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[Scheduler] Generating Twitter post for approval...');
  const product = getRandomProduct();
  const content = getRandomPromo(product);
  await sendForApproval(content, product.image, product);
});

// Post to Discord daily at 10am (direct, no approval needed)
cron.schedule('0 10 * * *', async () => {
  console.log('[Scheduler] Running Discord promo...');
  const product = getRandomProduct();
  await postToDiscord(null, product.image, {
    title: `🔥 ${product.name}`,
    description: `${product.description}\n\n💰 ${product.price}`,
    url: product.url
  });
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    status: 'Phoenix Forge Auto Publisher (with Approval System)',
    mode: 'Discord Approval - React ✅ to post to Twitter',
    pendingApprovals: pendingPosts.size,
    endpoints: {
      '/queue': 'POST - Queue post for approval',
      '/post/direct': 'POST - Post directly (skip approval)',
      '/post/discord': 'POST - Post to Discord',
      '/pending': 'GET - View pending approvals',
      '/products': 'GET - List products',
      '/trigger': 'POST - Generate new post for approval'
    }
  });
});

// Queue a post for approval
app.post('/queue', async (req, res) => {
  const { text, imageUrl, productId } = req.body;
  const product = productId ? products.find(p => p.id === productId) : getRandomProduct();
  const content = text || getRandomPromo(product);

  const result = await sendForApproval(content, imageUrl || product.image, product);
  res.json(result);
});

// Post directly (skip approval)
app.post('/post/direct', async (req, res) => {
  const { text, imageUrl } = req.body;
  const result = await postToTwitter(text, imageUrl);
  res.json(result);
});

// Post to Discord
app.post('/post/discord', async (req, res) => {
  const { text, imageUrl, embed } = req.body;
  const result = await postToDiscord(text, imageUrl, embed);
  res.json(result);
});

// View pending approvals
app.get('/pending', (req, res) => {
  const pending = [];
  pendingPosts.forEach((value, key) => {
    pending.push({
      messageId: key,
      product: value.product.name,
      textPreview: value.text.substring(0, 100) + '...',
      createdAt: value.createdAt,
    });
  });
  res.json({ count: pending.length, pending });
});

// Generate new post for approval
app.post('/trigger', async (req, res) => {
  const product = getRandomProduct();
  const content = getRandomPromo(product);
  const result = await sendForApproval(content, product.image, product);
  res.json(result);
});

// List products
app.get('/products', (req, res) => {
  res.json(products);
});

// Webhook for Gumroad sales
app.post('/webhook/sale', async (req, res) => {
  const sale = req.body;
  console.log('[Webhook] Sale received:', sale);
  await postToDiscord(`🎉 **NEW SALE!** Someone just purchased a product!`, null, null);
  res.json({ received: true });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Phoenix Forge Auto Publisher running on port ${PORT}`);
  console.log('Mode: Discord Approval System');
  console.log('- Posts queue to Discord for approval');
  console.log('- React ✅ to approve and post to Twitter');
  console.log('- React ❌ to reject');
  console.log('- React ✏️ and reply to edit');
});
