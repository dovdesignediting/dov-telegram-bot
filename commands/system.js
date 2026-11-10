const {
  FORMAT_GUIDE,
  getGroupData,
  sendFormattedMessage,
  requireAdmin
} = require('./utils');
const registerAdvancedCommands = require('./advanced');

// מספר הגרסה הנוכחי של הבוט – עדכון ענק עם 20 פקודות ומערכות חדשות!
const BOT_VERSION = '1.1.0.0v';

// פירוט השיפורים הגלוי למשתמשים בלבד (ללא שום אזכור לפקודות היוצר!)
const CHANGELOG_TEXT =
  `🚀 *עדכון ענק ${BOT_VERSION}*\n\n` +
  `✨ *מה חדש בעדכון זה (20 פקודות ומערכות חדשות!):*\n` +
  `• 🛡️ *אבטחה מתקדמת:* מצב חירום אוטומטי נגד מתקפות בוטים, אימות מצטרפים בכפתורים, חסימת שפות זרות, חסימת הודעות מועברות, הגבלת וותק לחדשים, נעילת לילה לפי שעון ישראל ומלכודת דבש לבוטים.\n` +
  `• ⚖️ *ניהול חכם וקהילה:* לחישה סודית בקבוצה (עם ביטול בפרטי), מענה אוטומטי חכם, הצבעת הדחה דמוקרטית, מערכת ערעורים, מכסת הודעות יומית, מחיקת הודעות משתמש, תיוג כולם וגיבוי הגדרות מלא.\n` +
  `• 🎮 *פעילויות ודירוגים:* מערכת הגרלות חיה, טבלת 10 הפעילים ביותר, אתגר המהירות ("הראשון שלוחץ"), דו-קרב קובייה ומדד אמינות משתמש.`;

const MAIN_MENU_TEXT =
  `שלום! 👋\n` +
  `אני בוט מתקדם לניהול והגנה על קבוצות.\n` +
  `🔖 *גרסה נוכחית:* עדכון ${BOT_VERSION}\n\n` +
  `📚 *תפריט הפקודות הראשי – בחר קטגוריה מהכפתורים למטה:*`;

