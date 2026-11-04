const {
  getGroupData,
  saveGroupData,
  requireAdmin,
  getTarget,
  parseDurationSeconds
} = require('./utils');

module.exports = function registerUsersCommands(bot) {
  // 1. /ban - חסימה לצמיתות + סיבה
  bot.command('ban', async (ctx) => {
    if (!(await requireAdmin(ctx, '/ban [בהשבה להודעה] [סיבה]'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ חובה להשיב (Reply) להודעת המשתמש או לציין ID.\nדוגמה: `/ban מציף בקבוצה`\nשלח /help לעזרה.', { parse_mode: 'Markdown' });
      const reason = target.args.join(' ') || 'ללא פירוט סיבה';
      await ctx.telegram.banChatMember(ctx.chat.id, target.id);
      const data = await getGroupData(ctx.chat.id);
      data.stats.bans = (data.stats.bans || 0) + 1;
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`🔨 המשתמש ${target.name} נחסם לצמיתות.\n📝 סיבה: ${reason}`);
    } catch (err) {
      await ctx.reply(`❌ הפקודה נכשלה (${err.description || err.message}). ודא שלבוט יש הרשאת חסימת משתמשים. לעזרה: /help`);
    }
  });

  // 2. /unban - הסרת חסימה
  bot.command('unban', async (ctx) => {
    if (!(await requireAdmin(ctx, '/unban [בהשבה או ID משתמש]'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ שימוש: השב להודעת המשתמש או כתוב `/unban [UserID]`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      await ctx.telegram.unbanChatMember(ctx.chat.id, target.id, { only_if_banned: true });
      await ctx.reply(`✅ החסימה של ${target.name} הוסרה בהצלחה.`);
    } catch (err) {
      await ctx.reply(`❌ הסרת החסימה נכשלה: ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 3. /kick - הוצאה מהקבוצה (ללא חסימה לצמיתות)
  bot.command('kick', async (ctx) => {
    if (!(await requireAdmin(ctx, '/kick [בהשבה להודעה]'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ שימוש: השב להודעת המשתמש שברצונך להוציא וכתוב `/kick`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      await ctx.telegram.banChatMember(ctx.chat.id, target.id);
      await ctx.telegram.unbanChatMember(ctx.chat.id, target.id);
      await ctx.reply(`👢 המשתמש ${target.name} הוצא מהקבוצה (יוכל להצטרף שוב עם קישור).`);
    } catch (err) {
      await ctx.reply(`❌ ההוצאה נכשלה: ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 4. /mute [זמן] - השתקה זמנית
  bot.command('mute', async (ctx) => {
    if (!(await requireAdmin(ctx, '/mute [זמן: 10m / 1h / 1d] (בהשבה להודעה)'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ שימוש: השב להודעת המשתמש וכתוב `/mute 1h` (או `15m`, `1d`).\nלעזרה: /help', { parse_mode: 'Markdown' });
      const timeArg = target.args[0] || '1h';
      const seconds = parseDurationSeconds(timeArg);
      if (!seconds) return ctx.reply('⚠️ פורמט זמן לא תקין. דוגמאות: `10m`, `2h`, `1d`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      const untilDate = Math.floor(Date.now() / 1000) + seconds;
      await ctx.telegram.restrictChatMember(ctx.chat.id, target.id, {
        until_date: untilDate,
        permissions: { can_send_messages: false }
      });
      await ctx.reply(`🔇 המשתמש ${target.name} הושתק למשך ${timeArg}.`);
    } catch (err) {
      await ctx.reply(`❌ ההשתקה נכשלה: ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 5. /unmute - הסרת השתקה
  bot.command('unmute', async (ctx) => {
    if (!(await requireAdmin(ctx, '/unmute [בהשבה להודעה]'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ שימוש: השב להודעת המשתמש וכתוב `/unmute`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      await ctx.telegram.restrictChatMember(ctx.chat.id, target.id, {
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        }
      });
      await ctx.reply(`🔊 ההשתקה של ${target.name} הוסרה.`);
    } catch (err) {
      await ctx.reply(`❌ הסרת ההשתקה נכשלה: ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 6. /warn - מתן אזהרה למשתמש (חסימה אוטומטית ב-3 אזהרות)
  bot.command('warn', async (ctx) => {
    if (!(await requireAdmin(ctx, '/warn [בהשבה להודעה] [סיבה]'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ שימוש: השב להודעת המשתמש וכתוב `/warn [סיבה]`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      const reason = target.args.join(' ') || 'הפרת כללי הקבוצה';
      const data = await getGroupData(ctx.chat.id);
      const userWarns = data.warns[target.id] || [];
      userWarns.push({ reason, date: new Date().toISOString().slice(0, 10) });
      data.warns[target.id] = userWarns;
      data.stats.warnsCount = (data.stats.warnsCount || 0) + 1;
      await saveGroupData(ctx.chat.id, data);

      if (userWarns.length >= 3) {
        await ctx.telegram.banChatMember(ctx.chat.id, target.id);
        await ctx.reply(`🚨 ${target.name} צבר 3/3 אזהרות ונחסם מהקבוצה!\nסיבה אחרונה: ${reason}`);
      } else {
        await ctx.reply(`⚠️ אזהרה ל-${target.name} (${userWarns.length}/3)\n📝 סיבה: ${reason}`);
      }
    } catch (err) {
      await ctx.reply(`❌ מתן האזהרה נכשל: ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 7. /warnings - בדיקת אזהרות של משתמש
  bot.command('warnings', async (ctx) => {
    if (!(await requireAdmin(ctx, '/warnings [בהשבה להודעה]'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ שימוש: השב להודעת המשתמש וכתוב `/warnings`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      const data = await getGroupData(ctx.chat.id);
      const list = data.warns[target.id] || [];
      if (!list.length) return ctx.reply(`✅ למשתמש ${target.name} אין אזהרות פעילות (0/3).`);
      const formatted = list.map((w, i) => `${i + 1}. ${w.reason} (${w.date})`).join('\n');
      await ctx.reply(`📋 אזהרות עבור ${target.name} (${list.length}/3):\n${formatted}`);
    } catch (err) {
      await ctx.reply(`❌ בדיקת האזהרות נכשלה. לעזרה: /help`);
    }
  });

  // 8. /clearwarns - איפוס אזהרות
  bot.command('clearwarns', async (ctx) => {
    if (!(await requireAdmin(ctx, '/clearwarns [בהשבה להודעה]'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ שימוש: השב להודעת המשתמש וכתוב `/clearwarns`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      const data = await getGroupData(ctx.chat.id);
      delete data.warns[target.id];
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`🧹 כל האזהרות של ${target.name} אופסו בהצלחה!`);
    } catch (err) {
      await ctx.reply(`❌ איפוס האזהרות נכשל. לעזרה: /help`);
    }
  });

  // 9. /promote - קידום לאדמין
  bot.command('promote', async (ctx) => {
    if (!(await requireAdmin(ctx, '/promote [בהשבה להודעה]'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ שימוש: השב להודעת המשתמש שברצונך לקדם וכתוב `/promote`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      await ctx.telegram.promoteChatMember(ctx.chat.id, target.id, {
        can_delete_messages: true,
        can_restrict_members: true,
        can_pin_messages: true,
        can_invite_users: true,
        can_manage_chat: true
      });
      await ctx.reply(`⭐ המשתמש ${target.name} קודם לתפקיד אדמין בקבוצה!`);
    } catch (err) {
      await ctx.reply(`❌ הקידום נכשל (${err.description || err.message}). ודא שלבוט יש הרשאת הוספת אדמינים. לעזרה: /help`);
    }
  });

  // 10. /demote - הורדה מניהול
  bot.command('demote', async (ctx) => {
    if (!(await requireAdmin(ctx, '/demote [בהשבה להודעה]'))) return;
    try {
      const target = getTarget(ctx);
      if (!target) return ctx.reply('⚠️ שימוש: השב להודעת האדמין שברצונך להוריד מניהול וכתוב `/demote`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      await ctx.telegram.promoteChatMember(ctx.chat.id, target.id, {
        can_delete_messages: false,
        can_restrict_members: false,
        can_pin_messages: false,
        can_invite_users: false,
        can_manage_chat: false
      });
      await ctx.reply(`📉 המשתמש ${target.name} הורד מתפקיד אדמין.`);
    } catch (err) {
      await ctx.reply(`❌ ההורדה מניהול נכשלה: ${err.description || err.message}. לעזרה: /help`);
    }
  });
};
