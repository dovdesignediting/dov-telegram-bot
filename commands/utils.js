const fs = require('fs');
const TMP_FILE = '/tmp/telegram_bot_state.json';
const memoryCache = {};
const floodTracker = {};

function createDefaultGroup() {
  return {
    warns: {},
    filters: [],
    rules: 'טרם הוגדרו חוקים לקבוצה זו. אדמין יכול להגדיר בעזרת /setrules',
    welcomeEnabled: true,
    welcomeText: 'ברוך הבא לקבוצה, {name}! נשמח שתקרא את חוקי הקבוצה (/rules).',
    antispam: false,
    antilink: false,
    antiflood: 0,
    locks: { links: false, media: false, stickers: false },
    stats: { messages: 0, bans: 0, warnsCount: 0 }
  };
}

// שמירה וקריאה Stateless: עובד מול Vercel KV (Upstash REST) או קובץ JSON ב-/tmp כגיבוי אוטומטי
async function getGroupData(chatId) {
  const key = `group:${chatId}`;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      const data = await res.json();
      if (data && data.result) {
        return { ...createDefaultGroup(), ...JSON.parse(data.result) };
      }
    } catch (err) {
      console.error('KV Read Error:', err.message);
    }
  }

  try {
    if (fs.existsSync(TMP_FILE)) {
      const fileData = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
      if (fileData[key]) return { ...createDefaultGroup(), ...fileData[key] };
    }
  } catch (e) {}

  if (!memoryCache[key]) memoryCache[key] = createDefaultGroup();
  return memoryCache[key];
}

async function saveGroupData(chatId, groupData) {
  const key = `group:${chatId}`;
  memoryCache[key] = groupData;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(groupData))
      });
    } catch (err) {
      console.error('KV Write Error:', err.message);
    }
  }

  try {
    let all = {};
    if (fs.existsSync(TMP_FILE)) {
      all = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
    }
    all[key] = groupData;
    fs.writeFileSync(TMP_FILE, JSON.stringify(all), 'utf8');
  } catch (e) {}
}

// בדיקת הרשאות אדמין בקבוצה
async function requireAdmin(ctx, commandUsage) {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply(`⚠️ פקודה זו מיועדת לקבוצות בלבד.\nשימוש: ${commandUsage}\nשלח /help לעזרה.`);
    return false;
  }
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    if (['creator', 'administrator'].includes(member.status)) return true;
    await ctx.reply('⛔ שגיאת הרשאה: רק אדמינים בקבוצה יכולים להריץ פקודה זו.');
    return false;
  } catch (err) {
    await ctx.reply(`❌ שגיאה בבדיקת הרשאות אדמין. שלח /help לעזרה.`);
    return false;
  }
}

// שליפת משתמש יעד מתוך השבה (Reply) להודעה או לפי מזהה מספרי
function getTarget(ctx) {
  const replyUser = ctx.message?.reply_to_message?.from;
  const args = (ctx.message?.text || '').trim().split(/\s+/).slice(1);
  if (replyUser) {
    return {
      id: replyUser.id,
      name: replyUser.first_name || 'משתמש',
      username: replyUser.username ? `@${replyUser.username}` : '',
      args
    };
  }
  if (args[0] && /^\d+$/.test(args[0])) {
    return {
      id: Number(args[0]),
      name: `משתמש (${args[0]})`,
      username: '',
      args: args.slice(1)
    };
  }
  return null;
}

// המרת מחרוזת זמן (10m, 2h, 1d) לשניות עבור השתקה
function parseDurationSeconds(str) {
  if (!str) return 3600;
  const match = String(str).match(/^(\d+)([smhd]?)$/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = (match[2] || 'm').toLowerCase();
  const mult = { s: 1, m: 60, h: 3600, d: 86400 };
  return Math.max(30, val * (mult[unit] || 60));
}

module.exports = {
  getGroupData,
  saveGroupData,
  requireAdmin,
  getTarget,
  parseDurationSeconds,
  floodTracker
};
