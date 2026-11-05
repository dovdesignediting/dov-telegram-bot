const {
  FORMAT_GUIDE,
  getGroupData,
  sendFormattedMessage,
  requireAdmin
} = require('./utils');

const HELP_CATEGORIES = {
  users:
    '👮 *קטגוריה 1: ניהול משתמשים (10 פקודות)*\n' +
    '• `/ban [סיבה]` – חסימה לצמיתות (בהשבה)\n' +
    '• `/unban [ID]` – הסרת חסימה\n' +
    '• `/kick` – הוצאה מהקבוצה (בהשבה)\n' +
    '• `/mute [10m/1h/1d]` – השתקה זמנית\n' +
    '• `/unmute` – הסרת השתקה\n' +
    '• `/warn [סיבה]` – אזהרה (3 = חסימה)\n' +
    '• `/warnings` – בדיקת אזהרות משתמש\n' +
    '• `/clearwarns` – איפוס אזהרות\n' +
    '• `/promote` – קידום לאדמין\n' +
    '• `/demote` – הורדה מניהול',
  content:
    '🧹 *קטגוריה 2: ניהול תוכן וניקוי*\n' +
    '• `/del` או `/purge [מספר]` – מחיקת הודעות\n' +
    '• `/cleanservice on/off` – מחיקה אוטומטית של הודעות שירות (הצטרפות/עזיבה/נעיצה)\n' +
    '• `/pin` – נעיצת הודעה (בהשבה)\n' +
    '• `/unpin` – הסרת נעיצה\n' +
    '• `/unpinall` – הסרת כל הנעוצים\n' +
    '• `/slowmode [שניות]` – מצב איטי\n' +
    '• `/lock [links/media/stickers/all]` – נעילת תוכן\n' +
    '• `/unlock [links/media/stickers/all]` – פתיחת נעילה',
  protection:
    '🛡️ *קטגוריה 3: אוטומציה והגנה (6 פקודות)*\n' +
    '• `/antispam on/off` – אנטי ספאם אוטומטי\n' +
    '• `/antilink on/off` – חסימת לינקים\n' +
    '• `/antiflood [מספר]` – הגנה מהצפה\n' +
    '• `/filter [מילה]` – הוספת/הסרת מילה אסורה\n' +
    '• `/filters` – רשימת כל הפילטרים\n' +
    '• `/welcome on/off` + `/setwelcome` – הודעת פתיחה',
  info:
    'ℹ️ *קטגוריה 4: מידע, חוקים ופקודות מותאמות*\n' +
    '• `/rules` + `/setrules [טקסט]` – חוקי הקבוצה\n' +
    '• `/addcmd [שם] [תוכן]` – יצירת פקודה מותאמת\n' +
    '• `/delcmd [שם]` ו-`/cmds` – ניהול פקודות מותאמות\n' +
    '• `/admins` – תיוג כל האדמינים\n' +
    '• `/id` או `/userinfo` – מידע על משתמש\n' +
    '• `/stats` – סטטיסטיקות קבוצה',
  system:
    '⚙️ *קטגוריה 5: מערכת, עיצוב וכפתורים*\n' +
    '• `/help` – תפריט עזרה אינטראקטיבי\n' +
    '• `/echo [טקסט]` – בדיקת עיצוב וכפתורים בצ׳אט פרטי\n' +
    '• `/format` – מדריך עיצוב הודעות, קישורים וכפתורים\n' +
    '• `/report` – דיווח לאדמינים (בהשבה)\n' +
    '• `/settings` – פאנל הגדרות קבוצה'
};

function getHelpKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '👮 ניהול משתמשים (10)', callback_data: 'help_users' },
        { text: '🧹 תוכן וניקוי (8)', callback_data: 'help_content' }
      ],
      [
        { text: '🛡️ אוטומציה והגנה (6)', callback_data: 'help_protection' },
        { text: 'ℹ️ מידע ופקודות (4+)', callback_data: 'help_info' }
      ],
      [
        { text: '⚙️ מערכת ועיצוב', callback_data: 'help_system' },
        { text: '🎨 מדריך כפתורים ועיצוב', callback_data: 'help_format' }
      ]
    ]
  };
}

