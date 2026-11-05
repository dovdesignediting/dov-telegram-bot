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
    cleanService: false,
    antispam: false,
    antilink: false,
    antiflood: 0,
    locks: { links: false, media: false, stickers: false },
    stats: { messages: 0, bans: 0, warnsCount: 0 }
  };
}

function createDefaultGlobal() {
  return {
    groups: {},
    users: {},
    wizards: {},
    globalBanned: [],
    maintenance: false,
    liveChatTarget: null
  };
}

async function rawGet(key) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      const data = await res.json();
      if (data && data.result) return JSON.parse(data.result);
    } catch (e) {}
  }
  try {
    if (fs.existsSync(TMP_FILE)) {
      const fileData = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
      if (fileData[key]) return fileData[key];
    }
  } catch (e) {}
  return memoryCache[key] || null;
}

async function rawSet(key, val) {
  memoryCache[key] = val;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(val))
      });
    } catch (e) {}
  }
  try {
    const all = fs.existsSync(TMP_FILE) ? JSON.parse(fs.readFileSync(TMP_FILE, 'utf8')) : {};
    all[key] = val;
    fs.writeFileSync(TMP_FILE, JSON.stringify(all), 'utf8');
  } catch (e) {}
}

async function getGroupData(chatId) {
  const saved = await rawGet(`group:${chatId}`);
  return { ...createDefaultGroup(), ...(saved || {}) };
}

async function saveGroupData(chatId, groupData) {
  await rawSet(`group:${chatId}`, groupData);
}

async function getGlobalData() {
  const saved = await rawGet('global:registry');
  return { ...createDefaultGlobal(), ...(saved || {}) };
}

async function saveGlobalData(globalData) {
  await rawSet('global:registry', globalData);
}

// חילוץ קישור הזמנה לקבוצה עבור היוצר
async function fetchGroupLink(telegram, chatId) {
  try {
    const chat = await telegram.getChat(chatId);
    if (chat.username) return `https://t.me/${chat.username}`;
    if (chat.invite_link) return chat.invite_link;
  } catch (e) {}
  try {
    const created = await telegram.createChatInviteLink(chatId, { name: 'Creator' });
    if (created?.invite_link) return created.invite_link;
  } catch (e) {}
  try {
    const exported = await telegram.exportChatInviteLink(chatId);
    if (exported) return exported;
  } catch (e) {}
  return null;
}

function getOwnerKeyboard(globalData) {
  const maint = globalData.maintenance ? '🟢 כבה מצב תחזוקה' : '🔴 הפעל מצב תחזוקה';
  return {
    inline_keyboard: [
      [
        { text: '🏢 רשימת קבוצות וקישורים', callback_data: 'own_groups' },
        { text: '👥 משתמשי הבוט וסטטיסטיקות', callback_data: 'own_users' }
      ],
      [
        { text: '💬 כתיבה חיה לקבוצה', callback_data: 'own_livechat_menu' },
        { text: '🛑 עצור כתיבה חיה', callback_data: 'own_livechat_stop' }
      ],
      [
        { text: maint, callback_data: 'own_toggle_maint' },
        { text: '📖 מדריך כל פקודות היוצר', callback_data: 'own_help' }
      ]
    ]
  };
}

async function sendGroupsList(ctx) {
  const globalData = await getGlobalData();
  const groups = Object.values(globalData.groups || {});
  if (!groups.length) {
    return ctx.reply('📭 הבוט עדיין לא קלט קבוצות (שלח הודעה כלשהי בקבוצה שבה הבוט נמצא והיא תופיע כאן מיד).');
  }
  const buttons = [];
  let report = `🏢 הקבוצות שבהן הבוט נמצא (${groups.length}):\n\n`;
  for (const g of groups.slice(0, 15)) {
    let count = '?';
    try { count = await ctx.telegram.getChatMembersCount(g.id); } catch (e) {}
    report += `• ${g.title}\n  🆔 ${g.id} | 👥 חברים: ${count}\n`;
    buttons.push([
      { text: `🔗 קישור: ${g.title.slice(0, 10)}`, callback_data: `own_link_${g.id}` },
      { text: `💬 כתוב לקבוצה`, callback_data: `own_chat_${g.id}` },
      { text: `🕵️ מידע`, callback_data: `own_spy_${g.id}` }
    ]);
  }
  await ctx.reply(report, { reply_markup: { inline_keyboard: buttons } });
}

async function sendUsersReport(ctx) {
  const globalData = await getGlobalData();
  const today = new Date().toISOString().slice(0, 10);
  const users = Object.values(globalData.users || {});
  const todayCount = users.filter((u) => u.lastSeen === today).length;
  const groupsCount = Object.keys(globalData.groups || {}).length;
  const list = users.slice(-40).reverse().map((u, i) =>
    `${i + 1}. ${u.name} (${u.username}) – ${u.id} ${u.lastSeen === today ? '🟢' : ''}`
  ).join('\n');

  await ctx.reply(
    `👥 דו"ח משתמשי הבוט:\n` +
    `• סך הכל משתמשים: ${users.length}\n` +
    `• פעילים היום (${today}): ${todayCount}\n` +
    `• קבוצות שבהן הבוט נמצא: ${groupsCount}\n\n` +
    `📋 רשימת משתמשים (🟢 = פעיל היום):\n${list || 'אין עדיין'}`
  );
}

function parseRichMessage(rawText, vars = {}) {
  let text = String(rawText || '');
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
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
  getGlobalData,
  saveGlobalData,
  fetchGroupLink,
  getOwnerKeyboard,
  sendGroupsList,
  sendUsersReport,
  parseRichMessage,
  sendFormattedMessage,
  requireAdmin,
  getTarget,
  parseDurationSeconds,
  floodTracker
};
