const { getGroupData, saveGroupData, requireAdmin, getTarget } = require('./utils');

module.exports = function registerInfoCommands(bot) {
  // 24. /rules + /setrules [טקסט] - הצגת והגדרת חוקי הקבוצה
  bot.command('rules', async (ctx) => {
    if (!(await requireAdmin(ctx, '/rules'))) return;
    try {
      const data = await getGroupData(ctx.chat.id);
      await ctx.reply(`📜 **חוקי הקבוצה:**\n\n${data.rules}`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ שגיאה בהצגת חוקי הקבוצה. לעזרה: /help');
    }
  });

  bot.command('setrules', async (ctx) => {
    if (!(await requireAdmin(ctx, '/setrules [טקסט החוקים]'))) return;
    try {
      const text = (ctx.message.text || '').trim().split(/\s+/).slice(1).join(' ');
      if (!text) {
        return ctx.reply('⚠️ שימוש: `/setrules 1. לשמור על שפה נאותה 2. אין לשלוח ספאם`\nלעזרה: /help', { parse_mode: 'Markdown' });
      }
      const data = await getGroupData(ctx.chat.id);
      data.rules = text;
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply('✅ חוקי הקבוצה עודכנו בהצלחה! לצפייה שלח `/rules`.', { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון חוקי הקבוצה. לעזרה: /help');
    }
  });

  // 25. /admins - תיוג והצגת כל האדמינים בקבוצה
  bot.command('admins', async (ctx) => {
    if (!(await requireAdmin(ctx, '/admins'))) return;
    try {
      const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
      const list = admins
        .filter((a) => !a.user.is_bot)
        .map((a) => {
          const role = a.status === 'creator' ? '👑 בעלים' : '🛡️ אדמין';
          const tag = a.user.username ? `@${a.user.username}` : a.user.first_name;
          return `${role}: ${tag}`;
        });
      await ctx.reply(`👥 **צוות הניהול של הקבוצה (${list.length}):**\n${list.join('\n')}`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply(`❌ שגיאה בשליפת רשימת האדמינים: ${err.description || err.message}. לעזרה: /help`);
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
        `👤 **מידע על משתמש:**\n` +
        `• שם: ${target.name}\n` +
        `• מזהה (User ID): \`${target.id}\`\n` +
        `• שם משתמש: ${target.username || 'ללא'}\n` +
        `• מעמד בקבוצה: ${member.status}\n` +
        `• אזהרות: ${warns}/3\n` +
        `• מזהה קבוצה (Chat ID): \`${ctx.chat.id}\``,
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
        `📊 **סטטיסטיקות קבוצה – ${ctx.chat.title || 'הקבוצה'}:**\n` +
        `• מספר חברים: ${count}\n` +
        `• הודעות שנוטרו: ${data.stats.messages || 0}\n` +
        `• סך אזהרות שניתנו: ${data.stats.warnsCount || 0}\n` +
        `• סך חסימות (Bans): ${data.stats.bans || 0}\n` +
        `• פילטרים פעילים: ${data.filters.length}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      await ctx.reply(`❌ שגיאה בשליפת סטטיסטיקות: ${err.description || err.message}. לעזרה: /help`);
    }
  });
};
