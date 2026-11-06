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
let memState = null;

function defaultState() {
  return {
    groups: {},
    users: {},
    wizards: {},
    globalBanned: [],
    maintenance: false,
    liveChatTarget: null
  };
}

// טעינת מצב הבוט: זיכרון -> קובץ מקומי -> שחזור אוטומטי משרתי טלגרם אחרי Push!
async function getState() {
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
        fs.writeFileSync(STATE_FILE, JSON.stringify(memState), 'utf8');
        return memState;
      }
    } catch (e) {}
  }

  memState = defaultState();
  return memState;
}

// שמירת מצב הבוט בזמן אמת גם מקומית וגם בענן של טלגרם כדי שישרוד כל Push ל-GitHub
async function saveState(state) {
  memState = state;
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

// סריקה אקטיבית בזמן אמת של כל הקבוצות והמשתמשים שבהן מול שרתי טלגרם
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
    `👑 פאנל שליטה ראשי – יוצר הבוט\n\n` +
    `• קבוצות: ${Object.keys(s.groups).length}\n` +
    `• סה"כ משתמשים: ${uList.length} (היום: ${todayU})\n` +
    `• כתיבה חיה: ${s.liveChatTarget || 'כבוי'}\n` +
    `• תחזוקה: ${s.maintenance ? 'פעיל 🔴' : 'כבוי 🟢'}`;

  const reply_markup = {
    inline_keyboard: [
      [{ text: '🔄 סרוק ועדכן נתונים בזמן אמת', callback_data: 'own_refresh' }],
      [{ text: '🏢 רשימת קבוצות וקישורים', callback_data: 'own_groups' }, { text: '👥 משתמשי הבוט', callback_data: 'own_users' }],
      [{ text: '💬 כתיבה חיה לקבוצה', callback_data: 'own_groups' }, { text: '🛑 עצור כתיבה חיה', callback_data: 'own_livechat_stop' }],
      [{ text: mBtn, callback_data: 'own_toggle_maint' }, { text: '📖 מדריך פקודות יוצר', callback_data: 'own_help' }]
    ]
  };
  return { text, reply_markup };
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

      if (chg) await saveState(s);
      if (s.maintenance && !isCreator(ctx)) return;

      const uid = ctx.from ? String(ctx.from.id) : null;
      const text = ctx.message?.text?.trim();
      const isPrivate = ctx.chat?.type === 'private';
      const wiz = isPrivate && uid ? s.wizards[uid] : null;
      const cmd = text ? text.split(/\s+/)[0].split('@')[0].toLowerCase() : '';

      // אשף הוספת פקודה פועל אך ורק בפרטי!
      if (wiz && cmd.startsWith('/') && (cmd.startsWith('/owner') || ['/god', '/start', '/help', '/cancel', '/broadcast', '/request_command'].includes(cmd))) {
        delete s.wizards[uid];
        await saveState(s);
        return next();
      }

      if (isPrivate && wiz && text) {
        if (wiz.step === 1) {
          s.wizards[uid] = { step: 2, cmd: text };
          await saveState(s);
          return await ctx.reply('מה הבוט צריך לענות כשמישהו יכתוב את זה?');
        }
        if (wiz.step === 2) {
          const reqCmd = wiz.cmd;
          delete s.wizards[uid];
          await saveState(s);
          const uName = ctx.from.first_name || 'משתמש';
          const uTag = ctx.from.username ? `@${ctx.from.username}` : 'ללא';
          await ctx.telegram.sendMessage(
            CREATOR_ID,
            `📩 בקשה חדשה לפקודה:\n👤 מאת: ${uName} (${uTag})\n🆔 ID: ${uid}\n⌨️ פקודה: ${reqCmd}\n💬 תשובה:\n${text}`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ לאשר', callback_data: `reqcmd_approve_${uid}` },
                  { text: '❌ לדחות', callback_data: `reqcmd_reject_${uid}` }
                ]]
              }
            }
          );
          return await ctx.reply('בקשתך נשלחה לאישור היוצר, נעדכן אותך בקרוב');
        }
      }

      if (isCreator(ctx) && isPrivate && s.liveChatTarget && text && !text.startsWith('/')) {
        const p = parseRichMessage(text);
        await ctx.telegram.sendMessage(s.liveChatTarget, p.text, p.extra);
        return await ctx.reply(`✅ נשלח לקבוצה (${s.liveChatTarget}). לעצירה: /owner_stop`);
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
      const p = parseRichMessage(msg);
      await ctx.telegram.sendMessage(cid, p.text, p.extra);
      await ctx.reply(`✅ נשלח לקבוצה ${cid}!`);
    } catch (e) { await ctx.reply(`❌ ${e.message}`); }
  });

  bot.command('owner_pin', async (ctx) => {
    if (!isCreator(ctx)) return;
    const cid = (ctx.message.text || '').trim().split(/\s+/)[1];
    const msg = (ctx.message.text || '').replace(/^\/owner_pin(@\S+)?\s+\S+\s*/i, '');
    if (!cid || !msg) return ctx.reply('שימוש: /owner_pin [ChatID] [הודעה]');
    try {
      const p = parseRichMessage(msg);
      const sent = await ctx.telegram.sendMessage(cid, p.text, p.extra);
      await ctx.telegram.pinChatMessage(cid, sent.message_id).catch(() => {});
      await ctx.reply(`📌 נשלח וננעץ בקבוצה ${cid}!`);
    } catch (e) { await ctx.reply(`❌ ${e.message}`); }
  });

  bot.command('broadcast', async (ctx) => {
    if (!isCreator(ctx)) return;
    const msg = (ctx.message.text || '').replace(/^\/broadcast(@\S+)?\s*/i, '');
    if (!msg) return ctx.reply('שימוש: /broadcast [הודעה]');
    const s = await getState();
    const p = parseRichMessage(msg);
    let gc = 0, uc = 0;
    for (const gid of Object.keys(s.groups)) { try { await ctx.telegram.sendMessage(gid, p.text, p.extra); gc++; } catch (e) {} }
    for (const uid of Object.keys(s.users)) { try { await ctx.telegram.sendMessage(uid, p.text, p.extra); uc++; } catch (e) {} }
    await ctx.reply(`📣 שודר ל-${gc} קבוצות ו-${uc} משתמשים.`);
  });

  bot.command('owner_dm', async (ctx) => {
    if (!isCreator(ctx)) return;
    const uid = (ctx.message.text || '').trim().split(/\s+/)[1];
    const msg = (ctx.message.text || '').replace(/^\/owner_dm(@\S+)?\s+\S+\s*/i, '');
    if (!uid || !msg) return ctx.reply('שימוש: /owner_dm [UserID] [הודעה]');
    try {
      const p = parseRichMessage(msg);
      await ctx.telegram.sendMessage(uid, p.text, p.extra);
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

  // /request_command - מוגבל לצ'אט פרטי בלבד! (בקבוצה מפנה בכפתור לפרטי)
  bot.command('request_command', async (ctx) => {
    if (!ctx.chat || ctx.chat.type !== 'private') {
      const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
      return ctx.reply('⚠️ הוספת פקודה מתבצעת בצ׳אט פרטי מול הבוט בלבד:', {
        reply_markup: {
          inline_keyboard: [[
            { text: '💡 לחץ כאן להצעת פקודה בפרטי', url: `https://t.me/${botUsername}?start=request_command` }
          ]]
        }
      });
    }
    const s = await getState();
    s.wizards[String(ctx.from.id)] = { step: 1 };
    await saveState(s);
    await ctx.reply('איזו מילה או פקודה תרצה שתוסיף? (למשל: /rules)');
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
      return await ctx.reply('איזו מילה או פקודה תרצה שתוסיף? (למשל: /rules)');
    }
    await ctx.reply(
      'שלום!\n' +
      'אני בוט מתקדם לניהול קבוצות עם 30 פקודות ניהול והגנה.\n' +
      'שלח /help לתפריט הפקודות המלא, או /request_command להצעת פקודה חדשה.'
    );
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
