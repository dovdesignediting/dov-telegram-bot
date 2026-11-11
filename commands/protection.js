const {
  getGroupData,
  saveGroupData,
  sendFormattedMessage,
  requireAdmin,
  floodTracker
} = require('./utils');

// שליחת הודעת ברוכים הבאים עם כפתור מובנה לחוקי הקבוצה בפרטי
async function sendWelcomeWithRulesBtn(ctx, rawText, memberName) {
  const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
  const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
  const cleanText = String(rawText || 'ברוך הבא לקבוצה, *{name}*! נשמח שתקרא את חוקי הקבוצה.').replace(/\s*\(\/rules\)/g, '');
  const fullText = cleanText.includes('start=rules_')
    ? cleanText
    : `${cleanText}\n{{📖 לחץ כאן לצפייה בחוקי הקבוצה}{${rulesUrl}}}`;
  return await sendFormattedMessage(ctx, fullText, { name: memberName || 'חבר' });
}

// בניית תצוגת פאנל המילים האסורות עם כפתורי עריכה ומחיקה לכל מילה
function buildFiltersPanel(filters) {
  if (!Array.isArray(filters) || !filters.length) {
    return {
      text: '📋 אין כרגע מילים חסומות בקבוצה.\nלהוספת מילה שלח: `/filter [מילה]`',
      reply_markup: { inline_keyboard: [] }
    };
  }
  const rows = [];
  filters.slice(0, 20).forEach((w, i) => {
    const shortW = w.length > 12 ? `${w.slice(0, 12)}…` : w;
    rows.push([
      { text: `✏️ ערוך: ${shortW}`, callback_data: `flt_edit_${i}` },
      { text: `🗑️ מחק: ${shortW}`, callback_data: `flt_del_${i}` }
    ]);
  });
  rows.push([{ text: '🧹 מחק את כל המילים האסורות', callback_data: 'flt_clear_all' }]);

  const text =
    `🚫 *ניהול מילים חסומות בקבוצה (${filters.length}):*\n` +
    filters.map((w, i) => `${i + 1}. \`${w}\``).join('\n') +
    `\n\n💡 *בחר מילה למטה לעריכה או מחיקה בלחיצה:*`;

  return { text, reply_markup: { inline_keyboard: rows } };
}