// הגדרת הקטגוריות וכל הפקודות בתוכן ככפתורים בעברית נקייה (ללא שמות פקודות באנגלית על הכפתורים)
const MENU_DATA = {
  users: {
    title: `👮 *קטגוריה 1: ניהול משתמשים* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'ban', label: '🚫 חסימת משתמש', info: '🚫 *חסימת משתמש לצמיתות*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/ban`\nאו עם סיבה:\n`/ban פרסום ספאם`' },
      { id: 'unban', label: '✅ הסרת חסימה', info: '✅ *הסרת חסימה ממשתמש*\n• *שימוש:* השב להודעה שלו או שלח עם ה-ID שלו:\n`/unban 123456789`' },
      { id: 'kick', label: '👢 הוצאה מהקבוצה', info: '👢 *הוצאת משתמש מהקבוצה (ללא חסימה)*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/kick`' },
      { id: 'mute', label: '🔇 השתקת משתמש', info: '🔇 *השתקת משתמש זמנית*\n• *שימוש:* השב להודעת המשתמש וכתוב זמן (`m`=דקות, `h`=שעות, `d`=ימים):\n`/mute 10m`\n`/mute 2h`\n`/mute 1d`' },
      { id: 'unmute', label: '🔊 ביטול השתקה', info: '🔊 *הסרת השתקה ממשתמש*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/unmute`' },
      { id: 'warn', label: '⚠️ מתן אזהרה', info: '⚠️ *מתן אזהרה למשתמש (ב-3 אזהרות נחסם אוטומטית)*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/warn שפה לא נאותה`' },
      { id: 'warnings', label: '📋 בדיקת אזהרות', info: '📋 *בדיקת כמות אזהרות של משתמש*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/warnings`' },
      { id: 'clearwarns', label: '🧼 איפוס אזהרות', info: '🧼 *מחיקת כל האזהרות של משתמש*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/clearwarns`' },
      { id: 'promote', label: '⭐ קידום לאדמין', info: '⭐ *קידום חבר קבוצה לניהול*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/promote`' },
      { id: 'demote', label: '⬇️ הורדה מניהול', info: '⬇️ *הסרת הרשאות ניהול מאדמין*\n• *שימוש:* השב להודעת המשתמש וכתוב:\n`/demote`' },
      { id: 'voteban', label: '⚖️ הצבעת הדחה', info: '⚖️ *הצבעת הדחה דמוקרטית ע"י חברי הקבוצה (כבוי ברירת מחדל)*\n• *הפעלה למנהל (בחירת כמות קולות):* `/voteban 5`\n• *כיבוי למנהל:* `/voteban off`\n• *פתיחת הצבעה (בהשבה):* `/voteban`' },
      { id: 'appeal', label: '📩 מערכת ערעורים', info: '📩 *ערעור על אזהרה או הגבלה (כבוי ברירת מחדל)*\n• *הפעלה/כיבוי למנהל:* `/appeal on` | `/appeal off`\n• *הגשת ערעור:* `/appeal [סיבת הערעור]`' },
      { id: 'msgquota', label: '📊 מכסת הודעות יומית', info: '📊 *הגבלת כמות הודעות יומית למשתמש ספציפי (כבוי ברירת מחדל)*\n• *הפעלה בהשבה להודעת המשתמש:* `/msgquota 15`\n• *ביטול הגבלה למשתמש:* `/msgquota off`' },
      { id: 'trust', label: '🕵️ מדד אמינות משתמש', info: '🕵️ *בדיקת ציון אמינות, וותק, הודעות ואזהרות של משתמש*\n• *שימוש:* השב להודעת המשתמש (או שלח ללא השבה) וכתוב:\n`/trust`' }
    ]
  },
  content: {
    title: `🧹 *קטגוריה 2: תוכן וניקוי* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'del', label: '🗑️ מחיקת הודעה', info: '🗑️ *מחיקת הודעה בודדת*\n• *שימוש:* השב להודעה שתרצה למחוק וכתוב:\n`/del`' },
      { id: 'purge', label: '🧹 מחיקה מרובה', info: '🧹 *מחיקת מספר הודעות אחרונות בבת אחת*\n• *שימוש:* כתוב מספר הודעות למחיקה (עד 100):\n`/purge 20`' },
      { id: 'cleanuser', label: '👤 מחיקת הודעות משתמש', info: '👤 *מחיקת הודעות של משתמש ספציפי (כבוי ברירת מחדל)*\n• *הפעלה/כיבוי למנהל:* `/cleanuser on` | `/cleanuser off`\n• *שימוש (בהשבה למשתמש):* `/cleanuser 15` (מוחק 15 הודעות אחרונות שלו)' },
      { id: 'cleanservice', label: '🧼 ניקוי הודעות שירות', info: '🧼 *מחיקה אוטומטית של הודעות "הצטרף/עזב את הקבוצה"*\n• *להפעלה:* `/cleanservice on`\n• *לכיבוי:* `/cleanservice off`' },
      { id: 'pin', label: '📌 נעיצת הודעה', info: '📌 *נעיצת הודעה בראש הקבוצה*\n• *שימוש:* השב להודעה שתרצה לנעוץ וכתוב:\n`/pin`' },
      { id: 'unpin', label: '📍 הסרת נעיצה', info: '📍 *הסרת נעיצה מהודעה*\n• *שימוש:* השב להודעה נעוצה או שלח:\n`/unpin`' },
      { id: 'unpinall', label: '🗃️ הסרת כל הנעוצים', info: '🗃️ *ביטול נעיצה של כל ההודעות הנעוצות בקבוצה*\n• *שימוש:* שלח בקבוצה:\n`/unpinall`' },
      { id: 'slowmode', label: '🐢 מצב איטי', info: '🐢 *הגבלת קצב שליחת הודעות בקבוצה*\n• *שימוש:* ציין שניות (או `0` לביטול):\n`/slowmode 30`\n`/slowmode 0`' },
      { id: 'lock', label: '🔒 נעילת תוכן', info: '🔒 *חסימת שליחת סוגי תוכן בקבוצה*\n• *אפשרויות:*\n`/lock links` – נעילת קישורים\n`/lock media` – נעילת תמונות וסרטונים\n`/lock stickers` – נעילת סטיקרים\n`/lock all` – נעילת כל הקבוצה' },
      { id: 'unlock', label: '🔓 פתיחת נעילה', info: '🔓 *שחרור נעילת תוכן בקבוצה*\n• *אפשרויות:*\n`/unlock links`\n`/unlock media`\n`/unlock stickers`\n`/unlock all`' }
    ]
  },
  protection: {
    title: `🛡️ *קטגוריה 3: אוטומציה והגנה* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'raidmode', label: '🚨 מצב חירום מתקפות', info: '🚨 *מצב חירום נגד מתקפת בוטים (ידני + זיהוי אוטומטי)*\n• *הפעלה ידנית ל-30 דקות:* `/raidmode on`\n• *כיבוי:* `/raidmode off`\n• *זיהוי אוטומטי של מתקפת בוטים:* `/raidmode auto`' },
      { id: 'verify', label: '🔐 אימות מצטרפים', info: '🔐 *אימות אנושי בכפתורים למצטרפים חדשים*\n• *פתיחת פאנל בחירת זמן:* `/verify`\n• *ללא הגבלת זמן:* `/verify none`\n• *עם הגבלת זמן:* `/verify 60s` או `/verify 5m`\n• *כיבוי:* `/verify off`' },
      { id: 'antiforward', label: '🔄 חסימת העברות', info: '🔄 *חסימת הודעות מועברות מערוצים/קבוצות (כבוי ברירת מחדל)*\n• *פתיחת כפתורי הפעלה/כיבוי:* `/antiforward`\n• *או בפקודה:* `/antiforward on` | `/antiforward off`' },
      { id: 'antiforeign', label: '🌍 חסימת שפות זרות', info: '🌍 *בחירת שפות זרות לחסימה אוטומטית (ערבית, רוסית, סינית, הודית)*\n• *לפתיחת תפריט בחירת שפות:* `/antiforeign`' },
      { id: 'nightmode', label: '🌙 נעילת לילה (שעון ישראל)', info: '🌙 *סגירה ופתיחה אוטומטית של הקבוצה לפי שעון ישראל*\n• *הפעלה (למשל מחצות עד 07:00):* `/nightmode 00:00 07:00`\n• *כיבוי:* `/nightmode off`' },
      { id: 'newbiemode', label: '👶 הגבלת וותק לחדשים', info: '👶 *חסימת שליחת מדיה וקישורים למשתמשים חדשים עד שיצברו וותק*\n• *פתיחת תפריט בחירת זמן:* `/newbiemode`\n• *או בפקודה:* `/newbiemode 1h` | `/newbiemode 24h` | `/newbiemode off`' },
      { id: 'honeypot', label: '🍯 מלכודת דבש לבוטים', info: '🍯 *פרסום כפתור מלכודת שלוכד וחוסם אוטומטית בוטים של ספאם*\n• *שימוש:* `/honeypot`' },
      { id: 'antispam', label: '🛡️ אנטי-ספאם', info: '🛡️ *סינון אוטומטי של הודעות ספאם והצפות*\n• *להפעלה:* `/antispam on`\n• *לכיבוי:* `/antispam off`' },
      { id: 'antilink', label: '🔗 חסימת לינקים', info: '🔗 *מחיקה אוטומטית של קישורים ממשתמשים רגילים*\n• *להפעלה:* `/antilink on`\n• *לכיבוי:* `/antilink off`' },
      { id: 'antiflood', label: '🌊 הגנת הצפה', info: '🌊 *חסימת משתמשים שמציפים הודעות ברצף*\n• *שימוש:* `/antiflood 5` (או `0` לכיבוי)' },
      { id: 'filter', label: '🚫 מילים אסורות', info: '🚫 *הוספה, עריכה ומחיקה של מילים אסורות*\n• *הוספה:* `/filter [מילה]`\n• *פאנל עריכה ומחיקה בכפתורים:* `/filters`\n• *עריכה מהירה:* `/editfilter [ישנה] [חדשה]`\n• *מחיקה:* `/unfilter [מילה]`' },
      { id: 'welcome', label: '👋 הודעת ברוכים הבאים', info: '👋 *הפעלה ועריכה של הודעת הצטרפות עם כפתור חוקים אוטומטי*\n• *הפעלה/כיבוי:* `/welcome on` | `/welcome off`\n• *עריכת נוסח:* `/setwelcome ברוך הבא {name}!`' }
    ]
  },
  info: {
    title: `ℹ️ *קטגוריה 4: מידע, קהילה ופעילויות* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'secret', label: '🔒 לחישה סודית', info: '🔒 *שליחת הודעה סודית בקבוצה שרק הנמען יכול לקרוא (עם כפתור ביטול בפרטי!)*\n• *שימוש:* השב לחבר וכתוב `/secret [הודעה]` או `/secret @username [הודעה]`\n• כפתור לביטול ומחיקת ההודעה הסודית יישלח אליך אוטומטית לפרטי!' },
      { id: 'autoreply', label: '🤖 מענה אוטומטי חכם', info: '🤖 *תגובות אוטומטיות של הבוט למילים בצ׳אט (מתוך רשימה מוכנה או בהתאמה אישית)*\n• *פתיחת פאנל בחירה ומחיקה:* `/autoreply`\n• *הוספה מותאמת:* `/autoreply מילה | תשובת הבוט`' },
      { id: 'giveaway', label: '🎁 הגרלה בקבוצה', info: '🎁 *פתיחת הגרלה אינטראקטיבית עם כפתור השתתפות והגרלת זוכה (למנהלים)*\n• *שימוש:* `/giveaway [שם הפרס]`' },
      { id: 'top', label: '🏆 טבלת הפעילים', info: '🏆 *הצגת 10 המשתמשים הכי פעילים בקבוצה עם מדליות*\n• *שימוש:* `/top`' },
      { id: 'fastclick', label: '⚡ אתגר הראשון שלוחץ', info: '⚡ *משחק מהירות בקבוצה – הראשון שלוחץ מנצח (מנהל מפעיל ומפסיק)*\n• *הפעלה למנהל:* `/fastclick start`\n• *עצירה למנהל:* `/fastclick stop` (או בכפתור העצירה)' },
      { id: 'duel', label: '⚔️ דו-קרב קובייה', info: '⚔️ *דו-קרב בכפתורים בין חברי הקבוצה (כבוי ברירת מחדל)*\n• *הפעלה/כיבוי למנהל:* `/duel on` | `/duel off`\n• *פתיחת דו-קרב:* `/duel`' },
      { id: 'tagall', label: '📣 תיוג כולם', info: '📣 *קריאת התפקדות לחברי הקבוצה הפעילים (מנהל מפעיל תחילה)*\n• *הפעלה/כיבוי למנהל:* `/tagall on` | `/tagall off`\n• *תיוג:* `/tagall [הודעה]`' },
      { id: 'rules', label: '📖 חוקי הקבוצה', info: '📖 *צפייה והגדרה של חוקי הקבוצה*\n• *צפייה:* `/rules`\n• *הגדרה (למנהלים):* `/setrules [טקסט החוקים]`' },
      { id: 'addcmd', label: '➕ פקודות מותאמות', info: '➕ *ניהול פקודות מותאמות אישית לקבוצה*\n• *הוספה:* `/addcmd [שם] [תוכן]`\n• *מחיקה:* `/delcmd [שם]`\n• *רשימה:* `/cmds`' },
      { id: 'admins', label: '👑 רשימת אדמינים', info: '👑 *הצגת ותיוג מנהלי הקבוצה*\n• *שימוש:* `/admins`' },
      { id: 'userinfo', label: '🆔 מידע וסטטיסטיקות', info: '🆔 *מידע על משתמש וסטטיסטיקות קבוצה*\n• *מידע משתמש:* `/id` או `/userinfo`\n• *סטטיסטיקות קבוצה:* `/stats`' }
    ]
  },
  system: {
    title: `⚙️ *קטגוריה 5: מערכת, גיבוי ועיצוב* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
    items: [
      { id: 'backup', label: '💾 גיבוי ושחזור קבוצה', info: '💾 *ייצוא ושחזור כל הגדרות הקבוצה, החוקים והפילטרים בלחיצה*\n• *ליצירת קוד גיבוי:* `/backup`\n• *לשחזור הגדרות מקוד גיבוי:* `/restore [קוד]`' },
      { id: 'settings', label: '⚙️ הגדרות קבוצה', info: '⚙️ *פאנל מצב כל ההגנות והנעילות בקבוצה*\n• *שימוש:* `/settings`' },
      { id: 'echo', label: '📢 בדיקת עיצוב', info: '📢 *בדיקת הודעה מעוצבת עם כפתורים*\n• *שימוש:*\n`/echo *כותרת מודגשת*\n{{כפתור לדוגמה}{https://t.me/telegram}}`' },
      { id: 'format', label: '🎨 מדריך עיצוב', info: '🎨 *מדריך מלא להדגשה, קישורים ויצירת כפתורים*\n• *שימוש:* `/format`' },
      { id: 'report', label: '🚨 דיווח לאדמינים', info: '🚨 *דיווח מהיר לכל מנהלי הקבוצה על הודעה בעייתית*\n• *שימוש:* השב להודעה וכתוב:\n`/report`' },
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
        { text: 'ℹ️ קהילה ופעילויות', callback_data: 'help_info' }
      ],
      [
        { text: '⚙️ מערכת וגיבוי', callback_data: 'help_system' },
        { text: '🎨 מדריך כפתורים ועיצוב', callback_data: 'help_format' }
      ],
      [
        { text: '💡 הצעה לשיפור', callback_data: 'reqcmd_start' },
        { text: `🆕 עדכון ${BOT_VERSION}`, callback_data: 'help_changelog' }
      ]
    ]
  };
}

