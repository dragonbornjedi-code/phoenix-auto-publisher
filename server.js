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
// ============================================================================
// MASTER SWITCH - Content Mode Selection
// ============================================================================
const PRODUCTS_ARE_LIVE = false;  // <-- CHANGE TO true WHEN PRODUCTS ARE LISTED!
const INSPIRATIONAL_MODE = true;  // Post inspirational Phoenix Rising content
const MIXED_MODE = true;          // When true, alternate between inspirational and products

// Content ratio: How often to post inspirational vs products (when both are enabled)
// e.g., 0.6 = 60% inspirational, 40% products
const INSPIRATIONAL_RATIO = 0.6;

// ============================================================================
// PHOENIX RISING - INSPIRATIONAL CONTENT DATABASE
// Stories of resilience, starting over, and rising from the ashes
// ============================================================================
const inspirationalPosts = [
  {
    id: 'college-2025',
    theme: 'new-beginnings',
    title: 'Never Too Old To Rise Again',
    story: "Today I'm taking my son to college with me. Not dropping him off - bringing him along for MY journey. At 30+, some might say I'm starting late. I say I'm starting RIGHT. The phoenix doesn't ask permission to rise from the ashes. It just rises. Every setback, every failure, every 'too late' - they're just fuel for the fire. If you're thinking about starting over, about going back to school, about chasing that dream you shelved years ago - this is your sign. Rise.",
    shortCaption: "Taking my son to college with me today. Not dropping him off - he's coming along for MY journey. Never too old to rise from the ashes.",
    hashtags: ['#PhoenixRising', '#NeverTooLate', '#SingleDad', '#StartingOver', '#CollegeJourney', '#Resilience', '#NewBeginnings', '#Motivation', '#DadLife', '#SecondChances'],
    emoji: '🔥',
    mood: 'inspirational',
  },
  {
    id: 'resilience-daily',
    theme: 'daily-grind',
    title: 'The Grind Continues',
    story: "Some days the fire burns low. Some days you wonder if it's worth it. Then you look at who you're doing it for and you remember - the phoenix doesn't give up. It transforms. Every struggle is part of the process. Keep going.",
    shortCaption: "The phoenix doesn't give up. It transforms. Keep going.",
    hashtags: ['#PhoenixRising', '#KeepGoing', '#Motivation', '#DailyGrind', '#Resilience', '#Transformation'],
    emoji: '💪',
    mood: 'motivational',
  },
  {
    id: 'single-dad-strength',
    theme: 'parenting',
    title: 'Single Dad, Double Strength',
    story: "Being a single dad isn't a limitation. It's a superpower. Every meal I cook, every homework battle, every bedtime story - I'm building something stronger than I ever imagined. My son doesn't see a broken family. He sees a dad who never quit.",
    shortCaption: "Single dad life: Not a limitation. A superpower. My son sees a dad who never quit.",
    hashtags: ['#SingleDad', '#DadLife', '#PhoenixRising', '#ParentingWin', '#Strength', '#FamilyFirst', '#NeverQuit'],
    emoji: '👨‍👦',
    mood: 'proud',
  },
  {
    id: 'autism-journey',
    theme: 'neurodiversity',
    title: 'Different, Not Less',
    story: "My son sees the world differently. And honestly? His perspective is often more beautiful than mine. Autism isn't something to overcome - it's something to understand, embrace, and celebrate. Together, we're learning that different is just another word for unique.",
    shortCaption: "Different, not less. My son's unique perspective makes the world more beautiful.",
    hashtags: ['#AutismAwareness', '#NeurodiversityPride', '#DifferentNotLess', '#AutismDad', '#PhoenixRising', '#Acceptance', '#LoveWins'],
    emoji: '🧩',
    mood: 'heartfelt',
  },
  {
    id: 'tech-rebuild',
    theme: 'career',
    title: 'Rebuilding From Zero',
    story: "Lost everything. Job. Stability. Confidence. But you know what I kept? My skills. My drive. My ability to learn. Now I'm building an empire from my phone, one line of code at a time. The ashes of yesterday are the foundation of tomorrow.",
    shortCaption: "Lost everything. Kept my drive. Building an empire from my phone. The ashes of yesterday are tomorrow's foundation.",
    hashtags: ['#PhoenixRising', '#TechLife', '#Entrepreneur', '#Comeback', '#SelfTaught', '#NeverGiveUp', '#BuildingDreams'],
    emoji: '📱',
    mood: 'determined',
  },
  {
    id: 'midnight-coding',
    theme: 'hustle',
    title: 'While They Sleep, I Build',
    story: "2 AM. Kid's asleep. House is quiet. This is when the magic happens. While the world sleeps, I'm writing code, building systems, creating something from nothing. Every late night is an investment. Every tired morning is proof I'm still fighting. The phoenix works in darkness so it can shine in daylight.",
    shortCaption: "2 AM. Kid's asleep. While the world sleeps, I build. Every late night is an investment in tomorrow.",
    hashtags: ['#NightOwl', '#HustleHard', '#PhoenixRising', '#CodingLife', '#BuildingDreams', '#SingleDadLife', '#MidnightMotivation', '#Entrepreneur'],
    emoji: '🌙',
    mood: 'hustle',
  },
  {
    id: 'broke-not-broken',
    theme: 'financial',
    title: 'Broke Is Temporary, Broken Is a Choice',
    story: "Bank account says zero. Society says failure. But here's what they don't see: the ideas, the plans, the systems being built. Broke is a situation. Broken is a mindset. I chose to be broke and building rather than comfortable and stagnant. The phoenix knows that empty is just space for something new.",
    shortCaption: "Broke is temporary. Broken is a choice. I chose to be broke and building rather than comfortable and stagnant.",
    hashtags: ['#BrokeNotBroken', '#PhoenixRising', '#Mindset', '#FinancialFreedom', '#BuildingWealth', '#Hustle', '#Motivation', '#Entrepreneur'],
    emoji: '💸',
    mood: 'defiant',
  },
  {
    id: 'failed-forward',
    theme: 'failure',
    title: 'I Failed So Many Times I Forgot How to Quit',
    story: "Failed business. Failed relationship. Failed expectations. You know what all that failure taught me? How to get back up. At some point, you fail so many times that failure stops being scary. It just becomes... practice. Every phoenix was once ashes. Every success story has a chapter of failures.",
    shortCaption: "Failed so many times I forgot how to quit. Every phoenix was once ashes.",
    hashtags: ['#FailForward', '#PhoenixRising', '#Resilience', '#NeverQuit', '#SuccessStory', '#Motivation', '#Comeback', '#KeepGoing'],
    emoji: '🔄',
    mood: 'resilient',
  },
  {
    id: 'son-watching',
    theme: 'legacy',
    title: 'Little Eyes Are Watching',
    story: "My son watches everything. When I give up, he learns to give up. When I push through, he learns persistence. When I chase dreams despite fear, he learns courage. I'm not just building a business - I'm building a blueprint for his life. The phoenix rises not just for itself, but for everyone watching.",
    shortCaption: "Little eyes are watching. I'm not just building a business - I'm building a blueprint for his life.",
    hashtags: ['#DadLife', '#PhoenixRising', '#Legacy', '#ParentingGoals', '#RoleModel', '#SingleDad', '#RaisingKings', '#LeadByExample'],
    emoji: '👁️',
    mood: 'purpose',
  },
  {
    id: 'phone-empire',
    theme: 'resourcefulness',
    title: 'No Laptop? No Problem.',
    story: "People ask about my setup. They expect a fancy office. I show them my phone. This entire empire - the code, the products, the systems - built on a phone. No excuses. No 'when I have better equipment.' Just action with what I have. The phoenix doesn't wait for perfect conditions. It rises anyway.",
    shortCaption: "No laptop? No problem. This entire empire built on a phone. No excuses, just action.",
    hashtags: ['#NoExcuses', '#PhoenixRising', '#MobileFirst', '#Resourceful', '#Entrepreneur', '#Hustle', '#StartWhereYouAre', '#MakeItWork'],
    emoji: '📲',
    mood: 'resourceful',
  },
  {
    id: 'tears-and-code',
    theme: 'vulnerability',
    title: 'Sometimes I Cry. Then I Code.',
    story: "Real talk: this journey isn't all motivation quotes and victory laps. Some nights I cry. Some days feel impossible. But here's the difference - I let myself feel it, then I get back to work. Tears dry. Code compiles. The phoenix isn't strong because it doesn't feel pain. It's strong because it rises despite it.",
    shortCaption: "Some nights I cry. Then I code. The phoenix rises despite the pain, not because of its absence.",
    hashtags: ['#RealTalk', '#PhoenixRising', '#Vulnerability', '#MentalHealth', '#KeepGoing', '#ItGetsBetter', '#Strength', '#Honesty'],
    emoji: '💧',
    mood: 'vulnerable',
  },
  {
    id: 'six-year-old-boss',
    theme: 'motivation',
    title: 'My Boss Is 6 Years Old',
    story: "I don't answer to a CEO. I don't clock in for a corporation. My boss is 6 years old and he pays me in hugs. Every line of code, every product sold, every hustle hour - it's for him. He doesn't care about my revenue. He cares that Dad shows up. That's the real performance review.",
    shortCaption: "My boss is 6 years old. He pays me in hugs and his only KPI is that Dad shows up.",
    hashtags: ['#DadLife', '#PhoenixRising', '#MyWhy', '#SingleDad', '#WorkingForFamily', '#Motivation', '#HustleForThem', '#FamilyFirst'],
    emoji: '🤗',
    mood: 'heartwarming',
  },
  {
    id: 'comfort-zone-ashes',
    theme: 'growth',
    title: 'My Comfort Zone Burned Down',
    story: "I didn't choose to leave my comfort zone. Life burned it down. And you know what? Best thing that ever happened. When you have nothing comfortable left to cling to, you have nothing to lose. That's when transformation happens. The phoenix needs fire. Sometimes life provides it.",
    shortCaption: "My comfort zone burned down. Best thing that ever happened. The phoenix needs fire.",
    hashtags: ['#ComfortZone', '#PhoenixRising', '#Transformation', '#Growth', '#Adversity', '#BlessingsInDisguise', '#KeepGoing', '#Change'],
    emoji: '🏚️',
    mood: 'transformative',
  },
  {
    id: 'comparison-killer',
    theme: 'mindset',
    title: 'Stop Comparing Your Chapter 1 to Their Chapter 20',
    story: "Scrolling through success stories used to crush me. Everyone else seemed so far ahead. Then I realized - I'm comparing my beginning to their middle. My rough draft to their published version. The phoenix doesn't compare its ashes to another bird's flight. It focuses on rising.",
    shortCaption: "Stop comparing your chapter 1 to their chapter 20. The phoenix focuses on rising, not comparing.",
    hashtags: ['#NoComparison', '#PhoenixRising', '#YourOwnPath', '#Mindset', '#JourneyNotDestination', '#SelfGrowth', '#Focus', '#StayInYourLane'],
    emoji: '📖',
    mood: 'wisdom',
  },
  {
    id: 'sunday-reset',
    theme: 'weekly',
    title: 'Sunday Reset: Ashes to Action',
    story: "Every Sunday I look at what burned last week. The failures. The setbacks. The plans that didn't work. Then I clear the ashes and start fresh. New week. New chances. New fire. That's the phoenix mindset - every week is a new opportunity to rise.",
    shortCaption: "Sunday Reset: Review what burned, clear the ashes, start fresh. Every week is a new chance to rise.",
    hashtags: ['#SundayReset', '#PhoenixRising', '#NewWeek', '#FreshStart', '#Motivation', '#WeeklyGoals', '#MondayReady', '#Reflection'],
    emoji: '🌅',
    mood: 'refreshed',
  },
  {
    id: 'invisible-progress',
    theme: 'patience',
    title: 'The Work Nobody Sees',
    story: "For every post you see, there are 100 failures you don't. For every win I share, there are 50 losses I don't. The grind isn't glamorous. The 3 AM debugging sessions. The rejected applications. The silent struggles. But every invisible moment of work is building something visible. Trust the process.",
    shortCaption: "For every win you see, there are 50 losses you don't. The invisible grind builds visible results.",
    hashtags: ['#InvisibleProgress', '#PhoenixRising', '#TrustTheProcess', '#Grind', '#BehindTheScenes', '#RealTalk', '#Patience', '#Hustle'],
    emoji: '👁️‍🗨️',
    mood: 'honest',
  },
  {
    id: 'restart-button',
    theme: 'new-beginnings',
    title: 'Life Gave Me a Restart Button',
    story: "Lost the job. Lost the relationship. Lost the path. You know what I found? Freedom. Sometimes life doesn't take things from you - it clears the way. Every loss was a lesson. Every ending was a beginning I couldn't see yet. Hit restart. Try again. Rise different.",
    shortCaption: "Sometimes life doesn't take things from you - it clears the way. Hit restart. Rise different.",
    hashtags: ['#RestartButton', '#PhoenixRising', '#NewBeginnings', '#Freedom', '#SecondChances', '#LifeLessons', '#StartOver', '#Resilience'],
    emoji: '🔄',
    mood: 'hopeful',
  },
  {
    id: 'small-wins',
    theme: 'progress',
    title: 'Celebrate the Tiny Victories',
    story: "Today's win: I got out of bed when I didn't want to. That's it. That's the whole victory. Some days that's enough. Some days just surviving is succeeding. The phoenix doesn't leap from ashes to sky in one motion. It rises. Slowly. Surely. One small flame at a time.",
    shortCaption: "Some days just surviving is succeeding. The phoenix rises slowly, one small flame at a time.",
    hashtags: ['#SmallWins', '#PhoenixRising', '#DailyVictory', '#MentalHealth', '#OneStepAtATime', '#Progress', '#YouGotThis', '#Celebrate'],
    emoji: '🎯',
    mood: 'gentle',
  },
  {
    id: 'rejection-fuel',
    theme: 'resilience',
    title: 'Rejection Is Just Redirection',
    story: "Got rejected again today. You know what I did? Said thank you. Not sarcastically - genuinely. Every no is pointing me toward my yes. Every closed door is saving me from the wrong room. The phoenix doesn't beg ashes to let it stay. It rises toward what's meant for it.",
    shortCaption: "Every no points me toward my yes. Every closed door saves me from the wrong room. Keep rising.",
    hashtags: ['#RejectionIsFuel', '#PhoenixRising', '#Redirection', '#KeepGoing', '#Resilience', '#ThankYouNext', '#Motivation', '#GrowthMindset'],
    emoji: '🚪',
    mood: 'defiant',
  },
  {
    id: 'imposter-syndrome',
    theme: 'mindset',
    title: 'The Imposter Who Keeps Showing Up',
    story: "I feel like a fraud every single day. Who am I to teach? To build? To dream this big? Then I remember - the imposter syndrome means I'm growing. I'm in rooms I've never been in. Doing things I've never done. The phoenix doesn't feel ready. It rises anyway.",
    shortCaption: "Imposter syndrome means you're growing. The phoenix doesn't feel ready. It rises anyway.",
    hashtags: ['#ImposterSyndrome', '#PhoenixRising', '#GrowthMindset', '#RiseAnyway', '#YouBelongHere', '#Confidence', '#SelfDoubt', '#KeepGoing'],
    emoji: '🎭',
    mood: 'vulnerable',
  },
  {
    id: 'money-stress',
    theme: 'financial',
    title: 'Checking My Bank Account Used to Hurt',
    story: "I used to avoid my bank app like it was a horror movie. Now I check it daily - not because it's full, but because I'm not afraid anymore. Fear kept me stuck. Awareness keeps me moving. The phoenix doesn't hide from the fire. It walks through it.",
    shortCaption: "I used to avoid my bank app. Now I face it daily. Fear kept me stuck. Awareness keeps me moving.",
    hashtags: ['#MoneyMindset', '#PhoenixRising', '#FinancialFreedom', '#FaceYourFears', '#BrokeButBuilding', '#Honesty', '#GrowthMindset', '#MoneyStress'],
    emoji: '💳',
    mood: 'brave',
  },
  {
    id: 'alone-not-lonely',
    theme: 'solitude',
    title: 'I Lost Friends. I Found Myself.',
    story: "The rebuild is lonely. Old friends don't understand the new you. Some people only liked you broken. When you start rising, you lose people. But you gain yourself. The phoenix walks alone through fire. And emerges more powerful than any flock.",
    shortCaption: "Some people only liked you broken. When you rise, you lose people. But you gain yourself.",
    hashtags: ['#AloneNotLonely', '#PhoenixRising', '#OutgrewThem', '#SelfDiscovery', '#GlowUp', '#RealFriends', '#Growth', '#WalkAlone'],
    emoji: '🚶',
    mood: 'reflective',
  },
  {
    id: 'tired-of-tired',
    theme: 'exhaustion',
    title: 'Tired of Being Tired',
    story: "I'm exhausted. Not fishing for sympathy - just being real. The hustle takes everything. But here's what keeps me going: being tired from chasing dreams beats being tired from a life I hate. The phoenix burns out to rise again. Rest if you need to. Then rise.",
    shortCaption: "Being tired from chasing dreams beats being tired from a life I hate. Rest if needed. Then rise.",
    hashtags: ['#TiredOfTired', '#PhoenixRising', '#BurnoutRecovery', '#HustleLife', '#RestAndRise', '#RealTalk', '#KeepGoing', '#MentalHealth'],
    emoji: '😴',
    mood: 'exhausted',
  },
  {
    id: 'haters-to-fans',
    theme: 'vindication',
    title: 'They Laughed. Now They Watch.',
    story: "Remember when they said I was crazy? Wasting time? Would never make it? They're still watching. Some with disbelief. Some with respect. Some with regret they didn't believe. I'm not doing this for them anymore. But I'd be lying if I said their doubt didn't fuel my fire.",
    shortCaption: "They said I was crazy. They're still watching. Their doubt fueled my fire.",
    hashtags: ['#ProveThemWrong', '#PhoenixRising', '#Doubters', '#Motivation', '#Vindication', '#SuccessStory', '#WatchMe', '#Fuel'],
    emoji: '👀',
    mood: 'victorious',
  },
  {
    id: 'building-legacy',
    theme: 'legacy',
    title: 'Building What I Wish I Had',
    story: "Nobody taught me this. No mentor. No roadmap. No safety net. So I'm building what I wish existed. For my son. For others like me. Every system I create, every resource I share - it's the help I never had. The phoenix doesn't just rise for itself. It lights the way.",
    shortCaption: "Building what I wish existed. Every resource I create is the help I never had.",
    hashtags: ['#BuildingLegacy', '#PhoenixRising', '#PayItForward', '#Mentor', '#HelpOthers', '#BreakTheCycle', '#Legacy', '#RiseAndLift'],
    emoji: '🏗️',
    mood: 'purposeful',
  },
];

