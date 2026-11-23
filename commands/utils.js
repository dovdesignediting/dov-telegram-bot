const fs = require('fs');
const TMP_FILE = '/tmp/telegram_bot_state.json';
const memoryCache = {};
const memCacheTs = {};
const CACHE_TTL_MS = 15000;
const floodTracker = {};
let tursoClient = null;
let tursoReady = false;
let kvBackoffUntil = 0;

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

// ==========================================
// מנוע מהיר + סנכרון דו-כיווני: Turso Cloud <-> Upstash Redis
// ==========================================
function getTursoClient() {
  if (tursoClient) return tursoClient;
  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.STORAGE_TURSO_DATABASE_URL ||
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_URL;
  const authToken =
    process.env.TURSO_AUTH_TOKEN ||
    process.env.STORAGE_TURSO_AUTH_TOKEN ||
    process.env.STORAGE_AUTH_TOKEN;

  if (!url || !authToken) return null;
  try {
    const { createClient } = require('@libsql/client');
    tursoClient = createClient({ url, authToken });
    return tursoClient;
  } catch (err) {
    console.error('Turso Init Error:', err.message);
    return null;
  }
}

async function ensureTursoTable(client) {
  if (tursoReady) return;
  await client.execute(`
    CREATE TABLE IF NOT EXISTS bot_kv (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  tursoReady = true;
}

async function tursoGet(key) {
  const client = getTursoClient();
  if (!client) return null;
  try {
    await ensureTursoTable(client);
    const res = await client.execute({
      sql: 'SELECT v FROM bot_kv WHERE k = ?',
      args: [key]
    });
    if (res.rows && res.rows.length > 0 && res.rows[0].v) {
      let parsed = JSON.parse(String(res.rows[0].v));
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.error('Turso Read Error:', err.message);
  }
  return null;
}

async function tursoSet(key, value) {
  const client = getTursoClient();
  if (!client) return false;
  try {
    await ensureTursoTable(client);
    await client.execute({
      sql: 'INSERT OR REPLACE INTO bot_kv (k, v, updated_at) VALUES (?, ?, ?)',
      args: [key, JSON.stringify(value), new Date().toISOString()]
    });
    return true;
  } catch (err) {
    console.error('Turso Write Error:', err.message);
    return false;
  }
}

function getKvConfig() {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return kvUrl && kvToken ? { kvUrl, kvToken } : null;
}

async function kvCommand(args, timeoutMs = 1200) {
  if (Date.now() < kvBackoffUntil) return null;
  const cfg = getKvConfig();
  if (!cfg) return null;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(cfg.kvUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.kvToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args),
      ...(controller ? { signal: controller.signal } : {})
    });
    if (!res.ok) {
      kvBackoffUntil = Date.now() + 300000; // דילוג 5 דקות אם Upstash עבר מכסה/שגיאה
      return null;
    }
    const data = await res.json();
    if (data && data.error) {
      kvBackoffUntil = Date.now() + 300000;
      return null;
    }
    return data;
  } catch (err) {
    kvBackoffUntil = Date.now() + 180000; // דילוג 3 דקות אם יש Timeout
    console.error('KV Request Error:', err.message);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function kvGet(key) {
  const data = await kvCommand(['GET', key]);
  if (data && data.result) {
    try {
      let parsed = JSON.parse(data.result);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (err) {
      console.error('KV Parse Error:', err.message);
    }
  }
  return null;
}

async function kvSet(key, value) {
  const data = await kvCommand(['SET', key, JSON.stringify(value)]);
  return Boolean(data && !data.error);
}

function pickNewerRecord(tursoVal, kvVal) {
  if (tursoVal && !kvVal) return { winner: tursoVal, source: 'turso', syncTarget: 'kv' };
  if (kvVal && !tursoVal) return { winner: kvVal, source: 'kv', syncTarget: 'turso' };
  if (!tursoVal && !kvVal) return { winner: null, source: null, syncTarget: null };

  const tTs = Number(tursoVal._syncTs || 0);
  const kTs = Number(kvVal._syncTs || 0);

  if (tTs > kTs) return { winner: tursoVal, source: 'turso', syncTarget: 'kv' };
  if (kTs > tTs) return { winner: kvVal, source: 'kv', syncTarget: 'turso' };
  return { winner: tursoVal, source: 'turso', syncTarget: null };
}

// קריאה סופר-מהירה: זיכרון פנימי (0ms) -> Turso -> Fallback ל-Upstash והעתקה אוטומטית ל-Turso
async function rawGet(key) {
  if (memoryCache[key] && (Date.now() - (memCacheTs[key] || 0)) < CACHE_TTL_MS) {
    return memoryCache[key];
  }

  const fromTurso = await tursoGet(key);
  if (fromTurso) {
    memoryCache[key] = fromTurso;
    memCacheTs[key] = Date.now();
    return fromTurso;
  }

  const fromKv = await kvGet(key);
  if (fromKv) {
    memoryCache[key] = fromKv;
    memCacheTs[key] = Date.now();
    tursoSet(key, fromKv).catch(() => {});
    return fromKv;
  }

  try {
    if (fs.existsSync(TMP_FILE)) {
      const fileData = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
      if (fileData[key]) {
        memoryCache[key] = fileData[key];
        memCacheTs[key] = Date.now();
        return fileData[key];
      }
    }
  } catch (e) {}

  return memoryCache[key] || null;
}

// כתיבה מהירה ומסונכרנת: שומר ל-Turso + מעדכן במקביל ל-Upstash (בלי לתקוע את הבוט אם Upstash מלא)
async function rawSet(key, value) {
  const stamped =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...value, _syncTs: Date.now() }
      : value;

  memoryCache[key] = stamped;
  memCacheTs[key] = Date.now();

  const tursoWrite = tursoSet(key, stamped);
  const kvWrite = Date.now() >= kvBackoffUntil ? kvSet(key, stamped) : Promise.resolve(false);
  await Promise.allSettled([tursoWrite, kvWrite]);

  try {
    let all = {};
    if (fs.existsSync(TMP_FILE)) {
      all = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
    }
    all[key] = stamped;
    fs.writeFileSync(TMP_FILE, JSON.stringify(all), 'utf8');
  } catch (e) {}
}

// סנכרון מלא דו-כיווני של כל המפתחות בין Turso ל-Upstash (להרצה יזומה)
async function syncAllDatabases() {
  kvBackoffUntil = 0;
  const report = { tursoToKv: 0, kvToTurso: 0, totalKeys: 0 };
  const client = getTursoClient();
  const tursoMap = {};
  const kvMap = {};

  if (client) {
    try {
      await ensureTursoTable(client);
      const res = await client.execute('SELECT k, v FROM bot_kv');
      for (const row of res.rows || []) {
        try {
          let parsed = JSON.parse(String(row.v));
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (parsed && typeof parsed === 'object') tursoMap[String(row.k)] = parsed;
        } catch (e) {}
      }
    } catch (err) {
      console.error('Turso Bulk Read Error:', err.message);
    }
  }

  const kvKeysRes = await kvCommand(['KEYS', '*'], 3000);
  const kvKeys = Array.isArray(kvKeysRes?.result) ? kvKeysRes.result : [];
  for (const k of kvKeys) {
    const val = await kvGet(k);
    if (val) kvMap[k] = val;
  }

  const allKeys = new Set([...Object.keys(tursoMap), ...Object.keys(kvMap)]);
  report.totalKeys = allKeys.size;

  for (const key of allKeys) {
    const { winner, syncTarget } = pickNewerRecord(tursoMap[key] || null, kvMap[key] || null);
    if (!winner) continue;
    const stamped = winner._syncTs ? winner : { ...winner, _syncTs: Date.now() };
    if (syncTarget === 'kv') {
      if (await kvSet(key, stamped)) report.tursoToKv++;
    } else if (syncTarget === 'turso') {
      if (await tursoSet(key, stamped)) report.kvToTurso++;
    }
  }

  return report;
}

async function getGroupData(chatId) {
  const key = `group:${String(chatId)}`;
  const saved = await rawGet(key);
  if (saved && typeof saved === 'object') {
    return { ...createDefaultGroup(), ...saved };
  }
  return createDefaultGroup();
}

async function saveGroupData(chatId, groupData) {
  const key = `group:${String(chatId)}`;
  await rawSet(key, groupData);
}

// פענוח הודעה עשירה: מחלץ כפתורי {{טקסט}{קישור}}, מתקן %2B ובונה Inline Keyboard
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

// שליחת הודעה מעוצבת עם תפיסת שגיאות Markdown והצגת מדריך העיצוב אוטומטית
async function sendFormattedMessage(ctx, rawText, vars = {}) {
  const { text, extra } = parseRichMessage(rawText, vars);
  try {
    return await ctx.reply(text, extra);
  } catch (err) {
    if (ctx.chat?.type === 'private' && !(ctx.message?.text || '').startsWith('/set') && !(ctx.message?.text || '').startsWith('/echo')) {
      const plainExtra = extra.reply_markup ? { reply_markup: extra.reply_markup, disable_web_page_preview: true } : { disable_web_page_preview: true };
      return await ctx.reply(text, plainExtra).catch(() => null);
    }
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
  syncAllDatabases,
  parseRichMessage,
  sendFormattedMessage,
  requireAdmin,
  getTarget,
  parseDurationSeconds,
  floodTracker
};
