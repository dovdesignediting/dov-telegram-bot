const fs = require('fs');
const { Telegraf } = require('telegraf');
const {
  getGroupData,
  saveGroupData,
  parseRichMessage,
  sendFormattedMessage
} = require('../commands/utils');
const registerUsersCommands = require('../commands/users');
const registerContentCommands = require('../commands/content');
const registerProtectionCommands = require('../commands/protection');
const registerInfoCommands = require('../commands/info');
const registerSystemCommands = require('../commands/system');

const token = process.env.BOT_TOKEN;
const bot = token ? new Telegraf(token) : null;
const CREATOR_ID = 1773089386;
const isCreator = (ctx) => Number(ctx.from?.id) === CREATOR_ID;
const STATE_FILE = '/tmp/owner_cloud_state.json';
const BOT_VERSION = registerSystemCommands.BOT_VERSION || '1.0.4.0v';
let memState = null;

function defaultState() {
  return {
    groups: {},
    users: {},
    wizards: {},
    globalBanned: [],
    maintenance: false,
    liveChatTarget: null,
    lastVersion: null
  };
}

// שליחה חכמה לקבוצה/משתמש: מתקנת אוטומטית קו תחתון בפקודות (/request_command) ואם יש שגיאת Markdown שולחת כטקסט רגיל!
async function safeSendRich(telegram, chatId, rawText) {
  const fixedText = String(rawText || '').replace(/([/@][a-zA-Z0-9_]+)/g, (m) => m.replace(/\\?_/g, '\\_'));
  const p = parseRichMessage(fixedText);
  try {
    return await telegram.sendMessage(chatId, p.text, p.extra);
  } catch (err) {
    const plain = parseRichMessage(rawText);
    const fallbackExtra = { disable_web_page_preview: true };
    if (plain.extra.reply_markup) fallbackExtra.reply_markup = plain.extra.reply_markup;
    return await telegram.sendMessage(chatId, plain.text, fallbackExtra);
  }
}

