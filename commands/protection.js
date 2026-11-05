const {
  getGroupData,
  saveGroupData,
  sendFormattedMessage,
  requireAdmin,
  floodTracker
} = require('./utils');

module.exports = function registerProtectionCommands(bot) {
  // 18. /antispam on/off - אנטי ספאם אוטומטי
  bot.command('antispam', async (ctx) => {
    if (!(await requireAdmin(ctx, '/antispam [on | off]'))) return;
    try {
      const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
      if (!['on', 'off'].includes(arg)) {
        return ctx.reply('⚠️ שימוש: `/antispam on` להפעלה או `/antispam off` לכיבוי.\nלעזרה: /help', { parse_mode: 'Markdown' });
      }
      const data = await getGroupData(ctx.chat.id);
      data.antispam = arg === 'on';
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`🛡️ מנגנון אנטי-ספאם כעת: *${data.antispam ? 'פעיל (ON)' : 'כבוי (OFF)'}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון אנטי-ספאם. לעזרה: /help');
    }
  });

  // 19. /antilink on/off - חסימת לינקים אוטומטית
  bot.command('antilink', async (ctx) => {
    if (!(await requireAdmin(ctx, '/antilink [on | off]'))) return;
    try {
      const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
      if (!['on', 'off'].includes(arg)) {
        return ctx.reply('⚠️ שימוש: `/antilink on` להפעלה או `/antilink off` לכיבוי.\nלעזרה: /help', { parse_mode: 'Markdown' });
      }
      const data = await getGroupData(ctx.chat.id);
      data.antilink = arg === 'on';
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`🔗 חסימת לינקים אוטומטית כעת: *${data.antilink ? 'פעילה (ON)' : 'כבויה (OFF)'}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון חסימת לינקים. לעזרה: /help');
    }
  });

  // 20. /antiflood [מספר] - הגנה מפני הצפה
  bot.command('antiflood', async (ctx) => {
    if (!(await requireAdmin(ctx, '/antiflood [מספר הודעות בדקה, או 0 לכיבוי]'))) return;
    try {
      const limit = parseInt((ctx.message.text || '').trim().split(/\s+/)[1], 10);
      if (isNaN(limit) || limit < 0 || limit > 50) {
        return ctx.reply('⚠️ שימוש: `/antiflood 5` (מספר הודעות מותר ב-15 שניות, או `0` לכיבוי).\nלעזרה: /help', { parse_mode: 'Markdown' });
      }
      const data = await getGroupData(ctx.chat.id);
      data.antiflood = limit;
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(limit === 0 ? '🌊 הגנת הצפה (Anti-Flood) כובתה.' : `🌊 הגנת הצפה הופעלה: מקסימום ${limit} הודעות רצופות.`);
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון Anti-Flood. לעזרה: /help');
    }
  });

  // 21. /filter [מילה] - הוספת מילת פילטר אסורה
  bot.command('filter', async (ctx) => {
    if (!(await requireAdmin(ctx, '/filter [מילה או ביטוי לחסימה]'))) return;
    try {
      const word = (ctx.message.text || '').trim().split(/\s+/).slice(1).join(' ').toLowerCase();
      if (!word) return ctx.reply('⚠️ שימוש: `/filter [מילה אסורה]` להוספה/הסרה מרשימת החסימות.\nלעזרה: /help', { parse_mode: 'Markdown' });
      const data = await getGroupData(ctx.chat.id);
      const idx = data.filters.indexOf(word);
      if (idx >= 0) {
        data.filters.splice(idx, 1);
        await saveGroupData(ctx.chat.id, data);
        return ctx.reply(`✅ המילה "${word}" הוסרה מרשימת הפילטרים.`);
      }
      data.filters.push(word);
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`🚫 המילה "${word}" נוספה לרשימת הפילטרים ותימחק אוטומטית.`);
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון פילטר. לעזרה: /help');
    }
  });

  // 22. /filters - רשימת כל הפילטרים בקבוצה
  bot.command('filters', async (ctx) => {
    if (!(await requireAdmin(ctx, '/filters'))) return;
    try {
      const data = await getGroupData(ctx.chat.id);
      if (!data.filters.length) return ctx.reply('📋 אין כרגע מילים חסומות בקבוצה. להוספה: `/filter [מילה]`', { parse_mode: 'Markdown' });
      await ctx.reply(`🚫 *מילים חסומות בקבוצה (${data.filters.length}):*\n• ${data.filters.join('\n• ')}`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ שגיאה בשליפת הפילטרים. לעזרה: /help');
    }
  });

  // 23. /welcome on/off + /setwelcome [טקסט עשיר עם כפתורים]
  bot.command('welcome', async (ctx) => {
    if (!(await requireAdmin(ctx, '/welcome [on | off]'))) return;
    try {
      const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
      const data = await getGroupData(ctx.chat.id);
      if (!['on', 'off'].includes(arg)) {
        await ctx.reply('👋 תצוגה מקדימה של הודעת הברוכים הבאים הנוכחית:');
        return await sendFormattedMessage(ctx, data.welcomeText, { name: ctx.from.first_name || 'חבר' });
      }
      data.welcomeEnabled = arg === 'on';
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`👋 הודעת ברוכים הבאים כעת: *${data.welcomeEnabled ? 'פעילה (ON)' : 'כבויה (OFF)'}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון הודעת פתיחה. לעזרה: /help');
    }
  });

  bot.command('setwelcome', async (ctx) => {
    if (!(await requireAdmin(ctx, '/setwelcome [טקסט + כפתורים]'))) return;
    try {
      const text = (ctx.message.text || '').replace(/^\/setwelcome(@\S+)?\s*/i, '');
      if (!text) {
        return ctx.reply(
          '⚠️ שימוש: `/setwelcome ברוך הבא *{name}*!\n{{חוקי הקבוצה}{https://t.me/telegram}}`\nלמדריך עיצוב מלא שלח `/format`',
          { parse_mode: 'Markdown' }
        );
      }
      const preview = await sendFormattedMessage(ctx, text, { name: ctx.from.first_name || 'חבר' });
      if (!preview) return;
      const data = await getGroupData(ctx.chat.id);
      data.welcomeText = text;
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply('✅ הודעת ברוכים הבאים נשמרה בהצלחה! (מעל מופיעה תצוגה מקדימה)');
    } catch (err) {
      await ctx.reply('❌ שגיאה בשמירת נוסח ברוכים הבאים. לעזרה: /help');
    }
  });

  // שליחת הודעת ברוכים הבאים מעוצבת עם כפתורים למצטרפים חדשים
  bot.on('new_chat_members', async (ctx) => {
    try {
      const data = await getGroupData(ctx.chat.id);
      if (!data.welcomeEnabled) return;
      for (const member of ctx.message.new_chat_members) {
        if (member.is_bot) continue;
        await sendFormattedMessage(ctx, data.welcomeText, { name: member.first_name || 'חבר' });
      }
    } catch (e) {}
  });

  // אכיפה אוטומטית + הפעלת פקודות מותאמות אישית של הקבוצה
  bot.on('message', async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from) return next();
    try {
      const data = await getGroupData(ctx.chat.id);
      data.stats.messages = (data.stats.messages || 0) + 1;
      await saveGroupData(ctx.chat.id, data);

      const rawText = (ctx.message.text || '').trim();
      if (rawText.startsWith('/')) {
        const cmdName = rawText.split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
        if (data.customCommands && data.customCommands[cmdName]) {
          await sendFormattedMessage(ctx, data.customCommands[cmdName], { name: ctx.from.first_name || 'חבר' });
          return;
        }
      }

      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id).catch(() => null);
      if (member && ['creator', 'administrator'].includes(member.status)) return next();

      const text = (ctx.message.text || ctx.message.caption || '').toLowerCase();
      const hasLink = /(https?:\/\/|t\.me\/|www\.)/i.test(text);
      const hasMedia = Boolean(ctx.message.photo || ctx.message.video || ctx.message.document);
      const hasSticker = Boolean(ctx.message.sticker);

      if ((data.antilink || data.locks.links) && hasLink) {
        await ctx.deleteMessage().catch(() => {});
        return ctx.reply(`🚫 ${ctx.from.first_name}, שליחת קישורים אסורה בקבוצה זו.`);
      }
      if (data.locks.media && hasMedia) return ctx.deleteMessage().catch(() => {});
      if (data.locks.stickers && hasSticker) return ctx.deleteMessage().catch(() => {});
      if (data.antispam && (text.length > 800 || ctx.message.forward_date)) return ctx.deleteMessage().catch(() => {});
      if (data.filters.some((w) => w && text.includes(w))) return ctx.deleteMessage().catch(() => {});

      if (data.antiflood > 0) {
        const key = `${ctx.chat.id}:${ctx.from.id}`;
        const now = Date.now();
        const recent = (floodTracker[key] || []).filter((t) => now - t < 15000);
        recent.push(now);
        floodTracker[key] = recent;
        if (recent.length > data.antiflood) {
          await ctx.deleteMessage().catch(() => {});
          await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.from.id, {
            until_date: Math.floor(now / 1000) + 300,
            permissions: { can_send_messages: false }
          }).catch(() => {});
          return ctx.reply(`🌊 ${ctx.from.first_name} הושתק ל-5 דקות עקב הצפה.`);
        }
      }
    } catch (e) {}
    return next();
  });
};
