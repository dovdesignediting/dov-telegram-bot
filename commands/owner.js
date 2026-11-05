const {
  getGlobalData,
  saveGlobalData,
  parseRichMessage
} = require('./utils');

const CREATOR_ID = 1773089386;

// בדיקה שקטה: מחזיר true אך ורק ליוצר הבוט (1773089386)
function isCreator(ctx) {
  return Number(ctx.from?.id) === CREATOR_ID;
}

// חילוץ קישור לקבוצה (ציבורי, קיים, או יצירת קישור הזמנה חדש אם הבוט אדמין)
async function fetchGroupLink(telegram, chatId) {
  try {
    const chat = await telegram.getChat(chatId);
    if (chat.username) return `https://t.me/${chat.username}`;
    if (chat.invite_link) return chat.invite_link;
  } catch (e) {}
  try {
    const created = await telegram.createChatInviteLink(chatId, { name: 'Creator Link' });
    if (created && created.invite_link) return created.invite_link;
  } catch (e) {}
  try {
    const exported = await telegram.exportChatInviteLink(chatId);
    if (exported) return exported;
  } catch (e) {}
  return null;
}

function getOwnerPanelKeyboard(globalData) {
  const maintStatus = globalData.maintenance ? '🟢 כבה מצב תחזוקה' : '🔴 הפעל מצב תחזוקה';
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
        { text: maintStatus, callback_data: 'own_toggle_maint' },
        { text: '📖 מדריך כל פקודות היוצר', callback_data: 'own_help' }
      ]
    ]
  };
}

