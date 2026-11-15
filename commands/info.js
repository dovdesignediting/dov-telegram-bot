const {
  getGroupData,
  saveGroupData,
  sendFormattedMessage,
  requireAdmin,
  getTarget
} = require('./utils');

// ניקוי אוטומטי של טקסט החוקים מפקודות /setrules כפולות, תווי כיוון נסתרים וכותרות כפולות
function cleanRulesText(raw) {
  let txt = String(raw || '').trim();
  txt = txt.replace(/^[\s\u200B-\u200F\u202A-\u202E\u2060-\u206F]+/, '');
  while (/^\/setrules(@\S+)?(\s|$)/i.test(txt)) {
    txt = txt.replace(/^\/setrules(@\S+)?\s*/i, '').trim();
    txt = txt.replace(/^[\s\u200B-\u200F\u202A-\u202E\u2060-\u206F]+/, '');
  }
  txt = txt.replace(/^📜\s*\*?חוקי הקבוצה[^:\n]*:\*?\s*/i, '').trim();
  while (/^\/setrules(@\S+)?(\s|$)/i.test(txt)) {
    txt = txt.replace(/^\/setrules(@\S+)?\s*/i, '').trim();
  }
  return txt;
}

async function isGroupAdminCb(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from) return false;
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return Boolean(m && ['creator', 'administrator'].includes(m.status));
  } catch (e) {
    return false;
  }
}

