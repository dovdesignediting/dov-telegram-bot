const {
  getGroupData,
  saveGroupData,
  sendFormattedMessage,
  requireAdmin,
  getTarget
} = require('./utils');

module.exports = function registerInfoCommands(bot) {
  // 24. /rules - שולח בקבוצה כפתור שמעביר לפרטי של הבוט ומציג שם את חוקי הקבוצה
  bot.command('rules', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') {
      return ctx.reply('⚠️ שלח את הפקודה `/rules` בתוך הקבוצה כדי לקבל כפתור לחוקי הקבוצה.', { parse_mode: 'Markdown' });
    }
    try {
      const data = await getGroupData(ctx.chat.id);
      if (ctx.chat.title && data.groupTitle !== ctx.chat.title) {
        data.groupTitle = ctx.chat.title;
        await saveGroupData(ctx.chat.id, data);
      }

      const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
      const deepLink = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;

      await ctx.reply('📜 *חוקי הקבוצה:*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📖 לחץ כאן לצפייה בחוקי הקבוצה', url: deepLink }]
          ]
        }
      });
    } catch (err) {
      await ctx.reply('❌ שגיאה בהצגת חוקי הקבוצה. לעזרה: /help');
    }
  });

  bot.command('setrules', async (ctx) => {
    if (!(await requireAdmin(ctx, '/setrules [טקסט החוקים + כפתורים]'))) return;
    try {
      const text = (ctx.message.text || '').replace(/^\/setrules(@\S+)?\s*/i, '');
      if (!text) {
        return ctx.reply(
          '⚠️ שימוש: `/setrules *חוקי הקבוצה:*\n1. שיח מכבד\n{{לערוץ הראשי}{https://t.me/telegram}}`\nלמדריך עיצוב וכפתורים שלח `/format`',
          { parse_mode: 'Markdown' }
        );
      }
      const preview = await sendFormattedMessage(ctx, text, { name: ctx.from.first_name || 'חבר' });
      if (!preview) return;
      const data = await getGroupData(ctx.chat.id);
      data.rules = text;
      data.groupTitle = ctx.chat.title || data.groupTitle || '';
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply('✅ חוקי הקבוצה נשמרו בהצלחה! כשמשתמש ישלח `/rules` בקבוצה הוא יקבל כפתור לצפייה בחוקים בפרטי.', { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון חוקי הקבוצה. לעזרה: /help');
    }
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