// Get inspirational post (random or by theme)
function getInspirationalPost(themeFilter = null) {
  let pool = inspirationalPosts;
  if (themeFilter) {
    pool = inspirationalPosts.filter(p => p.theme === themeFilter);
  }
  if (pool.length === 0) pool = inspirationalPosts;
  return pool[Math.floor(Math.random() * pool.length)];
}

const platforms = {
  twitter: {
    name: 'Twitter/X',
    charLimit: 280,
    style: 'short, punchy, hashtag-heavy',
    enabled: (PRODUCTS_ARE_LIVE || INSPIRATIONAL_MODE) && !!process.env.TWITTER_API_KEY,
    dailyLimit: 10,
    minHoursBetween: 4,
  },
  facebook: {
    name: 'Facebook',
    charLimit: 63206,
    optimalLength: 80,
    style: 'storytelling, emotional, engaging',
    enabled: (PRODUCTS_ARE_LIVE || INSPIRATIONAL_MODE) && !!process.env.FACEBOOK_PAGE_TOKEN,
    dailyLimit: 5,
    minHoursBetween: 6,
  },
  instagram: {
    name: 'Instagram',
    charLimit: 2200,
    style: 'visual-focused, emoji-rich, hashtag clusters',
    enabled: (PRODUCTS_ARE_LIVE || INSPIRATIONAL_MODE) && !!process.env.INSTAGRAM_ACCESS_TOKEN,
    dailyLimit: 3,
    minHoursBetween: 8,
  },
  pinterest: {
    name: 'Pinterest',
    charLimit: 500,
    style: 'descriptive, keyword-rich, actionable',
    enabled: (PRODUCTS_ARE_LIVE || INSPIRATIONAL_MODE) && !!process.env.PINTEREST_ACCESS_TOKEN,
    dailyLimit: 10,
    minHoursBetween: 2,
  },
  discord: {
    name: 'Discord',
    charLimit: 2000,
    style: 'community-focused, embed-rich',
    enabled: (PRODUCTS_ARE_LIVE || INSPIRATIONAL_MODE) && !!process.env.DISCORD_BOT_TOKEN,
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
// INSPIRATIONAL CONTENT TEMPLATES
// ============================================================================

// TWITTER: Short, punchy Phoenix Rising content (280 chars)
function getInspirationalTwitter(post) {
  const templates = [
    `${post.emoji} ${post.shortCaption}\n\n${post.hashtags.slice(0, 3).join(' ')}`,
    `${post.emoji} ${post.title}\n\n${post.shortCaption}\n\n${post.hashtags.slice(0, 2).join(' ')}`,
    `${post.shortCaption} ${post.emoji}\n\n${post.hashtags.slice(0, 3).join(' ')}`,
  ];
  const content = templates[Math.floor(Math.random() * templates.length)];
  return content.substring(0, 280);
}

// FACEBOOK: Full storytelling
function getInspirationalFacebook(post) {
  return `${post.emoji} ${post.title}\n\n${post.story}\n\n${post.hashtags.slice(0, 5).join(' ')}`;
}

// INSTAGRAM: Story with hashtag cluster
function getInspirationalInstagram(post) {
  return `${post.emoji} ${post.title}\n\n${post.story}\n\n.\n.\n.\n${post.hashtags.join(' ')} #RiseFromTheAshes #PersonalGrowth #LifeStory`;
}

// DISCORD: Embed format
function getInspirationalDiscord(post) {
  return {
    title: `${post.emoji} ${post.title}`,
    description: post.story,
    url: null,
  };
}

// ============================================================================
// SMART MULTI-PLATFORM POSTING
// ============================================================================

// Post inspirational content to all platforms
async function postInspirationalToAllPlatforms(postId = null) {
  const results = {};
  const post = postId
    ? inspirationalPosts.find(p => p.id === postId) || getInspirationalPost()
    : getInspirationalPost();

  console.log(`[Inspirational] Posting: ${post.title}`);

  // Twitter
  if (platforms.twitter.enabled) {
    const content = getInspirationalTwitter(post);
    results.twitter = await postToTwitter(content);
  }

  // Facebook
  if (platforms.facebook.enabled) {
    const content = getInspirationalFacebook(post);
    results.facebook = await postToFacebook(content);
  }

  // Instagram (needs image - skip for text-only)
  // results.instagram = { skipped: 'Needs image for Instagram' };

  // Discord
  if (platforms.discord.enabled) {
    const embedData = getInspirationalDiscord(post);
    results.discord = await postToDiscord(embedData);
  }

  await notifyWebhooks('inspirational_posted', { post: post.title, mood: post.mood, results });

  return { post: post.title, theme: post.theme, results };
}

// Track what type was last posted for alternation
let lastPostType = 'product';

async function smartPostToAllPlatforms() {
  // MIXED MODE: Alternate between inspirational and product content
  if (MIXED_MODE && INSPIRATIONAL_MODE) {
    // Use ratio or alternate based on random/last post
    const rollDice = Math.random();
    const shouldPostInspirational = rollDice < INSPIRATIONAL_RATIO || lastPostType === 'product';

    if (shouldPostInspirational || !PRODUCTS_ARE_LIVE) {
      lastPostType = 'inspirational';
      return await postInspirationalToAllPlatforms();
    }
  }

  // If only inspirational mode (no products live)
  if (INSPIRATIONAL_MODE && !PRODUCTS_ARE_LIVE) {
    return await postInspirationalToAllPlatforms();
  }

  lastPostType = 'product';
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
    mode: INSPIRATIONAL_MODE ? 'INSPIRATIONAL (Phoenix Rising Content)' : (PRODUCTS_ARE_LIVE ? 'PRODUCTS' : 'DISABLED'),
    features: ['Smart rotation', 'No repeats', 'Seasonal content', 'Rate limiting', 'Make.com integration', 'Inspirational Mode'],
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
      '/inspirational': 'GET - List inspirational posts',
      '/inspirational/trigger': 'POST - Post inspirational content',
      '/inspirational/trigger/:id': 'POST - Post specific inspirational post',
      '/inspirational/preview': 'GET - Preview college post',
      '/products': 'GET - List products',
      '/preview/:platform': 'GET - Preview content',
      '/status': 'GET - Platform status',
      '/history': 'GET - Posting history',
      '/rules': 'GET - Posting rules',
    }
  });
});

