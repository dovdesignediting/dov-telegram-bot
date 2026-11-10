const {
  FORMAT_GUIDE,
  getGroupData,
  sendFormattedMessage,
  requireAdmin
} = require('./utils');

// מספר הגרסה הנוכחי של הבוט – מתעדכן בכל שדרוג/תיקון/פיתוח
const BOT_VERSION = '1.0.5.0v';

// פירוט השיפורים הגלוי למשתמשים בלבד (ללא שום אזכור לפקודות היוצר!)
const CHANGELOG_TEXT =
  `🚀 *עדכון ${BOT_VERSION}*\n\n` +
  `✨ *מה חדש בעדכון זה:*\n` +
  `• שדרוג כל תפריטי העזרה לכפתורים אינטראקטיביים לכל פקודה.\n` +
  `• לחיצה על כל פקודה בתפריט פותחת תת-תפריט עם הסבר מפורט ודוגמה מוכנה להעתקה בלחיצה.\n` +
  `• הוספת כפתורי ניווט "🔙 חזרה" ו-"🏠 חזרה לתפריט הראשי" בכל הקטגוריות ותתי-התפריטים.`;

const MAIN_MENU_TEXT =
  `שלום! 👋\n` +
  `אני בוט מתקדם לניהול והגנה על קבוצות.\n` +
  `🔖 *גרסה נוכחית:* עדכון ${BOT_VERSION}\n\n` +
  `📚 *תפריט הפקודות הראשי – בחר קטגוריה מהכפתורים למטה:*`;

