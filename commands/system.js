const {
FORMAT_GUIDE,
getGroupData,
saveGroupData,
parseRichMessage,
sendFormattedMessage,
requireAdmin,
getTarget,
parseDurationSeconds
} = require('./utils');
const registerAdvancedCommands = require('./advanced');
const registerFoundersCommands = require('./founders');
const CREATOR_ID = 1773089386;
const FOUNDERS_CHAT_ID = '-1004417781995';
const BOT_VERSION = '1.1.0.0v';
const isCreatorId = (id) => Number(id) === CREATOR_ID;
const isCreator = (ctx) => isCreatorId(ctx.from?.id);
const isFoundersGroup = (ctx) => {
const cid = String(ctx.chat?.id || '');
return cid === FOUNDERS_CHAT_ID || cid === '-4417781995' || cid.endsWith('4417781995');
};
const getIsraelDateKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const noop = () => {};
const ack = (ctx, msg, show_alert) => ctx.answerCbQuery(msg, show_alert ? { show_alert: true } : undefined).catch(noop);
const editOrReply = (ctx, text, extra) => ctx.editMessageText(text, extra).catch(() => ctx.reply(text, extra));
const sendMd = (ctx, cid, text, reply_markup) => ctx.telegram.sendMessage(cid, text, reply_markup ? { parse_mode: 'Markdown', reply_markup } : { parse_mode: 'Markdown' });
const replyMd = (ctx, text, reply_markup) => ctx.reply(text, reply_markup ? { parse_mode: 'Markdown', reply_markup } : { parse_mode: 'Markdown' });
const replyKb = (ctx, text, inline_keyboard) => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
const editMd = (ctx, text, reply_markup) => editOrReply(ctx, text, reply_markup ? { parse_mode: 'Markdown', reply_markup } : { parse_mode: 'Markdown' });
const arg1 = (ctx) => ((ctx.message?.text || '').trim().split(/\s+/)[1] || '').trim();
const cItem = (label, write, reply) => ({ label, info: `${label}\n\n⌨️ *מה לכתוב:*\n\`${write}\`\n\n🤖 *מה הבוט ישיב:*\n${reply}` });
const mItem = (id, label, write, reply) => { const cmd = (write.match(/\/[a-zA-Z_]+/) || [`/${id}`])[0]; return { id, cmd, label, ...cItem(`${label} (\`${cmd}\`)`, write, reply) }; };
const fItem = mItem;
const MENU_DATA = {
users: {
title: `👮 *קטגוריה 1: ניהול משתמשים* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
items: [
mItem('ban', '🚫 חסימת משתמש', '/ban פרסום ספאם (בהשבה)', 'חוסם את המשתמש לצמיתות מהקבוצה.'),
mItem('tempban', '⏳ חסימה זמנית', '/tempban 2h (או 1d בהשבה)', 'חוסם את המשתמש זמנית ומשחרר אוטומטית בתום הזמן.'),
mItem('unban', '✅ הסרת חסימה', '/unban 123456789', 'מסיר חסימה ממשתמש ומאפשר לו להצטרף מחדש.'),
mItem('kick', '👢 הוצאה מהקבוצה', '/kick (בהשבה)', 'מוציא את המשתמש מהקבוצה ללא חסימה.'),
mItem('kickme', '🚪 יציאה עצמית', '/kickme', 'מוציא אותך מיד מהקבוצה לבקשתך ללא חסימה.'),
mItem('mute', '🔇 השתקת משתמש', '/mute 10m (או 2h / 1d בהשבה)', 'משתיק את המשתמש לזמן שהוגדר.'),
mItem('tmute', '🔇 השתקה + ערעור', '/tmute 30m שליחת פרסומות (בהשבה)', 'משתיק את המשתמש ומציג כפתור להגשת ערעור למנהלים.'),
mItem('unmute', '🔊 ביטול השתקה', '/unmute (בהשבה)', 'מסיר השתקה ממשתמש ומחזיר לו הרשאת כתיבה.'),
mItem('warn', '⚠️ מתן אזהרה', '/warn שפה לא נאותה (בהשבה)', 'מוסיף אזהרה למשתמש (ב-3 אזהרות נחסם אוטומטית).'),
mItem('warnings', '📋 בדיקת אזהרות', '/warnings (בהשבה)', 'מציג כמה אזהרות יש למשתמש ומה הסיבות.'),
mItem('clearwarns', '🧼 איפוס אזהרות', '/clearwarns (בהשבה)', 'מוחק את כל האזהרות של המשתמש.'),
mItem('promote', '⭐ קידום לאדמין', '/promote (בהשבה)', 'מקדם חבר קבוצה לניהול.'),
mItem('demote', '⬇️ הורדה מניהול', '/demote (בהשבה)', 'מסיר הרשאות ניהול מאדמין.'),
mItem('voteban', '⚖️ הצבעת הדחה', 'למנהל: /voteban 5 | לחברים (בהשבה): /voteban', 'פותח הצבעת הדחה דמוקרטית בקבוצה.'),
mItem('appeal', '📩 מערכת ערעורים', 'למנהל: /appeal on | למשתמש: /appeal סיבה', 'שולח בקשת ערעור עם כפתורי אישור/דחייה למנהלים.'),
mItem('msgquota', '📊 מכסת הודעות יומית', '/msgquota 15 (בהשבה, או off לביטול)', 'מגביל משתמש ספציפי לכמות הודעות יומית.'),
mItem('trust', '🕵️ מדד אמינות משתמש', '/trust (בהשבה או לבד)', 'מציג ציון אמינות, וותק, הודעות ואזהרות של המשתמש.')
]
},
content: {
title: `🧹 *קטגוריה 2: תוכן וניקוי* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
items: [
mItem('del', '🗑️ מחיקת הודעה', '/del (בהשבה להודעה)', 'מוחק מיד את ההודעה שעליה השבת.'),
mItem('purge', '🧹 מחיקה מרובה', '/purge 20 (עד 100)', 'מוחק מספר הודעות אחרונות בבת אחת.'),
mItem('cleanuser', '👤 מחיקת הודעות משתמש', 'קודם /cleanuser on, ואז בהשבה: /cleanuser 15', 'מוחק את ההודעות האחרונות של אותו משתמש.'),
mItem('cleanservice', '🧼 ניקוי הודעות שירות', '/cleanservice on | /cleanservice off', 'מוחק אוטומטית הודעות הצטרפות ועזיבה.'),
mItem('maxlength', '📏 הגבלת אורך הודעה', '/maxlength 500 (או off לביטול)', 'מוחק אוטומטית הודעות שעוברות את מכסת התווים.'),
mItem('pin', '📌 נעיצת הודעה', '/pin (בהשבה)', 'נועץ את ההודעה בראש הקבוצה.'),
mItem('unpin', '📍 הסרת נעיצה', '/unpin', 'מסיר נעיצה מהודעה.'),
mItem('unpinall', '🗃️ הסרת כל הנעוצים', '/unpinall', 'מסיר את כל ההודעות הנעוצות בקבוצה.'),
mItem('slowmode', '🐢 מצב איטי', '/slowmode 30 (או 0 לביטול)', 'מגביל את קצב שליחת ההודעות בקבוצה.'),
mItem('lock', '🔒 נעילת תוכן', '/lock links | media | stickers | all', 'חוסם שליחת קישורים, מדיה, סטיקרים או הכול.'),
mItem('unlock', '🔓 פתיחת נעילה', '/unlock links | media | stickers | all', 'משחרר נעילת תוכן בקבוצה.')
]
},
protection: {
title: `🛡️ *קטגוריה 3: אוטומציה והגנה* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
items: [
mItem('raidmode', '🚨 מצב חירום מתקפות', '/raidmode on | off | auto', 'חוסם מתקפות בוטים אוטומטית או ידנית ל-30 דקות.'),
mItem('verify', '🔐 אימות מצטרפים', '/verify (או /verify none / 60s / off)', 'אימות אנושי בכפתורים שמאוחד עם הודעת הכניסה וכפתור החוקים.'),
mItem('foreigncountries', '📵 חסימת קידומות ומדינות', '/foreign_countries (או /foreign_countries +98)', 'פאנל חסימת קידומות ומדינות זרות + אימות טלפון בכניסה.'),
mItem('antiporn', '🔞 חסימת תוכן למבוגרים', '/antiporn on | /antiporn off', 'מוחק אוטומטית קישורים ומילים למבוגרים (/antiporn או /antinsfw).'),
mItem('antibot', '🤖 חסימת הכנסת בוטים', '/antibot on | /antibot off', 'מסיר מיד כל בוט זר שמוכנס לקבוצה ע"י משתמש רגיל.'),
mItem('antichannels', '📢 חסימת כתיבה מערוץ', '/antichannels on | /antichannels off', 'מוחק אוטומטית הודעות שנשלחות בשם ערוץ בקבוצה.'),
mItem('antiforward', '🔄 חסימת העברות', '/antiforward on | /antiforward off', 'מוחק אוטומטית הודעות מועברות מערוצים וקבוצות.'),
mItem('antiforeign', '🌍 חסימת שפות זרות', '/antiforeign', 'פותח כפתורים לחסימת ערבית, רוסית, סינית והודית.'),
mItem('nightmode', '🌙 נעילת לילה (שעון ישראל)', '/nightmode 00:00 07:00 (או off)', 'סוגר ופותח אוטומטית את הקבוצה לפי שעון ישראל.'),
mItem('newbiemode', '👶 הגבלת וותק לחדשים', '/newbiemode (או /newbiemode 1h / off)', 'חוסם קישורים ומדיה ממצטרפים חדשים עד שיצברו וותק.'),
mItem('honeypot', '🍯 מלכודת דבש לבוטים', '/honeypot', 'מפרסם כפתור מלכודת שלוכד וחוסם אוטומטית בוטים.'),
mItem('antispam', '🛡️ אנטי-ספאם', '/antispam on | /antispam off', 'סינון אוטומטי של הודעות ספאם.'),
mItem('antilink', '🔗 חסימת לינקים', '/antilink on | /antilink off', 'מחיקה אוטומטית של קישורים ממשתמשים רגילים.'),
mItem('antiflood', '🌊 הגנת הצפה', '/antiflood 5 (או 0 לכיבוי)', 'משתיק אוטומטית מציפים ששולחים הודעות ברצף.'),
mItem('filter', '🚫 מילים אסורות', '/filter [מילה] | לפאנל עריכה ומחיקה: /filters', 'חסימה, עריכה ומחיקה של מילים אסורות בקבוצה.'),
mItem('welcome', '👋 הודעת ברוכים הבאים', '/welcome on | /setwelcome ברוך הבא {name}!', 'הודעת כניסה מעוצבת עם כפתור אוטומטי לחוקי הקבוצה.')
]
},
info: {
title: `ℹ️ *קטגוריה 4: מידע, קהילה ופעילויות* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
items: [
mItem('secret', '🔒 לחישה סודית', '/secret @username [הודעה] (או בהשבה)', 'הודעה סודית בקבוצה שרק הנמען יכול לקרוא + כפתור מחיקה בפרטי.'),
mItem('afk', '💤 מצב לא זמין (AFK)', '/afk בעבודה', 'מעדכן שאתה לא זמין ועונה אוטומטית למי שמתייג אותך.'),
mItem('remind', '⏰ תזכורת חכמה', '/remind 10m לבדוק את ההגרלה', 'קובע תזכורת ומתייג אותך בתום הזמן.'),
mItem('autoreply', '🤖 מענה אוטומטי חכם', '/autoreply או /autoreply מילה | תשובה', 'ניהול תגובות אוטומטיות של הבוט למילים בצ׳אט.'),
mItem('giveaway', '🎁 הגרלה בקבוצה', '/giveaway [שם הפרס]', 'פותח הגרלה חיה עם כפתור השתתפות והגרלת זוכה.'),
mItem('trivia', '🧠 משחק טריוויה', '/trivia', 'חידון טריוויה בעברית בכפתורים – הראשון שעונה נכון מנצח!'),
mItem('rps', '✂️ אבן נייר ומספריים', '/rps', 'משחק אבן, נייר ומספריים בכפתורים בין שני חברי קבוצה.'),
mItem('coin', '🪙 הטלת מטבע / קובייה', '/coin (עץ/פלי) או /roll (מספר 1–100)', 'הגרלה מהירה של מטבע או מספר אקראי.'),
mItem('top', '🏆 טבלת הפעילים', '/top', 'מציג את 10 החברים הכי פעילים בקבוצה עם מדליות.'),
mItem('fastclick', '⚡ אתגר הראשון שלוחץ', '/fastclick start | /fastclick stop', 'משחק מהירות בקבוצה – הראשון שלוחץ מנצח.'),
mItem('duel', '⚔️ דו-קרב קובייה', 'למנהל: /duel on | לחברים: /duel', 'דו-קרב קובייה בכפתורים בין חברי הקבוצה.'),
mItem('tagall', '📣 תיוג כולם', 'למנהל: /tagall on ואז /tagall [הודעה]', 'מתייג את חברי הקבוצה הפעילים.'),
mItem('rules', '📖 חוקי הקבוצה', '/rules | להגדרת חוקים: /setrules [טקסט]', 'מציג כפתור לקריאת חוקי הקבוצה בפרטי.'),
mItem('addcmd', '➕ פקודות מותאמות', '/addcmd [שם] [תוכן] | /delcmd | /cmds', 'יצירה וניהול של פקודות מותאמות אישית לקבוצה.'),
mItem('admins', '👑 הנהלה ופעילות', '/staff (או /admins) | לדוח פעילות: /inactive', 'מציג את בעל הקבוצה, המנהלים ודוח פעילות החברים.'),
mItem('userinfo', '🆔 מידע וסטטיסטיקות', '/id | /userinfo | /stats', 'מציג פרטי משתמש וסטטיסטיקות קבוצה מלאות.')
]
},
system: {
title: `⚙️ *קטגוריה 5: מערכת, גיבוי ועיצוב* (עדכון ${BOT_VERSION})\nבחר פעולה מהכפתורים למטה לצפייה בהסבר ובדוגמת שימוש:`,
items: [
mItem('backup', '💾 גיבוי ושחזור קבוצה', '/backup | לשחזור: /restore [קוד]', 'מייצא ומשחזר את כל הגדרות הקבוצה בלחיצה.'),
mItem('rulesbtn', '🔘 עיצוב כפתור חוקים', '/rules_button 📜 לחץ כאן לתקנון (או reset)', 'משנה את הטקסט שעל כפתור החוקים בהודעות הכניסה וב-/rules.'),
mItem('settings', '⚙️ הגדרות קבוצה', '/settings', 'מציג פאנל מרוכז עם מצב כל ההגנות והמערכות בקבוצה.'),
mItem('echo', '📢 בדיקת עיצוב', '/echo *כותרת* {{כפתור}{https://t.me/VolticMod_bot}}', 'שולח הודעה מעוצבת עם כפתורים לבדיקה.'),
mItem('format', '🎨 מדריך עיצוב', '/format', 'מציג מדריך מלא להדגשה, קישורים ויצירת כפתורים.'),
mItem('report', '🚨 דיווח לאדמינים', '/report (בהשבה להודעה בעייתית)', 'מתייג את כל מנהלי הקבוצה לטיפול בדיווח.'),
mItem('suggest', '💡 הצעה לשיפור', 'לחיצה על "💡 הצעה לשיפור" בתפריט הראשי', 'שליחת הצעה לפקודה חדשה ישירות ליוצר הבוט.'),
mItem('rate', '⭐ דירוג הבוט', 'לחיצה על "⭐ דירוג הבוט" בתפריט הראשי', 'דירוג הבוט ב-1 עד 5 כוכבים עם אפשרות לפידבק או דילוג.')
]
}
};
const CHANGELOG_TEXT =
`🚀 *עדכון ענק ${BOT_VERSION} – וולטיק מוד*\n\n` +
`✨ *מה חדש בעדכון זה:*\n` +
`1️⃣ 📵 *חסימת קידומות ומדינות (\`/foreign_countries\`):* זיהוי וחסימת מספרי טלפון וחשבונות ממדינות זרות (איראן +98, פקיסטן +92, אינדונזיה +62 ועוד) או הוספת כל קידומת מותאמת אישית.\n` +
`2️⃣ 📱 *אימות מספר טלפון של משתמש בכניסה לקבוצה:* מצב אבטחה שמחייב מצטרפים חדשים לאמת את מספר הטלפון שלהם בפרטי מול הבוט לפני שיוכלו לכתוב בקבוצה, וחוסם אוטומטית קידומות אסורות.\n` +
`3️⃣ ⭐ *דירוג הבוט בכוכבים ופידבק:* כפתור דירוג מהיר (1⭐ עד 5⭐) בתפריט הראשי עם אפשרות להשארת פידבק כתוב או דילוג בלחיצה.\n\n` +
`🛡️ *הגנות וניהול חדשים לקבוצות:*\n` +
`• 🔞 \`/antiporn\` ו-\`/antinsfw\` – חסימת קישורים ותוכן למבוגרים\n` +
`• 🤖 \`/antibot\` – חסימת הכנסת בוטים זרים לקבוצה\n` +
`• 📢 \`/antichannels\` – חסימת כתיבה בשם ערוץ בקבוצה\n` +
`• 📏 \`/maxlength\` – הגבלת אורך הודעה מקסימלי נגד מגילות ספאם\n` +
`• ⏳ \`/tempban\` ו-\`/tmute\` – חסימה זמנית והשתקה עם כפתור ערעור מהיר\n` +
`• 🔘 \`/rules_button\` – שינוי הטקסט שעל כפתור חוקי הקבוצה\n` +
`• 👮 \`/staff\` ו-\`/inactive\` – כרטיס הנהלת הקבוצה ובדיקת פעילות חברים\n\n` +
`🎮 *קהילה, עזר ומשחקים חדשים:*\n` +
`• 💤 \`/afk\` – מצב "לא זמין כרגע" שעונה אוטומטית כשמתייגים אותך\n` +
`• ⏰ \`/remind\` – תזכורת חכמה בקבוצה או בפרטי\n` +
`• 🧠 \`/trivia\`, ✂️ \`/rps\`, 🪙 \`/coin\`, 🎲 \`/roll\` ו-🚪 \`/kickme\``;
const MAIN_MENU_TEXT =
`שלום! 👋\n` +
`אני בוט מתקדם לניהול והגנה על קבוצות.\n` +
`🔖 *גרסה נוכחית:* עדכון ${BOT_VERSION}\n\n` +
`📚 *תפריט הפקודות הראשי – בחר קטגוריה מהכפתורים למטה:*`;
const FOUNDERS_MENU = [
fItem('shop', '🛒 חנות נקודות', '/shop', 'פותח קטלוג כפתורים לרכישת תואר מוזהב, הכרזת כבוד, הקפצת רעיון וכתר VIP בנקודות.'),
fItem('daily_spin', '🎡 גלגל המזל היומי', '/daily_spin', 'מסובב את גלגל המזל פעם ביום ומזכה בין 5 ל-30 נקודות מייסד!'),
fItem('duel_points', '⚔️ דו-קרב נקודות', '/duel_points 15', 'פותח דו-קרב קובייה על נקודות מייסד אמיתיות בין שני חברי צוות.'),
fItem('transfer_points', '💸 העברת נקודות', '/Transfer_points 20 (בהשבה למייסד)', 'מעביר נקודות מייסד מהמאזן שלך לחבר הצוות.'),
fItem('bet_goal', '🎲 הימור צמיחה', '/bet_goal 60', 'שומר את ההימור שלך לכמה קבוצות הבוט יגיע ומציג את טבלת ההימורים.'),
fItem('design_welcome', '🎨 עיצוב הודעת בוט', '/design_welcome [נוסח מוצע]', 'מפרסם הצעת עיצוב להודעת בוט עם כפתור אישור ליוצר (+25 נק׳).'),
fItem('my_ideas', '📂 תיק פיתוח אישי', '/my_ideas', 'מציג את כל הרעיונות והבאגים שהגשת ומצב האישור שלהם.'),
fItem('quiz_bot', '🧠 חידון מייסדים', '/quiz_bot', 'שואל שאלה עם 4 כפתורים – הראשון שעונה נכון מקבל +10 נקודות!'),
fItem('badge', '🎖️ ארון מדליות', '/badge', 'מציג את כל מדליות ההישגים שפתחת בצוות המייסדים.'),
fItem('invite_card', '🪪 כרטיס גיוס אישי', '/invite_card', 'מייצר כרטיס המלצה אישי עם שמך וכפתור להוספת הבוט.'),
fItem('changelog_draft', '📝 טיוטת העדכון הבא', '/changelog_draft (וליוצר: /set_draft)', 'מציג את רשימת הפיצ׳רים שמתוכננים לגרסה הבאה של הבוט.'),
fItem('founders_time', '⏳ ציר זמן מייסדים', '/founders_time', 'מציג את סדר ההצטרפות והוותק של כל חברי צוות המייסדים.'),
fItem('idea', '💡 הצעת רעיון', '/idea [תיאור הרעיון]', 'מפרסם כרטיס הצבעה לצוות וכפתור אישור ליוצר (+25 נק׳).'),
fItem('bug', '🐛 דיווח באג', '/bug [תיאור התקלה]', 'פותח כרטיס באג ממוספר עם כפתור ליוצר לסימון כטופל (+20 נק׳).'),
fItem('founder', '🪪 תעודת מייסד', '/founder', 'מציג את תעודת המייסד שלך (ועליך כותב: היוצר של וולטיק מוד).'),
fItem('rank', '📈 דרגות מייסדים', '/rank', 'מציג את דרגות המייסדים והניקוד שלך.'),
fItem('title', '🏷️ בחירת תואר אישי', '/title אדריכל פקודות', 'מעדכן את התואר האישי בתעודת המייסד שלך.'),
fItem('halloffame', '🏆 היכל התהילה', '/halloffame', 'מציג את טבלת 5 המייסדים המובילים בנקודות.'),
fItem('credits', '🏅 היכל הקרדיטים', '/credits', 'מציג את המייסדים שהרעיונות שלהם אושרו.'),
fItem('mvp', '⭐ מייסד השבוע', '/mvp', 'מכריז על המייסד המוביל של השבוע.'),
fItem('checkin', '🔥 התפקדות יומית', '/checkin', 'מעניק +5 נקודות ומעדכן את רצף הימים שלך.'),
fItem('mission', '📋 משימת הצוות', '/mission (וליוצר: /setmission)', 'מציג את המשימה הנוכחית עם כפתור השלמת משימה (+10 נק׳).'),
fItem('preview', '🎨 הדמיית פקודה', '/preview *טקסט* {{כפתור}{https://t.me/VolticMod_bot}}', 'מציג בזמן אמת איך תיראה ההודעה עם הכפתור.'),
fItem('gold', '🪙 רעיונות זהב', '/gold (בהשבה לשמירה או לבד לצפייה)', 'שומר ומציג את רעיונות הזהב של הקבוצה.'),
fItem('goal', '🎯 יעד הצמיחה', '/goal (וליוצר: /setgoal)', 'מציג מד התקדמות של כמות הקבוצות והמשתמשים.'),
fItem('sharebot', '🔗 שיתוף הבוט', '/sharebot', 'מוציא כרטיס שיתוף מוכן להוספת הבוט.'),
fItem('ask', '❓ שאלה ליוצר', '/ask [שאלה]', 'מעביר את השאלה ישירות לפרטי של יוצר הבוט.'),
fItem('feedback_bot', '⭐ דירוג הבוט', '/feedback_bot', 'פותח כפתורי דירוג 1⭐ עד 5⭐.')
];
const CREATOR_DICT = {
owner_ghost: cItem('👻 מצב רוח רפאים (/owner_ghost)', '/owner_ghost [ChatID] (או off)', 'מעביר אליך לפרטי בשידור חי כל הודעה שנכתבת בקבוצה שבחרת בלי שאף אחד בקבוצה ידע.'),
owner_hijack_welcome: cItem('📣 באנר ברוכים הבאים (/owner_hijack_welcome)', '/owner_hijack_welcome טקסט (או off)', 'מוסיף אוטומטית את השורה שלך לתחתית כל הודעת ברוכים הבאים בכל הקבוצות בבוט.'),
owner_global_filter: cItem('🚫 פילטר גלובלי (/owner_global_filter)', '/owner_global_filter מילה (או list / clear)', 'מוחק אוטומטית את המילה או הקישור בכל הקבוצות שבהן הבוט נמצא.'),
owner_nuke_spammer: cItem('☢️ השמדת ספאמר (/owner_nuke_spammer)', '/owner_nuke_spammer [UserID]', 'חוסם את הספאמר בכל הקבוצות בבוט ומוחק את ההודעות האחרונות שלו מכל הקבוצות בבת אחת.'),
owner_vip: cItem('💎 סימון קבוצת VIP (/owner_VIP)', '/owner_VIP [ChatID]', 'מעניק לקבוצה תג קבוצת VIP רשמית של וולטיק מוד ב-/settings וב-/stats ומכריז בקבוצה.'),
owner_unban_me: cItem('🔓 שחרור עצמי מקבוצה (/owner_unban_me)', '/owner_unban_me [ChatID]', 'מסיר ממך כל חסימה או הגבלה בקבוצה ושולח לך לפרטי קישור הזמנה להיכנס אליה.'),
owner_poll_all: cItem('📊 סקר בכל הקבוצות (/owner_poll_all)', '/owner_poll_all שאלה | תשובה 1 | תשובה 2', 'מפרסם את הסקר עם כפתורי הצבעה בכל הקבוצות ומעדכן תוצאות חיות מכל הקבוצות יחד.'),
owner_top_groups: cItem('🏆 דירוג קבוצות (/owner_top_groups)', '/owner_top_groups', 'מציג טבלה מדורגת של 10 הקבוצות המובילות בכמות הודעות וחברים.'),
owner_blacklist_group: cItem('⛔ החרמת קבוצה (/owner_blacklist_group)', '/owner_blacklist_group [ChatID]', 'הבוט יוצא מהקבוצה מיד, ואם ינסו להוסיף אותו אליה שוב בעתיד הוא ייצא אוטומטית.'),
owner_gift_points: cItem('🎁 גשם נקודות למייסדים (/owner_gift_points)', '/owner_gift_points 25', 'מעניק בונוס נקודות מייסד לכל חברי צוות המייסדים ומכריז על המתנה בקבוצת המייסדים!'),
owner: cItem('👑 פאנל שליטה (/owner)', '/owner', 'פותח את פאנל השליטה הראשי ליוצר הבוט.'),
broadcast: cItem('📣 שידור לכולם (/broadcast)', '/broadcast [הודעה]', 'שולח הודעה לכל הקבוצות ולכל המשתמשים.'),
broadcast_users: cItem('✉️ שידור למשתמשים (/broadcast_users)', '/broadcast_users [הודעה]', 'שולח הודעה לכל משתמשי הבוט בפרטי בלבד.')
};
for (const f of FOUNDERS_MENU) {
CREATOR_DICT[f.id] = { label: `${f.label} (${f.cmd})`, info: f.info };
}
for (const cat of Object.values(MENU_DATA)) {
for (const item of cat.items) {
const key = item.cmd.replace(/^\//, '');
CREATOR_DICT[key] = { label: `${item.label} (${item.cmd})`, info: item.info };
}
}
function buildCreatorKb(page = 0) {
const entries = Object.entries(CREATOR_DICT);
const perPage = 12;
const totalPages = Math.ceil(entries.length / perPage);
const safePage = Math.max(0, Math.min(page, totalPages - 1));
const slice = entries.slice(safePage * perPage, (safePage + 1) * perPage);
const rows = [];
for (let i = 0; i < slice.length; i += 2) {
const [k1, v1] = slice[i];
const r = [{ text: v1.label, callback_data: `cexp_cmd_${safePage}_${k1}` }];
if (slice[i + 1]) {
const [k2, v2] = slice[i + 1];
r.push({ text: v2.label, callback_data: `cexp_cmd_${safePage}_${k2}` });
}
rows.push(r);
}
const nav = [];
if (safePage < totalPages - 1) nav.push({ text: '⬅️ עמוד הבא', callback_data: `cexp_page_${safePage + 1}` });
if (safePage > 0) nav.push({ text: '➡️ עמוד קודם', callback_data: `cexp_page_${safePage - 1}` });
if (nav.length) rows.push(nav);
rows.push([{ text: '🔙 חזרה לפאנל /owner', callback_data: 'own_panel' }]);
const text =
`👑 *תפריט כל הפקודות של הבוט – ליוצר בלבד (עמוד ${safePage + 1} מתוך ${totalPages})*\n` +
`סה"כ *${entries.length} פקודות ומערכות* בבוט שלך.\n\n` +
`👇 *לחץ על כל כפתור פקודה למטה כדי לראות בדיוק מה לכתוב ומה הבוט ישיב:*`;
return { text, reply_markup: { inline_keyboard: rows } };
}
function buildFoundersKb() {
const rows = [];
for (let i = 0; i < FOUNDERS_MENU.length; i += 2) {
const r = [{ text: FOUNDERS_MENU[i].label, callback_data: `fnd_m_${FOUNDERS_MENU[i].id}` }];
if (FOUNDERS_MENU[i + 1]) {
r.push({ text: FOUNDERS_MENU[i + 1].label, callback_data: `fnd_m_${FOUNDERS_MENU[i + 1].id}` });
}
rows.push(r);
}
return { inline_keyboard: rows };
}
function getHelpKeyboard() {
return {
inline_keyboard: [
[{ text: '👮 ניהול משתמשים', callback_data: 'help_users' }, { text: '🧹 תוכן וניקוי', callback_data: 'help_content' }],
[{ text: '🛡️ אוטומציה והגנה', callback_data: 'help_protection' }, { text: 'ℹ️ קהילה ופעילויות', callback_data: 'help_info' }],
[{ text: '⚙️ מערכת וגיבוי', callback_data: 'help_system' }, { text: '🎨 מדריך כפתורים ועיצוב', callback_data: 'help_format' }],
[{ text: '💡 הצעה לשיפור', callback_data: 'reqcmd_start' }, { text: '⭐ דירוג הבוט', callback_data: 'rate_start' }],
[{ text: `🆕 עדכון ${BOT_VERSION}`, callback_data: 'help_changelog' }]
]
};
}
function getCatKb(catKey) {
const cat = MENU_DATA[catKey];
const rows = [];
if (cat && Array.isArray(cat.items)) {
for (let i = 0; i < cat.items.length; i += 2) {
const row = [{ text: cat.items[i].label, callback_data: `hcmd_${catKey}_${cat.items[i].id}` }];
if (cat.items[i + 1]) {
row.push({ text: cat.items[i + 1].label, callback_data: `hcmd_${catKey}_${cat.items[i + 1].id}` });
}
rows.push(row);
}
}
rows.push([{ text: '🔙 חזרה', callback_data: 'help_main' }]);
return { inline_keyboard: rows };
}
const getCmdSubKb = (catKey) => ({ inline_keyboard: [[{ text: '🔙 חזרה', callback_data: `help_${catKey}` }]] });
const getBackKb = () => ({ inline_keyboard: [[{ text: '🔙 חזרה', callback_data: 'help_main' }]] });
const PORN_REGEX = /(pornhub|xvideos|xnxx|onlyfans\.com|redtube|youporn|xhamster|brazzers|nsfw|xxx|סקס|פורנו)/i;
const TRIVIA_QS = [
{ q: 'איזו עיר היא בירת ישראל?', opts: ['ירושלים', 'תל אביב', 'חיפה', 'באר שבע'], ans: 0 },
{ q: 'כמה ימים יש בשנה מעוברת לועזית?', opts: ['364', '365', '366', '360'], ans: 2 },
{ q: 'איזה כוכב לכת הוא הקרוב ביותר לשמש?', opts: ['נגה', 'מאדים', 'חמה (מרקורי)', 'צדק'], ans: 2 },
{ q: 'מהי היבשת הגדולה ביותר בעולם?', opts: ['אפריקה', 'אסיה', 'אירופה', 'אמריקה'], ans: 1 },
{ q: 'כמה שחקנים יש לקבוצת כדורגל על המגרש?', opts: ['9', '10', '11', '12'], ans: 2 },
{ q: 'איזה יסוד כימי מסומן באות O?', opts: ['זהב', 'חמצן', 'מימן', 'פחמן'], ans: 1 }
];
const FOUNDERS_QUIZ = [
{ q: 'איזו פקודה מפעילה חסימת קידומות ומדינות זרות בבוט?', opts: ['/foreign_countries', '/antiflood', '/slowmode', '/lock'], ans: 0 },
{ q: 'איזו פקודה שולחת לחישה סודית שרק הנמען יכול לקרוא?', opts: ['/echo', '/secret', '/rules', '/warn'], ans: 1 },
{ q: 'בכמה נקודות מייסד מזכה אישור רעיון (/idea) ע"י היוצר?', opts: ['5 נקודות', '10 נקודות', '25 נקודות', '50 נקודות'], ans: 2 },
{ q: 'איזו פקודה נועלת אוטומטית את הקבוצה בלילה לפי שעון ישראל?', opts: ['/nightmode', '/raidmode', '/newbiemode', '/cleanuser'], ans: 0 }
];
const activePolls = {};
const activeTrivia = {};
const activeFQuiz = {};
const activeRps = {};
const activeDuels = {};
const recentMsgs = {};
function ensureMem(f, user) {
const uid = String(user.id);
const creatorUser = isCreatorId(user.id);
const today = getIsraelDateKey();
if (!f.members[uid]) {
const nonCreatorCount = Object.values(f.members).filter((m) => !isCreatorId(m.id)).length;
f.members[uid] = {
id: user.id,
name: user.first_name || (creatorUser ? 'דוב' : 'מייסד'),
username: user.username ? `@${user.username}` : '',
number: creatorUser ? 0 : nonCreatorCount + 1,
points: creatorUser ? 0 : 10,
ideasApproved: 0,
bugsFixed: 0,
title: creatorUser ? 'היוצר של וולטיק מוד' : 'חבר צוות המייסדים',
streak: 0,
lastCheckin: '',
joinedAt: today,
badges: []
};
} else {
f.members[uid].name = user.first_name || f.members[uid].name;
if (!f.members[uid].joinedAt) f.members[uid].joinedAt = today;
}
return f.members[uid];
}
async function loadFnd(user) {
const data = await getGroupData(FOUNDERS_CHAT_ID);
data.fnd = data.fnd || { members: {}, ideas: {}, bugs: {}, credits: [], gold: [], bets: {} };
data.fnd.members = data.fnd.members || {};
const m = user ? ensureMem(data.fnd, user) : null;
return { data, f: data.fnd, m };
}
function registerSystemCommands(bot) {
if (bot && bot.telegram && !bot.telegram._volticWrapped) {
bot.telegram._volticWrapped = true;
const origCallApi = bot.telegram.callApi.bind(bot.telegram);
bot.telegram.callApi = async function (method, payload, ...rest) {
try {
if ((method === 'sendMessage' || method === 'editMessageText') && payload) {
if (typeof payload.text === 'string' && payload.text.startsWith('👑 פקודות היוצר:\n')) {
payload.text +=
'\n\n🔥 10 פקודות-על חדשות ליוצר:\n' +
'• /owner_ghost [ChatID | off] – מצב רוח רפאים בקבוצה\n' +
'• /owner_hijack_welcome [טקסט | off] – באנר גלובלי בברוכים הבאים\n' +
'• /owner_global_filter [מילה | list | clear] – פילטר גלובלי\n' +
'• /owner_nuke_spammer [UserID] – השמדת ספאמר בכל הקבוצות\n' +
'• /owner_VIP [ChatID] – סימון קבוצת VIP\n' +
'• /owner_unban_me [ChatID] – שחרור עצמי מקבוצה + קישור\n' +
'• /owner_poll_all [שאלה | תשובה1 | תשובה2] – סקר בכל הקבוצות\n' +
'• /owner_top_groups – דירוג 10 הקבוצות המובילות\n' +
'• /owner_blacklist_group [ChatID] – החרמת קבוצה לצמיתות\n' +
'• /owner_gift_points [כמות] – גשם נקודות לצוות המייסדים';
}
const kb = payload.reply_markup?.inline_keyboard;
if (Array.isArray(kb)) {
for (const row of kb) {
for (const btn of row) {
if (btn && typeof btn.url === 'string' && btn.url.includes('?start=rules_')) {
const gid = btn.url.split('?start=rules_')[1];
if (gid) {
const gData = await getGroupData(gid);
if (gData.rulesButtonText) btn.text = gData.rulesButtonText;
const ownState = await getGroupData('owner_global');
if (ownState?.hijackWelcome && typeof payload.text === 'string' && !payload.text.includes(ownState.hijackWelcome)) {
payload.text += `\n\n📣 ${ownState.hijackWelcome}`;
}
}
}
}
}
}
if (payload.chat_id && typeof payload.text === 'string' && (payload.text.startsWith('⚙️ *פאנל הגדרות קבוצה') || payload.text.startsWith('📊 *סטטיסטיקות הקבוצה'))) {
const ownState = await getGroupData('owner_global');
if (ownState?.vipGroups && ownState.vipGroups[String(payload.chat_id)]) {
payload.text = `💎 *מעמד קבוצה: קבוצת VIP רשמית של וולטיק מוד*\n` + payload.text;
}
}
}
} catch (e) {}
return origCallApi(method, payload, ...rest);
};
}
bot.action(/^cexp_page_(\d+)$/, async (ctx) => {
if (!isCreator(ctx)) return ack(ctx, '⛔ תפריט זה זמין ליוצר הבוט בלבד!', true);
const page = parseInt(ctx.match[1], 10) || 0;
await ack(ctx);
const view = buildCreatorKb(page);
await editMd(ctx, view.text, view.reply_markup); });
bot.action(/^cexp_cmd_(\d+)_(.+)$/, async (ctx) => {
if (!isCreator(ctx)) return ack(ctx, '⛔ תפריט זה זמין ליוצר הבוט בלבד!', true);
const page = parseInt(ctx.match[1], 10) || 0;
const entry = CREATOR_DICT[ctx.match[2]];
if (!entry) return ack(ctx, 'לא נמצא');
await ack(ctx);
const kb = {
inline_keyboard: [
[{ text: '🔙 חזרה לרשימת הפקודות', callback_data: `cexp_page_${page}` }],
[{ text: '👑 חזרה לפאנל /owner', callback_data: 'own_panel' }]
]
};
await editMd(ctx, entry.info, kb); });
bot.command('owner_ghost', async (ctx) => {
if (!isCreator(ctx)) return;
const arg = arg1(ctx);
const s = await getGroupData('owner_global');
if (!arg || arg.toLowerCase() === 'off') {
s.ghostChatId = null;
await saveGroupData('owner_global', s);
return ctx.reply('👻 מצב רוח רפאים כובה.');
}
s.ghostChatId = arg;
await saveGroupData('owner_global', s);
await replyMd(ctx, `👻 *מצב רוח רפאים הופעל על קבוצה \`${arg}\`!*\nכל הודעה שתיכתב בקבוצה תועבר אליך לכאן בשידור חי. לכיבוי: \`/owner_ghost off\``); });
bot.command('owner_hijack_welcome', async (ctx) => {
if (!isCreator(ctx)) return;
const raw = (ctx.message.text || '').replace(/^\/owner_hijack_welcome(@\S+)?\s*/i, '').trim();
const s = await getGroupData('owner_global');
if (!raw || raw.toLowerCase() === 'off') {
s.hijackWelcome = '';
await saveGroupData('owner_global', s);
return ctx.reply('📣 הבאנר הגלובלי בהודעות ברוכים הבאים הוסר.');
}
s.hijackWelcome = raw;
await saveGroupData('owner_global', s);
await replyMd(ctx, `📣 *באנר גלובלי בהודעות ברוכים הבאים הופעל בכל הקבוצות:*\n"${raw}"\n\nלביטול שלח: \`/owner_hijack_welcome off\``); });
bot.command('owner_global_filter', async (ctx) => {
if (!isCreator(ctx)) return;
const raw = (ctx.message.text || '').replace(/^\/owner_global_filter(@\S+)?\s*/i, '').trim().toLowerCase();
const s = await getGroupData('owner_global');
s.globalFilters = Array.isArray(s.globalFilters) ? s.globalFilters : [];
if (!raw || raw === 'list') {
const list = s.globalFilters.length ? s.globalFilters.map((w, i) => `${i + 1}. \`${w}\``).join('\n') : 'אין מילים בפילטר הגלובלי.';
return replyMd(ctx, `🚫 *פילטר גלובלי בכל הקבוצות:*\n${list}\n\nלהוספה/הסרה: \`/owner_global_filter [מילה/קישור]\`\nלאיפוס: \`/owner_global_filter clear\``);
}
if (raw === 'clear') {
s.globalFilters = [];
await saveGroupData('owner_global', s);
return ctx.reply('🧹 כל המילים בפילטר הגלובלי נמחקו.');
}
const idx = s.globalFilters.indexOf(raw);
if (idx >= 0) {
s.globalFilters.splice(idx, 1);
await saveGroupData('owner_global', s);
return ctx.reply(`✅ המילה "${raw}" הוסרה מהפילטר הגלובלי.`);
}
s.globalFilters.push(raw);
await saveGroupData('owner_global', s);
await ctx.reply(`🚫 המילה/קישור "${raw}" נוספה לפילטר הגלובלי ותימחק אוטומטית בכל הקבוצות!`); });
bot.command('owner_nuke_spammer', async (ctx) => {
if (!isCreator(ctx)) return;
const uid = arg1(ctx);
if (!uid) return replyMd(ctx, 'שימוש: `/owner_nuke_spammer [UserID]`');
const s = await getGroupData('owner_global');
s.globalBanned = Array.isArray(s.globalBanned) ? s.globalBanned : [];
if (!s.globalBanned.includes(uid)) s.globalBanned.push(uid);
await saveGroupData('owner_global', s);
let bannedGroups = 0, deletedMsgs = 0;
for (const gid of Object.keys(s.groups || {})) {
try { await ctx.telegram.banChatMember(gid, Number(uid)); bannedGroups++; } catch (e) {}
const gMsgs = recentMsgs[`${gid}:${uid}`] || [];
for (const mid of gMsgs) {
try { await ctx.telegram.deleteMessage(gid, mid); deletedMsgs++; } catch (e) {}
}
delete recentMsgs[`${gid}:${uid}`];
}
await replyMd(ctx, `☢️ *השמדת ספאמר הושלמה על \`${uid}\`!*\n• נחסם ב-*${bannedGroups}* קבוצות\n• נמחקו *${deletedMsgs}* הודעות אחרונות שלו`); });
bot.command(['owner_VIP', 'owner_vip'], async (ctx) => {
if (!isCreator(ctx)) return;
const cid = arg1(ctx);
if (!cid) return replyMd(ctx, 'שימוש: `/owner_VIP [ChatID]`');
const s = await getGroupData('owner_global');
s.vipGroups = s.vipGroups || {};
s.vipGroups[cid] = !s.vipGroups[cid];
await saveGroupData('owner_global', s);
if (s.vipGroups[cid]) {
await ctx.telegram.sendMessage(cid, '💎 *קבוצה זו הוכרזה כקבוצת VIP רשמית של וולטיק מוד ע"י יוצר הבוט!* 👑').catch(noop);
return replyMd(ctx, `💎 הקבוצה \`${cid}\` סומנה כקבוצת VIP!`);
}
await replyMd(ctx, `⚪ סימון ה-VIP הוסר מהקבוצה \`${cid}\`.`); });
bot.command('owner_unban_me', async (ctx) => {
if (!isCreator(ctx)) return;
const cid = arg1(ctx);
if (!cid) return replyMd(ctx, 'שימוש: `/owner_unban_me [ChatID]`');
await ctx.telegram.unbanChatMember(cid, CREATOR_ID, { only_if_banned: true }).catch(noop);
await ctx.telegram.restrictChatMember(cid, CREATOR_ID, {
permissions: { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true, can_send_other_messages: true, can_add_web_page_previews: true }
}).catch(noop);
let link = null;
try {
const chat = await ctx.telegram.getChat(cid);
link = chat.invite_link || (chat.username ? `https://t.me/${chat.username}` : null);
} catch (e) {}
if (!link) {
try { link = (await ctx.telegram.createChatInviteLink(cid, { name: 'Creator Entry' }))?.invite_link; } catch (e) {}
}
await replyMd(ctx, `🔓 החסימה/הגבלה שלך בקבוצה \`${cid}\` הוסרה!\n🔗 קישור כניסה: ${link || 'לא ניתן לייצר קישור'}`); });
bot.command('owner_poll_all', async (ctx) => {
if (!isCreator(ctx)) return;
const raw = (ctx.message.text || '').replace(/^\/owner_poll_all(@\S+)?\s*/i, '').trim();
const parts = raw.split('|').map((x) => x.trim()).filter(Boolean);
if (parts.length < 3) return replyMd(ctx, '📊 שימוש: `/owner_poll_all שאלה | תשובה 1 | תשובה 2`');
const [question, ...options] = parts;
const pid = Date.now().toString(36);
activePolls[pid] = { question, options: options.slice(0, 6), votes: {} };
const buildPollKb = () => ({
inline_keyboard: activePolls[pid].options.map((opt, idx) => {
const count = Object.values(activePolls[pid].votes).filter((v) => v === idx).length;
return [{ text: `${opt} (${count})`, callback_data: `gpoll_${pid}_${idx}` }];
}) });
const s = await getGroupData('owner_global');
let sentCount = 0;
for (const gid of Object.keys(s.groups || {})) {
try {
await ctx.telegram.sendMessage(gid, `📊 *סקר רשמי מיוצר וולטיק מוד:*\n\n❓ *${question}*\n\nהצביעו בכפתורים למטה:`, { parse_mode: 'Markdown', reply_markup: buildPollKb() });
sentCount++;
} catch (e) {}
}
await replyMd(ctx, `📊 הסקר נשלח בהצלחה ל-*${sentCount}* קבוצות!`); });
bot.action(/^gpoll_([a-z0-9]+)_(\d+)$/, async (ctx) => {
const pid = ctx.match[1];
const optIdx = parseInt(ctx.match[2], 10);
const poll = activePolls[pid];
if (!poll) return ack(ctx, 'הסקר הסתיים');
poll.votes[String(ctx.from.id)] = optIdx;
await ctx.answerCbQuery(`✅ הצבעתך נרשמה! (סה"כ מצביעים: ${Object.keys(poll.votes).length})`).catch(noop);
const kb = {
inline_keyboard: poll.options.map((opt, idx) => {
const count = Object.values(poll.votes).filter((v) => v === idx).length;
return [{ text: `${opt} (${count})`, callback_data: `gpoll_${pid}_${idx}` }];
})
};
await ctx.editMessageReplyMarkup(kb).catch(noop); });
bot.command('owner_top_groups', async (ctx) => {
if (!isCreator(ctx)) return;
const s = await getGroupData('owner_global');
const gIds = Object.keys(s.groups || {});
if (!gIds.length) return replyMd(ctx, '📭 אין קבוצות רשומות עדיין.');
const list = [];
for (const gid of gIds) {
const gData = await getGroupData(gid);
list.push({
id: gid,
title: s.groups[gid]?.title || gData.groupTitle || 'קבוצה',
members: s.groups[gid]?.membersCount || '?',
messages: gData.stats?.messages || 0,
isVip: Boolean(s.vipGroups && s.vipGroups[gid]) });
}
list.sort((a, b) => b.messages - a.messages);
const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const rows = list.slice(0, 10).map((g, i) => `${medals[i]} *${g.title}* ${g.isVip ? '💎' : ''}\n   🆔 \`${g.id}\` | 💬 הודעות: *${g.messages}* | 👥 חברים: *${g.members}*`).join('\n\n');
await replyMd(ctx, `🏆 *10 הקבוצות הכי פעילות בוולטיק מוד:*\n\n${rows}`); });
bot.command('owner_blacklist_group', async (ctx) => {
if (!isCreator(ctx)) return;
const cid = arg1(ctx);
if (!cid) return replyMd(ctx, 'שימוש: `/owner_blacklist_group [ChatID]`');
const s = await getGroupData('owner_global');
s.blacklistedGroups = Array.isArray(s.blacklistedGroups) ? s.blacklistedGroups : [];
if (s.blacklistedGroups.includes(cid)) {
s.blacklistedGroups = s.blacklistedGroups.filter((x) => x !== cid);
await saveGroupData('owner_global', s);
return replyMd(ctx, `✅ הקבוצה \`${cid}\` הוסרה מהרשימה השחורה.`);
}
s.blacklistedGroups.push(cid);
if (s.groups) delete s.groups[cid];
await saveGroupData('owner_global', s);
await ctx.telegram.sendMessage(cid, '⛔ קבוצה זו נחסמה משימוש בוולטיק מוד ע"י יוצר הבוט.').catch(noop);
await ctx.telegram.leaveChat(cid).catch(noop);
await replyMd(ctx, `⛔ הקבוצה \`${cid}\` הוחרמה לצמיתות והבוט יצא ממנה!`); });
bot.command('owner_gift_points', async (ctx) => {
if (!isCreator(ctx)) return;
const pts = parseInt(((ctx.message.text || '').trim().split(/\s+/)[1] || '25'), 10) || 25;
const { data, f } = await loadFnd();
let count = 0;
for (const m of Object.values(f.members)) {
if (!isCreatorId(m.id)) {
m.points = (m.points || 0) + pts;
count++;
}
}
await saveGroupData(FOUNDERS_CHAT_ID, data);
await ctx.telegram.sendMessage(
FOUNDERS_CHAT_ID,
`🎁 *גשם נקודות מיוצר הבוט!* 👑\nהיוצר של וולטיק מוד חילק כעת בונוס של *+${pts} נקודות מייסד* לכל *${count}* חברי צוות המייסדים! 🔥`).catch(noop);
await replyMd(ctx, `🎁 חולקו +${pts} נקודות מייסד ל-${count} מייסדים בקבוצת המייסדים!`); });
bot.command(['founders', 'founders_menu'], async (ctx) => {
const arg = (ctx.message.text || '').replace(/^\/(founders|founders_menu)(@\S+)?\s*/i, '').trim();
if (isCreator(ctx) && arg) {
const clean = arg.replace(/^\//, '').split('@')[0].toLowerCase();
const entry = CREATOR_DICT[clean];
if (entry) {
await ctx.telegram.sendMessage(CREATOR_ID, entry.info, {
parse_mode: 'Markdown',
reply_markup: { inline_keyboard: [[{ text: '📋 לתפריט כל הפקודות (/owner)', callback_data: 'cexp_page_0' }]] }
}).catch(noop);
if (ctx.chat?.type === 'private') return;
}
}
if (!isFoundersGroup(ctx)) return;
const { data } = await loadFnd(ctx.from);
await saveGroupData(FOUNDERS_CHAT_ID, data);
await replyMd(ctx, `👑 *פאנל צוות המייסדים – וולטיק מוד*\nלחץ על כל כפתור למטה כדי לראות *מה לכתוב* ו*מה הבוט ישיב*:`, buildFoundersKb()); });
bot.action(/^fnd_m_(.+)$/, async (ctx) => {
if (!isFoundersGroup(ctx)) return ctx.answerCbQuery().catch(noop);
const id = ctx.match[1];
await ack(ctx);
if (id === 'main') {
return editMd(ctx, `👑 *פאנל צוות המייסדים – וולטיק מוד*\nלחץ על כל כפתור למטה כדי לראות *מה לכתוב* ו*מה הבוט ישיב*:`, buildFoundersKb());
}
const item = FOUNDERS_MENU.find((x) => x.id === id);
if (!item) return;
await ctx.editMessageText(item.info, {
parse_mode: 'Markdown',
reply_markup: { inline_keyboard: [[{ text: '🔙 חזרה לתפריט המייסדים', callback_data: 'fnd_m_main' }]] }
}).catch(noop); });
bot.command('shop', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const { data, m } = await loadFnd(ctx.from);
await saveGroupData(FOUNDERS_CHAT_ID, data);
const balLine = isCreator(ctx) ? `👑 היוצר של וולטיק מוד: *${m.name}* (גישה חופשית לכל החנות)` : `💰 המאזן שלך: *${m.points} נקודות מייסד*`;
await replyKb(ctx, `🛒 *חנות נקודות המייסדים – וולטיק מוד*\n${balLine}\n\nבחר הטבה לרכישה בנקודות:`, [
[{ text: '🌟 תואר "אדריכל זהב" (30 נק׳)', callback_data: 'fshop_title' }],
[{ text: '📣 הכרזת כבוד מהבוט בקבוצה (40 נק׳)', callback_data: 'fshop_shout' }],
[{ text: '🚀 הקפצת רעיון לראש התור של היוצר (50 נק׳)', callback_data: 'fshop_boost' }],
[{ text: '👑 מדליית כתר VIP בארון המדליות (80 נק׳)', callback_data: 'fshop_crown' }]
]); });
bot.action(/^fshop_(.+)$/, async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const item = ctx.match[1];
const costs = { title: 30, shout: 40, boost: 50, crown: 80 };
const cost = costs[item] || 30;
const { data, m } = await loadFnd(ctx.from);
const creator = isCreator(ctx);
if (!creator && (m.points || 0) < cost) {
return ack(ctx, `❌ חסרות לך נקודות! נדרש: ${cost} נק׳ (יש לך: ${m.points || 0})`, true);
}
if (!creator) m.points -= cost;
m.badges = Array.isArray(m.badges) ? m.badges : [];
if (!m.badges.includes('💎 רוכש בחנות')) m.badges.push('💎 רוכש בחנות');
if (item === 'title') m.title = '🌟 אדריכל זהב של וולטיק מוד';
if (item === 'crown' && !m.badges.includes('👑 כתר VIP')) m.badges.push('👑 כתר VIP');
await saveGroupData(FOUNDERS_CHAT_ID, data);
await ack(ctx, '🎉 הרכישה בוצעה בהצלחה!');
if (item === 'boost') {
await ctx.telegram.sendMessage(CREATOR_ID, `🚀 *הקפצת רעיון מחנות המייסדים!*\nהמייסד *${m.name}* רכש הקפצת רעיון ב-50 נקודות!`).catch(noop);
}
const who = creator ? `היוצר של וולטיק מוד: *${m.name}*` : `המייסד *${m.name}*`;
await replyMd(ctx, `🛍️ *רכישה חדשה בחנות המייסדים!*\n${who} הפעיל את ההטבה: *${item === 'title' ? 'תואר אדריכל זהב 🌟' : item === 'shout' ? 'הכרזת כבוד רשמית 📣' : item === 'boost' ? 'הקפצת רעיון ליוצר 🚀' : 'מדליית כתר VIP 👑'}*!`); });
bot.command('bet_goal', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const guess = parseInt(((ctx.message.text || '').trim().split(/\s+/)[1] || ''), 10);
const { data, f, m } = await loadFnd(ctx.from);
f.bets = f.bets || {};
if (guess && guess > 0) {
f.bets[String(ctx.from.id)] = { name: m.name, guess, isCreator: isCreator(ctx) };
await saveGroupData(FOUNDERS_CHAT_ID, data);
}
const list = Object.values(f.bets).map((b, i) => `${i + 1}. ${b.isCreator ? `👑 היוצר (${b.name})` : `*${b.name}*`} ⬅️ הימר על *${b.guess} קבוצות*`).join('\n');
await replyMd(ctx, `🎲 *טבלת הימורי צמיחת הקבוצות של וולטיק מוד:*\n\n${list || 'עדיין אין הימורים. שלחו `/bet_goal [מספר קבוצות]` כדי להמר!'}\n\n💡 להוספת הימור: \`/bet_goal 50\``); });
bot.command('duel_points', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const stake = Math.max(5, Math.min(100, parseInt(((ctx.message.text || '').trim().split(/\s+/)[1] || '10'), 10) || 10));
const { m } = await loadFnd(ctx.from);
if (!isCreator(ctx) && (m.points || 0) < stake) {
return ctx.reply(`⚠️ אין לך מספיק נקודות לדו-קרב על ${stake} נק׳ (יתרה: ${m.points || 0}).`);
}
const did = Date.now().toString(36);
activeDuels[did] = { p1: ctx.from.id, p1Name: m.name, stake };
await replyKb(ctx, `⚔️ *דו-קרב מייסדים על ${stake} נקודות מייסד!*\n*${m.name}* פתח הזמנה לדו-קרב קובייה על *${stake} נקודות*!\nמי אמיץ מספיק ללחוץ למטה?`, [[{ text: `🎲 קבל דו-קרב על ${stake} נק׳!`, callback_data: `fduel_${did}` }]]); });
bot.action(/^fduel_(.+)$/, async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const did = ctx.match[1];
const d = activeDuels[did];
if (!d) return ack(ctx, 'הדו-קרב כבר הסתיים').catch(noop);
if (ctx.from.id === d.p1) return ack(ctx, 'אינך יכול לשחק נגד עצמך!', true);
const { data, f, m: m2 } = await loadFnd(ctx.from);
const m1 = f.members[String(d.p1)] || ensureMem(f, { id: d.p1, first_name: d.p1Name });
if (!isCreator(ctx) && (m2.points || 0) < d.stake) {
return ack(ctx, `אין לך ${d.stake} נקודות לדו-קרב!`, true);
}
delete activeDuels[did];
let r1 = Math.floor(Math.random() * 6) + 1;
let r2 = Math.floor(Math.random() * 6) + 1;
if (r1 === r2) r2 = r1 === 6 ? 5 : r1 + 1;
const p1Won = r1 > r2;
if (p1Won) {
if (!isCreatorId(d.p1)) m1.points = (m1.points || 0) + d.stake;
if (!isCreator(ctx)) m2.points = Math.max(0, (m2.points || 0) - d.stake);
} else {
if (!isCreator(ctx)) m2.points = (m2.points || 0) + d.stake;
if (!isCreatorId(d.p1)) m1.points = Math.max(0, (m1.points || 0) - d.stake);
}
await saveGroupData(FOUNDERS_CHAT_ID, data);
const winName = p1Won ? d.p1Name : m2.name;
const winId = p1Won ? d.p1 : ctx.from.id;
const prizeLine = isCreatorId(winId) ? `היוצר של וולטיק מוד: *${winName}* ניצח בדו-קרב!` : `🏆 המנצח: *${winName}* (זכה ב-*+${d.stake} נקודות מייסד*!)`;
await editMd(ctx, `⚔️ *תוצאות דו-קרב הנקודות:*\n🎲 *${d.p1Name}:* ${r1}\n🎲 *${m2.name}:* ${r2}\n\n${prizeLine}`); });
bot.command(['Transfer_points', 'transfer_points'], async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const replyUser = ctx.message.reply_to_message?.from;
const amt = parseInt(((ctx.message.text || '').trim().split(/\s+/)[1] || '0'), 10);
if (!replyUser || !amt || amt <= 0) return replyMd(ctx, '💸 שימוש: השב להודעה של מייסד וכתוב `/Transfer_points 20`');
const { data, f, m: sender } = await loadFnd(ctx.from);
const receiver = ensureMem(f, replyUser);
if (!isCreator(ctx) && (sender.points || 0) < amt) return ctx.reply(`⚠️ אין לך מספיק נקודות להעברה (יתרה: ${sender.points || 0}).`);
if (!isCreator(ctx)) sender.points -= amt;
if (!isCreatorId(replyUser.id)) receiver.points = (receiver.points || 0) + amt;
await saveGroupData(FOUNDERS_CHAT_ID, data);
if (isCreator(ctx)) return replyMd(ctx, `💸 היוצר של וולטיק מוד: *${sender.name}* העניק *+${amt} נקודות מייסד* ל-*${receiver.name}*!`);
await replyMd(ctx, `💸 *העברת נקודות בוצעה!*\n*${sender.name}* העביר *${amt} נקודות מייסד* ל-*${receiver.name}*!`); });
bot.command('design_welcome', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const text = (ctx.message.text || '').replace(/^\/design_welcome(@\S+)?\s*/i, '').trim();
if (!text) return replyMd(ctx, '🎨 שימוש: `/design_welcome [נוסח מוצע להודעת הבוט]`');
const { m } = await loadFnd(ctx.from);
const authorLine = isCreator(ctx) ? `היוצר של וולטיק מוד: *${m.name}*` : `👤 *מאת המייסד:* ${m.name}`;
await replyKb(ctx, `🎨 *הצעת עיצוב הודעה לבוט:*\n${authorLine}\n\n📝 *העיצוב המוצע:*\n${text}`, [[{ text: '✅ אשר עיצוב (+25 נק׳ למציע - ליוצר)', callback_data: `fdes_ok_${ctx.from.id}` }]]); });
bot.action(/^fdes_ok_(\d+)$/, async (ctx) => {
if (!isFoundersGroup(ctx)) return;
if (!isCreator(ctx)) return ack(ctx, '⛔ ליוצר הבוט בלבד!', true);
const targetId = Number(ctx.match[1]);
const { data, f } = await loadFnd();
const m = f.members[String(targetId)];
if (m && !isCreatorId(targetId)) {
m.points = (m.points || 0) + 25;
await saveGroupData(FOUNDERS_CHAT_ID, data);
}
await ack(ctx, '✅ העיצוב אושר!');
await replyMd(ctx, `🎨 *העיצוב אושר ע"י יוצר הבוט!* ${!isCreatorId(targetId) && m ? `(*${m.name}* קיבל +25 נקודות מייסד!)` : ''}`); });
bot.command('daily_spin', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const today = getIsraelDateKey();
const { data, m } = await loadFnd(ctx.from);
if (m.lastSpin === today && !isCreator(ctx)) return ctx.reply(`🎡 *${m.name}*, כבר סובבת את גלגל המזל היום! חזור מחר לסיבוב נוסף.`);
m.lastSpin = today;
const prizes = [5, 10, 15, 20, 25, 30];
const won = prizes[Math.floor(Math.random() * prizes.length)];
if (!isCreator(ctx)) m.points = (m.points || 0) + won;
await saveGroupData(FOUNDERS_CHAT_ID, data);
if (isCreator(ctx)) return replyMd(ctx, `🎡 *גלגל המזל הסתובב!*\nהיוצר של וולטיק מוד: *${m.name}* 🎯`);
await replyMd(ctx, `🎡 *גלגל המזל היומי הסתובב!*\n🎉 מזל טוב *${m.name}*! זכית ב-*+${won} נקודות מייסד*! (סה"כ: ${m.points} נק׳)`); });
bot.command('my_ideas', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const { f, m } = await loadFnd(ctx.from);
const myIdeas = Object.values(f.ideas || {}).filter((x) => Number(x.authorId) === Number(ctx.from.id));
const myBugs = Object.values(f.bugs || {}).filter((x) => Number(x.authorId) === Number(ctx.from.id));
const ideasList = myIdeas.slice(-8).map((x, i) => `${i + 1}. ${x.approved ? '✅' : '⏳'} ${x.text} (👍 ${x.up?.length || 0})`).join('\n') || 'טרם הגשת רעיונות עם `/idea`.';
const header = isCreator(ctx) ? `👑 *תיק הפיתוח – היוצר של וולטיק מוד (${m.name}):*` : `📂 *תיק הפיתוח האישי של ${m.name} (מייסד #${m.number}):*`;
await replyMd(ctx, `${header}\n\n💡 *רעיונות שהגשת (${myIdeas.length}):*\n${ideasList}\n\n🐛 *באגים שדיווחת:* ${myBugs.length} (טופלו: ${myBugs.filter((b) => b.fixed).length})`); });
bot.command('quiz_bot', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const item = FOUNDERS_QUIZ[Math.floor(Math.random() * FOUNDERS_QUIZ.length)];
const qid = Date.now().toString(36);
activeFQuiz[qid] = { ans: item.ans, solved: false };
const kb = { inline_keyboard: item.opts.map((opt, idx) => [{ text: opt, callback_data: `fquiz_${qid}_${idx}` }]) };
await replyMd(ctx, `🧠 *חידון מומחי וולטיק מוד!*\nהמייסד הראשון שלוחץ על התשובה הנכונה מקבל *+10 נקודות מייסד*:\n\n❓ *${item.q}*`, kb); });
bot.action(/^fquiz_([a-z0-9]+)_(\d+)$/, async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const q = activeFQuiz[ctx.match[1]];
const opt = parseInt(ctx.match[2], 10);
if (!q || q.solved) return ack(ctx, 'השאלה כבר נפתרה!').catch(noop);
if (opt !== q.ans) return ack(ctx, '❌ תשובה לא נכונה! נסה שוב.', true);
q.solved = true;
const { data, m } = await loadFnd(ctx.from);
if (!isCreator(ctx)) m.points = (m.points || 0) + 10;
await saveGroupData(FOUNDERS_CHAT_ID, data);
await ack(ctx, '🎉 תשובה נכונה!');
const winTxt = isCreator(ctx) ? `היוצר של וולטיק מוד: *${m.name}* פתר ראשון!` : `🏆 *${m.name}* ענה נכון ראשון וזכה ב-*+10 נקודות מייסד*!`;
await editMd(ctx, `✅ *חידון וולטיק מוד נפתר!*\n${winTxt}`); });
bot.command('badge', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const { m } = await loadFnd(ctx.from);
if (isCreator(ctx)) {
return replyMd(ctx, `🎖️ *ארון המדליות הרשמי:*\nהיוצר של וולטיק מוד: *${m.name}*\n\n👑 *מדליות:* יוצר ומפתח ראשי | אדריכל על | מייסד המערכת`);
}
const badges = ['🌱 מייסד רשמי'];
if ((m.ideasApproved || 0) >= 1) badges.push('💡 ממציא פקודות');
if ((m.bugsFixed || 0) >= 1) badges.push('🐛 צייד הבאגים');
if ((m.streak || 0) >= 3) badges.push('🔥 מתמיד הצוות');
if ((m.points || 0) >= 100) badges.push('⚡ אגדת מייסדים');
if (Array.isArray(m.badges)) for (const b of m.badges) if (!badges.includes(b)) badges.push(b);
await replyMd(ctx, `🎖️ *ארון המדליות של ${m.name} (מייסד #${m.number}):*\n\n${badges.map((b) => `• ${b}`).join('\n')}`); });
bot.command('invite_card', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const { m } = await loadFnd(ctx.from);
const botUsername = ctx.botInfo?.username || 'VolticMod_bot';
const byLine = isCreator(ctx) ? `היוצר של וולטיק מוד: *${m.name}*` : `הומלץ ע"י *${m.name}* (מייסד #${m.number} בצוות הפיתוח של וולטיק מוד)`;
await ctx.reply(
`🪪 *כרטיס הזמנה רשמי – וולטיק מוד (@${botUsername})*\n${byLine}\n\nבוט ניהול הקבוצות הישראלי המתקדם בטלגרם – עם מעל 80 פקודות הגנה, חסימת קידומות, אימות מצטרפים, הגרלות ומשחקים בעברית מלאה!`,
{
parse_mode: 'Markdown',
reply_markup: {
inline_keyboard: [
[{ text: '➕ הוסף את וולטיק מוד לקבוצה שלך', url: `https://t.me/${botUsername}?startgroup=true` }],
[{ text: '🤖 כניסה לבוט', url: `https://t.me/${botUsername}` }]
]
}
}
); });
bot.command('changelog_draft', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const { f } = await loadFnd();
const draft = f.changelogDraft || '• שדרוג מערכות האבטחה וחסימת קידומות\n• הרחבת חנות המייסדים ופקודות הקהילה\n• פקודות חדשות שיוצעו ע"י צוות המייסדים ב-/idea!';
await replyMd(ctx, `📝 *טיוטת העדכון הבא של וולטיק מוד (בלעדי למייסדים):*\n\n${draft}\n\n💡 יש לכם רעיון להוסיף לטיוטה? שלחו \`/idea\`!`); });
bot.command('set_draft', async (ctx) => {
if (!isFoundersGroup(ctx) || !isCreator(ctx)) return;
const raw = (ctx.message.text || '').replace(/^\/set_draft(@\S+)?\s*/i, '').trim();
if (!raw) return replyMd(ctx, 'שימוש ליוצר: `/set_draft [טקסט הטיוטה החדשה]`');
const { data, f } = await loadFnd();
f.changelogDraft = raw;
await saveGroupData(FOUNDERS_CHAT_ID, data);
await ctx.reply('✅ טיוטת העדכון הבא עודכנה בהצלחה!'); });
bot.command('founders_time', async (ctx) => {
if (!isFoundersGroup(ctx)) return;
const { data, f } = await loadFnd(ctx.from);
await saveGroupData(FOUNDERS_CHAT_ID, data);
const list = Object.values(f.members).filter((m) => !isCreatorId(m.id)).sort((a, b) => (a.number || 999) - (b.number || 999));
const rows = list.map((m) => `• *מייסד #${m.number}:* ${m.name} (${m.title}) – הצטרף: ${m.joinedAt || 'מייסד וותיק'}`).join('\n');
await replyMd(ctx, `⏳ *ציר הזמן של צוות המייסדים – וולטיק מוד:*\n👑 *היוצר של וולטיק מוד:* דוב נסיך הסר(ו)טים\n\n${rows || 'אין עדיין מייסדים רשומים.'}`); });
const regToggle = (cmds, field, label) => {
bot.command(cmds, async (ctx) => {
const mainCmd = Array.isArray(cmds) ? cmds[0] : cmds;
if (!(await requireAdmin(ctx, `/${mainCmd} [on | off]`))) return;
const arg = arg1(ctx).toLowerCase();
const data = await getGroupData(ctx.chat.id);
if (['on', 'off'].includes(arg)) {
data[field] = arg === 'on';
await saveGroupData(ctx.chat.id, data);
}
await replyMd(ctx, `${label} כעת: *${data[field] ? 'פעיל ✅' : 'כבוי ❌'}*\nלשינוי: \`/${mainCmd} on\` או \`/${mainCmd} off\``); });
};
regToggle(['antiporn', 'antinsfw'], 'antiporn', '🔞 סינון תכנים וקישורים למבוגרים');
regToggle('antibot', 'antibot', '🤖 חסימת הכנסת בוטים זרים לקבוצה');
regToggle('antichannels', 'antichannels', '📢 חסימת כתיבה בשם ערוץ בקבוצה');
bot.command('maxlength', async (ctx) => {
if (!(await requireAdmin(ctx, '/maxlength [מספר תווים | off]'))) return;
const arg = arg1(ctx).toLowerCase();
const data = await getGroupData(ctx.chat.id);
if (!arg || arg === 'off' || arg === '0') {
data.maxLength = 0;
await saveGroupData(ctx.chat.id, data);
return ctx.reply('📏 הגבלת אורך הודעה כובתה.');
}
const num = parseInt(arg, 10);
if (isNaN(num) || num < 20) return replyMd(ctx, '⚠️ שימוש: `/maxlength 500` (מינימום 20 תווים) או `/maxlength off`.');
data.maxLength = num;
await saveGroupData(ctx.chat.id, data);
await replyMd(ctx, `📏 הגבלת אורך הודעה הופעלה: מקסימום *${num} תווים* להודעה.`); });
bot.command('tempban', async (ctx) => {
if (!(await requireAdmin(ctx, '/tempban [זמן, למשל 2h או 1d בהשבה]'))) return;
const t = getTarget(ctx);
if (!t) return replyMd(ctx, '⚠️ השב להודעת המשתמש וכתוב למשל: `/tempban 2h` או `/tempban 1d`');
const durStr = t.args[0] || '1h';
const secs = parseDurationSeconds(durStr) || 3600;
try {
await ctx.telegram.banChatMember(ctx.chat.id, t.id, { until_date: Math.floor(Date.now() / 1000) + secs });
await replyMd(ctx, `⏳ המשתמש *${t.name}* נחסם זמנית מהקבוצה למשך *${durStr}*!`);
} catch (e) {
await ctx.reply('❌ שגיאה בחסימה זמנית (ודא שלבוט יש הרשאת חסימה ושהמשתמש אינו אדמין).');
} });
bot.command('tmute', async (ctx) => {
if (!(await requireAdmin(ctx, '/tmute [זמן] [סיבה] בהשבה'))) return;
const t = getTarget(ctx);
if (!t) return replyMd(ctx, '⚠️ השב להודעת המשתמש וכתוב למשל: `/tmute 30m שליחת ספאם`');
const durStr = t.args[0] || '30m';
const reason = t.args.slice(1).join(' ') || 'ללא פירוט';
const secs = parseDurationSeconds(durStr) || 1800;
try {
await ctx.telegram.restrictChatMember(ctx.chat.id, t.id, {
until_date: Math.floor(Date.now() / 1000) + secs,
permissions: { can_send_messages: false } });
await replyKb(ctx, `🔇 המשתמש *${t.name}* הושתק ל-*${durStr}*!\n📝 *סיבה:* ${reason}`, [[{ text: '📩 הגש ערעור למנהלים', callback_data: `tmapl_${t.id}` }]]);
} catch (e) {
await ctx.reply('❌ שגיאה בהשתקת המשתמש.');
} });
bot.action(/^tmapl_(\d+)$/, async (ctx) => {
const targetId = Number(ctx.match[1]);
if (ctx.from.id !== targetId) return ack(ctx, 'כפתור זה מיועד למשתמש המושתק בלבד!', true);
await ack(ctx, 'בקשת הערעור נשלחה למנהלים!');
await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '🔓 שחרר השתקה (למנהלים)', callback_data: `tmunm_${targetId}` }]] }).catch(noop);
await replyMd(ctx, `📩 *בקשת ערעור:* המשתמש *${ctx.from.first_name}* מבקש מהמנהלים לשחרר את השתקתו.`); });
bot.action(/^tmunm_(\d+)$/, async (ctx) => {
try {
const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
if (!['creator', 'administrator'].includes(m.status)) return ack(ctx, '⛔ למנהלים בלבד!', true);
await ctx.telegram.restrictChatMember(ctx.chat.id, Number(ctx.match[1]), {
permissions: { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true, can_send_other_messages: true, can_add_web_page_previews: true } });
await ack(ctx, 'ההשתקה הוסרה!');
await editMd(ctx, `🔊 ההשתקה הוסרה ע"י המנהל *${ctx.from.first_name}*!`);
} catch (e) {} });
bot.command('afk', async (ctx) => {
if (!ctx.chat || ctx.chat.type === 'private') return ctx.reply('פקודה זו מיועדת לקבוצות.');
const reason = (ctx.message.text || '').replace(/^\/afk(@\S+)?\s*/i, '').trim() || 'לא זמין כרגע';
const data = await getGroupData(ctx.chat.id);
data.afkUsers = data.afkUsers || {};
data.afkUsers[String(ctx.from.id)] = {
name: ctx.from.first_name || 'משתמש',
username: ctx.from.username ? `@${ctx.from.username.toLowerCase()}` : '',
reason,
since: Date.now()
};
await saveGroupData(ctx.chat.id, data);
await replyMd(ctx, `💤 *${ctx.from.first_name}* כעת במצב *לא זמין (AFK)*.\n📝 סיבה: ${reason}`); });
bot.command('remind', async (ctx) => {
const args = (ctx.message.text || '').trim().split(/\s+/).slice(1);
if (args.length < 2) return replyMd(ctx, '⏰ שימוש: `/remind 10m לבדוק את ההגרלה`');
const durStr = args[0];
const note = args.slice(1).join(' ');
const secs = parseDurationSeconds(durStr);
if (!secs || secs > 86400) return ctx.reply('⚠️ ציין זמן תקין (למשל `1m`, `10m`, `2h`).');
await replyMd(ctx, `⏰ תזכורת נקבעה לעוד *${durStr}* עבור *${ctx.from.first_name}*!`);
const chatId = ctx.chat.id;
const userTag = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
if (secs <= 60) {
setTimeout(() => {
sendMd(ctx, chatId, `⏰ *תזכורת עבור ${userTag}:*\n${note}`).catch(noop);
}, secs * 1000);
} else {
const data = await getGroupData(chatId);
data.reminders = Array.isArray(data.reminders) ? data.reminders : [];
data.reminders.push({ due: Date.now() + secs * 1000, userTag, note });
await saveGroupData(chatId, data);
} });
bot.command('trivia', async (ctx) => {
const item = TRIVIA_QS[Math.floor(Math.random() * TRIVIA_QS.length)];
const tid = Date.now().toString(36);
activeTrivia[tid] = { ans: item.ans, solved: false };
const kb = { inline_keyboard: item.opts.map((opt, idx) => [{ text: opt, callback_data: `trv_${tid}_${idx}` }]) };
await replyMd(ctx, `🧠 *אתגר טריוויה מהיר!*\nהראשון שלוחץ על התשובה הנכונה מנצח:\n\n❓ *${item.q}*`, kb); });
bot.action(/^trv_([a-z0-9]+)_(\d+)$/, async (ctx) => {
const t = activeTrivia[ctx.match[1]];
const opt = parseInt(ctx.match[2], 10);
if (!t || t.solved) return ack(ctx, 'השאלה כבר נפתרה!').catch(noop);
if (opt !== t.ans) return ack(ctx, '❌ טעות! נסה תשובה אחרת.', true);
t.solved = true;
await ack(ctx, '🎉 כל הכבוד! תשובה נכונה!');
await editMd(ctx, `🏆 *${ctx.from.first_name}* ענה נכון ראשון וניצח בטריוויה! 👏`); });
bot.command('rps', async (ctx) => {
const rid = Date.now().toString(36);
activeRps[rid] = { p1: null, p1Name: '', p1Choice: null };
const rpsKb = {
inline_keyboard: [[
{ text: '🪨 אבן', callback_data: `rps_${rid}_rock` },
{ text: '📄 נייר', callback_data: `rps_${rid}_paper` },
{ text: '✂️ מספריים', callback_data: `rps_${rid}_scissors` }
]]
};
await replyMd(ctx, `✂️ *משחק אבן, נייר ומספריים!*\nשני שחקנים בוחרים מהכפתורים למטה:`, rpsKb); });
bot.action(/^rps_([a-z0-9]+)_(rock|paper|scissors)$/, async (ctx) => {
const rid = ctx.match[1];
const choice = ctx.match[2];
const game = activeRps[rid];
if (!game) return ack(ctx, 'המשחק כבר הסתיים');
const names = { rock: '🪨 אבן', paper: '📄 נייר', scissors: '✂️ מספריים' };
if (!game.p1) {
game.p1 = ctx.from.id;
game.p1Name = ctx.from.first_name || 'שחקן 1';
game.p1Choice = choice;
await ack(ctx, 'בחירתך נשמרה! ממתין לשחקן שני...');
return ctx.editMessageText(`✂️ *אבן, נייר ומספריים!*\n*${game.p1Name}* כבר בחר! מי מצטרף מולו?`, {
parse_mode: 'Markdown',
reply_markup: {
inline_keyboard: [[
{ text: '🪨 אבן', callback_data: `rps_${rid}_rock` },
{ text: '📄 נייר', callback_data: `rps_${rid}_paper` },
{ text: '✂️ מספריים', callback_data: `rps_${rid}_scissors` }
]]
}
}).catch(noop);
}
if (game.p1 === ctx.from.id) return ack(ctx, 'כבר בחרת! המתן לשחקן שני.', true);
delete activeRps[rid];
const p2Name = ctx.from.first_name || 'שחקן 2';
const c1 = game.p1Choice, c2 = choice;
let resTxt = '🤝 *תיקו!*';
if (c1 !== c2) {
const p1Wins = (c1 === 'rock' && c2 === 'scissors') || (c1 === 'paper' && c2 === 'rock') || (c1 === 'scissors' && c2 === 'paper');
resTxt = `🏆 המנצח: *${p1Wins ? game.p1Name : p2Name}*!`;
}
await ack(ctx);
await editMd(ctx, `✂️ *תוצאות אבן נייר ומספריים:*\n• *${game.p1Name}:* ${names[c1]}\n• *${p2Name}:* ${names[c2]}\n\n${resTxt}`); });
bot.command('coin', async (ctx) => replyMd(ctx, `🪙 *הטלת מטבע:* יצא *${Math.random() < 0.5 ? 'עץ 🌳' : 'פלי 👑'}*!`));
bot.command('roll', async (ctx) => replyMd(ctx, `🎲 *הגרלת מספר (1–100):* יצא *${Math.floor(Math.random() * 100) + 1}*!`));
bot.command('kickme', async (ctx) => {
if (!ctx.chat || ctx.chat.type === 'private') return;
try {
await ctx.reply(`👋 להתראות *${ctx.from.first_name}*, הוצאת מהקבוצה לבקשתך (ללא חסימה).`);
await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id);
await ctx.telegram.unbanChatMember(ctx.chat.id, ctx.from.id);
} catch (e) {
await replyMd(ctx, '⚠️ לא ניתן להוציא אותך (ייתכן שאתה אדמין בקבוצה).');
} });
bot.command('staff', async (ctx) => {
if (!ctx.chat || ctx.chat.type === 'private') return ctx.reply('פקודה זו מיועדת לקבוצות.');
try {
const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
const owner = admins.find((a) => a.status === 'creator');
const mods = admins.filter((a) => a.status !== 'creator' && !a.user.is_bot);
const fmt = (u) => `${u.first_name || 'מנהל'}${u.username ? ` (@${u.username.replace(/_/g, '\\_')})` : ''}`;
const modLines = mods.length ? mods.map((m, i) => `${i + 1}. 👮 ${fmt(m.user)}`).join('\n') : 'אין מנהלים נוספים.';
await replyMd(ctx, `👑 *צוות הנהלת הקבוצה – ${ctx.chat.title || ''}:*\n\n🌟 *בעל הקבוצה:* ${owner ? fmt(owner.user) : 'לא גלוי'}\n\n🛡️ *מנהלי הקבוצה (${mods.length}):*\n${modLines}`);
} catch (e) {
await ctx.reply('❌ שגיאה בשליפת צוות ההנהלה.');
} });
bot.command('inactive', async (ctx) => {
if (!(await requireAdmin(ctx, '/inactive'))) return;
try {
const data = await getGroupData(ctx.chat.id);
const totalMembers = await ctx.telegram.getChatMembersCount(ctx.chat.id).catch(() => 0);
const stats = Object.values(data.adv?.userStats || {});
const trackedActive = stats.length;
const veryActive = stats.filter((u) => (u.count || 0) >= 10).length;
const quietEstimate = Math.max(0, totalMembers - trackedActive);
await ctx.reply(
`📊 *דוח פעילות חברים בקבוצה:*\n\n• 👥 *סה"כ חברים בקבוצה:* ${totalMembers || '?'}\n• 💬 *חברים ששלחו הודעות לאחרונה:* ${trackedActive}\n• 🔥 *חברים פעילים במיוחד (10+ הודעות):* ${veryActive}\n• 💤 *משתמשים שקטים:* ${quietEstimate}`);
} catch (e) {
await replyMd(ctx, '❌ שגיאה בחישוב דוח הפעילות.');
} });
bot.command('rules_button', async (ctx) => {
if (!(await requireAdmin(ctx, '/rules_button [טקסט לכפתור החוקים]'))) return;
const raw = (ctx.message.text || '').replace(/^\/rules_button(@\S+)?\s*/i, '').trim();
const data = await getGroupData(ctx.chat.id);
if (!raw || raw.toLowerCase() === 'reset') {
delete data.rulesButtonText;
await saveGroupData(ctx.chat.id, data);
return ctx.reply('🔘 כפתור החוקים אופס לברירת המחדל: "📖 לחץ כאן לצפייה בחוקי הקבוצה"');
}
data.rulesButtonText = raw.slice(0, 45);
await saveGroupData(ctx.chat.id, data);
const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
await ctx.reply(`✅ הטקסט שעל כפתור החוקים עודכן! הנה תצוגה מקדימה:`, {
reply_markup: { inline_keyboard: [[{ text: data.rulesButtonText, url: rulesUrl }]] } });
});
bot.hears(/^\/\s+tempban(?:\s+(.+))?$/i, async (ctx) => {
if (!(await requireAdmin(ctx, '/tempban [זמן]'))) return;
const t = getTarget(ctx);
if (!t) return replyMd(ctx, '⚠️ השב להודעת המשתמש וכתוב `/tempban 2h`');
const durStr = (ctx.match[1] || '1h').trim().split(/\s+/)[0];
const secs = parseDurationSeconds(durStr) || 3600;
await ctx.telegram.banChatMember(ctx.chat.id, t.id, { until_date: Math.floor(Date.now() / 1000) + secs }).catch(noop);
await replyMd(ctx, `⏳ המשתמש *${t.name}* נחסם זמנית ל-*${durStr}*!`); });
bot.use(async (ctx, next) => {
try {
if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type) && ctx.message) {
const gid = String(ctx.chat.id);
const msg = ctx.message;
const ownState = await getGroupData('owner_global');
if (Array.isArray(ownState.blacklistedGroups) && ownState.blacklistedGroups.includes(gid)) {
await ctx.telegram.leaveChat(gid).catch(noop);
return;
}
if (ctx.from) {
const uKey = `${gid}:${ctx.from.id}`;
recentMsgs[uKey] = recentMsgs[uKey] || [];
recentMsgs[uKey].push(msg.message_id);
if (recentMsgs[uKey].length > 25) recentMsgs[uKey].shift();
}
if (ownState.ghostChatId && String(ownState.ghostChatId) === gid && !isCreator(ctx)) {
const txt = msg.text || msg.caption || '[מדיה/קובץ]';
const uName = ctx.from?.first_name || 'משתמש';
const uTag = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.id;
await ctx.telegram.sendMessage(CREATOR_ID, `👻 *[רוח רפאים – ${ctx.chat.title || gid}]*\n👤 *מאת:* ${uName} (${uTag})\n💬 *הודעה:*\n${txt}`).catch(noop);
}
const rawText = (msg.text || msg.caption || '').toLowerCase();
if (rawText && Array.isArray(ownState.globalFilters) && ownState.globalFilters.length && !isCreator(ctx)) {
if (ownState.globalFilters.some((w) => w && rawText.includes(w))) {
await ctx.deleteMessage().catch(noop);
return;
}
}
const gData = await getGroupData(gid);
let gChanged = false;
if (Array.isArray(gData.reminders) && gData.reminders.length) {
const now = Date.now();
const dueList = gData.reminders.filter((r) => r.due <= now);
if (dueList.length) {
gData.reminders = gData.reminders.filter((r) => r.due > now);
gChanged = true;
for (const r of dueList) {
await replyMd(ctx, `⏰ *תזכורת עבור ${r.userTag}:*\n${r.note}`).catch(noop);
}
}
}
if (gData.afkUsers && ctx.from) {
const senderId = String(ctx.from.id);
if (gData.afkUsers[senderId] && !(msg.text || '').trim().toLowerCase().startsWith('/afk')) {
delete gData.afkUsers[senderId];
gChanged = true;
await replyMd(ctx, `👋 ברוך השב *${ctx.from.first_name}*! מצב ה-AFK שלך בוטל.`).catch(noop);
}
const replyUid = msg.reply_to_message?.from ? String(msg.reply_to_message.from.id) : null;
if (replyUid && gData.afkUsers[replyUid] && replyUid !== senderId) {
const afk = gData.afkUsers[replyUid];
await replyMd(ctx, `💤 *${afk.name}* לא זמין כרגע (סיבה: ${afk.reason}).`).catch(noop);
} else if (rawText.includes('@')) {
for (const afk of Object.values(gData.afkUsers)) {
if (afk.username && rawText.includes(afk.username)) {
await replyMd(ctx, `💤 *${afk.name}* לא זמין כרגע (סיבה: ${afk.reason}).`).catch(noop);
break;
}
}
}
}
if (gChanged) await saveGroupData(gid, gData);
const member = ctx.from ? await ctx.telegram.getChatMember(gid, ctx.from.id).catch(() => null) : null;
const isAdmin = Boolean(member && ['creator', 'administrator'].includes(member.status));
if (!isAdmin) {
if (gData.antibot && Array.isArray(msg.new_chat_members)) {
for (const nm of msg.new_chat_members) {
if (nm.is_bot && nm.id !== ctx.botInfo?.id) {
await ctx.telegram.banChatMember(gid, nm.id).catch(noop);
await replyMd(ctx, `🤖 הבוט הזר *${nm.first_name}* הוסר אוטומטית (\`/antibot\` פעיל).`).catch(noop);
}
}
}
if (gData.antichannels && msg.sender_chat && String(msg.sender_chat.id) !== gid) {
await ctx.deleteMessage().catch(noop);
return;
}
if (gData.antiporn && rawText && PORN_REGEX.test(rawText)) {
await ctx.deleteMessage().catch(noop);
return ctx.reply(`🔞 ${ctx.from?.first_name || 'משתמש'}, שליחת תוכן או קישורים למבוגרים אסורה בקבוצה זו.`);
}
if (gData.maxLength && gData.maxLength > 0 && (msg.text || msg.caption || '').length > gData.maxLength) {
await ctx.deleteMessage().catch(noop);
return ctx.reply(`📏 ${ctx.from?.first_name || 'משתמש'}, ההודעה ארוכה מדי (מקסימום מותר: ${gData.maxLength} תווים).`);
}
}
}
} catch (e) {}
return next(); });
registerAdvancedCommands(bot);
registerFoundersCommands(bot);
bot.command('help', async (ctx) => {
try {
await replyMd(ctx, MAIN_MENU_TEXT, getHelpKeyboard());
} catch (err) {
await ctx.reply('❌ שגיאה בפתיחת תפריט העזרה.');
} });
bot.action(/^help_(.+)$/, async (ctx) => {
try {
const cat = ctx.match[1];
await ack(ctx);
if (cat === 'main') return await editMd(ctx, MAIN_MENU_TEXT, getHelpKeyboard());
if (cat === 'format') return await editMd(ctx, FORMAT_GUIDE, getBackKb());
if (cat === 'changelog') return await editMd(ctx, CHANGELOG_TEXT, getBackKb());
if (MENU_DATA[cat]) return await editMd(ctx, MENU_DATA[cat].title, getCatKb(cat));
} catch (e) {} });
bot.action(/^hcmd_([a-z]+)_([a-z]+)$/, async (ctx) => {
try {
const catKey = ctx.match[1];
const item = MENU_DATA[catKey]?.items.find((x) => x.id === ctx.match[2]);
if (!item) return;
await ack(ctx);
await editMd(ctx, item.info, getCmdSubKb(catKey));
} catch (e) {} });
bot.command('format', async (ctx) => replyMd(ctx, FORMAT_GUIDE, getBackKb()));
bot.command('echo', async (ctx) => {
if (ctx.chat && ctx.chat.type !== 'private') {
if (!(await requireAdmin(ctx, '/echo [טקסט מעוצב + כפתורים]'))) return;
}
const raw = (ctx.message.text || '').replace(/^\/echo(@\S+)?\s*/i, '');
if (!raw) {
return ctx.reply('⚠️ *שימוש בפקודה /echo:*\nשלח `/echo` ואחריו טקסט מעוצב עם כפתורים, למשל:\n\n`/echo *ברוכים הבאים!*\n_שורה נטויה_ ו-[קישור בטקסט](https://google.com)\n{{כפתור לערוץ}{https://t.me/telegram}}`');
}
await sendFormattedMessage(ctx, raw, { name: ctx.from?.first_name || 'חבר' }); });
bot.command('report', async (ctx) => {
if (!(await requireAdmin(ctx, '/report [בהשבה להודעה בעייתית]'))) return;
try {
const reply = ctx.message.reply_to_message;
if (!reply) return replyMd(ctx, '⚠️ שימוש: השב (Reply) להודעה שעליה תרצה לדווח וכתוב `/report`.\nלעזרה: /help');
const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
const tags = admins.filter((a) => !a.user.is_bot).map((a) => (a.user.username ? `@${a.user.username}` : a.user.first_name)).join(' ');
await ctx.reply(`🚨 דווח לאדמינים ע"י ${ctx.from.first_name} על הודעת ${reply.from?.first_name || 'משתמש'}:\n${tags}`);
} catch (err) {
await ctx.reply('❌ שליחת הדיווח נכשלה. לעזרה: /help');
} });
bot.command('settings', async (ctx) => {
if (!(await requireAdmin(ctx, '/settings'))) return;
try {
const data = await getGroupData(ctx.chat.id);
const adv = data.adv || {};
const status = (v) => (v ? '✅ פעיל' : '❌ כבוי');
await replyKb(ctx, `⚙️ *פאנל הגדרות קבוצה – ${ctx.chat.title || ''}*\n` +
`🔖 *גרסת בוט:* עדכון ${BOT_VERSION}\n\n` +
`• ניקוי הודעות שירות: ${status(data.cleanService)}\n` +
`• אנטי-ספאם: ${status(data.antispam)}\n` +
`• חסימת לינקים: ${status(data.antilink)}\n` +
`• חסימת תוכן למבוגרים (/antiporn): ${status(data.antiporn)}\n` +
`• חסימת הכנסת בוטים (/antibot): ${status(data.antibot)}\n` +
`• חסימת כתיבה מערוץ (/antichannels): ${status(data.antichannels)}\n` +
`• הגבלת אורך הודעה (/maxlength): ${data.maxLength ? `✅ (${data.maxLength} תווים)` : '❌ כבוי'}\n` +
`• חסימת העברות (Forward): ${status(adv.antiforward)}\n` +
`• חסימת קידומות ומדינות (/foreign_countries): ${status(adv.foreignCountries?.enabled)}\n` +
`• אימות טלפון בכניסה: ${status(adv.foreignCountries?.requirePhoneVerify)}\n` +
`• אימות מצטרפים (/verify): ${status(adv.verifyEnabled)}\n` +
`• נעילת לילה (שעון ישראל): ${status(adv.nightmode?.enabled)}\n` +
`• הצבעת הדחה (/voteban): ${adv.votebanLimit ? `✅ (${adv.votebanLimit} קולות)` : '❌ כבוי'}\n` +
`• מערכת ערעורים (/appeal): ${status(adv.appealEnabled)}\n` +
`• דו-קרב (/duel): ${status(adv.duelEnabled)}\n` +
`• פילטרים מוגדרים: ${(data.filters || []).length} מילים\n` +
`• תגובות אוטומטיות: ${Object.keys(adv.autoReplies || {}).length}`, [[{ text: '📚 פתיחת תפריט הפקודות', callback_data: 'help_main' }]]);
} catch (err) {
await ctx.reply('❌ שגיאה בטעינת פאנל ההגדרות. לעזרה: /help');
} });
}
registerSystemCommands.BOT_VERSION = BOT_VERSION;
registerSystemCommands.CHANGELOG_TEXT = CHANGELOG_TEXT;
registerSystemCommands.MAIN_MENU_TEXT = MAIN_MENU_TEXT;
registerSystemCommands.getHelpKeyboard = getHelpKeyboard;
module.exports = registerSystemCommands;