// ============================================================================
// INSPIRATIONAL CONTENT ENDPOINTS
// ============================================================================

// List all inspirational posts
app.get('/inspirational', (req, res) => {
  res.json({
    mode: 'Phoenix Rising - Inspirational Content',
    posts: inspirationalPosts.map(p => ({
      id: p.id,
      title: p.title,
      theme: p.theme,
      mood: p.mood,
      shortCaption: p.shortCaption,
    })),
  });
});

// Preview the college post specifically
app.get('/inspirational/preview', (req, res) => {
  const collegePost = inspirationalPosts.find(p => p.id === 'college-2025');
  res.json({
    post: collegePost,
    previews: {
      twitter: getInspirationalTwitter(collegePost),
      facebook: getInspirationalFacebook(collegePost),
      instagram: getInspirationalInstagram(collegePost),
      discord: getInspirationalDiscord(collegePost),
    }
  });
});

// Trigger inspirational post (random or by theme)
app.post('/inspirational/trigger', async (req, res) => {
  const { theme } = req.body || {};
  const post = theme
    ? inspirationalPosts.find(p => p.theme === theme) || getInspirationalPost()
    : getInspirationalPost();

  const results = await postInspirationalToAllPlatforms(post.id);
  res.json(results);
});

// Trigger specific inspirational post by ID
app.post('/inspirational/trigger/:id', async (req, res) => {
  const { id } = req.params;
  const post = inspirationalPosts.find(p => p.id === id);

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
      available: inspirationalPosts.map(p => p.id),
    });
  }

  const results = await postInspirationalToAllPlatforms(id);
  res.json(results);
});

// Add custom inspirational post on the fly
app.post('/inspirational/custom', async (req, res) => {
  const { title, story, shortCaption, hashtags, emoji, theme, mood } = req.body;

  if (!story) {
    return res.status(400).json({ error: 'Story is required' });
  }

  const customPost = {
    id: 'custom-' + Date.now(),
    theme: theme || 'custom',
    title: title || 'Phoenix Rising',
    story: story,
    shortCaption: shortCaption || story.substring(0, 120) + '...',
    hashtags: hashtags || ['#PhoenixRising', '#Motivation', '#NeverGiveUp'],
    emoji: emoji || '🔥',
    mood: mood || 'inspirational',
  };

  // Add to temporary posts
  inspirationalPosts.push(customPost);

  const results = await postInspirationalToAllPlatforms(customPost.id);
  res.json({ customPost, results });
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
