const fs = require('fs');
const TMP_FILE = '/tmp/telegram_bot_state.json';
const memoryCache = {};
const floodTracker = {};

const FORMAT_GUIDE =
  '⚠️ *שגיאה בעיצוב הטקסט – מדריך עיצוב וכפתורים:*\n' +
  'אם קיבלתם שגיאה אז הגעתם למקום הנכון, קראו זאת כדי להבין איפה הבעיה:\n\n' +
  '1️⃣ *קו תחתון בשם משתמש:*\n' +
  'אם הטקסט חייב להכיל `_`, שימו לפניו `\\` (סלאש הפוך).\n' +
  'לדוגמה: `@user\\_name` יופיע ככה: @user\\_name\n\n' +
  '2️⃣ *קישור בתוך טקסט:*\n' +
  'טקסט = `[]`, קישור = `()`\n' +
  'לדוגמה: `[טקסט](https://google.com)`\n\n' +
  '3️⃣ *קישור בתוך כפתור:*\n' +
  'טקסט וקישור = `{{טקסט}{קישור}}`\n' +
  'לדוגמה: `{{מעבר לערוץ}{https://t.me/telegram}}`\n\n' +
  '4️⃣ *טקסט נטוי ומודגש:*\n' +
  '• נטוי: שימו `_` בהתחלה ובסוף (`_לדוגמה_`)\n' +
  '• מודגש: שימו `*` בהתחלה ובסוף (`*לדוגמה*`)\n\n' +
  '5️⃣ *סימן פלוס (+) בקישורים:*\n' +
  'אם בקישור בתוך כפתור או היפר-קישור מופיע `+`, החליפו אותו ב-`%2B`.\n\n' +
  '💡 *אפשרויות אלו פועלות ב:* הודעת ברוך הבא (`/setwelcome`), כללים (`/setrules`), פקודות מותאמות אישית (`/addcmd`), ובפקודה `/echo` בצ׳אט פרטי בבוט.';

function createDefaultGroup() {
  return {
    warns: {},
    filters: [],
    customCommands: {},
    rules: 'טרם הוגדרו חוקים לקבוצה זו. אדמין יכול להגדיר בעזרת /setrules',
    welcomeEnabled: true,
    welcomeText: 'ברוך הבא לקבוצה, *{name}*! נשמח שתקרא את חוקי הקבוצה (/rules).',
    antispam: false,
    antilink: false,
    antiflood: 0,
    locks: { links: false, media: false, stickers: false },
    stats: { messages: 0, bans: 0, warnsCount: 0 }
  };
}

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
      if (data && data.result) return { ...createDefaultGroup(), ...JSON.parse(data.result) };
    } catch (e) {}
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
        headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(groupData))
      });
    } catch (e) {}
  }
  try {
    const all = fs.existsSync(TMP_FILE) ? JSON.parse(fs.readFileSync(TMP_FILE, 'utf8')) : {};
    all[key] = groupData;
    fs.writeFileSync(TMP_FILE, JSON.stringify(all), 'utf8');
  } catch (e) {}
}

// פענוח הודעה עשירה: מחלץ כפתורי {{טקסט}{קישור}}, מתקן %2B ובונה Inline Keyboard
function parseRichMessage(rawText, vars = {}) {
  let text = String(rawText || '');
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  // תמיכה ב-%2B בתוך היפר-קישורים [טקסט](קישור)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const cleanUrl = url.trim().replace(/%2B/gi, '+');
    return `[${label}](${cleanUrl})`;
  });

  const keyboard = [];
  const btnRegex = /\{\{([^{}]+)\}\{([^{}]+)\}\}/g;
  const lines = text.split('\n');
  const cleanedLines = [];

  for (const line of lines) {
    const row = [];
    const stripped = line.replace(btnRegex, (_, btnText, btnUrl) => {
      let url = btnUrl.trim().replace(/%2B/gi, '+');
      if (!/^https?:\/\//i.test(url) && !/^tg:\/\//i.test(url)) url = `https://${url}`;
      row.push({ text: btnText.trim(), url });
      return '';
    });
    if (row.length > 0) keyboard.push(row);
    if (stripped.trim() || row.length === 0) cleanedLines.push(stripped);
  }

  const finalText = cleanedLines.join('\n').trim() || ' ';
  const extra = { parse_mode: 'Markdown', disable_web_page_preview: true };
  if (keyboard.length > 0) extra.reply_markup = { inline_keyboard: keyboard };
  return { text: finalText, extra };
}

// שליחת הודעה מעוצבת עם תפיסת שגיאות Markdown והצגת מדריך העיצוב אוטומטית
async function sendFormattedMessage(ctx, rawText, vars = {}) {
  const { text, extra } = parseRichMessage(rawText, vars);
  try {
    return await ctx.reply(text, extra);
  } catch (err) {
    await ctx.reply(FORMAT_GUIDE, { parse_mode: 'Markdown' });
    return null;
  }
}

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
    await ctx.reply('❌ שגיאה בבדיקת הרשאות אדמין. שלח /help לעזרה.');
    return false;
  }
}

function getTarget(ctx) {
  const replyUser = ctx.message?.reply_to_message?.from;
  const args = (ctx.message?.text || '').trim().split(/\s+/).slice(1);
  if (replyUser) {
    return { id: replyUser.id, name: replyUser.first_name || 'משתמש', username: replyUser.username ? `@${replyUser.username}` : '', args };
  }
  if (args[0] && /^\d+$/.test(args[0])) {
    return { id: Number(args[0]), name: `משתמש (${args[0]})`, username: '', args: args.slice(1) };
  }
  return null;
}

function parseDurationSeconds(str) {
  if (!str) return 3600;
  const match = String(str).match(/^(\d+)([smhd]?)$/i);
  if (!match) return null;
  const mult = { s: 1, m: 60, h: 3600, d: 86400 };
  return Math.max(30, parseInt(match[1], 10) * (mult[(match[2] || 'm').toLowerCase()] || 60));
}

module.exports = {
  FORMAT_GUIDE,
  getGroupData,
  saveGroupData,
  parseRichMessage,
  sendFormattedMessage,
  requireAdmin,
  getTarget,
  parseDurationSeconds,
  floodTracker
};