// הגדרת הקטגוריות וכל הפקודות בתוכן ככפתורים (תתי-תפריטים)
const MENU_DATA = {
  users: {
    title: `👮 *קטגוריה 1: ניהול משתמשים* (עדכון ${BOT_VERSION})\nבחר פקודה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'ban', label: '🚫 חסימה (/ban)', info: '🚫 *חסימת משתמש לצמיתות*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/ban`\nאו עם סיבה:\n`/ban פרסום ספאם`' },
      { id: 'unban', label: '✅ הסרת חסימה (/unban)', info: '✅ *הסרת חסימה ממשתמש*\n• *שימוש:* השב להודעה שלו או שלח עם ה-ID שלו:\n`/unban 123456789`' },
      { id: 'kick', label: '👢 הוצאה (/kick)', info: '👢 *הוצאת משתמש מהקבוצה (ללא חסימה)*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/kick`' },
      { id: 'mute', label: '🔇 השתקה (/mute)', info: '🔇 *השתקת משתמש זמנית*\n• *שימוש:* השב להודעת המשתמש וכתוב זמן (`m`=דקות, `h`=שעות, `d`=ימים):\n`/mute 10m`\n`/mute 2h`\n`/mute 1d`' },
      { id: 'unmute', label: '🔊 ביטול השתקה (/unmute)', info: '🔊 *הסרת השתקה ממשתמש*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/unmute`' },
      { id: 'warn', label: '⚠️ אזהרה (/warn)', info: '⚠️ *מתן אזהרה למשתמש (ב-3 אזהרות נחסם אוטומטית)*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/warn שפה לא נאותה`' },
      { id: 'warnings', label: '📋 בדיקת אזהרות (/warnings)', info: '📋 *בדיקת כמות אזהרות של משתמש*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/warnings`' },
      { id: 'clearwarns', label: '🧼 איפוס אזהרות (/clearwarns)', info: '🧼 *מחיקת כל האזהרות של משתמש*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/clearwarns`' },
      { id: 'promote', label: '⭐ קידום לאדמין (/promote)', info: '⭐ *קידום חבר קבוצה לניהול*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/promote`' },
      { id: 'demote', label: '⬇️ הורדה מניהול (/demote)', info: '⬇️ *הסרת הרשאות ניהול מאדמין*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/demote`' }
    ]
  },
  content: {
    title: `🧹 *קטגוריה 2: תוכן וניקוי* (עדכון ${BOT_VERSION})\nבחר פקודה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'del', label: '🗑️ מחיקת הודעה (/del)', info: '🗑️ *מחיקת הודעה בודדת*\n• *שימוש:* השב להודעה שתרצה למחוק וכתוב:\n`/del`' },
      { id: 'purge', label: '🧹 מחיקה מרובה (/purge)', info: '🧹 *מחיקת מספר הודעות אחרונות בבת אחת*\n• *שימוש:* כתוב מספר הודעות למחיקה (עד 100):\n`/purge 20`' },
      { id: 'cleanservice', label: '🧼 ניקוי הודעות שירות', info: '🧼 *מחיקה אוטומטית של הודעות "הצטרף/עזב את הקבוצה"*\n• *להפעלה:* `/cleanservice on`\n• *לכיבוי:* `/cleanservice off`' },
      { id: 'pin', label: '📌 נעיצת הודעה (/pin)', info: '📌 *נעיצת הודעה בראש הקבוצה*\n• *שימוש:* השב להודעה שתרצה לנעוץ וכתוב:\n`/pin`' },
      { id: 'unpin', label: '📍 הסרת נעיצה (/unpin)', info: '📍 *הסרת נעיצה מהודעה*\n• *שימוש:* השב להודעה נעוצה או שלח:\n`/unpin`' },
      { id: 'unpinall', label: '🗃️ הסרת כל הנעוצים', info: '🗃️ *ביטול נעיצה של כל ההודעות הנעוצות בקבוצה*\n• *שימוש:* שלח בקבוצה:\n`/unpinall`' },
      { id: 'slowmode', label: '🐢 מצב איטי (/slowmode)', info: '🐢 *הגבלת קצב שליחת הודעות בקבוצה*\n• *שימוש:* ציין שניות (או `0` לביטול):\n`/slowmode 30`\n`/slowmode 0`' },
      { id: 'lock', label: '🔒 נעילת תוכן (/lock)', info: '🔒 *חסימת שליחת סוגי תוכן בקבוצה*\n• *אפשרויות:*\n`/lock links` – נעילת קישורים\n`/lock media` – נעילת תמונות וסרטונים\n`/lock stickers` – נעילת סטיקרים\n`/lock all` – נעילת כל הקבוצה' },
      { id: 'unlock', label: '🔓 פתיחת נעילה (/unlock)', info: '🔓 *שחרור נעילת תוכן בקבוצה*\n• *אפשרויות:*\n`/unlock links`\n`/unlock media`\n`/unlock stickers`\n`/unlock all`' }
    ]
  },
  protection: {
    title: `🛡️ *קטגוריה 3: אוטומציה והגנה* (עדכון ${BOT_VERSION})\nבחר פקודה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'antispam', label: '🛡️ אנטי-ספאם (/antispam)', info: '🛡️ *סינון אוטומטי של הודעות ספאם והצפות*\n• *להפעלה:* `/antispam on`\n• *לכיבוי:* `/antispam off`' },
      { id: 'antilink', label: '🔗 חסימת לינקים (/antilink)', info: '🔗 *מחיקה אוטומטית של קישורים ממשתמשים רגילים*\n• *להפעלה:* `/antilink on`\n• *לכיבוי:* `/antilink off`' },
      { id: 'antiflood', label: '🌊 הגנת הצפה (/antiflood)', info: '🌊 *חסימת משתמשים שמציפים הודעות ברצף*\n• *שימוש:* ציין מקסימום הודעות ב-10 שניות (או `off` לכיבוי):\n`/antiflood 5`\n`/antiflood off`' },
      { id: 'filter', label: '🚫 מילים אסורות (/filter)', info: '🚫 *הוספה או הסרה של מילה אסורה למחיקה אוטומטית*\n• *שימוש:*\n`/filter מילה`' },
      { id: 'filters', label: '📜 רשימת פילטרים (/filters)', info: '📜 *הצגת כל המילים החסומות כרגע בקבוצה*\n• *שימוש:*\n`/filters`' },
      { id: 'welcome', label: '👋 הפעלת ברוכים הבאים', info: '👋 *הפעלה או כיבוי של הודעת הצטרפות לחברים חדשים*\n• *להפעלה:* `/welcome on`\n• *לכיבוי:* `/welcome off`' },
      { id: 'setwelcome', label: '✏️ עריכת ברוכים הבאים', info: '✏️ *קביעת נוסח הודעת הפתיחה (כולל כפתור חוקים אוטומטי)*\n• *שימוש:*\n`/setwelcome ברוך הבא {name} לקבוצה שלנו!`' }
    ]
  },
  info: {
    title: `ℹ️ *קטגוריה 4: מידע, חוקים ופקודות* (עדכון ${BOT_VERSION})\nבחר פקודה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'rules', label: '📖 צפייה בחוקים (/rules)', info: '📖 *הצגת כפתור לצפייה בחוקי הקבוצה בצ׳אט פרטי*\n• *שימוש:*\n`/rules`' },
      { id: 'setrules', label: '📝 הגדרת חוקים (/setrules)', info: '📝 *עדכון חוקי הקבוצה (לאדמינים)*\n• *שימוש:*\n`/setrules 1. לשמור על כבוד הדדי\n2. אין לשלוח ספאם`' },
      { id: 'addcmd', label: '➕ הוספת פקודה (/addcmd)', info: '➕ *יצירת פקודה מותאמת אישית לקבוצה*\n• *שימוש:*\n`/addcmd שעות הפעילות שלנו היא 09:00-18:00`' },
      { id: 'delcmd', label: '➖ מחיקת פקודה (/delcmd)', info: '➖ *מחיקת פקודה מותאמת אישית*\n• *שימוש:*\n`/delcmd שעות`' },
      { id: 'cmds', label: '📂 רשימת פקודות (/cmds)', info: '📂 *הצגת כל הפקודות המותאמות של הקבוצה*\n• *שימוש:*\n`/cmds`' },
      { id: 'admins', label: '👑 רשימת אדמינים (/admins)', info: '👑 *הצגת ותיוג מנהלי הקבוצה*\n• *שימוש:*\n`/admins`' },
      { id: 'userinfo', label: '🆔 מידע על משתמש (/id)', info: '🆔 *הצגת מזהה (ID) ופרטים על משתמש או קבוצה*\n• *שימוש:* שלח `/id` או השב להודעה עם `/userinfo`' },
      { id: 'stats', label: '📊 סטטיסטיקות (/stats)', info: '📊 *הצגת נתוני הקבוצה ומספר החברים*\n• *שימוש:*\n`/stats`' }
    ]
  },
  system: {
    title: `⚙️ *קטגוריה 5: מערכת ועיצוב* (עדכון ${BOT_VERSION})\nבחר פקודה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'settings', label: '⚙️ הגדרות קבוצה (/settings)', info: '⚙️ *פאנל מצב כל ההגנות והנעילות בקבוצה*\n• *שימוש:*\n`/settings`' },
      { id: 'echo', label: '📢 בדיקת עיצוב (/echo)', info: '📢 *בדיקת הודעה מעוצבת עם כפתורים*\n• *שימוש:*\n`/echo *כותרת מודגשת*\n{{כפתור לדוגמה}{https://t.me/telegram}}`' },
      { id: 'format', label: '🎨 מדריך עיצוב (/format)', info: '🎨 *מדריך מלא להדגשה, קישורים ויצירת כפתורים*\n• *שימוש:*\n`/format`' },
      { id: 'report', label: '🚨 דיווח לאדמינים (/report)', info: '🚨 *דיווח מהיר לכל מנהלי הקבוצה על הודעה בעייתית*\n• *שימוש:* השב להודעה וכתוב:\n`/report`' },
      { id: 'suggest', label: '💡 הצעה לשיפור', info: '💡 *שליחת הצעה לשיפור או בקשת פקודה חדשה*\n• לחץ על הכפתור *"💡 הצעה לשיפור"* בתפריט הראשי כדי לשלוח הצעה ישירות!' }
    ]
  }
};
function getHelpKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '👮 ניהול משתמשים', callback_data: 'help_users' },
        { text: '🧹 תוכן וניקוי', callback_data: 'help_content' }
      ],
      [
        { text: '🛡️ אוטומציה והגנה', callback_data: 'help_protection' },
        { text: 'ℹ️ מידע ופקודות', callback_data: 'help_info' }
      ],
      [
        { text: '⚙️ מערכת ועיצוב', callback_data: 'help_system' },
        { text: '🎨 מדריך כפתורים ועיצוב', callback_data: 'help_format' }
      ],
      [
        { text: '💡 הצעה לשיפור', callback_data: 'reqcmd_start' },
        { text: `🆕 עדכון ${BOT_VERSION}`, callback_data: 'help_changelog' }
      ]
    ]
  };
}