// טעינת מצב הבוט מ-Upstash Redis (דרך getGroupData) + גיבוי משרתי טלגרם
async function getState() {
  try {
    const redisData = await getGroupData('owner_global');
    if (redisData && (redisData.users || redisData.groups || redisData.wizards)) {
      memState = {
        groups: redisData.groups || {},
        users: redisData.users || {},
        wizards: redisData.wizards || {},
        globalBanned: redisData.globalBanned || [],
        maintenance: Boolean(redisData.maintenance),
        liveChatTarget: redisData.liveChatTarget || null,
        lastVersion: redisData.lastVersion || null
      };
      return memState;
    }
  } catch (e) {}

  if (memState) return memState;
  try {
    if (fs.existsSync(STATE_FILE)) {
      memState = { ...defaultState(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
      return memState;
    }
  } catch (e) {}

  if (bot) {
    try {
      const cmds = await bot.telegram.callApi('getMyCommands', {
        scope: { type: 'chat', chat_id: CREATOR_ID },
        language_code: 'zu'
      });
      if (Array.isArray(cmds) && cmds.length > 0) {
        const b64 = cmds.map((c) => c.description).join('');
        const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
        memState = { ...defaultState(), ...parsed };
        await saveGroupData('owner_global', memState);
        return memState;
      }
    } catch (e) {}
  }

  memState = defaultState();
  return memState;
}

// שמירת מצב הבוט ב-Upstash Redis + גיבוי בשרתי טלגרם
async function saveState(state) {
  memState = state;
  try {
    await saveGroupData('owner_global', state);
  } catch (e) {}
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8');
  } catch (e) {}

  if (bot) {
    try {
      const b64 = Buffer.from(JSON.stringify(state), 'utf8').toString('base64');
      const chunks = (b64.match(/.{1,250}/g) || []).slice(0, 95);
      const commands = chunks.map((chunk, i) => ({ command: `d_${i}`, description: chunk }));
      await bot.telegram.callApi('setMyCommands', {
        commands,
        scope: { type: 'chat', chat_id: CREATOR_ID },
        language_code: 'zu'
      });
    } catch (e) {}
  }
}

async function scanRealtime(telegram, state) {
  const today = new Date().toISOString().slice(0, 10);
  for (const gid of Object.keys(state.groups)) {
    try {
      const chat = await telegram.getChat(gid);
      const count = await telegram.getChatMembersCount(gid).catch(() => state.groups[gid].membersCount || '?');
      state.groups[gid] = {
        ...state.groups[gid],
        id: chat.id,
        title: chat.title || state.groups[gid].title || 'קבוצה',
        membersCount: count
      };
      const admins = await telegram.getChatAdministrators(gid).catch(() => []);
      for (const a of admins) {
        if (a.user && !a.user.is_bot) {
          const uid = String(a.user.id);
          const prev = state.users[uid] || {};
          state.users[uid] = {
            id: a.user.id,
            name: `${a.user.first_name || ''} ${a.user.last_name || ''}`.trim() || 'משתמש',
            username: a.user.username ? `@${a.user.username}` : 'ללא',
            lastSeen: prev.lastSeen || today
          };
        }
      }
    } catch (e) {}
  }
  await saveState(state);
}

async function getLink(tg, cid) {
  try {
    const c = await tg.getChat(cid);
    if (c.username) return `https://t.me/${c.username}`;
    if (c.invite_link) return c.invite_link;
  } catch (e) {}
  try {
    const r = await tg.createChatInviteLink(cid, { name: 'Owner' });
    if (r?.invite_link) return r.invite_link;
  } catch (e) {}
  try {
    return await tg.exportChatInviteLink(cid);
  } catch (e) { return null; }
}

function buildOwnerPanel(s) {
  const today = new Date().toISOString().slice(0, 10);
  const uList = Object.values(s.users);
  const todayU = uList.filter((u) => u.lastSeen === today).length;
  const mBtn = s.maintenance ? '🟢 כבה מצב תחזוקה' : '🔴 הפעל מצב תחזוקה';

  const text =
    `👑 פאנל שליטה ראשי – יוצר הבוט\n` +
    `🔖 גרסה נוכחית: עדכון ${BOT_VERSION}\n\n` +
    `• קבוצות: ${Object.keys(s.groups).length}\n` +
    `• סה"כ משתמשים: ${uList.length} (היום: ${todayU})\n` +
    `• כתיבה חיה: ${s.liveChatTarget || 'כבוי'}\n` +
    `• תחזוקה: ${s.maintenance ? 'פעיל 🔴' : 'כבוי 🟢'}`;

  const reply_markup = {
    inline_keyboard: [
      [{ text: '🔄 סרוק ועדכן נתונים בזמן אמת', callback_data: 'own_refresh' }],
      [{ text: `🚀 שלח הודעת עדכון ${BOT_VERSION} לכולם`, callback_data: 'own_announce_ver' }],
      [{ text: '🏢 רשימת קבוצות וקישורים', callback_data: 'own_groups' }, { text: '👥 משתמשי הבוט', callback_data: 'own_users' }],
      [{ text: '💬 כתיבה חיה לקבוצה', callback_data: 'own_groups' }, { text: '🛑 עצור כתיבה חיה', callback_data: 'own_livechat_stop' }],
      [{ text: mBtn, callback_data: 'own_toggle_maint' }, { text: '📖 מדריך פקודות יוצר', callback_data: 'own_help' }]
    ]
  };
  return { text, reply_markup };
}

const WIZARD_STEP1_TEXT =
  '💡 *הצעה לשיפור / הוספת פקודה*\n\n' +
  'איזו מילה או פקודה תרצה שתוסיף? (למשל: /rules)';

const WIZARD_CANCEL_KB = {
  inline_keyboard: [[{ text: '❌ ביטול', callback_data: 'reqcmd_cancel' }]]
};

const BACK_TO_MENU_KB = {
  inline_keyboard: [[{ text: '🔙 חזרה לתפריט', callback_data: 'help_main' }]]
};

function getMainMenuText() {
  return (
    registerSystemCommands.MAIN_MENU_TEXT ||
    `שלום! 👋\nאני בוט מתקדם לניהול והגנה על קבוצות.\n🔖 *גרסה נוכחית:* עדכון ${BOT_VERSION}\n\n📚 *תפריט הפקודות – בחר קטגוריה מהכפתורים למטה:*`
  );
}

function getMainMenuKeyboard() {
  if (typeof registerSystemCommands.getHelpKeyboard === 'function') {
    return registerSystemCommands.getHelpKeyboard();
  }
  return {
    inline_keyboard: [
      [
        { text: '👮 ניהול משתמשים', callback_data: 'help_users' },
        { text: '🧹 תוכן וניקוי', callback_data: 'help_content' }
      ],
      [
        { text: '🛡️ אוטומציה והגנה', callback_data: 'help_protection' },
        { text: 'ℹ️ מידע ופקודות', callback_data: 'help_info' }
      ],
      [
        { text: '⚙️ מערכת ועיצוב', callback_data: 'help_system' },
        { text: '🎨 מדריך כפתורים ועיצוב', callback_data: 'help_format' }
      ],
      [
        { text: '💡 הצעה לשיפור', callback_data: 'reqcmd_start' },
        { text: `🆕 עדכון ${BOT_VERSION}`, callback_data: 'help_changelog' }
      ]
    ]
  };
}

async function broadcastVersionUpdate(telegram, state) {
  const msg = registerSystemCommands.CHANGELOG_TEXT || `🚀 *עדכון ${BOT_VERSION}* עלה לאוויר!`;
  let gc = 0, uc = 0;
  for (const gid of Object.keys(state.groups)) {
    try { await safeSendRich(telegram, gid, msg); gc++; } catch (e) {}
  }
  for (const uid of Object.keys(state.users)) {
    try { await safeSendRich(telegram, uid, msg); uc++; } catch (e) {}
  }
  return { gc, uc };
}

if (bot) {
  bot.use(async (ctx, next) => {
    try {
      const s = await getState();
      const today = new Date().toISOString().slice(0, 10);
      let chg = false;

      if (ctx.from && !ctx.from.is_bot) {
        const uid = String(ctx.from.id);
        if (s.globalBanned.includes(uid) && !isCreator(ctx)) {
          if (ctx.chat && ctx.chat.type !== 'private') {
            await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id).catch(() => {});
          }
          return;
        }
        s.users[uid] = {
          id: ctx.from.id,
          name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'משתמש',
          username: ctx.from.username ? `@${ctx.from.username}` : 'ללא',
          lastSeen: today
        };
        chg = true;
      }

      if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)) {
        const gid = String(ctx.chat.id);
        s.groups[gid] = {
          ...(s.groups[gid] || {}),
          id: ctx.chat.id,
          title: ctx.chat.title || 'קבוצה'
        };
        chg = true;
      }

      // אם עלה עדכון גרסה חדש – מציג אוטומטית למשתמשים ולקבוצות את מספר העדכון ופירוט השדרוגים
      if (s.lastVersion !== BOT_VERSION) {
        s.lastVersion = BOT_VERSION;
        await saveState(s);
        await broadcastVersionUpdate(ctx.telegram, s);
      } else if (chg) {
        await saveState(s);
      }

      if (s.maintenance && !isCreator(ctx)) return;

      const uid = ctx.from ? String(ctx.from.id) : null;
      const text = ctx.message?.text?.trim();
      const isPrivate = ctx.chat?.type === 'private';
      const wiz = isPrivate && uid ? s.wizards[uid] : null;
      const cmd = text ? text.split(/\s+/)[0].split('@')[0].toLowerCase() : '';

      // פקודת /cancel מבטלת את האשף ומציגה כפתור חזרה לתפריט
      if (isPrivate && cmd === '/cancel') {
        if (wiz) {
          delete s.wizards[uid];
          await saveState(s);
          return await ctx.reply('❌ תהליך שליחת ההצעה בוטל.', { reply_markup: BACK_TO_MENU_KB });
        }
        return await ctx.reply('אין תהליך פעיל לביטול.', { reply_markup: BACK_TO_MENU_KB });
      }

      // אם המשתמש באמצע האשף ושלח פקודת מערכת – יוצאים מהאשף ומריצים אותה
      if (wiz && (cmd.startsWith('/owner') || ['/god', '/start', '/help', '/broadcast', '/request_command'].includes(cmd))) {
        delete s.wizards[uid];
        await saveState(s);
        return next();
      }

      // טיפול בשלבי אשף "הצעה לשיפור" בצ'אט פרטי
      if (isPrivate && wiz && text) {
        if (wiz.step === 1) {
          s.wizards[uid] = { step: 2, cmd: text };
          await saveState(s);
          return await ctx.reply(
            'מה הבוט צריך לענות כשמישהו יכתוב את זה?',
            { reply_markup: WIZARD_CANCEL_KB }
          );
        }
        if (wiz.step === 2) {
          const reqCmd = wiz.cmd;
          delete s.wizards[uid];
          await saveState(s);
          const uName = ctx.from.first_name || 'משתמש';
          const uTag = ctx.from.username ? `@${ctx.from.username}` : 'ללא';
          await ctx.telegram.sendMessage(
            CREATOR_ID,
            `📩 הצעה חדשה לשיפור / פקודה:\n👤 מאת: ${uName} (${uTag})\n🆔 ID: ${uid}\n⌨️ פקודה/נושא: ${reqCmd}\n💬 תוכן ההצעה:\n${text}`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ לאשר', callback_data: `reqcmd_approve_${uid}` },
                  { text: '❌ לדחות', callback_data: `reqcmd_reject_${uid}` }
                ]]
              }
            }
          );
          return await ctx.reply('בקשתך נשלחה לאישור היוצר, נעדכן אותך בקרוב', {
            reply_markup: BACK_TO_MENU_KB
          });
        }
      }

      // כתיבה חיה לקבוצה (תומך גם בהודעות עם /פקודות או @שמות עם קו תחתון!)
      if (isCreator(ctx) && isPrivate && s.liveChatTarget && text && !cmd.startsWith('/owner') && !['/god', '/start', '/help', '/cancel', '/broadcast', '/request_command'].includes(cmd)) {
        try {
          await safeSendRich(ctx.telegram, s.liveChatTarget, text);
          return await ctx.reply(`✅ נשלח לקבוצה (${s.liveChatTarget}). לעצירה: /owner_stop`);
        } catch (err) {
          return await ctx.reply(`❌ שגיאה בשליחה לקבוצה (${s.liveChatTarget}): ${err.description || err.message}`);
        }
      }
    } catch (e) {}
    return next();
  });
  bot.command(['owner', 'god'], async (ctx) => {
    if (!isCreator(ctx)) return;
    const s = await getState();
    await scanRealtime(ctx.telegram, s);
    const panel = buildOwnerPanel(s);
    await ctx.reply(panel.text, { reply_markup: panel.reply_markup });
  });

  async function showGroups(ctx) {
    const s = await getState();
    await scanRealtime(ctx.telegram, s);
    const groups = Object.values(s.groups);
    if (!groups.length) return ctx.reply('📭 שלח הודעה אחת בתוך הקבוצה שבה הבוט נמצא כדי שהבוט יסרוק וישמור אותה לתמיד.');
    const btns = [];
    let txt = `🏢 קבוצות שבהן הבוט נמצא (${groups.length}):\n\n`;
    for (const g of groups.slice(0, 15)) {
      txt += `• ${g.title} | ID: ${g.id} | חברים: ${g.membersCount || '?'}\n`;
      btns.push([
        { text: `🔗 קישור: ${g.title.slice(0, 9)}`, callback_data: `own_link_${g.id}` },
        { text: '💬 כתוב', callback_data: `own_chat_${g.id}` },
        { text: '🕵️ מידע', callback_data: `own_spy_${g.id}` }
      ]);
    }
    await ctx.reply(txt, { reply_markup: { inline_keyboard: btns } });
  }

  async function showUsers(ctx) {
    const s = await getState();
    await scanRealtime(ctx.telegram, s);
    const today = new Date().toISOString().slice(0, 10);
    const uList = Object.values(s.users);
    const todayC = uList.filter((u) => u.lastSeen === today).length;
    const rows = uList.slice(-35).reverse().map((u, i) => `${i + 1}. ${u.name} (${u.username}) – ${u.id} ${u.lastSeen === today ? '🟢' : ''}`).join('\n');
    await ctx.reply(`👥 משתמשים: סה"כ ${uList.length} | היום: ${todayC} | קבוצות: ${Object.keys(s.groups).length}\n\n${rows || 'אין'}`);
  }

  bot.command('owner_groups', async (ctx) => { if (isCreator(ctx)) await showGroups(ctx); });
  bot.command('owner_users', async (ctx) => { if (isCreator(ctx)) await showUsers(ctx); });

  bot.command('owner_link', async (ctx) => {
    if (!isCreator(ctx)) return;
    const cid = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!cid) return ctx.reply('שימוש: /owner_link [ChatID]');
    const link = await getLink(ctx.telegram, cid);
    await ctx.reply(link ? `🔗 קישור:\n${link}` : '⚠️ אין לבוט הרשאת קישור בקבוצה זו.');
  });

  bot.command('owner_chat', async (ctx) => {
    if (!isCreator(ctx)) return;
    const cid = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!cid) return ctx.reply('שימוש: /owner_chat [ChatID]');
    const s = await getState();
    s.liveChatTarget = cid;
    await saveState(s);
    await ctx.reply(`🎙️ כתיבה חיה הופעלה לקבוצה ${cid}! כל הודעה רגילה שתכתוב לי כאן בפרטי תישלח בשם הבוט לקבוצה. לעצירה: /owner_stop`);
  });

  bot.command('owner_stop', async (ctx) => {
    if (!isCreator(ctx)) return;
    const s = await getState();
    s.liveChatTarget = null;
    await saveState(s);
    await ctx.reply('🛑 כתיבה חיה הופסקה.');
  });

  bot.command('owner_say', async (ctx) => {
    if (!isCreator(ctx)) return;
    const cid = (ctx.message.text || '').trim().split(/\s+/)[1];
    const msg = (ctx.message.text || '').replace(/^\/owner_say(@\S+)?\s+\S+\s*/i, '');
    if (!cid || !msg) return ctx.reply('שימוש: /owner_say [ChatID] [הודעה]');
    try {
      await safeSendRich(ctx.telegram, cid, msg);
      await ctx.reply(`✅ נשלח לקבוצה ${cid}!`);
    } catch (e) { await ctx.reply(`❌ ${e.message}`); }
  });

  bot.command('owner_pin', async (ctx) => {
    if (!isCreator(ctx)) return;
    const cid = (ctx.message.text || '').trim().split(/\s+/)[1];
    const msg = (ctx.message.text || '').replace(/^\/owner_pin(@\S+)?\s+\S+\s*/i, '');
    if (!cid || !msg) return ctx.reply('שימוש: /owner_pin [ChatID] [הודעה]');
    try {
      const sent = await safeSendRich(ctx.telegram, cid, msg);
      await ctx.telegram.pinChatMessage(cid, sent.message_id).catch(() => {});
      await ctx.reply(`📌 נשלח וננעץ בקבוצה ${cid}!`);
    } catch (e) { await ctx.reply(`❌ ${e.message}`); }
  });

  bot.command('broadcast', async (ctx) => {
    if (!isCreator(ctx)) return;
    const msg = (ctx.message.text || '').replace(/^\/broadcast(@\S+)?\s*/i, '');
    if (!msg) return ctx.reply('שימוש: /broadcast [הודעה]');
    const s = await getState();
    let gc = 0, uc = 0;
    for (const gid of Object.keys(s.groups)) { try { await safeSendRich(ctx.telegram, gid, msg); gc++; } catch (e) {} }
    for (const uid of Object.keys(s.users)) { try { await safeSendRich(ctx.telegram, uid, msg); uc++; } catch (e) {} }
    await ctx.reply(`📣 שודר ל-${gc} קבוצות ו-${uc} משתמשים.`);
  });

  bot.command('owner_dm', async (ctx) => {
    if (!isCreator(ctx)) return;
    const uid = (ctx.message.text || '').trim().split(/\s+/)[1];
    const msg = (ctx.message.text || '').replace(/^\/owner_dm(@\S+)?\s+\S+\s*/i, '');
    if (!uid || !msg) return ctx.reply('שימוש: /owner_dm [UserID] [הודעה]');
    try {
      await safeSendRich(ctx.telegram, uid, msg);
      await ctx.reply(`✉️ נשלח למשתמש ${uid}!`);
    } catch (e) { await ctx.reply(`❌ ${e.message}`); }
  });

  bot.command('owner_leave', async (ctx) => {
    if (!isCreator(ctx)) return;
    const cid = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!cid) return ctx.reply('שימוש: /owner_leave [ChatID]');
    try {
      await ctx.telegram.leaveChat(cid);
      const s = await getState();
      delete s.groups[String(cid)];
      await saveState(s);
      await ctx.reply(`👋 הבוט עזב את ${cid}.`);
    } catch (e) { await ctx.reply(`❌ ${e.message}`); }
  });

  bot.command('owner_globalban', async (ctx) => {
    if (!isCreator(ctx)) return;
    const uid = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!uid) return ctx.reply('שימוש: /owner_globalban [UserID]');
    const s = await getState();
    if (!s.globalBanned.includes(String(uid))) s.globalBanned.push(String(uid));
    await saveState(s);
    let c = 0;
    for (const gid of Object.keys(s.groups)) { try { await ctx.telegram.banChatMember(gid, Number(uid)); c++; } catch (e) {} }
    await ctx.reply(`⚡ ${uid} נחסם ב-${c} קבוצות!`);
  });

  bot.command('owner_unglobalban', async (ctx) => {
    if (!isCreator(ctx)) return;
    const uid = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!uid) return ctx.reply('שימוש: /owner_unglobalban [UserID]');
    const s = await getState();
    s.globalBanned = s.globalBanned.filter((id) => id !== String(uid));
    await saveState(s);
    for (const gid of Object.keys(s.groups)) { try { await ctx.telegram.unbanChatMember(gid, Number(uid), { only_if_banned: true }); } catch (e) {} }
    await ctx.reply(`✅ החסימה הגלובלית של ${uid} הוסרה.`);
  });

  bot.action(/^own_(.+)$/, async (ctx) => {
    if (!isCreator(ctx)) return;
    const act = ctx.match[1];
    await ctx.answerCbQuery('מעדכן...').catch(() => {});
    if (act === 'refresh') {
      const s = await getState();
      await scanRealtime(ctx.telegram, s);
      const panel = buildOwnerPanel(s);
      return ctx.editMessageText(panel.text, { reply_markup: panel.reply_markup }).catch(() => ctx.reply(panel.text, { reply_markup: panel.reply_markup }));
    }
    if (act === 'announce_ver') {
      const s = await getState();
      s.lastVersion = BOT_VERSION;
      await saveState(s);
      const { gc, uc } = await broadcastVersionUpdate(ctx.telegram, s);
      return ctx.reply(`🚀 הודעת עדכון ${BOT_VERSION} נשלחה ל-${gc} קבוצות ו-${uc} משתמשים!`);
    }
    if (act === 'groups') return showGroups(ctx);
    if (act === 'users') return showUsers(ctx);
    if (act === 'livechat_stop') {
      const s = await getState();
      s.liveChatTarget = null;
      await saveState(s);
      const panel = buildOwnerPanel(s);
      await ctx.editMessageText(panel.text, { reply_markup: panel.reply_markup }).catch(() => {});
      return ctx.reply('🛑 כתיבה חיה הופסקה.');
    }
    if (act === 'toggle_maint') {
      const s = await getState();
      s.maintenance = !s.maintenance;
      await saveState(s);
      const panel = buildOwnerPanel(s);
      await ctx.editMessageText(panel.text, { reply_markup: panel.reply_markup }).catch(() => {});
      return ctx.reply(`🔧 מצב תחזוקה כעת: ${s.maintenance ? 'פעיל 🔴 (הבוט עונה רק לך)' : 'כבוי 🟢 (פתוח לכולם)'}`);
    }
    if (act === 'help') {
      return ctx.reply(
        '👑 פקודות היוצר:\n' +
        '• /owner או /god – פאנל שליטה\n' +
        '• /owner_groups – רשימת קבוצות וקישורים\n' +
        '• /owner_link [ChatID] – קישור לקבוצה\n' +
        '• /owner_users – משתמשים וסטטיסטיקות\n' +
        '• /owner_chat [ChatID] – כתיבה חיה לקבוצה\n' +
        '• /owner_stop – עצירת כתיבה חיה\n' +
        '• /owner_say [ChatID] [טקסט] – שליחה לקבוצה\n' +
        '• /owner_pin [ChatID] [טקסט] – שליחה ונעיצה\n' +
        '• /broadcast [טקסט] – שידור גלובלי\n' +
        '• /owner_dm [UserID] [טקסט] – הודעה למשתמש\n' +
        '• /owner_leave [ChatID] – עזיבת קבוצה\n' +
        '• /owner_globalban / /owner_unglobalban [UserID]'
      );
    }
    if (act.startsWith('link_')) {
      const gid = act.replace('link_', '');
      const link = await getLink(ctx.telegram, gid);
      return ctx.reply(link ? `🔗 קישור:\n${link}` : '⚠️ אין הרשאת קישור.');
    }
    if (act.startsWith('chat_')) {
      const gid = act.replace('chat_', '');
      const s = await getState();
      s.liveChatTarget = gid;
      await saveState(s);
      return ctx.reply(`🎙️ כתיבה חיה הופעלה לקבוצה ${gid}!\nכל הודעה רגילה שתכתוב לי כאן בפרטי תישלח בשם הבוט לקבוצה. לעצירה: /owner_stop`);
    }
    if (act.startsWith('spy_')) {
      const gid = act.replace('spy_', '');
      try {
        const chat = await ctx.telegram.getChat(gid);
        const cnt = await ctx.telegram.getChatMembersCount(gid).catch(() => '?');
        const adms = await ctx.telegram.getChatAdministrators(gid).catch(() => []);
        const names = adms.map((a) => a.user.username ? `@${a.user.username}` : a.user.first_name).join(', ');
        const link = await getLink(ctx.telegram, gid);
        await ctx.reply(`🕵️ מודיעין:\n• שם: ${chat.title}\n• ID: ${gid}\n• חברים: ${cnt}\n• אדמינים: ${names}\n• קישור: ${link || 'ללא'}`);
      } catch (e) { await ctx.reply('❌ שגיאה בשליפת מידע.'); }
    }
  });

  // כפתור "💡 הצעה לשיפור" מתוך התפריט (עורך את ההודעה הקיימת כדי שהצ'אט יישאר נקי!)
  bot.action('reqcmd_start', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    if (!ctx.chat || ctx.chat.type !== 'private') {
      const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
      return ctx.reply('⚠️ שליחת הצעה לשיפור מתבצעת בצ׳אט פרטי מול הבוט בלבד:', {
        reply_markup: {
          inline_keyboard: [[
            { text: '💡 לחץ כאן לשליחת הצעה בפרטי', url: `https://t.me/${botUsername}?start=request_command` }
          ]]
        }
      });
    }
    const s = await getState();
    s.wizards[String(ctx.from.id)] = { step: 1 };
    await saveState(s);
    await ctx.editMessageText(WIZARD_STEP1_TEXT, {
      parse_mode: 'Markdown',
      reply_markup: WIZARD_CANCEL_KB
    }).catch(() => ctx.reply(WIZARD_STEP1_TEXT, {
      parse_mode: 'Markdown',
      reply_markup: WIZARD_CANCEL_KB
    }));
  });

  // תמיכה גם בפקודה /request_command למי ששולח ידנית
  bot.command('request_command', async (ctx) => {
    if (!ctx.chat || ctx.chat.type !== 'private') {
      const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
      return ctx.reply('⚠️ שליחת הצעה לשיפור מתבצעת בצ׳אט פרטי מול הבוט בלבד:', {
        reply_markup: {
          inline_keyboard: [[
            { text: '💡 לחץ כאן לשליחת הצעה בפרטי', url: `https://t.me/${botUsername}?start=request_command` }
          ]]
        }
      });
    }
    const s = await getState();
    s.wizards[String(ctx.from.id)] = { step: 1 };
    await saveState(s);
    await ctx.reply(WIZARD_STEP1_TEXT, {
      parse_mode: 'Markdown',
      reply_markup: WIZARD_CANCEL_KB
    });
  });

  // כפתור "❌ ביטול" – מציג שהתהליך התבטל ומוסיף מתחת להודעה לחצן "🔙 חזרה לתפריט"
  bot.action('reqcmd_cancel', async (ctx) => {
    const s = await getState();
    const uid = String(ctx.from.id);
    delete s.wizards[uid];
    await saveState(s);
    await ctx.answerCbQuery('בוטל').catch(() => {});
    await ctx.editMessageText('❌ תהליך שליחת ההצעה בוטל.', {
      reply_markup: BACK_TO_MENU_KB
    }).catch(() => ctx.reply('❌ תהליך שליחת ההצעה בוטל.', {
      reply_markup: BACK_TO_MENU_KB
    }));
  });

  // כפתור "🔙 חזרה לתפריט" – מחזיר מיד לתפריט הראשי באותה הודעה בלי ללכלך את הצ'אט
  bot.action('help_main', async (ctx) => {
    const s = await getState();
    if (ctx.from) {
      delete s.wizards[String(ctx.from.id)];
      await saveState(s);
    }
    await ctx.answerCbQuery().catch(() => {});
    await ctx.editMessageText(getMainMenuText(), {
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard()
    }).catch(() => ctx.reply(getMainMenuText(), {
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard()
    }));
  });

  bot.action(/^reqcmd_approve_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return;
    const uid = ctx.match[1];
    const orig = ctx.callbackQuery?.message?.text || '';
    await ctx.answerCbQuery('אושר');
    await ctx.editMessageText(`אושר\n\n${orig}`);
    await ctx.telegram.sendMessage(uid, 'הפקודה אושרה ועובדת!').catch(() => {});
  });

  bot.action(/^reqcmd_reject_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return;
    const uid = ctx.match[1];
    const orig = ctx.callbackQuery?.message?.text || '';
    await ctx.answerCbQuery('נדחה');
    await ctx.editMessageText(`נדחה\n\n${orig}`);
    await ctx.telegram.sendMessage(uid, 'הפקודה נדחתה עקב החלטת היוצר').catch(() => {});
  });

  // בכניסה לבוט (/start) מציג מיד את כל התפריט והכפתורים בלי צורך לשלוח /help!
  bot.start(async (ctx) => {
    const payload = ctx.startPayload || (ctx.message?.text || '').split(/\s+/)[1] || '';
    if (payload.startsWith('rules_')) {
      const gid = payload.replace('rules_', '');
      const data = await getGroupData(gid);
      const title = data.groupTitle ? ` (${data.groupTitle})` : '';
      return await sendFormattedMessage(ctx, `📜 *חוקי הקבוצה${title}:*\n\n${data.rules}`, { name: ctx.from?.first_name || 'חבר' });
    }
    if (payload === 'request_command' && ctx.chat?.type === 'private') {
      const s = await getState();
      s.wizards[String(ctx.from.id)] = { step: 1 };
      await saveState(s);
      return await ctx.reply(WIZARD_STEP1_TEXT, {
        parse_mode: 'Markdown',
        reply_markup: WIZARD_CANCEL_KB
      });
    }
    await ctx.reply(getMainMenuText(), {
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard()
    });
  });

  registerSystemCommands(bot);
  registerUsersCommands(bot);
  registerContentCommands(bot);
  registerInfoCommands(bot);
  registerProtectionCommands(bot);

  bot.catch((err, ctx) => {
    console.error(`Bot error in update ${ctx.update.update_id}:`, err);
  });
}

module.exports = async (req, res) => {
  try {
    if (!bot) return res.status(500).send('חסר BOT_TOKEN');
    if (req.method === 'GET') {
      if (req.query && req.query.setWebhook === '1') {
        const host = process.env.WEBHOOK_URL || `https://${req.headers.host}/api/bot`;
        await bot.telegram.setWebhook(host);
        return res.status(200).json({ ok: true, webhookUrl: host });
      }
      return res.status(200).send('הבוט פעיל ומוכן לקבל הודעות! ✅');
    }
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).send('Method Not Allowed');
  } catch (error) {
    return res.status(200).json({ ok: false, error: error.message });
  }
};