module.exports = function registerInfoCommands(bot) {
  // ניקוי אוטומטי של /setrules מתוך הודעות חוקי קבוצה גם בלחיצה על כפתור החוקים בפרטי
  if (bot && bot.telegram && !bot.telegram._rulesCleanWrapped) {
    bot.telegram._rulesCleanWrapped = true;
    const origCall = bot.telegram.callApi.bind(bot.telegram);
    bot.telegram.callApi = async function (method, payload, ...rest) {
      try {
        if ((method === 'sendMessage' || method === 'editMessageText') && payload && typeof payload.text === 'string') {
          if (payload.text.includes('חוקי הקבוצה') && /\/setrules(@\S+)?/i.test(payload.text)) {
            payload.text = payload.text.replace(/\/setrules(@\S+)?\s*/gi, '');
          }
        }
      } catch (e) {}
      return origCall(method, payload, ...rest);
    };
  }

  // 24. /rules + /setrules - הצגת והגדרת חוקי הקבוצה (במצב שקט או פומבי + מחיקה אוטומטית של הודעות ההגדרה)
  bot.command('rules', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') {
      return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
    }
    try {
      const data = await getGroupData(ctx.chat.id);
      const cleaned = cleanRulesText(data.rules);
      if (cleaned !== data.rules) {
        data.rules = cleaned;
        await saveGroupData(ctx.chat.id, data);
      }

      const mode = data.rulesMode || 'public';
      const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
      const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
      const btnText = data.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';

      if (mode === 'silent') {
        await ctx.deleteMessage().catch(() => {});
        return await ctx.reply('📜 *חוקי הקבוצה זמינים לקריאה בפרטי:*', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: btnText, url: rulesUrl }]]
          }
        });
      }

      await sendFormattedMessage(ctx, `📜 *חוקי הקבוצה:*\n\n${cleaned}`, {
        name: ctx.from?.first_name || 'חבר'
      });
    } catch (err) {
      await ctx.reply('❌ שגיאה בהצגת חוקי הקבוצה. לעזרה: /help');
    }
  });

  bot.command('setrules', async (ctx) => {
    if (!(await requireAdmin(ctx, '/setrules [טקסט החוקים + כפתורים]'))) return;
    try {
      const adminMsgId = ctx.message?.message_id;
      const replyMsg = ctx.message?.reply_to_message;
      let rawInput = (ctx.message?.text || '').replace(/^[\s\u200B-\u200F]*\/setrules(@\S+)?\s*/i, '');
      if (!rawInput.trim() && replyMsg && (replyMsg.text || replyMsg.caption)) {
        rawInput = replyMsg.text || replyMsg.caption;
      }

      // בדיקה אם המנהל ציין מראש "שקט" או "פומבי" בתחילת הפקודה
      let explicitMode = null;
      if (/^(שקט|silent)(\s+|\n|$)/i.test(rawInput.trim())) {
        explicitMode = 'silent';
        rawInput = rawInput.trim().replace(/^(שקט|silent)\s*/i, '');
      } else if (/^(פומבי|public)(\s+|\n|$)/i.test(rawInput.trim())) {
        explicitMode = 'public';
        rawInput = rawInput.trim().replace(/^(פומבי|public)\s*/i, '');
      }

      const text = cleanRulesText(rawInput);
      if (!text) {
        return ctx.reply(
          '⚠️ *שימוש בפקודה /setrules:*\n' +
          '`/setrules *חוקי הקבוצה:*\n1. שיח מכבד\n{{לערוץ הראשי}{https://t.me/telegram}}`\n\n' +
          '💡 הבוט ימחק מיד את הודעת ההגדרה ויאפשר לך לבחור בין *מצב שקט* ל*מצב פומבי*.',
          { parse_mode: 'Markdown' }
        );
      }

      // בדיקת תקינות העיצוב ושליחת הודעת בדיקה זמנית שנמחקת מיד
      const preview = await sendFormattedMessage(ctx, text, { name: ctx.from.first_name || 'חבר' });
      if (!preview) return;

      // 1. מחיקה מיידית של הודעת המגדיר ושל הודעת החוקים של הבוט מהקבוצה!
      if (adminMsgId) {
        await ctx.telegram.deleteMessage(ctx.chat.id, adminMsgId).catch(() => {});
      }
      if (preview && preview.message_id) {
        await ctx.telegram.deleteMessage(ctx.chat.id, preview.message_id).catch(() => {});
      }

      const data = await getGroupData(ctx.chat.id);
      data.rules = text;
      data.groupTitle = ctx.chat.title || data.groupTitle || '';
      if (explicitMode) data.rulesMode = explicitMode;
      await saveGroupData(ctx.chat.id, data);

      if (explicitMode === 'silent') {
        const tempMsg = await ctx.reply('🤫 חוקי הקבוצה הוגדרו ונשמרו באופן שקט.');
        setTimeout(() => {
          ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id).catch(() => {});
        }, 3000);
        return;
      }

      if (explicitMode === 'public') {
        const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
        const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
        const btnText = data.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';
        return await ctx.reply('📢 *חוקי הקבוצה עודכנו!* לחצו על הכפתור למטה לקריאת החוקים:', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: btnText, url: rulesUrl }]] }
        });
      }

      // 2. שליחת כפתורי בחירה למנהל: הגדרת החוקים באופן שקט או פומבי
      await ctx.reply(
        '✅ *חוקי הקבוצה נשמרו והודעות הטקסט נמחקו מהצ׳אט!*\n\n' +
        'איך תרצה להגדיר את חוקי הקבוצה כעת?',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🤫 באופן שקט', callback_data: 'setrules_mode_silent' },
                { text: '📢 באופן פומבי', callback_data: 'setrules_mode_public' }
              ]
            ]
          }
        }
      );
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון חוקי הקבוצה. לעזרה: /help');
    }
  });

  bot.action(/^setrules_mode_(silent|public)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) {
      return ctx.answerCbQuery('⛔ פעולה זו מיועדת למנהלי הקבוצה בלבד!', { show_alert: true }).catch(() => {});
    }
    const mode = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    data.rulesMode = mode;
    data.rules = cleanRulesText(data.rules);
    await saveGroupData(ctx.chat.id, data);

    if (mode === 'silent') {
      await ctx.answerCbQuery('🤫 חוקי הקבוצה הוגדרו באופן שקט!').catch(() => {});
      await ctx.deleteMessage().catch(() => {});
      return;
    }

    await ctx.answerCbQuery('📢 חוקי הקבוצה הוגדרו באופן פומבי!').catch(() => {});
    const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
    const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
    const btnText = data.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';
    await ctx.editMessageText(
      '📢 *חוקי הקבוצה עודכנו והוגדרו באופן פומבי!*\nלצפייה בחוקי הקבוצה לחצו על הכפתור למטה או שלחו `/rules`:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: btnText, url: rulesUrl }]]
        }
      }
    ).catch(() => {});
  });

  // פקודות מותאמות אישית לקבוצה (/addcmd, /delcmd, /cmds) עם תמיכה בעיצוב וכפתורים
  bot.command('addcmd', async (ctx) => {
    if (!(await requireAdmin(ctx, '/addcmd [שם פקודה] [תוכן מעוצב + כפתורים]'))) return;
    try {
      const raw = (ctx.message.text || '').replace(/^\/addcmd(@\S+)?\s*/i, '');
      const firstSpace = raw.search(/\s/);
      if (firstSpace === -1) {
        return ctx.reply(
          '⚠️ שימוש: `/addcmd שם_פקודה תוכן ההודעה המעוצבת`\nלדוגמה:\n`/addcmd site *האתר שלנו:*\n{{כניסה לאתר}{https://google.com}}`',
          { parse_mode: 'Markdown' }
        );
      }
      const cmdName = raw.slice(0, firstSpace).replace(/^\//, '').toLowerCase();
      const cmdContent = raw.slice(firstSpace + 1).trim();
      const preview = await sendFormattedMessage(ctx, cmdContent, { name: ctx.from.first_name || 'חבר' });
      if (!preview) return;

      const data = await getGroupData(ctx.chat.id);
      data.customCommands = data.customCommands || {};
      data.customCommands[cmdName] = cmdContent;
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`✅ הפקודה המותאמת \`/${cmdName}\` נשמרה! (מעל מופיעה תצוגה מקדימה)`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ שגיאה בשמירת פקודה מותאמת אישית.');
    }
  });

  bot.command('delcmd', async (ctx) => {
    if (!(await requireAdmin(ctx, '/delcmd [שם פקודה]'))) return;
    const cmdName = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').replace(/^\//, '').toLowerCase();
    if (!cmdName) return ctx.reply('⚠️ שימוש: `/delcmd [שם פקודה]`', { parse_mode: 'Markdown' });
    const data = await getGroupData(ctx.chat.id);
    if (!data.customCommands || !data.customCommands[cmdName]) {
      return ctx.reply(`⚠️ הפקודה \`/${cmdName}\` לא קיימת בקבוצה.`, { parse_mode: 'Markdown' });
    }
    delete data.customCommands[cmdName];
    await saveGroupData(ctx.chat.id, data);
    await ctx.reply(`🗑️ הפקודה המותאמת \`/${cmdName}\` נמחקה.`, { parse_mode: 'Markdown' });
  });

  bot.command('cmds', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
    const data = await getGroupData(ctx.chat.id);
    const keys = Object.keys(data.customCommands || {});
    if (!keys.length) return ctx.reply('📋 אין כרגע פקודות מותאמות אישית בקבוצה. להוספה: `/addcmd`', { parse_mode: 'Markdown' });
    await ctx.reply(`📌 *פקודות מותאמות אישית בקבוצה:*\n• /${keys.join('\n• /')}`, { parse_mode: 'Markdown' });
  });

  // 25. /admins - תיוג והצגת כל האדמינים בקבוצה
  bot.command('admins', async (ctx) => {
    if (!(await requireAdmin(ctx, '/admins'))) return;
    try {
      const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
      const list = admins
        .filter((a) => !a.user.is_bot)
        .map((a) => `${a.status === 'creator' ? '👑 בעלים' : '🛡️ אדמין'}: ${a.user.username ? `@${a.user.username}` : a.user.first_name}`);
      await ctx.reply(`👥 *צוות הניהול של הקבוצה (${list.length}):*\n${list.join('\n')}`);
    } catch (err) {
      await ctx.reply(`❌ שגיאה בשליפת רשימת האדמינים. לעזרה: /help`);
    }
  });

  // 26. /id או /userinfo - מידע על משתמש
  bot.command(['id', 'userinfo'], async (ctx) => {
    if (!(await requireAdmin(ctx, '/userinfo [בהשבה להודעה או ללא פרמטר]'))) return;
    try {
      const target = getTarget(ctx) || {
        id: ctx.from.id,
        name: ctx.from.first_name || 'משתמש',
        username: ctx.from.username ? `@${ctx.from.username}` : 'ללא'
      };
      const member = await ctx.telegram.getChatMember(ctx.chat.id, target.id).catch(() => ({ status: 'לא ידוע' }));
      const data = await getGroupData(ctx.chat.id);
      const warns = (data.warns[target.id] || []).length;
      await ctx.reply(
        `👤 *מידע על משתמש:*\n• שם: ${target.name}\n• מזהה: \`${target.id}\`\n• מעמד: ${member.status}\n• אזהרות: ${warns}/3\n• מזהה קבוצה: \`${ctx.chat.id}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      await ctx.reply('❌ שגיאה בשליפת פרטי משתמש. לעזרה: /help');
    }
  });

  // 27. /stats - סטטיסטיקות קבוצה
  bot.command('stats', async (ctx) => {
    if (!(await requireAdmin(ctx, '/stats'))) return;
    try {
      const count = await ctx.telegram.getChatMembersCount(ctx.chat.id);
      const data = await getGroupData(ctx.chat.id);
      await ctx.reply(
        `📊 *סטטיסטיקות קבוצה:*\n• חברים: ${count}\n• הודעות שנוטרו: ${data.stats.messages || 0}\n• אזהרות: ${data.stats.warnsCount || 0}\n• חסימות: ${data.stats.bans || 0}\n• פילטרים: ${data.filters.length}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      await ctx.reply(`❌ שגיאה בשליפת סטטיסטיקות. לעזרה: /help`);
    }
  });
};