module.exports = function registerSystemCommands(bot) {
  // 28. /help - תפריט עזרה מסודר עם כפתורים (Inline Keyboard)
  bot.command('help', async (ctx) => {
    try {
      await ctx.reply(
        '📚 *תפריט עזרה – ניהול קבוצה ועיצוב הודעות*\nבחר קטגוריה מהכפתורים למטה כדי לראות את כל הפקודות וההסברים:',
        { parse_mode: 'Markdown', reply_markup: getHelpKeyboard() }
      );
    } catch (err) {
      await ctx.reply('❌ שגיאה בפתיחת תפריט העזרה.');
    }
  });

  bot.action(/^help_(.+)$/, async (ctx) => {
    try {
      const cat = ctx.match[1];
      const text = cat === 'format' ? FORMAT_GUIDE : (HELP_CATEGORIES[cat] || 'בחר קטגוריה:');
      await ctx.answerCbQuery();
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: getHelpKeyboard()
      });
    } catch (e) {}
  });

  // /format - הצגת מדריך העיצוב והכפתורים של MonitorGroupbot
  bot.command('format', async (ctx) => {
    await ctx.reply(FORMAT_GUIDE, { parse_mode: 'Markdown' });
  });

  // /echo - שליחת הודעה מעוצבת עם כפתורים (בצ'אט פרטי עם הבוט או בקבוצה לאדמין)
  bot.command('echo', async (ctx) => {
    if (ctx.chat && ctx.chat.type !== 'private') {
      if (!(await requireAdmin(ctx, '/echo [טקסט מעוצב + כפתורים]'))) return;
    }
    const raw = (ctx.message.text || '').replace(/^\/echo(@\S+)?\s*/i, '');
    if (!raw) {
      return ctx.reply(
        '⚠️ *שימוש בפקודה /echo:*\nשלח `/echo` ואחריו טקסט מעוצב עם כפתורים, למשל:\n\n' +
        '`/echo *ברוכים הבאים!*\n_שורה נטויה_ ו-[קישור בטקסט](https://google.com)\n{{כפתור לערוץ}{https://t.me/telegram}}`',
        { parse_mode: 'Markdown' }
      );
    }
    await sendFormattedMessage(ctx, raw, { name: ctx.from?.first_name || 'חבר' });
  });

  // 29. /report - דיווח לאדמינים על הודעה
  bot.command('report', async (ctx) => {
    if (!(await requireAdmin(ctx, '/report [בהשבה להודעה בעייתית]'))) return;
    try {
      const reply = ctx.message.reply_to_message;
      if (!reply) return ctx.reply('⚠️ שימוש: השב (Reply) להודעה שעליה תרצה לדווח וכתוב `/report`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
      const tags = admins
        .filter((a) => !a.user.is_bot)
        .map((a) => (a.user.username ? `@${a.user.username}` : a.user.first_name))
        .join(' ');
      await ctx.reply(`🚨 דווח לאדמינים ע"י ${ctx.from.first_name} על הודעת ${reply.from?.first_name || 'משתמש'}:\n${tags}`);
    } catch (err) {
      await ctx.reply('❌ שליחת הדיווח נכשלה. לעזרה: /help');
    }
  });

  // 30. /settings - פאנל הגדרות קבוצה
  bot.command('settings', async (ctx) => {
    if (!(await requireAdmin(ctx, '/settings'))) return;
    try {
      const data = await getGroupData(ctx.chat.id);
      const status = (v) => (v ? '✅ פעיל' : '❌ כבוי');
      await ctx.reply(
        `⚙️ *פאנל הגדרות קבוצה – ${ctx.chat.title || ''}*\n\n` +
        `• ניקוי הודעות שירות: ${status(data.cleanService)}\n` +
        `• אנטי-ספאם: ${status(data.antispam)}\n` +
        `• חסימת לינקים: ${status(data.antilink)}\n` +
        `• הגנת הצפה (Anti-Flood): ${data.antiflood || 'כבוי'}\n` +
        `• הודעת ברוכים הבאים: ${status(data.welcomeEnabled)}\n` +
        `• נעילת קישורים: ${status(data.locks.links)}\n` +
        `• נעילת מדיה: ${status(data.locks.media)}\n` +
        `• נעילת סטיקרים: ${status(data.locks.stickers)}\n` +
        `• פילטרים מוגדרים: ${data.filters.length} מילים\n` +
        `• פקודות מותאמות אישית: ${Object.keys(data.customCommands || {}).length}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '📚 מדריך פקודות ועיצוב (/help)', callback_data: 'help_format' }]]
          }
        }
      );
    } catch (err) {
      await ctx.reply('❌ שגיאה בטעינת פאנל ההגדרות. לעזרה: /help');
    }
  });
};