async function isGroupAdminCallback(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from) return false;
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return m && ['creator', 'administrator'].includes(m.status);
  } catch (e) {
    return false;
  }
}

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

  // 21. /filter [מילה] - הוספת/הסרת מילת פילטר אסורה
  bot.command('filter', async (ctx) => {
    if (!(await requireAdmin(ctx, '/filter [מילה או ביטוי לחסימה]'))) return;
    try {
      const word = (ctx.message.text || '').trim().split(/\s+/).slice(1).join(' ').toLowerCase();
      if (!word) {
        return ctx.reply(
          '⚠️ *ניהול מילים אסורות:*\n' +
          '• להוספת מילה: `/filter [מילה]`\n' +
          '• לעריכה ומחיקה בכפתורים: `/filters`\n' +
          '• לעריכה מהירה: `/editfilter [ישנה] [חדשה]`\n' +
          '• למחיקה מהירה: `/unfilter [מילה]`',
          { parse_mode: 'Markdown' }
        );
      }
      const data = await getGroupData(ctx.chat.id);
      data.filters = Array.isArray(data.filters) ? data.filters : [];
      const idx = data.filters.indexOf(word);
      if (idx >= 0) {
        data.filters.splice(idx, 1);
        await saveGroupData(ctx.chat.id, data);
        return ctx.reply(`✅ המילה "${word}" הוסרה מרשימת הפילטרים.`);
      }
      data.filters.push(word);
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(
        `🚫 המילה "${word}" נוספה לרשימת הפילטרים ותימחק אוטומטית.\nלעריכה או מחיקה של מילים שלח \`/filters\``,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון פילטר. לעזרה: /help');
    }
  });

  // מחיקת מילה אסורה ספציפית בפקודה: /unfilter או /delfilter
  bot.command(['unfilter', 'delfilter'], async (ctx) => {
    if (!(await requireAdmin(ctx, '/unfilter [מילה להסרה]'))) return;
    try {
      const word = (ctx.message.text || '').trim().split(/\s+/).slice(1).join(' ').toLowerCase();
      if (!word) return ctx.reply('⚠️ שימוש: `/unfilter [מילה]` למחיקת מילה מהפילטר (או שלח `/filters` למחיקה בכפתורים).', { parse_mode: 'Markdown' });
      const data = await getGroupData(ctx.chat.id);
      data.filters = Array.isArray(data.filters) ? data.filters : [];
      const idx = data.filters.indexOf(word);
      if (idx === -1) return ctx.reply(`⚠️ המילה "${word}" לא נמצאה ברשימת הפילטרים.`);
      data.filters.splice(idx, 1);
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`🗑️ המילה "${word}" נמחקה מרשימת הפילטרים.`);
    } catch (err) {
      await ctx.reply('❌ שגיאה במחיקת מילה מהפילטר.');
    }
  });

  // עריכת מילה אסורה בפקודה: /editfilter [מילה ישנה] [מילה חדשה]
  bot.command('editfilter', async (ctx) => {
    if (!(await requireAdmin(ctx, '/editfilter [מילה ישנה] [מילה חדשה]'))) return;
    try {
      const args = (ctx.message.text || '').trim().split(/\s+/).slice(1);
      if (args.length < 2) {
        return ctx.reply('⚠️ שימוש: `/editfilter [מילה ישנה] [מילה חדשה]`\n(או שלח `/filters` ולחץ על כפתור *✏️ ערוך* ליד המילה).', { parse_mode: 'Markdown' });
      }
      const oldWord = args[0].toLowerCase();
      const newWord = args.slice(1).join(' ').toLowerCase();
      const data = await getGroupData(ctx.chat.id);
      data.filters = Array.isArray(data.filters) ? data.filters : [];
      const idx = data.filters.indexOf(oldWord);
      if (idx === -1) return ctx.reply(`⚠️ המילה "${oldWord}" לא נמצאה ברשימת הפילטרים.`);
      data.filters[idx] = newWord;
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`✏️ הפילטר עודכן בהצלחה מ-"${oldWord}" ל-"${newWord}"!`);
    } catch (err) {
      await ctx.reply('❌ שגיאה בעריכת הפילטר.');
    }
  });

  // מחיקת כל המילים האסורות בבת אחת: /clearfilters
  bot.command('clearfilters', async (ctx) => {
    if (!(await requireAdmin(ctx, '/clearfilters'))) return;
    try {
      const data = await getGroupData(ctx.chat.id);
      data.filters = [];
      delete data.editingFilter;
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply('🧹 כל המילים החסומות בקבוצה נמחקו.');
    } catch (err) {
      await ctx.reply('❌ שגיאה באיפוס הפילטרים.');
    }
  });

  // 22. /filters - פאנל אינטראקטיבי לעריכה ומחיקה של מילים חסומות
  bot.command('filters', async (ctx) => {
    if (!(await requireAdmin(ctx, '/filters'))) return;
    try {
      const data = await getGroupData(ctx.chat.id);
      data.filters = Array.isArray(data.filters) ? data.filters : [];
      const panel = buildFiltersPanel(data.filters);
      await ctx.reply(panel.text, {
        parse_mode: 'Markdown',
        reply_markup: panel.reply_markup
      });
    } catch (err) {
      await ctx.reply('❌ שגיאה בשליפת הפילטרים. לעזרה: /help');
    }
  });

  // כפתורי מחיקה ועריכה מתוך פאנל /filters
  bot.action(/^flt_del_(\d+)$/, async (ctx) => {
    if (!(await isGroupAdminCallback(ctx))) {
      return ctx.answerCbQuery('⛔ פעולה זו מיועדת לאדמינים בלבד.', { show_alert: true }).catch(() => {});
    }
    const idx = parseInt(ctx.match[1], 10);
    const data = await getGroupData(ctx.chat.id);
    data.filters = Array.isArray(data.filters) ? data.filters : [];
    if (idx < 0 || idx >= data.filters.length) {
      return ctx.answerCbQuery('המילה כבר הוסרה').catch(() => {});
    }
    const removed = data.filters.splice(idx, 1)[0];
    delete data.editingFilter;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery(`🗑️ "${removed}" נמחקה`).catch(() => {});
    const panel = buildFiltersPanel(data.filters);
    await ctx.editMessageText(panel.text, {
      parse_mode: 'Markdown',
      reply_markup: panel.reply_markup
    }).catch(() => {});
  });
  bot.action(/^flt_edit_(\d+)$/, async (ctx) => {
    if (!(await isGroupAdminCallback(ctx))) {
      return ctx.answerCbQuery('⛔ פעולה זו מיועדת לאדמינים בלבד.', { show_alert: true }).catch(() => {});
    }
    const idx = parseInt(ctx.match[1], 10);
    const data = await getGroupData(ctx.chat.id);
    data.filters = Array.isArray(data.filters) ? data.filters : [];
    if (idx < 0 || idx >= data.filters.length) {
      return ctx.answerCbQuery('המילה לא נמצאה').catch(() => {});
    }
    const oldWord = data.filters[idx];
    data.editingFilter = { adminId: ctx.from.id, index: idx, oldWord };
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery().catch(() => {});
    await ctx.editMessageText(
      `✏️ *עריכת מילה אסורה:* \`${oldWord}\`\n\nכתוב עכשיו בצ׳אט את המילה החדשה שתחליף אותה:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ ביטול וחזרה לרשימה', callback_data: 'flt_cancel_edit' }]]
        }
      }
    ).catch(() => {});
  });

  bot.action('flt_cancel_edit', async (ctx) => {
    if (!(await isGroupAdminCallback(ctx))) {
      return ctx.answerCbQuery('⛔ פעולה זו מיועדת לאדמינים בלבד.', { show_alert: true }).catch(() => {});
    }
    const data = await getGroupData(ctx.chat.id);
    delete data.editingFilter;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('בוטל').catch(() => {});
    const panel = buildFiltersPanel(data.filters || []);
    await ctx.editMessageText(panel.text, {
      parse_mode: 'Markdown',
      reply_markup: panel.reply_markup
    }).catch(() => {});
  });

  bot.action('flt_clear_all', async (ctx) => {
    if (!(await isGroupAdminCallback(ctx))) {
      return ctx.answerCbQuery('⛔ פעולה זו מיועדת לאדמינים בלבד.', { show_alert: true }).catch(() => {});
    }
    const data = await getGroupData(ctx.chat.id);
    data.filters = [];
    delete data.editingFilter;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('🧹 כל המילים נמחקו').catch(() => {});
    await ctx.editMessageText('🧹 כל המילים החסומות בקבוצה נמחקו בהצלחה.').catch(() => {});
  });

  // 23. /welcome on/off + /setwelcome [טקסט עשיר עם כפתור מובנה לחוקי הקבוצה]
  bot.command('welcome', async (ctx) => {
    if (!(await requireAdmin(ctx, '/welcome [on | off]'))) return;
    try {
      const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
      const data = await getGroupData(ctx.chat.id);
      if (!['on', 'off'].includes(arg)) {
        await ctx.reply('👋 תצוגה מקדימה של הודעת הברוכים הבאים הנוכחית:');
        return await sendWelcomeWithRulesBtn(ctx, data.welcomeText, ctx.from.first_name || 'חבר');
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
          '⚠️ שימוש: `/setwelcome ברוך הבא *{name}*!`\n(כפתור לחוקי הקבוצה מתווסף אוטומטית מתחת להודעה).\nלמדריך עיצוב מלא שלח `/format`',
          { parse_mode: 'Markdown' }
        );
      }
      const preview = await sendWelcomeWithRulesBtn(ctx, text, ctx.from.first_name || 'חבר');
      if (!preview) return;
      const data = await getGroupData(ctx.chat.id);
      data.welcomeText = text;
      data.groupTitle = ctx.chat.title || data.groupTitle || '';
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply('✅ הודעת ברוכים הבאים נשמרה בהצלחה! (מעל מופיעה תצוגה מקדימה עם כפתור החוקים)');
    } catch (err) {
      await ctx.reply('❌ שגיאה בשמירת נוסח ברוכים הבאים. לעזרה: /help');
    }
  });

  // אכיפה אוטומטית + ניקוי הודעות שירות + ברוכים הבאים עם כפתור חוקים + פקודות מותאמות
  bot.on('message', async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from) return next();
    try {
      const data = await getGroupData(ctx.chat.id);
      const msg = ctx.message;

      if (ctx.chat.title && data.groupTitle !== ctx.chat.title) {
        data.groupTitle = ctx.chat.title;
      }

      const isService = Boolean(
        msg.new_chat_members || msg.left_chat_member || msg.pinned_message ||
        msg.new_chat_title || msg.new_chat_photo || msg.delete_chat_photo ||
        msg.group_chat_created || msg.supergroup_chat_created ||
        msg.video_chat_started || msg.video_chat_ended || msg.video_chat_participants_invited
      );

      // אם מופעל אימות מצטרפים (/verify) או מצב חירום (/raidmode) – לא שולחים הודעה שנייה נפרדת (הודעת הברוכים הבאים מאוחדת להודעת האימות!)
      const verifyOrRaidActive = Boolean(data.adv && (data.adv.verifyEnabled || data.adv.raidUntil > Date.now()));
      if (msg.new_chat_members && data.welcomeEnabled && !verifyOrRaidActive) {
        for (const member of msg.new_chat_members) {
          if (!member.is_bot) {
            await sendWelcomeWithRulesBtn(ctx, data.welcomeText, member.first_name || 'חבר');
          }
        }
      }

      if (isService && data.cleanService) {
        await saveGroupData(ctx.chat.id, data);
        await ctx.deleteMessage().catch(() => {});
        return;
      }

      const rawText = (msg.text || '').trim();

      // אם אדמין לחץ על "✏️ ערוך" בפאנל /filters וכותב עכשיו את המילה החדשה
      if (data.editingFilter && Number(data.editingFilter.adminId) === Number(ctx.from.id) && rawText && !rawText.startsWith('/')) {
        const { index, oldWord } = data.editingFilter;
        const newWord = rawText.toLowerCase();
        data.filters = Array.isArray(data.filters) ? data.filters : [];
        if (index >= 0 && index < data.filters.length) {
          data.filters[index] = newWord;
        } else {
          const fallbackIdx = data.filters.indexOf(oldWord);
          if (fallbackIdx >= 0) data.filters[fallbackIdx] = newWord;
          else data.filters.push(newWord);
        }
        delete data.editingFilter;
        await saveGroupData(ctx.chat.id, data);
        const panel = buildFiltersPanel(data.filters);
        return await ctx.reply(`✅ המילה האסורה עודכנה מ-"${oldWord}" ל-"${newWord}"!\n\n${panel.text}`, {
          parse_mode: 'Markdown',
          reply_markup: panel.reply_markup
        });
      }

      data.stats.messages = (data.stats.messages || 0) + 1;
      await saveGroupData(ctx.chat.id, data);

      if (rawText.startsWith('/')) {
        const cmdName = rawText.split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
        if (data.customCommands && data.customCommands[cmdName]) {
          await sendFormattedMessage(ctx, data.customCommands[cmdName], { name: ctx.from.first_name || 'חבר' });
          return;
        }
      }

      const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id).catch(() => null);
      if (member && ['creator', 'administrator'].includes(member.status)) return next();

      const text = (msg.text || msg.caption || '').toLowerCase();
      const hasLink = /(https?:\/\/|t\.me\/|www\.)/i.test(text);
      const hasMedia = Boolean(msg.photo || msg.video || msg.document);

      if ((data.antilink || data.locks.links) && hasLink) {
        await ctx.deleteMessage().catch(() => {});
        return ctx.reply(`🚫 ${ctx.from.first_name}, שליחת קישורים אסורה בקבוצה זו.`);
      }
      if (data.locks.media && hasMedia) return ctx.deleteMessage().catch(() => {});
      if (data.locks.stickers && msg.sticker) return ctx.deleteMessage().catch(() => {});
      if (data.antispam && (text.length > 800 || msg.forward_date)) return ctx.deleteMessage().catch(() => {});
      if (Array.isArray(data.filters) && data.filters.some((w) => w && text.includes(w.toLowerCase()))) {
        return ctx.deleteMessage().catch(() => {});
      }

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