// מקלדת קטגוריה – רק כפתור "🔙 חזרה" בתחתית (ללא "חזרה לתפריט הראשי")
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
  rows.push([{ text: '🔙 חזרה', callback_data: 'help_main' }]);
  return { inline_keyboard: rows };
}

// מקלדת תת-תפריט של פקודה – רק כפתור "🔙 חזרה"
function getCommandSubMenuKeyboard(catKey) {
  return {
    inline_keyboard: [
      [{ text: '🔙 חזרה', callback_data: `help_${catKey}` }]
    ]
  };
}

// מקלדת חזרה רגילה – רק כפתור "🔙 חזרה"
function getBackToMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔙 חזרה', callback_data: 'help_main' }]
    ]
  };
}

function registerSystemCommands(bot) {
  // רישום אוטומטי של כל 20 הפקודות המתקדמות מקובץ commands/advanced.js
  registerAdvancedCommands(bot);

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
      const adv = data.adv || {};
      const status = (v) => (v ? '✅ פעיל' : '❌ כבוי');
      await ctx.reply(
        `⚙️ *פאנל הגדרות קבוצה – ${ctx.chat.title || ''}*\n` +
        `🔖 *גרסת בוט:* עדכון ${BOT_VERSION}\n\n` +
        `• ניקוי הודעות שירות: ${status(data.cleanService)}\n` +
        `• אנטי-ספאם: ${status(data.antispam)}\n` +
        `• חסימת לינקים: ${status(data.antilink)}\n` +
        `• חסימת העברות (Forward): ${status(adv.antiforward)}\n` +
        `• אימות מצטרפים (/verify): ${status(adv.verifyEnabled)}\n` +
        `• נעילת לילה (שעון ישראל): ${status(adv.nightmode?.enabled)}\n` +
        `• הצבעת הדחה (/voteban): ${adv.votebanLimit ? `✅ (${adv.votebanLimit} קולות)` : '❌ כבוי'}\n` +
        `• מערכת ערעורים (/appeal): ${status(adv.appealEnabled)}\n` +
        `• דו-קרב (/duel): ${status(adv.duelEnabled)}\n` +
        `• פילטרים מוגדרים: ${(data.filters || []).length} מילים\n` +
        `• תגובות אוטומטיות: ${Object.keys(adv.autoReplies || {}).length}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '📚 פתיחת תפריט הפקודות', callback_data: 'help_main' }]]
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