// בניית מקלדת כפתורים לכל הפקודות בתוך קטגוריה + כפתור "חזרה" ו-"חזרה לתפריט הראשי"
function getCategoryKeyboard(catKey) {
  const cat = MENU_DATA[catKey];
  const rows = [];
  if (cat && Array.isArray(cat.items)) {
    for (let i = 0; i < cat.items.length; i += 2) {
      const row = [
        { text: cat.items[i].label, callback_data: `hcmd_${catKey}_${cat.items[i].id}` }
      ];
      if (cat.items[i + 1]) {
        row.push({ text: cat.items[i + 1].label, callback_data: `hcmd_${catKey}_${cat.items[i + 1].id}` });
      }
      rows.push(row);
    }
  }
  rows.push([
    { text: '🔙 חזרה', callback_data: 'help_main' },
    { text: '🏠 חזרה לתפריט הראשי', callback_data: 'help_main' }
  ]);
  return { inline_keyboard: rows };
}

// בניית מקלדת לתת-תפריט של פקודה ספציפית: "🔙 חזרה" מחזיר לקטגוריה, ו-"🏠 חזרה לתפריט הראשי" מחזיר לראשי!
function getCommandSubMenuKeyboard(catKey) {
  return {
    inline_keyboard: [
      [
        { text: '🔙 חזרה', callback_data: `help_${catKey}` },
        { text: '🏠 חזרה לתפריט הראשי', callback_data: 'help_main' }
      ]
    ]
  };
}

function getBackToMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔙 חזרה', callback_data: 'help_main' },
        { text: '🏠 חזרה לתפריט הראשי', callback_data: 'help_main' }
      ]
    ]
  };
}

function registerSystemCommands(bot) {
  bot.command('help', async (ctx) => {
    try {
      await ctx.reply(MAIN_MENU_TEXT, {
        parse_mode: 'Markdown',
        reply_markup: getHelpKeyboard()
      });
    } catch (err) {
      await ctx.reply('❌ שגיאה בפתיחת תפריט העזרה.');
    }
  });

  // מעבר בין קטגוריות התפריט הראשי
  bot.action(/^help_(.+)$/, async (ctx) => {
    try {
      const cat = ctx.match[1];
      await ctx.answerCbQuery().catch(() => {});

      if (cat === 'main') {
        return await ctx.editMessageText(MAIN_MENU_TEXT, {
          parse_mode: 'Markdown',
          reply_markup: getHelpKeyboard()
        }).catch(() => ctx.reply(MAIN_MENU_TEXT, {
          parse_mode: 'Markdown',
          reply_markup: getHelpKeyboard()
        }));
      }

      if (cat === 'format') {
        return await ctx.editMessageText(FORMAT_GUIDE, {
          parse_mode: 'Markdown',
          reply_markup: getBackToMenuKeyboard()
        }).catch(() => ctx.reply(FORMAT_GUIDE, {
          parse_mode: 'Markdown',
          reply_markup: getBackToMenuKeyboard()
        }));
      }

      if (cat === 'changelog') {
        return await ctx.editMessageText(CHANGELOG_TEXT, {
          parse_mode: 'Markdown',
          reply_markup: getBackToMenuKeyboard()
        }).catch(() => ctx.reply(CHANGELOG_TEXT, {
          parse_mode: 'Markdown',
          reply_markup: getBackToMenuKeyboard()
        }));
      }

      if (MENU_DATA[cat]) {
        const text = MENU_DATA[cat].title;
        const kb = getCategoryKeyboard(cat);
        return await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          reply_markup: kb
        }).catch(() => ctx.reply(text, {
          parse_mode: 'Markdown',
          reply_markup: kb
        }));
      }
    } catch (e) {}
  });

  // לחיצה על כפתור של פקודה בתוך קטגוריה (פותח תת-תפריט עם הסבר + כפתור "חזרה" לקטגוריה וכפתור "חזרה לתפריט הראשי")
  bot.action(/^hcmd_([a-z]+)_([a-z]+)$/, async (ctx) => {
    try {
      const catKey = ctx.match[1];
      const cmdId = ctx.match[2];
      const cat = MENU_DATA[catKey];
      if (!cat) return;
      const item = cat.items.find((x) => x.id === cmdId);
      if (!item) return;

      await ctx.answerCbQuery().catch(() => {});
      const kb = getCommandSubMenuKeyboard(catKey);
      await ctx.editMessageText(item.info, {
        parse_mode: 'Markdown',
        reply_markup: kb
      }).catch(() => ctx.reply(item.info, {
        parse_mode: 'Markdown',
        reply_markup: kb
      }));
    } catch (e) {}
  });

  bot.command('format', async (ctx) => {
    await ctx.reply(FORMAT_GUIDE, { parse_mode: 'Markdown', reply_markup: getBackToMenuKeyboard() });
  });

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

  bot.command('settings', async (ctx) => {
    if (!(await requireAdmin(ctx, '/settings'))) return;
    try {
      const data = await getGroupData(ctx.chat.id);
      const status = (v) => (v ? '✅ פעיל' : '❌ כבוי');
      await ctx.reply(
        `⚙️ *פאנל הגדרות קבוצה – ${ctx.chat.title || ''}*\n` +
        `🔖 *גרסת בוט:* עדכון ${BOT_VERSION}\n\n` +
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
            inline_keyboard: [[{ text: '📚 פתיחת תפריט הפקודות (/help)', callback_data: 'help_main' }]]
          }
        }
      );
    } catch (err) {
      await ctx.reply('❌ שגיאה בטעינת פאנל ההגדרות. לעזרה: /help');
    }
  });
}

registerSystemCommands.BOT_VERSION = BOT_VERSION;
registerSystemCommands.CHANGELOG_TEXT = CHANGELOG_TEXT;
registerSystemCommands.MAIN_MENU_TEXT = MAIN_MENU_TEXT;
registerSystemCommands.getHelpKeyboard = getHelpKeyboard;

module.exports = registerSystemCommands;
