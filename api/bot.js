const { Telegraf } = require('telegraf');
const {
  getGroupData,
  getGlobalData,
  saveGlobalData,
  fetchGroupLink,
  getOwnerKeyboard,
  sendGroupsList,
  sendUsersReport,
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

if (bot) {
  // ניטור קבוצות, משתמשים, אשף בקשת פקודה וכתיבה חיה של היוצר
  bot.use(async (ctx, next) => {
    try {
      const globalData = await getGlobalData();
      const today = new Date().toISOString().slice(0, 10);
      let changed = false;

      if (ctx.from && !ctx.from.is_bot) {
        const uid = String(ctx.from.id);
        if ((globalData.globalBanned || []).includes(uid) && !isCreator(ctx)) {
          if (ctx.chat && ctx.chat.type !== 'private') {
            await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id).catch(() => {});
          }
          return;
        }
        const prev = (globalData.users || {})[uid] || {};
        globalData.users[uid] = {
          id: ctx.from.id,
          name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'משתמש',
          username: ctx.from.username ? `@${ctx.from.username}` : 'ללא',
          firstSeen: prev.firstSeen || today,
          lastSeen: today
        };
        changed = true;
      }

      if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)) {
        const gid = String(ctx.chat.id);
        globalData.groups[gid] = {
          id: ctx.chat.id,
          title: ctx.chat.title || 'קבוצה',
          username: ctx.chat.username ? `@${ctx.chat.username}` : '',
          updatedAt: today
        };
        changed = true;
      }

      if (changed) await saveGlobalData(globalData);
      if (globalData.maintenance && !isCreator(ctx)) return;

      const uid = ctx.from ? String(ctx.from.id) : null;
      const text = ctx.message?.text?.trim();
      const wiz = uid && globalData.wizards ? globalData.wizards[uid] : null;
      const cmdToken = text ? text.split(/\s+/)[0].split('@')[0].toLowerCase() : '';

      // פקודות יוצר ומערכת תמיד יוצאות מהאשף ומתבצעות מיד!
      if (wiz && cmdToken.startsWith('/') && (cmdToken.startsWith('/owner') || ['/god', '/start', '/help', '/cancel', '/broadcast'].includes(cmdToken))) {
        delete globalData.wizards[uid];
        await saveGlobalData(globalData);
        return next();
      }

      if (wiz && text) {
        if (wiz.step === 1) {
          globalData.wizards[uid] = { step: 2, cmd: text };
          await saveGlobalData(globalData);
          await ctx.reply('מה הבוט צריך לענות כשמישהו יכתוב את זה?');
          return;
        }
        if (wiz.step === 2) {
          const reqCmd = wiz.cmd;
          delete globalData.wizards[uid];
          await saveGlobalData(globalData);
          const uName = ctx.from.first_name || 'משתמש';
          const uTag = ctx.from.username ? `@${ctx.from.username}` : 'ללא שם משתמש';

          await ctx.telegram.sendMessage(
            CREATOR_ID,
            `📩 בקשה חדשה להוספת פקודה:\n\n👤 משתמש: ${uName} (${uTag})\n🆔 User ID: ${uid}\n⌨️ פקודה מבוקשת: ${reqCmd}\n💬 תשובה מבוקשת:\n${text}`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ לאשר', callback_data: `reqcmd_approve_${uid}` },
                  { text: '❌ לדחות', callback_data: `reqcmd_reject_${uid}` }
                ]]
              }
            }
          );
          await ctx.reply('בקשתך נשלחה לאישור היוצר, נעדכן אותך בקרוב');
          return;
        }
      }

      // כתיבה חיה מהפרטי של היוצר לתוך קבוצה נבחרת
      if (isCreator(ctx) && ctx.chat?.type === 'private' && globalData.liveChatTarget && text && !text.startsWith('/')) {
        const parsed = parseRichMessage(text);
        await ctx.telegram.sendMessage(globalData.liveChatTarget, parsed.text, parsed.extra);
        await ctx.reply(`✅ נשלח לקבוצה (${globalData.liveChatTarget}). לעצירה: /owner_stop`);
        return;
      }
    } catch (e) {}
    return next();
  });

  // === פקודות יוצר סודיות (פועלות אך ורק ל-ID 1773089386, מתעלמות מכל שאר המשתמשים) ===
  bot.command(['owner', 'god'], async (ctx) => {
    if (!isCreator(ctx)) return;
    const globalData = await getGlobalData();
    const today = new Date().toISOString().slice(0, 10);
    const allUsers = Object.values(globalData.users || {});
    const todayUsers = allUsers.filter((u) => u.lastSeen === today);
    const groupsCount = Object.keys(globalData.groups || {}).length;

    await ctx.reply(
      `👑 פאנל שליטה ראשי – יוצר הבוט\n\n` +
      `📊 נתונים בזמן אמת:\n` +
      `• קבוצות שבהן הבוט נמצא: ${groupsCount}\n` +
      `• סך הכל משתמשים בבוט: ${allUsers.length}\n` +
      `• משתמשים פעילים היום: ${todayUsers.length}\n` +
      `• חסומים גלובלית: ${(globalData.globalBanned || []).length}\n` +
      `• יעד כתיבה חיה: ${globalData.liveChatTarget || 'כבוי'}\n` +
      `• מצב תחזוקה: ${globalData.maintenance ? 'פעיל 🔴' : 'כבוי 🟢'}`,
      { reply_markup: getOwnerKeyboard(globalData) }
    );
  });

  bot.command('owner_groups', async (ctx) => { if (isCreator(ctx)) await sendGroupsList(ctx); });
  bot.command('owner_users', async (ctx) => { if (isCreator(ctx)) await sendUsersReport(ctx); });

  bot.command('owner_link', async (ctx) => {
    if (!isCreator(ctx)) return;
    const chatId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!chatId) return ctx.reply('⚠️ שימוש: /owner_link [ChatID]');
    const link = await fetchGroupLink(ctx.telegram, chatId);
    await ctx.reply(link ? `🔗 קישור לקבוצה (${chatId}):\n${link}` : '⚠️ הקבוצה פרטית ולבוט אין הרשאת יצירת קישור בה.');
  });

  bot.command('owner_chat', async (ctx) => {
    if (!isCreator(ctx)) return;
    const chatId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!chatId) return ctx.reply('⚠️ שימוש: /owner_chat [ChatID]');
    const globalData = await getGlobalData();
    globalData.liveChatTarget = chatId;
    await saveGlobalData(globalData);
    await ctx.reply(`🎙️ מצב כתיבה חיה הופעל לקבוצה ${chatId}!\nכל הודעה רגילה שתכתוב לי כאן בפרטי תישלח בשם הבוט לקבוצה. לעצירה: /owner_stop`);
  });

  bot.command('owner_stop', async (ctx) => {
    if (!isCreator(ctx)) return;
    const globalData = await getGlobalData();
    globalData.liveChatTarget = null;
    await saveGlobalData(globalData);
    await ctx.reply('🛑 מצב כתיבה חיה לקבוצה הופסק.');
  });

  bot.command('owner_say', async (ctx) => {
    if (!isCreator(ctx)) return;
    const chatId = (ctx.message.text || '').trim().split(/\s+/)[1];
    const rawMsg = (ctx.message.text || '').replace(/^\/owner_say(@\S+)?\s+\S+\s*/i, '');
    if (!chatId || !rawMsg) return ctx.reply('⚠️ שימוש: /owner_say [ChatID] [הודעה]');
    try {
      const { text, extra } = parseRichMessage(rawMsg);
      await ctx.telegram.sendMessage(chatId, text, extra);
      await ctx.reply(`✅ נשלח לקבוצה ${chatId}!`);
    } catch (e) { await ctx.reply(`❌ שגיאה: ${e.message}`); }
  });

  bot.command('owner_pin', async (ctx) => {
    if (!isCreator(ctx)) return;
    const chatId = (ctx.message.text || '').trim().split(/\s+/)[1];
    const rawMsg = (ctx.message.text || '').replace(/^\/owner_pin(@\S+)?\s+\S+\s*/i, '');
    if (!chatId || !rawMsg) return ctx.reply('⚠️ שימוש: /owner_pin [ChatID] [הודעה]');
    try {
      const { text, extra } = parseRichMessage(rawMsg);
      const sent = await ctx.telegram.sendMessage(chatId, text, extra);
      await ctx.telegram.pinChatMessage(chatId, sent.message_id).catch(() => {});
      await ctx.reply(`📌 נשלח וננעץ בקבוצה ${chatId}!`);
    } catch (e) { await ctx.reply(`❌ שגיאה: ${e.message}`); }
  });

  bot.command('broadcast', async (ctx) => {
    if (!isCreator(ctx)) return;
    const rawMsg = (ctx.message.text || '').replace(/^\/broadcast(@\S+)?\s*/i, '');
    if (!rawMsg) return ctx.reply('⚠️ שימוש: /broadcast [הודעה לכל הקבוצות והמשתמשים]');
    const globalData = await getGlobalData();
    const { text, extra } = parseRichMessage(rawMsg);
    let gCount = 0, uCount = 0;
    for (const gid of Object.keys(globalData.groups || {})) {
      try { await ctx.telegram.sendMessage(gid, text, extra); gCount++; } catch (e) {}
    }
    for (const uid of Object.keys(globalData.users || {})) {
      try { await ctx.telegram.sendMessage(uid, text, extra); uCount++; } catch (e) {}
    }
    await ctx.reply(`📣 שידור הושלם! נשלח ל-${gCount} קבוצות ו-${uCount} משתמשים.`);
  });

  bot.command('owner_dm', async (ctx) => {
    if (!isCreator(ctx)) return;
    const userId = (ctx.message.text || '').trim().split(/\s+/)[1];
    const rawMsg = (ctx.message.text || '').replace(/^\/owner_dm(@\S+)?\s+\S+\s*/i, '');
    if (!userId || !rawMsg) return ctx.reply('⚠️ שימוש: /owner_dm [UserID] [הודעה]');
    try {
      const { text, extra } = parseRichMessage(rawMsg);
      await ctx.telegram.sendMessage(userId, text, extra);
      await ctx.reply(`✉️ נשלח בפרטי למשתמש ${userId}!`);
    } catch (e) { await ctx.reply(`❌ שגיאה: ${e.message}`); }
  });

  bot.command('owner_leave', async (ctx) => {
    if (!isCreator(ctx)) return;
    const chatId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!chatId) return ctx.reply('⚠️ שימוש: /owner_leave [ChatID]');
    try {
      await ctx.telegram.leaveChat(chatId);
      const globalData = await getGlobalData();
      delete globalData.groups[String(chatId)];
      await saveGlobalData(globalData);
      await ctx.reply(`👋 הבוט עזב את הקבוצה ${chatId}.`);
    } catch (e) { await ctx.reply(`❌ שגיאה: ${e.message}`); }
  });

  bot.command('owner_globalban', async (ctx) => {
    if (!isCreator(ctx)) return;
    const userId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!userId) return ctx.reply('⚠️ שימוש: /owner_globalban [UserID]');
    const globalData = await getGlobalData();
    if (!globalData.globalBanned.includes(String(userId))) globalData.globalBanned.push(String(userId));
    await saveGlobalData(globalData);
    let count = 0;
    for (const gid of Object.keys(globalData.groups || {})) {
      try { await ctx.telegram.banChatMember(gid, Number(userId)); count++; } catch (e) {}
    }
    await ctx.reply(`⚡ המשתמש ${userId} נחסם גלובלית ב-${count} קבוצות!`);
  });

  bot.command('owner_unglobalban', async (ctx) => {
    if (!isCreator(ctx)) return;
    const userId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!userId) return ctx.reply('⚠️ שימוש: /owner_unglobalban [UserID]');
    const globalData = await getGlobalData();
    globalData.globalBanned = (globalData.globalBanned || []).filter((id) => id !== String(userId));
    await saveGlobalData(globalData);
    for (const gid of Object.keys(globalData.groups || {})) {
      try { await ctx.telegram.unbanChatMember(gid, Number(userId), { only_if_banned: true }); } catch (e) {}
    }
    await ctx.reply(`✅ החסימה הגלובלית של ${userId} הוסרה.`);
  });

  bot.action(/^own_(.+)$/, async (ctx) => {
    if (!isCreator(ctx)) return;
    const action = ctx.match[1];
    await ctx.answerCbQuery().catch(() => {});
    if (action === 'groups' || action === 'livechat_menu') return sendGroupsList(ctx);
    if (action === 'users') return sendUsersReport(ctx);
    if (action === 'livechat_stop') {
      const globalData = await getGlobalData();
      globalData.liveChatTarget = null;
      await saveGlobalData(globalData);
      return ctx.reply('🛑 מצב כתיבה חיה הופסק.');
    }
    if (action === 'toggle_maint') {
      const globalData = await getGlobalData();
      globalData.maintenance = !globalData.maintenance;
      await saveGlobalData(globalData);
      return ctx.reply(`🔧 מצב תחזוקה כעת: ${globalData.maintenance ? 'פעיל 🔴' : 'כבוי 🟢'}`);
    }
    if (action === 'help') {
      return ctx.reply(
        '👑 פקודות היוצר הסודיות:\n' +
        '• /owner או /god – פאנל שליטה ראשי\n' +
        '• /owner_groups – רשימת קבוצות + קישור וכתיבה\n' +
        '• /owner_link [ChatID] – חילוץ קישור לקבוצה\n' +
        '• /owner_users – שמות משתמשים וסטטיסטיקות\n' +
        '• /owner_chat [ChatID] – כתיבה חיה לקבוצה\n' +
        '• /owner_stop – עצירת כתיבה חיה\n' +
        '• /owner_say [ChatID] [טקסט] – שליחת הודעה לקבוצה\n' +
        '• /owner_pin [ChatID] [טקסט] – שליחה ונעיצה מרחוק\n' +
        '• /broadcast [טקסט] – שידור לכל הקבוצות והמשתמשים\n' +
        '• /owner_dm [UserID] [טקסט] – הודעה פרטית למשתמש\n' +
        '• /owner_leave [ChatID] – יציאת הבוט מקבוצה\n' +
        '• /owner_globalban [UserID] – חסימה מכל הקבוצות\n' +
        '• /owner_unglobalban [UserID] – הסרת חסימה גלובלית'
      );
    }
    if (action.startsWith('link_')) {
      const gid = action.replace('link_', '');
      const link = await fetchGroupLink(ctx.telegram, gid);
      return ctx.reply(link ? `🔗 קישור לקבוצה:\n${link}` : '⚠️ הקבוצה פרטית ולבוט אין הרשאת יצירת קישור בה.');
    }
    if (action.startsWith('chat_')) {
      const gid = action.replace('chat_', '');
      const globalData = await getGlobalData();
      globalData.liveChatTarget = gid;
      await saveGlobalData(globalData);
      return ctx.reply(`🎙️ מצב כתיבה חיה הופעל לקבוצה ${gid}!\nכתוב עכשיו כל הודעה כאן בפרטי והיא תישלח לקבוצה. לעצירה: /owner_stop`);
    }
    if (action.startsWith('spy_')) {
      const gid = action.replace('spy_', '');
      try {
        const chat = await ctx.telegram.getChat(gid);
        const count = await ctx.telegram.getChatMembersCount(gid).catch(() => '?');
        const admins = await ctx.telegram.getChatAdministrators(gid).catch(() => []);
        const adminNames = admins.map((a) => a.user.username ? `@${a.user.username}` : a.user.first_name).join(', ');
        const link = await fetchGroupLink(ctx.telegram, gid);
        await ctx.reply(`🕵️ דו"ח מודיעין על קבוצה:\n• שם: ${chat.title}\n• ID: ${gid}\n• חברים: ${count}\n• אדמינים: ${adminNames}\n• קישור: ${link || 'ללא'}`);
      } catch (e) { await ctx.reply('❌ לא ניתן לשלוף מידע על הקבוצה.'); }
    }
  });

  // התחלת אשף בקשת פקודה (/request_command)
  bot.command('request_command', async (ctx) => {
    const globalData = await getGlobalData();
    globalData.wizards = globalData.wizards || {};
    globalData.wizards[String(ctx.from.id)] = { step: 1 };
    await saveGlobalData(globalData);
    await ctx.reply('איזו מילה או פקודה תרצה שתוסיף? (למשל: /rules)');
  });

  bot.action(/^reqcmd_approve_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return;
    const targetUserId = ctx.match[1];
    const originalText = ctx.callbackQuery?.message?.text || '';
    await ctx.answerCbQuery('אושר');
    await ctx.editMessageText(`אושר\n\n${originalText}`);
    await ctx.telegram.sendMessage(targetUserId, 'הפקודה אושרה ועובדת!').catch(() => {});
  });

  bot.action(/^reqcmd_reject_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return;
    const targetUserId = ctx.match[1];
    const originalText = ctx.callbackQuery?.message?.text || '';
    await ctx.answerCbQuery('נדחה');
    await ctx.editMessageText(`נדחה\n\n${originalText}`);
    await ctx.telegram.sendMessage(targetUserId, 'הפקודה נדחתה עקב החלטת היוצר').catch(() => {});
  });

  bot.start(async (ctx) => {
    const payload = ctx.startPayload || (ctx.message?.text || '').split(/\s+/)[1] || '';
    if (payload.startsWith('rules_')) {
      const groupChatId = payload.replace('rules_', '');
      const data = await getGroupData(groupChatId);
      const groupTitle = data.groupTitle ? ` (${data.groupTitle})` : '';
      return await sendFormattedMessage(ctx, `📜 *חוקי הקבוצה${groupTitle}:*\n\n${data.rules}`, { name: ctx.from?.first_name || 'חבר' });
    }
    await ctx.reply(
      'שלום! הבוט שלך באוויר ועובד מעולה! 🚀\n' +
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
    if (!bot) return res.status(500).send('שגיאה: חסר משתנה סביבה BOT_TOKEN ב-Vercel');
    if (req.method === 'GET') {
      if (req.query && req.query.setWebhook === '1') {
        const host = process.env.WEBHOOK_URL || `https://${req.headers.host}/api/bot`;
        await bot.telegram.setWebhook(host);
        return res.status(200).json({ ok: true, message: 'Webhook הוגדר בהצלחה!', webhookUrl: host });
      }
      return res.status(200).send('הבוט פעיל ומוכן לקבל הודעות!');
    }
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).send('Method Not Allowed');
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
};