module.exports = function registerOwnerCommands(bot) {
  // ניטור אוטומטי של כל הקבוצות והמשתמשים + חסימה גלובלית + מצב תחזוקה + כתיבה חיה
  bot.use(async (ctx, next) => {
    try {
      const globalData = await getGlobalData();
      const today = new Date().toISOString().slice(0, 10);
      let changed = false;

      if (ctx.from && !ctx.from.is_bot) {
        const uid = String(ctx.from.id);
        if (globalData.globalBanned.includes(uid) && !isCreator(ctx)) {
          if (ctx.chat && ctx.chat.type !== 'private') {
            await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id).catch(() => {});
          }
          return;
        }
        const prev = globalData.users[uid] || {};
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

      // מצב כתיבה חיה מהפרטי של היוצר לתוך קבוצה נבחרת
      if (
        isCreator(ctx) &&
        ctx.chat?.type === 'private' &&
        globalData.liveChatTarget &&
        ctx.message?.text &&
        !ctx.message.text.startsWith('/')
      ) {
        const { text, extra } = parseRichMessage(ctx.message.text);
        await ctx.telegram.sendMessage(globalData.liveChatTarget, text, extra);
        await ctx.reply(`✅ נשלח לקבוצה (${globalData.liveChatTarget}). לעצירה: /owner_stop`);
        return;
      }
    } catch (e) {}
    return next();
  });

  // 1. /owner או /god - פאנל שליטה ראשי ליוצר בלבד
  bot.command(['owner', 'god'], async (ctx) => {
    if (!isCreator(ctx)) return;
    const globalData = await getGlobalData();
    const today = new Date().toISOString().slice(0, 10);
    const allUsers = Object.values(globalData.users);
    const todayUsers = allUsers.filter((u) => u.lastSeen === today);
    const groupsCount = Object.keys(globalData.groups).length;

    await ctx.reply(
      `👑 *פאנל שליטה ראשי – יוצר הבוט*\n\n` +
      `📊 *נתונים בזמן אמת:*\n` +
      `• קבוצות שבהן הבוט נמצא: *${groupsCount}*\n` +
      `• סך הכל משתמשים בבוט: *${allUsers.length}*\n` +
      `• משתמשים פעילים היום: *${todayUsers.length}*\n` +
      `• חסומים גלובלית: *${globalData.globalBanned.length}*\n` +
      `• יעד כתיבה חיה: *${globalData.liveChatTarget || 'כבוי'}*\n` +
      `• מצב תחזוקה: *${globalData.maintenance ? 'פעיל 🔴' : 'כבוי 🟢'}*`,
      { parse_mode: 'Markdown', reply_markup: getOwnerPanelKeyboard(globalData) }
    );
  });

  // 2. /owner_groups - רשימת הקבוצות שבהן הבוט נמצא + כפתורי שליטה
  bot.command('owner_groups', async (ctx) => {
    if (!isCreator(ctx)) return;
    await sendGroupsList(ctx);
  });

  async function sendGroupsList(ctx) {
    const globalData = await getGlobalData();
    const groups = Object.values(globalData.groups);
    if (!groups.length) {
      return ctx.reply('📭 הבוט עדיין לא רשום באף קבוצה פעילה (ברגע שתישלח הודעה בקבוצה שבה הבוט נמצא היא תופיע כאן אוטומטית).');
    }
    const buttons = [];
    let report = `🏢 *הקבוצות שבהן הבוט נמצא (${groups.length}):*\n\n`;
    for (const g of groups.slice(0, 15)) {
      let count = '?';
      try { count = await ctx.telegram.getChatMembersCount(g.id); } catch (e) {}
      report += `• *${g.title}*\n  🆔 \`${g.id}\` | 👥 חברים: ${count}\n`;
      buttons.push([
        { text: `🔗 קישור: ${g.title.slice(0, 10)}`, callback_data: `own_link_${g.id}` },
        { text: `💬 כתוב לקבוצה`, callback_data: `own_chat_${g.id}` },
        { text: `🕵️ מידע`, callback_data: `own_spy_${g.id}` }
      ]);
    }
    await ctx.reply(report, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // 3. /owner_link [ChatID] - שליפת קישור הזמנה לקבוצה
  bot.command('owner_link', async (ctx) => {
    if (!isCreator(ctx)) return;
    const chatId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!chatId) return ctx.reply('⚠️ שימוש: `/owner_link [ChatID]` (או לחץ על כפתור הקישור ב-`/owner_groups`)', { parse_mode: 'Markdown' });
    const link = await fetchGroupLink(ctx.telegram, chatId);
    if (link) return ctx.reply(`🔗 *קישור לקבוצה (${chatId}):*\n${link}`, { parse_mode: 'Markdown' });
    await ctx.reply('⚠️ לא ניתן לחלץ קישור (הקבוצה פרטית ולבוט אין הרשאת ניהול ליצירת קישור בה, אך תוכל לכתוב בה דרך `/owner_chat`).', { parse_mode: 'Markdown' });
  });

  // 4. /owner_users - רשימת שמות משתמשי הבוט, כמה סה"כ, כמה היום וכמה קבוצות
  bot.command('owner_users', async (ctx) => {
    if (!isCreator(ctx)) return;
    await sendUsersReport(ctx);
  });

  async function sendUsersReport(ctx) {
    const globalData = await getGlobalData();
    const today = new Date().toISOString().slice(0, 10);
    const users = Object.values(globalData.users);
    const todayCount = users.filter((u) => u.lastSeen === today).length;
    const groupsCount = Object.keys(globalData.groups).length;
    const list = users.slice(-40).reverse().map((u, i) =>
      `${i + 1}. ${u.name} (${u.username}) – \`${u.id}\` ${u.lastSeen === today ? '🟢' : ''}`
    ).join('\n');

    await ctx.reply(
      `👥 *דו"ח משתמשי הבוט:*\n` +
      `• סך הכל משתמשים: *${users.length}*\n` +
      `• פעילים היום (${today}): *${todayCount}*\n` +
      `• קבוצות שבהן הבוט נמצא: *${groupsCount}*\n\n` +
      `📋 *רשימת משתמשים (🟢 = פעיל היום):*\n${list || 'אין עדיין'}`,
      { parse_mode: 'Markdown' }
    );
  }

  // 5. /owner_say + /owner_chat + /owner_stop - כתיבה מתוך הבוט לקבוצה
  bot.command('owner_say', async (ctx) => {
    if (!isCreator(ctx)) return;
    const parts = (ctx.message.text || '').trim().split(/\s+/);
    const chatId = parts[1];
    const rawMsg = (ctx.message.text || '').replace(/^\/owner_say(@\S+)?\s+\S+\s*/i, '');
    if (!chatId || !rawMsg) return ctx.reply('⚠️ שימוש: `/owner_say [ChatID] [הודעה מעוצבת + כפתורים]`', { parse_mode: 'Markdown' });
    try {
      const { text, extra } = parseRichMessage(rawMsg);
      await ctx.telegram.sendMessage(chatId, text, extra);
      await ctx.reply(`✅ ההודעה נשלחה בהצלחה לקבוצה \`${chatId}\`!`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply(`❌ שגיאה בשליחה לקבוצה: ${err.description || err.message}`);
    }
  });

  bot.command('owner_chat', async (ctx) => {
    if (!isCreator(ctx)) return;
    const chatId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!chatId) return ctx.reply('⚠️ שימוש: `/owner_chat [ChatID]` (או בחר קבוצה מתוך `/owner`)', { parse_mode: 'Markdown' });
    const globalData = await getGlobalData();
    globalData.liveChatTarget = chatId;
    await saveGlobalData(globalData);
    await ctx.reply(`🎙️ *מצב כתיבה חיה הופעל לקבוצה* \`${chatId}\`!\nמעכשיו כל הודעה רגילה שתכתוב לי כאן בפרטי תישלח אוטומטית בשם הבוט לקבוצה.\nלעצירה שלח: \`/owner_stop\``, { parse_mode: 'Markdown' });
  });

  bot.command('owner_stop', async (ctx) => {
    if (!isCreator(ctx)) return;
    const globalData = await getGlobalData();
    globalData.liveChatTarget = null;
    await saveGlobalData(globalData);
    await ctx.reply('🛑 מצב כתיבה חיה לקבוצה הופסק.');
  });

  // 6. /broadcast [הודעה] - שידור הודעה גלובלי לכל הקבוצות והמשתמשים
  bot.command('broadcast', async (ctx) => {
    if (!isCreator(ctx)) return;
    const rawMsg = (ctx.message.text || '').replace(/^\/broadcast(@\S+)?\s*/i, '');
    if (!rawMsg) return ctx.reply('⚠️ שימוש: `/broadcast [הודעה מעוצבת + כפתורים לשידור לכל הקבוצות והמשתמשים]`', { parse_mode: 'Markdown' });
    const globalData = await getGlobalData();
    const { text, extra } = parseRichMessage(rawMsg);
    let sentGroups = 0;
    let sentUsers = 0;
    for (const gid of Object.keys(globalData.groups)) {
      try { await ctx.telegram.sendMessage(gid, text, extra); sentGroups++; } catch (e) {}
    }
    for (const uid of Object.keys(globalData.users)) {
      try { await ctx.telegram.sendMessage(uid, text, extra); sentUsers++; } catch (e) {}
    }
    await ctx.reply(`📣 *שידור גלובלי הושלם!*\n• נשלח ל-${sentGroups} קבוצות\n• נשלח ל-${sentUsers} משתמשים בפרטי`, { parse_mode: 'Markdown' });
  });

  // 7. /owner_pin [ChatID] [הודעה] - שליחה ונעיצת הודעה מרחוק בראש קבוצה
  bot.command('owner_pin', async (ctx) => {
    if (!isCreator(ctx)) return;
    const parts = (ctx.message.text || '').trim().split(/\s+/);
    const chatId = parts[1];
    const rawMsg = (ctx.message.text || '').replace(/^\/owner_pin(@\S+)?\s+\S+\s*/i, '');
    if (!chatId || !rawMsg) return ctx.reply('⚠️ שימוש: `/owner_pin [ChatID] [הודעה לנעיצה בקבוצה]`', { parse_mode: 'Markdown' });
    try {
      const { text, extra } = parseRichMessage(rawMsg);
      const sent = await ctx.telegram.sendMessage(chatId, text, extra);
      await ctx.telegram.pinChatMessage(chatId, sent.message_id).catch(() => {});
      await ctx.reply(`📌 ההודעה נשלחה וננעצה בקבוצה \`${chatId}\`!`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply(`❌ שגיאה: ${err.description || err.message}`);
    }
  });

  // 8. /owner_leave [ChatID] - פקודה לבוט לעזוב קבוצה מרחוק
  bot.command('owner_leave', async (ctx) => {
    if (!isCreator(ctx)) return;
    const chatId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!chatId) return ctx.reply('⚠️ שימוש: `/owner_leave [ChatID]`', { parse_mode: 'Markdown' });
    try {
      await ctx.telegram.leaveChat(chatId);
      const globalData = await getGlobalData();
      delete globalData.groups[String(chatId)];
      await saveGlobalData(globalData);
      await ctx.reply(`👋 הבוט עזב את הקבוצה \`${chatId}\` בהצלחה.`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply(`❌ שגיאה ביציאה מהקבוצה: ${err.description || err.message}`);
    }
  });

  // 9. /owner_dm [UserID] [הודעה] - שליחת הודעה פרטית מהבוט לכל משתמש
  bot.command('owner_dm', async (ctx) => {
    if (!isCreator(ctx)) return;
    const parts = (ctx.message.text || '').trim().split(/\s+/);
    const userId = parts[1];
    const rawMsg = (ctx.message.text || '').replace(/^\/owner_dm(@\S+)?\s+\S+\s*/i, '');
    if (!userId || !rawMsg) return ctx.reply('⚠️ שימוש: `/owner_dm [UserID] [הודעה]`', { parse_mode: 'Markdown' });
    try {
      const { text, extra } = parseRichMessage(rawMsg);
      await ctx.telegram.sendMessage(userId, text, extra);
      await ctx.reply(`✉️ ההודעה נשלחה בפרטי למשתמש \`${userId}\`!`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply(`❌ לא ניתן לשלוח למשתמש: ${err.description || err.message}`);
    }
  });

  // 10. /owner_globalban ו-/owner_unglobalban - חסימת על מכל הקבוצות
  bot.command('owner_globalban', async (ctx) => {
    if (!isCreator(ctx)) return;
    const userId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!userId) return ctx.reply('⚠️ שימוש: `/owner_globalban [UserID]`', { parse_mode: 'Markdown' });
    const globalData = await getGlobalData();
    if (!globalData.globalBanned.includes(String(userId))) globalData.globalBanned.push(String(userId));
    await saveGlobalData(globalData);
    let bannedIn = 0;
    for (const gid of Object.keys(globalData.groups)) {
      try { await ctx.telegram.banChatMember(gid, Number(userId)); bannedIn++; } catch (e) {}
    }
    await ctx.reply(`⚡ המשתמש \`${userId}\` נחסם גלובלית והורחק מ-${bannedIn} קבוצות!`, { parse_mode: 'Markdown' });
  });

  bot.command('owner_unglobalban', async (ctx) => {
    if (!isCreator(ctx)) return;
    const userId = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!userId) return ctx.reply('⚠️ שימוש: `/owner_unglobalban [UserID]`', { parse_mode: 'Markdown' });
    const globalData = await getGlobalData();
    globalData.globalBanned = globalData.globalBanned.filter((id) => id !== String(userId));
    await saveGlobalData(globalData);
    for (const gid of Object.keys(globalData.groups)) {
      try { await ctx.telegram.unbanChatMember(gid, Number(userId), { only_if_banned: true }); } catch (e) {}
    }
    await ctx.reply(`✅ החסימה הגלובלית של \`${userId}\` הוסרה בכל הקבוצות.`, { parse_mode: 'Markdown' });
  });

  // טיפול בכפתורים של פאנל היוצר
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
      return ctx.reply(`🔧 מצב תחזוקה כעת: *${globalData.maintenance ? 'פעיל 🔴 (הבוט מגיב רק לך)' : 'כבוי 🟢 (פתוח לכולם)'}*`, { parse_mode: 'Markdown' });
    }
    if (action === 'help') {
      return ctx.reply(
        '👑 *כל פקודות היוצר הסודיות (פועלות רק לך):*\n\n' +
        '• `/owner` או `/god` – פאנל שליטה ראשי עם כפתורים\n' +
        '• `/owner_groups` – רשימת הקבוצות + כפתורי קישור, כתיבה ומודיעין\n' +
        '• `/owner_link [ChatID]` – חילוץ קישור הזמנה לקבוצה\n' +
        '• `/owner_users` – שמות משתמשי הבוט, כמה סה"כ, כמה היום וכמה קבוצות\n' +
        '• `/owner_chat [ChatID]` – פתיחת כתיבה חיה מהבוט לתוך קבוצה\n' +
        '• `/owner_stop` – עצירת כתיבה חיה\n' +
        '• `/owner_say [ChatID] [טקסט]` – שליחת הודעה חד-פעמית לקבוצה\n' +
        '• `/owner_pin [ChatID] [טקסט]` – שליחה ונעיצת הודעה מרחוק בקבוצה\n' +
        '• `/broadcast [טקסט]` – שידור הודעה לכל הקבוצות והמשתמשים\n' +
        '• `/owner_dm [UserID] [טקסט]` – שליחת הודעה פרטית למשתמש מהבוט\n' +
        '• `/owner_leave [ChatID]` – פקודה לבוט לעזוב קבוצה\n' +
        '• `/owner_globalban [UserID]` – חסימת משתמש מכל הקבוצות בבת אחת\n' +
        '• `/owner_unglobalban [UserID]` – הסרת חסימה גלובלית',
        { parse_mode: 'Markdown' }
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
      return ctx.reply(`🎙️ *מצב כתיבה חיה הופעל לקבוצה* \`${gid}\`!\nכתוב עכשיו כל הודעה כאן בפרטי והיא תישלח לקבוצה. לעצירה: /owner_stop`, { parse_mode: 'Markdown' });
    }
    if (action.startsWith('spy_')) {
      const gid = action.replace('spy_', '');
      try {
        const chat = await ctx.telegram.getChat(gid);
        const count = await ctx.telegram.getChatMembersCount(gid).catch(() => '?');
        const admins = await ctx.telegram.getChatAdministrators(gid).catch(() => []);
        const adminNames = admins.map((a) => a.user.username ? `@${a.user.username}` : a.user.first_name).join(', ');
        const link = await fetchGroupLink(ctx.telegram, gid);
        await ctx.reply(
          `🕵️ *דו"ח מודיעין על קבוצה:*\n` +
          `• שם: *${chat.title || 'קבוצה'}*\n` +
          `• מזהה: \`${gid}\`\n` +
          `• חברים: ${count}\n` +
          `• אדמינים: ${adminNames || 'לא זמין'}\n` +
          `• קישור: ${link || 'ללא קישור זמין'}`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        await ctx.reply('❌ לא ניתן לשלוף מידע על הקבוצה.');
      }
    }
  });
};
