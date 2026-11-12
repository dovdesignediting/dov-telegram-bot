const { getGroupData, saveGroupData, sendFormattedMessage } = require('./utils');

const CREATOR_ID = 1773089386;
const FOUNDERS_CHAT_ID = '-1004417781995';
const FOUNDERS_VERSION = '1.2.0-Founders';

// בדיקה קשיחה שהפקודה מורצת אך ורק בקבוצת צוות המייסדים (-1004417781995)
function isFoundersGroup(ctx) {
  const cid = String(ctx.chat?.id || '');
  return cid === FOUNDERS_CHAT_ID || cid === '-4417781995' || cid.endsWith('4417781995');
}

function isCreatorId(id) {
  return Number(id) === CREATOR_ID;
}

function isCreator(ctx) {
  return isCreatorId(ctx.from?.id);
}

function getIsraelDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

function getFounderRankName(pts, userId) {
  if (isCreatorId(userId)) return '👑 היוצר של וולטיק מוד';
  if (pts >= 150) return '👑 מייסד על';
  if (pts >= 80) return '🧠 אדריכל פקודות';
  if (pts >= 30) return '⚡ מייסד פעיל';
  return '🌱 מייסד מתלמד';
}

function ensureFoundersData(data) {
  data.fnd = data.fnd || {};
  const f = data.fnd;
  f.members = f.members || {};
  f.ideas = f.ideas || {};
  f.bugs = f.bugs || {};
  f.bugCounter = f.bugCounter || 0;
  f.credits = f.credits || [];
  f.gold = f.gold || [];
  f.mission = f.mission || { text: 'להציע רעיונות חדשים לפקודות שישדרגו את וולטיק מוד!', doneBy: {} };
  f.goalTarget = f.goalTarget || 50;
  f.ratings = f.ratings || {};
  f.announcedVersion = f.announcedVersion || null;
  return f;
}

function ensureMember(f, user) {
  const uid = String(user.id);
  const creatorUser = isCreatorId(user.id);
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
      lastCheckin: ''
    };
  } else {
    f.members[uid].name = user.first_name || f.members[uid].name;
    if (user.username) f.members[uid].username = `@${user.username}`;
    if (creatorUser) {
      f.members[uid].title = f.members[uid].title || 'היוצר של וולטיק מוד';
    }
  }
  return f.members[uid];
}

// מילון כל הפקודות של הבוט (ליוצר הבוט בלבד מתוך /owner!) – מציג בלחיצת כפתור מה לכתוב ומה הבוט ישיב
const CREATOR_CMD_DICTIONARY = {
  // פקודות ניהול משתמשים, תוכן, הגנה ומידע
  ban: { label: '🚫 חסימת משתמש (/ban)', info: '🚫 *חסימת משתמש (/ban)*\n\n⌨️ *מה לכתוב (בהשבה להודעה):*\n`/ban פרסום ספאם`\n\n🤖 *מה הבוט ישיב:*\n"🔨 המשתמש נחסם מהקבוצה! (סיבה: פרסום ספאם)"' },
  unban: { label: '🔓 הסרת חסימה (/unban)', info: '🔓 *הסרת חסימה (/unban)*\n\n⌨️ *מה לכתוב:*\n`/unban 123456789`\n\n🤖 *מה הבוט ישיב:*\n"🔓 החסימה של המשתמש הוסרה והוא יכול להצטרף מחדש."' },
  kick: { label: '👢 הוצאה מהקבוצה (/kick)', info: '👢 *הוצאה מהקבוצה (/kick)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/kick`\n\n🤖 *מה הבוט ישיב:*\n"👢 המשתמש הוצא מהקבוצה."' },
  mute: { label: '🔇 השתקת משתמש (/mute)', info: '🔇 *השתקת משתמש (/mute)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/mute 10m` (או `2h` / `1d`)\n\n🤖 *מה הבוט ישיב:*\n"🔇 המשתמש הושתק ל-10 דקות."' },
  unmute: { label: '🔊 ביטול השתקה (/unmute)', info: '🔊 *ביטול השתקה (/unmute)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/unmute`\n\n🤖 *מה הבוט ישיב:*\n"🔊 ההשתקה הוסרה! המשתמש יכול לשוב ולכתוב."' },
  warn: { label: '⚠️ מתן אזהרה (/warn)', info: '⚠️ *מתן אזהרה (/warn)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/warn שפה לא נאותה`\n\n🤖 *מה הבוט ישיב:*\n"⚠️ אזהרה למשתמש (1/3) | סיבה: שפה לא נאותה" (ב-3 אזהרות נחסם אוטומטית).' },
  warnings: { label: '📋 בדיקת אזהרות (/warnings)', info: '📋 *בדיקת אזהרות (/warnings)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/warnings`\n\n🤖 *מה הבוט ישיב:*\n"📋 אזהרות עבור המשתמש (1/3): 1. שפה לא נאותה"' },
  clearwarns: { label: '🧹 איפוס אזהרות (/clearwarns)', info: '🧹 *איפוס אזהרות (/clearwarns)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/clearwarns`\n\n🤖 *מה הבוט ישיב:*\n"🧹 כל האזהרות של המשתמש נמחקו!"' },
  promote: { label: '⭐ קידום לאדמין (/promote)', info: '⭐ *קידום לאדמין (/promote)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/promote`\n\n🤖 *מה הבוט ישיב:*\n"⭐ המשתמש קודם למנהל בקבוצה!"' },
  demote: { label: '⬇️ הורדה מניהול (/demote)', info: '⬇️ *הורדה מניהול (/demote)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/demote`\n\n🤖 *מה הבוט ישיב:*\n"⬇️ הרשאות הניהול הוסרו מהמשתמש."' },
  del: { label: '🗑️ מחיקת הודעה (/del)', info: '🗑️ *מחיקת הודעה (/del)*\n\n⌨️ *מה לכתוב (בהשבה להודעה):*\n`/del`\n\n🤖 *מה הבוט ישיב:*\nמוחק מיד את ההודעה שעליה השבת וגם את הפקודה עצמה.' },
  purge: { label: '🧹 מחיקה מרובה (/purge)', info: '🧹 *מחיקה מרובה (/purge)*\n\n⌨️ *מה לכתוב:*\n`/purge 20`\n\n🤖 *מה הבוט ישיב:*\n"🧹 נמחקו 20 הודעות אחרונות בהצלחה!"' },
  pin: { label: '📌 נעיצת הודעה (/pin)', info: '📌 *נעיצת הודעה (/pin)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/pin`\n\n🤖 *מה הבוט ישיב:*\n"📌 ההודעה ננעצה בראש הקבוצה!"' },
  unpin: { label: '📍 הסרת נעיצה (/unpin)', info: '📍 *הסרת נעיצה (/unpin)*\n\n⌨️ *מה לכתוב:*\n`/unpin`\n\n🤖 *מה הבוט ישיב:*\n"📍 הנעיצה הוסרה בהצלחה."' },
  unpinall: { label: '🗃️ הסרת כל הנעוצים (/unpinall)', info: '🗃️ *הסרת כל הנעוצים (/unpinall)*\n\n⌨️ *מה לכתוב:*\n`/unpinall`\n\n🤖 *מה הבוט ישיב:*\n"🗑️ כל ההודעות הנעוצות בקבוצה הוסרו!"' },
  slowmode: { label: '🐢 מצב איטי (/slowmode)', info: '🐢 *מצב איטי (/slowmode)*\n\n⌨️ *מה לכתוב:*\n`/slowmode 30` (או `0` לביטול)\n\n🤖 *מה הבוט ישיב:*\n"🐢 מצב איטי הופעל: הודעה אחת כל 30 שניות."' },
  lock: { label: '🔒 נעילת תוכן (/lock)', info: '🔒 *נעילת תוכן (/lock)*\n\n⌨️ *מה לכתוב:*\n`/lock links` | `/lock media` | `/lock stickers` | `/lock all`\n\n🤖 *מה הבוט ישיב:*\n"🔒 נעילת קישורים הופעלה בקבוצה!"' },
  unlock: { label: '🔓 פתיחת נעילה (/unlock)', info: '🔓 *פתיחת נעילה (/unlock)*\n\n⌨️ *מה לכתוב:*\n`/unlock links` | `/unlock media` | `/unlock stickers` | `/unlock all`\n\n🤖 *מה הבוט ישיב:*\n"🔓 נעילת קישורים בוטלה בקבוצה!"' },
  cleanservice: { label: '🧼 ניקוי הודעות שירות (/cleanservice)', info: '🧼 *ניקוי הודעות שירות (/cleanservice)*\n\n⌨️ *מה לכתוב:*\n`/cleanservice on` | `/cleanservice off`\n\n🤖 *מה הבוט ישיב:*\n"🧼 ניקוי אוטומטי של הודעות שירות: פעיל (ON)"' },
  antispam: { label: '🛡️ אנטי-ספאם (/antispam)', info: '🛡️ *אנטי-ספאם (/antispam)*\n\n⌨️ *מה לכתוב:*\n`/antispam on` | `/antispam off`\n\n🤖 *מה הבוט ישיב:*\n"🛡️ מנגנון אנטי-ספאם כעת: פעיל (ON)"' },
  antilink: { label: '🔗 חסימת לינקים (/antilink)', info: '🔗 *חסימת לינקים (/antilink)*\n\n⌨️ *מה לכתוב:*\n`/antilink on` | `/antilink off`\n\n🤖 *מה הבוט ישיב:*\n"🔗 חסימת לינקים אוטומטית כעת: פעילה (ON)"' },
  antiflood: { label: '🌊 הגנת הצפה (/antiflood)', info: '🌊 *הגנת הצפה (/antiflood)*\n\n⌨️ *מה לכתוב:*\n`/antiflood 5` (או `0` לכיבוי)\n\n🤖 *מה הבוט ישיב:*\n"🌊 הגנת הצפה הופעלה: מקסימום 5 הודעות רצופות."' },
  filter: { label: '🚫 הוספת מילה אסורה (/filter)', info: '🚫 *הוספת מילה אסורה (/filter)*\n\n⌨️ *מה לכתוב:*\n`/filter מילה`\n\n🤖 *מה הבוט ישיב:*\n"🚫 המילה נוספה לרשימת הפילטרים ותימחק אוטומטית."' },
  filters: { label: '📋 ניהול מילים אסורות (/filters)', info: '📋 *פאנל מילים אסורות (/filters)*\n\n⌨️ *מה לכתוב:*\n`/filters`\n\n🤖 *מה הבוט ישיב:*\nמציג את כל המילים האסורות עם כפתורי `✏️ ערוך` ו-`🗑️ מחק` ליד כל מילה.' },
  editfilter: { label: '✏️ עריכת מילה אסורה (/editfilter)', info: '✏️ *עריכת מילה אסורה (/editfilter)*\n\n⌨️ *מה לכתוב:*\n`/editfilter ישנה חדשה`\n\n🤖 *מה הבוט ישיב:*\n"✏️ הפילטר עודכן בהצלחה!"' },
  unfilter: { label: '🗑️ מחיקת מילה אסורה (/unfilter)', info: '🗑️ *מחיקת מילה אסורה (/unfilter)*\n\n⌨️ *מה לכתוב:*\n`/unfilter מילה`\n\n🤖 *מה הבוט ישיב:*\n"🗑️ המילה נמחקה מרשימת הפילטרים."' },
  clearfilters: { label: '🧹 איפוס כל הפילטרים (/clearfilters)', info: '🧹 *איפוס כל הפילטרים (/clearfilters)*\n\n⌨️ *מה לכתוב:*\n`/clearfilters`\n\n🤖 *מה הבוט ישיב:*\n"🧹 כל המילים החסומות בקבוצה נמחקו."' },
  welcome: { label: '👋 הפעלת ברוכים הבאים (/welcome)', info: '👋 *הודעת ברוכים הבאים (/welcome)*\n\n⌨️ *מה לכתוב:*\n`/welcome on` | `/welcome off`\n\n🤖 *מה הבוט ישיב:*\n"👋 הודעת ברוכים הבאים כעת: פעילה (ON)"' },
  setwelcome: { label: '✏️ עריכת ברוכים הבאים (/setwelcome)', info: '✏️ *עריכת ברוכים הבאים (/setwelcome)*\n\n⌨️ *מה לכתוב:*\n`/setwelcome ברוך הבא {name}!`\n\n🤖 *מה הבוט ישיב:*\nמציג תצוגה מקדימה עם כפתור לחוקי הקבוצה ושומר את ההודעה.' },
  rules: { label: '📜 הצגת חוקים (/rules)', info: '📜 *חוקי הקבוצה (/rules)*\n\n⌨️ *מה לכתוב:*\n`/rules`\n\n🤖 *מה הבוט ישיב:*\nמציג כפתור מעבר לקריאת חוקי הקבוצה בפרטי של הבוט.' },
  setrules: { label: '✍️ הגדרת חוקים (/setrules)', info: '✍️ *הגדרת חוקים (/setrules)*\n\n⌨️ *מה לכתוב:*\n`/setrules חוק 1: לכבד את כולם`\n\n🤖 *מה הבוט ישיב:*\n"✅ חוקי הקבוצה נשמרו בהצלחה!"' },
  addcmd: { label: '➕ הוספת פקודה (/addcmd)', info: '➕ *הוספת פקודה מותאמת (/addcmd)*\n\n⌨️ *מה לכתוב:*\n`/addcmd שעות פתוח מ-09:00 עד 20:00`\n\n🤖 *מה הבוט ישיב:*\n"✅ הפקודה /שעות נוספה!" (וכל מי שיכתוב `/שעות` יקבל את התשובה).' },
  delcmd: { label: '➖ מחיקת פקודה (/delcmd)', info: '➖ *מחיקת פקודה מותאמת (/delcmd)*\n\n⌨️ *מה לכתוב:*\n`/delcmd שעות`\n\n🤖 *מה הבוט ישיב:*\n"🗑️ הפקודה נמחקה."' },
  cmds: { label: '📂 רשימת פקודות (/cmds)', info: '📂 *רשימת פקודות מותאמות (/cmds)*\n\n⌨️ *מה לכתוב:*\n`/cmds`\n\n🤖 *מה הבוט ישיב:*\nמציג את רשימת כל הפקודות המותאמות אישית שנוצרו בקבוצה.' },
  admins: { label: '👮 רשימת אדמינים (/admins)', info: '👮 *רשימת אדמינים (/admins)*\n\n⌨️ *מה לכתוב:*\n`/admins`\n\n🤖 *מה הבוט ישיב:*\nמציג את רשימת כל מנהלי הקבוצה.' },
  id: { label: '🆔 בדיקת מזהה (/id)', info: '🆔 *בדיקת מזהה (/id)*\n\n⌨️ *מה לכתוב:*\n`/id`\n\n🤖 *מה הבוט ישיב:*\nמציג את ה-ID של המשתמש ושל הקבוצה.' },
  userinfo: { label: '👤 פרטי משתמש (/userinfo)', info: '👤 *פרטי משתמש (/userinfo)*\n\n⌨️ *מה לכתוב (בהשבה או לבד):*\n`/userinfo`\n\n🤖 *מה הבוט ישיב:*\nמציג כרטיס פרטים מלא על המשתמש.' },
  stats: { label: '📊 סטטיסטיקות (/stats)', info: '📊 *סטטיסטיקות קבוצה (/stats)*\n\n⌨️ *מה לכתוב:*\n`/stats`\n\n🤖 *מה הבוט ישיב:*\nמציג כמות הודעות, אזהרות, חסימות ומצב הגנות בקבוצה.' },
  settings: { label: '⚙️ הגדרות קבוצה (/settings)', info: '⚙️ *הגדרות קבוצה (/settings)*\n\n⌨️ *מה לכתוב:*\n`/settings`\n\n🤖 *מה הבוט ישיב:*\nמציג פאנל מרוכז עם מצב כל ההגנות והמערכות בקבוצה.' },
  echo: { label: '📢 בדיקת עיצוב (/echo)', info: '📢 *בדיקת עיצוב וכפתורים (/echo)*\n\n⌨️ *מה לכתוב:*\n`/echo *כותרת*\n{{כפתור}{https://t.me/VolticMod_bot}}`\n\n🤖 *מה הבוט ישיב:*\nשולח את ההודעה המעוצבת עם הכפתור הלחיץ מתחתיה.' },
  format: { label: '🎨 מדריך עיצוב (/format)', info: '🎨 *מדריך עיצוב (/format)*\n\n⌨️ *מה לכתוב:*\n`/format`\n\n🤖 *מה הבוט ישיב:*\nמציג את מדריך העיצוב המלא (הדגשה, קישורים וכפתורים).' },
  report: { label: '🚨 דיווח לאדמינים (/report)', info: '🚨 *דיווח לאדמינים (/report)*\n\n⌨️ *מה לכתוב (בהשבה להודעה):*\n`/report`\n\n🤖 *מה הבוט ישיב:*\nמתייג את כל מנהלי הקבוצה לטיפול בהודעה.' },
  help: { label: '📚 תפריט עזרה (/help)', info: '📚 *תפריט עזרה (/help)*\n\n⌨️ *מה לכתוב:*\n`/help` (או `/start`)\n\n🤖 *מה הבוט ישיב:*\nפותח את התפריט הראשי של הבוט.' },

  // 21 הפקודות המתקדמות
  raidmode: { label: '🚨 מצב חירום (/raidmode)', info: '🚨 *מצב חירום נגד מתקפת בוטים (/raidmode)*\n\n⌨️ *מה לכתוב:*\n`/raidmode on` | `/raidmode off` | `/raidmode auto`\n\n🤖 *מה הבוט ישיב:*\n"🚨 מצב חירום (Raid Mode) הופעל ל-30 דקות! כניסת חשבונות חדשים, קישורים ומדיה נחסמו אוטומטית."' },
  verify: { label: '🔐 אימות מצטרפים (/verify)', info: '🔐 *אימות מצטרפים (/verify)*\n\n⌨️ *מה לכתוב:*\n`/verify` או `/verify none` או `/verify 60s` או `/verify off`\n\n🤖 *מה הבוט ישיב:*\nפותח כפתורי בחירת זמן. כשמצטרף לוחץ על 🔑, הבוט מאמת אותו ומאחד את האישור עם הודעת הברוכים הבאים וכפתור החוקים.' },
  foreign_countries: { label: '📵 חסימת קידומות (/foreign_countries)', info: '📵 *חסימת קידומות ומדינות (/foreign_countries)*\n\n⌨️ *מה לכתוב:*\n`/foreign_countries` או `/foreign_countries +98`\n\n🤖 *מה הבוט ישיב:*\nפותח פאנל כפתורים לבחירת קידומות ומדינות לחסימה (`+98`, `+92`, `+62` וכו׳), סינון בכניסה ואימות קידומת בפרטי.' },
  antiforward: { label: '🔄 חסימת העברות (/antiforward)', info: '🔄 *חסימת העברות (/antiforward)*\n\n⌨️ *מה לכתוב:*\n`/antiforward on` | `/antiforward off`\n\n🤖 *מה הבוט ישיב:*\n"🔄 חסימת העברת הודעות (Forward) כעת: פעילה ✅"' },
  antiforeign: { label: '🌍 חסימת שפות זרות (/antiforeign)', info: '🌍 *חסימת שפות זרות (/antiforeign)*\n\n⌨️ *מה לכתוב:*\n`/antiforeign`\n\n🤖 *מה הבוט ישיב:*\nפותח תפריט כפתורים לחסימת ערבית, רוסית, סינית והודית.' },
  secret: { label: '🔒 לחישה סודית (/secret)', info: '🔒 *לחישה סודית (/secret)*\n\n⌨️ *מה לכתוב:*\n`/secret @username הודעה סודית` (או בהשבה)\n\n🤖 *מה הבוט ישיב:*\nמפרסם בקבוצה כפתור קריאה לנמען בלבד + שולח לשולח בפרטי כפתור למחיקת ההודעה הסודית מהקבוצה.' },
  autoreply: { label: '🤖 מענה אוטומטי (/autoreply)', info: '🤖 *מענה אוטומטי (/autoreply)*\n\n⌨️ *מה לכתוב:*\n`/autoreply` או `/autoreply מילה | תשובה`\n\n🤖 *מה הבוט ישיב:*\nפותח פאנל תבניות מוכנות וכפתורי מחיקה, ועונה אוטומטית בצ׳אט.' },
  voteban: { label: '⚖️ הצבעת הדחה (/voteban)', info: '⚖️ *הצבעת הדחה (/voteban)*\n\n⌨️ *מה לכתוב:*\nלמנהל: `/voteban 5` | לחברים (בהשבה): `/voteban`\n\n🤖 *מה הבוט ישיב:*\n"⚖️ נפתחה הצבעת הרחקה!" עם כפתור הצבעה עד להרחקה אוטומטית.' },
  appeal: { label: '📩 מערכת ערעורים (/appeal)', info: '📩 *מערכת ערעורים (/appeal)*\n\n⌨️ *מה לכתוב:*\nלמנהל: `/appeal on` | למשתמש: `/appeal סיבה`\n\n🤖 *מה הבוט ישיב:*\n"📩 בקשת ערעור חדשה" עם כפתורי אישור/דחייה למנהלים.' },
  msgquota: { label: '📊 מכסת הודעות (/msgquota)', info: '📊 *מכסת הודעות יומית (/msgquota)*\n\n⌨️ *מה לכתוב (בהשבה):*\n`/msgquota 15` (או `off`)\n\n🤖 *מה הבוט ישיב:*\n"📊 הוגדרה מכסה יומית למשתמש: עד 15 הודעות ביום."' },
  cleanuser: { label: '👤 ניקוי הודעות משתמש (/cleanuser)', info: '👤 *ניקוי הודעות משתמש (/cleanuser)*\n\n⌨️ *מה לכתוב:*\nקודם `/cleanuser on`, ואז בהשבה: `/cleanuser 15`\n\n🤖 *מה הבוט ישיב:*\n"🧹 נמחקו 15 הודעות של המשתמש."' },
  giveaway: { label: '🎁 הגרלה (/giveaway)', info: '🎁 *הגרלה בקבוצה (/giveaway)*\n\n⌨️ *מה לכתוב:*\n`/giveaway מנוי פרימיום`\n\n🤖 *מה הבוט ישיב:*\n"🎉 הגרלה חדשה נפתחה בקבוצה!" עם כפתור השתתפות וכפתור הגרלת זוכה למנהל.' },
  top: { label: '🏆 טבלת פעילים (/top)', info: '🏆 *טבלת 10 הפעילים (/top)*\n\n⌨️ *מה לכתוב:*\n`/top`\n\n🤖 *מה הבוט ישיב:*\n"🏆 טבלת 10 הפעילים ביותר בקבוצה:" עם מדליות וכמות הודעות.' },
  fastclick: { label: '⚡ הראשון שלוחץ (/fastclick)', info: '⚡ *אתגר המהירות (/fastclick)*\n\n⌨️ *מה לכתוב:*\n`/fastclick start` | `/fastclick stop`\n\n🤖 *מה הבוט ישיב:*\n"⚡ אתגר המהירות התחיל!" עם כפתור לחיצה מהירה והכרזה על המנצח.' },
  duel: { label: '⚔️ דו-קרב קובייה (/duel)', info: '⚔️ *דו-קרב קובייה (/duel)*\n\n⌨️ *מה לכתוב:*\nלמנהל: `/duel on` | לחברים: `/duel`\n\n🤖 *מה הבוט ישיב:*\n"⚔️ פתח הזמנה לדו-קרב קובייה!" ומטיל קוביות בין שני השחקנים.' },
  nightmode: { label: '🌙 נעילת לילה (/nightmode)', info: '🌙 *נעילת לילה לפי שעון ישראל (/nightmode)*\n\n⌨️ *מה לכתוב:*\n`/nightmode 00:00 07:00` | `/nightmode off`\n\n🤖 *מה הבוט ישיב:*\n"🌙 מצב לילה אוטומטי הופעל לפי שעון ישראל!"' },
  newbiemode: { label: '👶 הגבלת חדשים (/newbiemode)', info: '👶 *הגבלת וותק לחדשים (/newbiemode)*\n\n⌨️ *מה לכתוב:*\n`/newbiemode` או `/newbiemode 1h` או `/newbiemode off`\n\n🤖 *מה הבוט ישיב:*\n"🛡️ הגבלת חדשים הופעלה: משתמש חדש יוכל לשלוח מדיה וקישורים רק אחרי צבירת וותק."' },
  honeypot: { label: '🍯 מלכודת דבש (/honeypot)', info: '🍯 *מלכודת דבש לבוטים (/honeypot)*\n\n⌨️ *מה לכתוב:*\n`/honeypot`\n\n🤖 *מה הבוט ישיב:*\nמפרסם כפתור מלכודת לבוטים וחוסם אוטומטית כל מי שלוחץ עליו.' },
  trust: { label: '🕵️ מדד אמינות (/trust)', info: '🕵️ *מדד אמינות משתמש (/trust)*\n\n⌨️ *מה לכתוב:*\n`/trust` (בהשבה או לבד)\n\n🤖 *מה הבוט ישיב:*\n"🕵️ מדד אמינות משתמש: ציון אמינות משוקלל, הודעות, וותק ואזהרות."' },
  tagall: { label: '📣 תיוג כולם (/tagall)', info: '📣 *תיוג כולם (/tagall)*\n\n⌨️ *מה לכתוב:*\nקודם `/tagall on`, ואז `/tagall הודעה`\n\n🤖 *מה הבוט ישיב:*\n"📣 קריאת מנהל הקבוצה:" ומתייג את החברים הפעילים.' },
  backup: { label: '💾 גיבוי קבוצה (/backup)', info: '💾 *גיבוי הגדרות קבוצה (/backup)*\n\n⌨️ *מה לכתוב:*\n`/backup`\n\n🤖 *מה הבוט ישיב:*\n"💾 גיבוי הגדרות הקבוצה מוכן!" ונותן קוד גיבוי.' },
  restore: { label: '♻️ שחזור קבוצה (/restore)', info: '♻️ *שחזור הגדרות קבוצה (/restore)*\n\n⌨️ *מה לכתוב:*\n`/restore [קוד גיבוי]`\n\n🤖 *מה הבוט ישיב:*\n"✅ כל הגדרות הקבוצה, החוקים, הפילטרים והפקודות המותאמות שוחזרו בהצלחה!"' },

  // פקודות צוות המייסדים
  founders: { label: '👑 תפריט מייסדים (/founders)', info: '👑 *תפריט מייסדים (/founders)*\n\n⌨️ *מה לכתוב:*\n`/founders`\n\n🤖 *מה הבוט ישיב:*\nבקבוצת המייסדים פותח את תפריט צוות המייסדים ושולח לך בפרטי את מדריך היוצר.' },
  idea: { label: '💡 הצעת רעיון (/idea)', info: '💡 *הצעת רעיון במייסדים (/idea)*\n\n⌨️ *מה לכתוב:*\n`/idea להוסיף פקודת תזכורת`\n\n🤖 *מה הבוט ישיב:*\nמפרסם כרטיס הצבעה (🔥/🤔) וכפתור `✅ אשר לפיתוח (+25 נק׳ - ליוצר)`.' },
  bug: { label: '🐛 דיווח באג (/bug)', info: '🐛 *דיווח באג במייסדים (/bug)*\n\n⌨️ *מה לכתוב:*\n`/bug תיאור התקלה`\n\n🤖 *מה הבוט ישיב:*\nפותח כרטיס באג ממוספר עם כפתור `🔧 סמן כטופל (+20 נק׳ למדווח - ליוצר)`.' },
  credits: { label: '🏅 היכל קרדיטים (/credits)', info: '🏅 *היכל הקרדיטים (/credits)*\n\n⌨️ *מה לכתוב:*\n`/credits`\n\n🤖 *מה הבוט ישיב:*\nמציג את רשימת כל המייסדים שהרעיונות שלהם אושרו.' },
  addcredit: { label: '🏅 הוספת קרדיט (/addcredit)', info: '🏅 *הוספת קרדיט ידנית (/addcredit)*\n\n⌨️ *מה לכתוב:*\n`/addcredit שם | פקודה`\n\n🤖 *מה הבוט ישיב:*\n"🏅 נוסף להיכל הקרדיטים!"' },
  founder: { label: '🪪 תעודת מייסד (/founder)', info: '🪪 *תעודת מייסד (/founder)*\n\n⌨️ *מה לכתוב:*\n`/founder`\n\n🤖 *מה הבוט ישיב:*\nמציג תעודת מייסד רשמית (ועליך כותב: "היוצר של וולטיק מוד").' },
  rank: { label: '📈 דרגות מייסדים (/rank)', info: '📈 *דרגות מייסדים (/rank)*\n\n⌨️ *מה לכתוב:*\n`/rank`\n\n🤖 *מה הבוט ישיב:*\nמציג את סולם הדרגות של צוות המייסדים.' },
  halloffame: { label: '🏆 היכל התהילה (/halloffame)', info: '🏆 *היכל התהילה (/halloffame)*\n\n⌨️ *מה לכתוב:*\n`/halloffame`\n\n🤖 *מה הבוט ישיב:*\nמציג את 5 המייסדים המובילים בנקודות.' },
  title: { label: '🏷️ תואר אישי (/title)', info: '🏷️ *תואר מייסד אישי (/title)*\n\n⌨️ *מה לכתוב:*\n`/title אדריכל הפקודות`\n\n🤖 *מה הבוט ישיב:*\n"🏷️ התואר האישי שלך עודכן!"' },
  award: { label: '🎖️ הענקת נקודות (/award)', info: '🎖️ *הענקת נקודות למייסד (/award)*\n\n⌨️ *מה לכתוב (בהשבה למייסד):*\n`/award 50`\n\n🤖 *מה הבוט ישיב:*\n"🎖️ אות הצטיינות מיוצר הבוט! המייסד קיבל בונוס של +50 נקודות מייסד!"' },
  preview: { label: '🎨 הדמיית פקודה (/preview)', info: '🎨 *הדמיית פקודה (/preview)*\n\n⌨️ *מה לכתוב:*\n`/preview *טקסט* {{כפתור}{https://t.me/VolticMod_bot}}`\n\n🤖 *מה הבוט ישיב:*\nמציג תצוגת הדמיה חיה של ההודעה והכפתור.' },
  goal: { label: '🎯 יעד צמיחה (/goal)', info: '🎯 *מד יעד הצמיחה (/goal)*\n\n⌨️ *מה לכתוב:*\n`/goal` (ולעדכון יעד: `/setgoal 100`)\n\n🤖 *מה הבוט ישיב:*\nמציג מד התקדמות של כמות הקבוצות והמשתמשים.' },
  sharebot: { label: '🔗 שיתוף הבוט (/sharebot)', info: '🔗 *כרטיס שיתוף הבוט (/sharebot)*\n\n⌨️ *מה לכתוב:*\n`/sharebot`\n\n🤖 *מה הבוט ישיב:*\nמוציא כרטיס שיתוף מוכן עם כפתור להוספת הבוט לקבוצות.' },
  mvp: { label: '⭐ מייסד השבוע (/mvp)', info: '⭐ *מייסד השבוע (/mvp)*\n\n⌨️ *מה לכתוב:*\n`/mvp`\n\n🤖 *מה הבוט ישיב:*\nמכריז על המייסד המוביל של השבוע.' },
  mission: { label: '📋 משימת הצוות (/mission)', info: '📋 *משימת צוות המייסדים (/mission)*\n\n⌨️ *מה לכתוב:*\n`/mission` (ולהגדרת משימה: `/setmission טקסט`)\n\n🤖 *מה הבוט ישיב:*\nמציג את המשימה הנוכחית עם כפתור השלמת משימה.' },
  checkin: { label: '🔥 התפקדות יומית (/checkin)', info: '🔥 *התפקדות יומית (/checkin)*\n\n⌨️ *מה לכתוב:*\n`/checkin`\n\n🤖 *מה הבוט ישיב:*\n"🔥 התפקדות יומית הושלמה!" ומעדכן נקודות ורצף ימים.' },
  ask: { label: '❓ שאלה ליוצר (/ask)', info: '❓ *שאלה ליוצר (/ask)*\n\n⌨️ *מה לכתוב:*\n`/ask שאלה`\n\n🤖 *מה הבוט ישיב:*\nממסגר את השאלה בקבוצה ושולח אותה אליך לפרטי.' },
  gold: { label: '🪙 רעיונות זהב (/gold)', info: '🪙 *לוח רעיונות הזהב (/gold)*\n\n⌨️ *מה לכתוב:*\n`/gold` (בהשבה לשמירה, או לבד לצפייה)\n\n🤖 *מה הבוט ישיב:*\n"🪙 נשמר בלוח רעיונות הזהב!" (ועליך כותב: "היוצר של וולטיק מוד").' },
  feedback_bot: { label: '⭐ דירוג במייסדים (/feedback_bot)', info: '⭐ *דירוג הבוט במייסדים (/feedback_bot)*\n\n⌨️ *מה לכתוב:*\n`/feedback_bot`\n\n🤖 *מה הבוט ישיב:*\nפותח כפתורי דירוג 1⭐ עד 5⭐ ומחשב ממוצע.' },

  // פקודות שליטה של יוצר הבוט בלבד
  owner: { label: '👑 פאנל שליטה (/owner)', info: '👑 *פאנל שליטה ליוצר הבוט (/owner)*\n\n⌨️ *מה לכתוב בפרטי:*\n`/owner` (או `/god`)\n\n🤖 *מה הבוט ישיב:*\nפותח את פאנל השליטה הראשי שלך (כל הפקודות של הבוט, סריקת קבוצות, שידור הודעות, כתיבה חיה ומצב תחזוקה).' },
  broadcast: { label: '📣 שידור לכולם (/broadcast)', info: '📣 *שידור הודעה לכולם (/broadcast)*\n\n⌨️ *מה לכתוב בפרטי:*\n`/broadcast הודעה`\n\n🤖 *מה הבוט ישיב:*\nשולח את ההודעה לכל הקבוצות ולכל המשתמשים ומדווח לכמה נשלח.' },
  broadcast_users: { label: '✉️ שידור למשתמשים (/broadcast_users)', info: '✉️ *שידור למשתמשים בפרטי (/broadcast_users)*\n\n⌨️ *מה לכתוב בפרטי:*\n`/broadcast_users הודעה`\n\n🤖 *מה הבוט ישיב:*\nשולח את ההודעה אך ורק למשתמשי הבוט בפרטי (ללא קבוצות).' }
};

function buildCreatorAllCmdsKeyboard(page = 0) {
  const entries = Object.entries(CREATOR_CMD_DICTIONARY);
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
    `סה"כ *${entries.length} פקודות* במערכת שלך.\n\n` +
    `👇 *לחץ על כל כפתור פקודה למטה כדי לראות בדיוק מה לכתוב ומה הבוט ישיב:*`;
  return { text, reply_markup: { inline_keyboard: rows } };
}

// ההודעה שנשלחת לפרטי של היוצר בכל פעם שמישהו מפעיל את תפריט המייסדים (/founders)
const CREATOR_SECRET_FOUNDERS_GUIDE =
  `👑 *פקודות וכפתורים שעובדים רק לך (היוצר) בקבוצת צוות המייסדים:*\n\n` +
  `1️⃣ *הענקת מדליה ונקודות למייסד:*\n` +
  `השב להודעה של חבר בקבוצה ושלח:\n` +
  `\`/award 50\` (מוסיף לו נקודות מייסד ומכריז בקבוצה)\n\n` +
  `2️⃣ *אישור רעיון של מייסד (/idea):*\n` +
  `מתחת לכל רעיון שמישהו שולח עם \`/idea\`, יש כפתור **✅ אשר לפיתוח (+25 נק׳)** שעובד רק לך! לחיצה עליו מאשרת את הרעיון, נותנת למציע 25 נקודות ומוסיפה אותו אוטומטית להיכל הקרדיטים (\`/credits\`).\n\n` +
  `3️⃣ *סימון באג כטופל (/bug):*\n` +
  `מתחת לכל דיווח \`/bug\`, יש כפתור **🔧 סמן כטופל (+20 נק׳)** שעובד רק לך ומזכה את המדווח ב-20 נקודות.\n\n` +
  `4️⃣ *הגדרת משימה חדשה לצוות (/mission):*\n` +
  `שלח בקבוצה: \`/setmission [תיאור המשימה החדשה]\` (מאפס את המשתתפים ומגדיר משימה חדשה).\n\n` +
  `5️⃣ *עדכון יעד הקבוצות (/goal):*\n` +
  `שלח בקבוצה: \`/setgoal [מספר]\` (למשל \`/setgoal 100\`).\n\n` +
  `6️⃣ *הוספת קרדיט ידנית להיכל הקרדיטים (/credits):*\n` +
  `שלח בקבוצה: \`/addcredit שם המייסד | שם הפקודה\`\n\n` +
  `7️⃣ *פרסום הודעת עדכון המייסדים בקבוצה:*\n` +
  `שלח בקבוצה: \`/founders_announce\`\n\n` +
  `💡 *לצפייה בתפריט כל הפקודות של הבוט פתח בפרטי:* \`/owner\``;

// הודעת העדכון שמתפרסמת אך ורק בקבוצת צוות המייסדים
const FOUNDERS_UPDATE_ANNOUNCEMENT =
  `👑 *עדכון בלעדי לצוות המייסדים של וולטיק מוד (${FOUNDERS_VERSION})!* 🚀\n\n` +
  `החל מעכשיו נוספו לקבוצה שלנו *18 פקודות ומערכות מיוחדות* שפועלות **אך ורק בקבוצת צוות המייסדים**:\n\n` +
  `• 💡 \`/idea [רעיון]\` – העלאת רעיון להצבעת הצוות ואישור היוצר\n` +
  `• 🐛 \`/bug [תיאור]\` – דיווח באגים וקבלת נקודות מייסד\n` +
  `• 🏅 \`/credits\` – היכל הקרדיטים של ממציאי הפקודות\n` +
  `• 🪪 \`/founder\` – תעודת המייסד האישית שלך\n` +
  `• 📈 \`/rank\` – סולם דרגות המייסדים\n` +
  `• 🏆 \`/halloffame\` – היכל התהילה של 5 המייסדים המובילים\n` +
  `• 🏷️ \`/title [כינוי]\` – בחירת תואר מייסד אישי\n` +
  `• 🎖️ \`/award\` – הענקת נקודות הצטיינות ע"י היוצר\n` +
  `• 🎨 \`/preview [הודעה]\` – הדמיית פקודה וכפתורים בזמן אמת\n` +
  `• 🎯 \`/goal\` – מד יעד הצמיחה של הבוט\n` +
  `• 🔗 \`/sharebot\` – כרטיס שיתוף מהיר להפצת הבוט\n` +
  `• ⭐ \`/mvp\` – מייסד השבוע של הקבוצה\n` +
  `• 📋 \`/mission\` – המשימה הנוכחית של צוות המייסדים\n` +
  `• 🔥 \`/checkin\` – התפקדות יומית וצבירת נקודות\n` +
  `• ❓ \`/ask [שאלה]\` – שאלה ישירה ליוצר הבוט\n` +
  `• 🪙 \`/gold\` – שמירה וצפייה ב"רעיונות הזהב" מהצ׳אט\n` +
  `• ⭐ \`/feedback_bot\` – דירוג הבוט בכוכבים\n` +
  `• 👑 \`/founders\` – פתיחת תפריט הכפתורים של צוות המייסדים!`;

const FOUNDERS_MENU_ITEMS = [
  { id: 'idea', label: '💡 הצעת רעיון', info: '💡 *העלאת רעיון לפיתוח בבוט*\n\n⌨️ *מה לכתוב:*\n`/idea [תיאור הרעיון שלך]`\n\n🤖 *מה הבוט ישיב:*\nמפרסם כרטיס הצבעה לכל הצוות (`🔥 עף על זה!` / `🤔 פחות דחוף`) וכפתור אישור ליוצר שמזכה ב-+25 נקודות וקרדיט!' },
  { id: 'bug', label: '🐛 דיווח באג', info: '🐛 *דיווח על תקלה או באג בבוט*\n\n⌨️ *מה לכתוב:*\n`/bug [תיאור התקלה]`\n\n🤖 *מה הבוט ישיב:*\nפותח כרטיס באג ממוספר עם כפתור ליוצר לסימון כטופל (+20 נקודות למדווח).' },
  { id: 'founder', label: '🪪 תעודת מייסד', info: '🪪 *הצגת תעודת המייסד הרשמית שלך*\n\n⌨️ *מה לכתוב:*\n`/founder` (או בהשבה לחבר אחר בצוות)\n\n🤖 *מה הבוט ישיב:*\nמציג את תעודת המייסד שלך עם מספר מייסד, תואר אישי, דרגה, נקודות ורצף התפקדות.' },
  { id: 'rank', label: '📈 דרגות מייסדים', info: '📈 *סולם הדרגות של צוות המייסדים*\n\n⌨️ *מה לכתוב:*\n`/rank`\n\n🤖 *מה הבוט ישיב:*\nמציג את כל דרגות המייסדים ואת הניקוד והדרגה הנוכחיים שלך.' },
  { id: 'title', label: '🏷️ בחירת תואר אישי', info: '🏷️ *קביעת תואר כבוד בתעודת המייסד שלך*\n\n⌨️ *מה לכתוב:*\n`/title אדריכל פקודות ראשי`\n\n🤖 *מה הבוט ישיב:*\n"🏷️ התואר האישי שלך עודכן ל: אדריכל פקודות ראשי!"' },
  { id: 'halloffame', label: '🏆 היכל התהילה', info: '🏆 *5 המייסדים המובילים של וולטיק מוד*\n\n⌨️ *מה לכתוב:*\n`/halloffame`\n\n🤖 *מה הבוט ישיב:*\nמציג את טבלת 5 המייסדים המובילים בנקודות עם מדליות.' },
  { id: 'credits', label: '🏅 היכל הקרדיטים', info: '🏅 *רשימת הפקודות שהוצעו ע"י חברי צוות המייסדים*\n\n⌨️ *מה לכתוב:*\n`/credits`\n\n🤖 *מה הבוט ישיב:*\nמציג את רשימת הכבוד של המייסדים שהרעיונות שלהם אושרו ונכנסו לבוט.' },
  { id: 'mvp', label: '⭐ מייסד השבוע', info: '⭐ *הצגת המייסד המוביל והמשפיע ביותר השבוע*\n\n⌨️ *מה לכתוב:*\n`/mvp`\n\n🤖 *מה הבוט ישיב:*\nמכריז על מייסד השבוע עם התואר, הדרגה והניקוד שלו.' },
  { id: 'checkin', label: '🔥 התפקדות יומית', info: '🔥 *צ׳ק-אין יומי לצוות המייסדים*\n\n⌨️ *מה לכתוב:*\n`/checkin`\n\n🤖 *מה הבוט ישיב:*\n"🔥 התפקדות יומית הושלמה! קיבלת +5 נקודות מייסד" ומעדכן את רצף הימים שלך.' },
  { id: 'mission', label: '📋 משימת הצוות', info: '📋 *צפייה במשימה הנוכחית של צוות המייסדים*\n\n⌨️ *מה לכתוב:*\n`/mission`\n\n🤖 *מה הבוט ישיב:*\nמציג את המשימה הנוכחית עם כפתור `✅ השלמתי את המשימה! (+10 נק׳)`.' },
  { id: 'preview', label: '🎨 הדמיית פקודה', info: '🎨 *הדגמה חיה של הודעת בוט עם עיצוב וכפתורים*\n\n⌨️ *מה לכתוב:*\n`/preview *טקסט לדוגמה*\n{{כפתור}{https://t.me/VolticMod_bot}}`\n\n🤖 *מה הבוט ישיב:*\nמציג בזמן אמת איך תיראה ההודעה המעוצבת עם הכפתור.' },
  { id: 'gold', label: '🪙 רעיונות זהב', info: '🪙 *לוח רעיונות הזהב של הקבוצה*\n\n⌨️ *מה לכתוב:*\n• לשמירה: השב להודעה עם `/gold`\n• לצפייה: שלח `/gold`\n\n🤖 *מה הבוט ישיב:*\nשומר את ההודעה בלוח הזהב או מציג את 10 רעיונות הזהב האחרונים.' },
  { id: 'goal', label: '🎯 יעד הצמיחה', info: '🎯 *מד התקדמות הקבוצות והמשתמשים של וולטיק מוד*\n\n⌨️ *מה לכתוב:*\n`/goal`\n\n🤖 *מה הבוט ישיב:*\nמציג מד התקדמות ויזואלי של כמות הקבוצות הפעילות והמשתמשים לעומת היעד.' },
  { id: 'sharebot', label: '🔗 שיתוף הבוט', info: '🔗 *קבלת כרטיס שיתוף מוכן עם כפתור להוספת הבוט*\n\n⌨️ *מה לכתוב:*\n`/sharebot`\n\n🤖 *מה הבוט ישיב:*\nמוציא הודעת שיתוף מוכנה עם כפתור להוספת וולטיק מוד לקבוצות חדשות.' },
  { id: 'ask', label: '❓ שאלה ליוצר', info: '❓ *שליחת שאלה בולטת ישירות ליוצר הבוט*\n\n⌨️ *מה לכתוב:*\n`/ask [השאלה שלך]`\n\n🤖 *מה הבוט ישיב:*\nממסגר את השאלה בקבוצה ומעביר אותה ישירות לפרטי של יוצר הבוט.' },
  { id: 'feedback_bot', label: '⭐ דירוג הבוט', info: '⭐ *דירוג העדכונים וחוויית המשתמש בבוט*\n\n⌨️ *מה לכתוב:*\n`/feedback_bot`\n\n🤖 *מה הבוט ישיב:*\nפותח כפתורי 1⭐ עד 5⭐ ומציג את הציון הממוצע.' },
  { id: 'award', label: '🎖️ הענקת מדליה', info: '🎖️ *הענקת נקודות הצטיינות למייסד (ליוצר בלבד)*\n\n⌨️ *מה לכתוב (בהשבה להודעה):*\n`/award 50`\n\n🤖 *מה הבוט ישיב:*\n"🎖️ אות הצטיינות מיוצר הבוט! המייסד קיבל בונוס של +50 נקודות מייסד!"' }
];

function buildFoundersMenuKeyboard() {
  const rows = [];
  for (let i = 0; i < FOUNDERS_MENU_ITEMS.length; i += 2) {
    const r = [{ text: FOUNDERS_MENU_ITEMS[i].label, callback_data: `fnd_m_${FOUNDERS_MENU_ITEMS[i].id}` }];
    if (FOUNDERS_MENU_ITEMS[i + 1]) {
      r.push({ text: FOUNDERS_MENU_ITEMS[i + 1].label, callback_data: `fnd_m_${FOUNDERS_MENU_ITEMS[i + 1].id}` });
    }
    rows.push(r);
  }
  return { inline_keyboard: rows };
}

function handleCreatorExplain(ctx, rawQuery) {
  if (!isCreator(ctx)) return;
  const clean = String(rawQuery || '').trim().replace(/^\//, '').split('@')[0].toLowerCase();
  if (!clean) {
    const view = buildCreatorAllCmdsKeyboard(0);
    return ctx.telegram.sendMessage(CREATOR_ID, view.text, {
      parse_mode: 'Markdown',
      reply_markup: view.reply_markup
    }).catch(() => {});
  }
  const entry = CREATOR_CMD_DICTIONARY[clean];
  if (!entry) {
    const view = buildCreatorAllCmdsKeyboard(0);
    return ctx.telegram.sendMessage(
      CREATOR_ID,
      `❓ לא נמצאה הפקודה \`/${clean}\`. בחר פקודה מהכפתורים למטה:\n\n${view.text}`,
      { parse_mode: 'Markdown', reply_markup: view.reply_markup }
    ).catch(() => {});
  }
  return ctx.telegram.sendMessage(
    CREATOR_ID,
    entry.info,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 לתפריט כל הפקודות', callback_data: 'cexp_page_0' }],
          [{ text: '🔙 חזרה לפאנל /owner', callback_data: 'own_panel' }]
        ]
      }
    }
  ).catch(() => {});
}

module.exports = function registerFoundersCommands(bot) {
  // דפדוף ולחיצה על כפתורי תפריט כל הפקודות מתוך /owner – עובד אך ורק ליוצר הבוט!
  bot.action(/^cexp_page_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ תפריט זה זמין ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const page = parseInt(ctx.match[1], 10) || 0;
    await ctx.answerCbQuery().catch(() => {});
    const view = buildCreatorAllCmdsKeyboard(page);
    await ctx.editMessageText(view.text, {
      parse_mode: 'Markdown',
      reply_markup: view.reply_markup
    }).catch(() => ctx.reply(view.text, {
      parse_mode: 'Markdown',
      reply_markup: view.reply_markup
    }));
  });

  bot.action(/^cexp_cmd_(\d+)_(.+)$/, async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ תפריט זה זמין ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const page = parseInt(ctx.match[1], 10) || 0;
    const cmdKey = ctx.match[2];
    const entry = CREATOR_CMD_DICTIONARY[cmdKey];
    if (!entry) return ctx.answerCbQuery('לא נמצא').catch(() => {});
    await ctx.answerCbQuery().catch(() => {});
    const kb = {
      inline_keyboard: [
        [{ text: '🔙 חזרה לרשימת הפקודות', callback_data: `cexp_page_${page}` }],
        [{ text: '👑 חזרה לפאנל /owner', callback_data: 'own_panel' }]
      ]
    };
    await ctx.editMessageText(entry.info, {
      parse_mode: 'Markdown',
      reply_markup: kb
    }).catch(() => ctx.reply(entry.info, {
      parse_mode: 'Markdown',
      reply_markup: kb
    }));
  });

  // זיהוי חכם ליוצר הבוט בפרטי + פרסום אוטומטי בקבוצת המייסדים
  bot.use(async (ctx, next) => {
    if (isCreator(ctx) && ctx.chat?.type === 'private' && ctx.message?.text) {
      const parts = ctx.message.text.trim().split(/\s+/);
      if (parts.length === 2 && /^\/?founders$/i.test(parts[1])) {
        const targetCmd = parts[0].replace(/^\//, '').split('@')[0].toLowerCase();
        if (CREATOR_CMD_DICTIONARY[targetCmd]) {
          await handleCreatorExplain(ctx, targetCmd);
          return;
        }
      }
    }

    if (isFoundersGroup(ctx) && ctx.message) {
      try {
        const data = await getGroupData(FOUNDERS_CHAT_ID);
        const f = ensureFoundersData(data);
        if (ctx.from && !ctx.from.is_bot) {
          ensureMember(f, ctx.from);
        }
        if (f.announcedVersion !== FOUNDERS_VERSION) {
          f.announcedVersion = FOUNDERS_VERSION;
          await saveGroupData(FOUNDERS_CHAT_ID, data);
          await ctx.reply(FOUNDERS_UPDATE_ANNOUNCEMENT, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '👑 פתח את תפריט צוות המייסדים', callback_data: 'fnd_m_main' }]] }
          }).catch(() => {});
        } else {
          await saveGroupData(FOUNDERS_CHAT_ID, data);
        }
      } catch (e) {}
    }
    return next();
  });

  // 18. /founders - בקבוצת המייסדים פותח תפריט ושולח מדריך ליוצר
  bot.command(['founders', 'founders_menu'], async (ctx) => {
    const arg = (ctx.message.text || '').replace(/^\/(founders|founders_menu)(@\S+)?\s*/i, '').trim();

    if (isCreator(ctx) && arg) {
      await handleCreatorExplain(ctx, arg);
      if (ctx.chat?.type === 'private') return;
    }

    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    ensureMember(f, ctx.from);
    await saveGroupData(FOUNDERS_CHAT_ID, data);

    const triggerName = ctx.from?.first_name || 'משתמש';
    await ctx.telegram.sendMessage(
      CREATOR_ID,
      `🔔 *${triggerName}* פתח כעת את תפריט צוות המייסדים (\`/founders\`).\n\n${CREATOR_SECRET_FOUNDERS_GUIDE}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
    await ctx.reply(
      `👑 *פאנל צוות המייסדים – וולטיק מוד*\nלחץ על כל כפתור למטה כדי לראות *מה לכתוב* ו*מה הבוט ישיב*:`,
      { parse_mode: 'Markdown', reply_markup: buildFoundersMenuKeyboard() }
    );
  });

  bot.command('founders_announce', async (ctx) => {
    if (!isFoundersGroup(ctx) || !isCreator(ctx)) return;
    await ctx.reply(FOUNDERS_UPDATE_ANNOUNCEMENT, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '👑 פתח את תפריט צוות המייסדים', callback_data: 'fnd_m_main' }]] }
    });
  });

  bot.action(/^fnd_m_(.+)$/, async (ctx) => {
    if (!isFoundersGroup(ctx)) return ctx.answerCbQuery().catch(() => {});
    const id = ctx.match[1];
    await ctx.answerCbQuery().catch(() => {});
    if (id === 'main') {
      return ctx.editMessageText(
        `👑 *פאנל צוות המייסדים – וולטיק מוד*\nלחץ על כל כפתור למטה כדי לראות *מה לכתוב* ו*מה הבוט ישיב*:`,
        { parse_mode: 'Markdown', reply_markup: buildFoundersMenuKeyboard() }
      ).catch(() => {});
    }
    const item = FOUNDERS_MENU_ITEMS.find((x) => x.id === id);
    if (!item) return;
    await ctx.editMessageText(item.info, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔙 חזרה', callback_data: 'fnd_m_main' }]] }
    }).catch(() => {});
  });

  // 1. /idea [רעיון] - הצעת רעיון עם הצבעות חיות ואישור יוצר
  bot.command('idea', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const text = (ctx.message.text || '').replace(/^\/idea(@\S+)?\s*/i, '').trim();
    if (!text) return ctx.reply('💡 שימוש: `/idea [תיאור הרעיון שלך לפקודה או שדרוג]`', { parse_mode: 'Markdown' });
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const m = ensureMember(f, ctx.from);
    if (!isCreator(ctx)) {
      m.points += 5;
    }
    const iid = Date.now().toString(36);
    f.ideas[iid] = { authorId: ctx.from.id, authorName: m.name, text, up: [ctx.from.id], down: [], approved: false };
    await saveGroupData(FOUNDERS_CHAT_ID, data);

    const authorLine = isCreator(ctx)
      ? `היוצר של וולטיק מוד: *${m.name}*`
      : `👤 *מאת:* ${m.name} (מייסד #${m.number})`;

    await ctx.reply(
      `💡 *הצעת פיתוח חדשה מצוות המייסדים!*\n` +
      `${authorLine}\n` +
      `📝 *הרעיון:* ${text}\n\n` +
      `הצביעו למטה מה דעתכם:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔥 עף על זה! (1)', callback_data: `fnd_id_up_${iid}` },
              { text: '🤔 פחות דחוף (0)', callback_data: `fnd_id_dn_${iid}` }
            ],
            [{ text: '✅ אשר לפיתוח (+25 נק׳ - ליוצר)', callback_data: `fnd_id_ok_${iid}` }]
          ]
        }
      }
    );
  });

  bot.action(/^fnd_id_(up|dn|ok)_(.+)$/, async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const act = ctx.match[1];
    const iid = ctx.match[2];
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const idea = f.ideas[iid];
    if (!idea) return ctx.answerCbQuery('הרעיון לא נמצא').catch(() => {});

    if (act === 'ok') {
      if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ רק יוצר הבוט יכול לאשר רעיון לפיתוח!', { show_alert: true }).catch(() => {});
      if (idea.approved) return ctx.answerCbQuery('כבר אושר!').catch(() => {});
      idea.approved = true;
      const authorIsCreator = isCreatorId(idea.authorId);
      const author = f.members[String(idea.authorId)];
      if (author && !authorIsCreator) {
        author.points = (author.points || 0) + 25;
        author.ideasApproved = (author.ideasApproved || 0) + 1;
      }
      f.credits.push({ name: idea.authorName, cmd: idea.text.slice(0, 50), isCreator: authorIsCreator });
      await saveGroupData(FOUNDERS_CHAT_ID, data);
      await ctx.answerCbQuery('✅ הרעיון אושר!').catch(() => {});
      const creditLine = authorIsCreator
        ? `היוצר של וולטיק מוד: *${idea.authorName}*`
        : `👤 *מאת:* ${idea.authorName} (קיבל +25 נקודות מייסד ונכנס להיכל הקרדיטים!)`;
      return ctx.editMessageText(
        `✅ *רעיון אושר לפיתוח ע"י יוצר הבוט!*\n${creditLine}\n📝 *הרעיון:* ${idea.text}\n👍 תומכים: ${idea.up.length}`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }

    const uid = ctx.from.id;
    idea.up = (idea.up || []).filter((id) => id !== uid);
    idea.down = (idea.down || []).filter((id) => id !== uid);
    if (act === 'up') idea.up.push(uid);
    else idea.down.push(uid);
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.answerCbQuery('קולך נרשם!').catch(() => {});
    await ctx.editMessageReplyMarkup({
      inline_keyboard: [
        [
          { text: `🔥 עף על זה! (${idea.up.length})`, callback_data: `fnd_id_up_${iid}` },
          { text: `🤔 פחות דחוף (${idea.down.length})`, callback_data: `fnd_id_dn_${iid}` }
        ],
        [{ text: '✅ אשר לפיתוח (+25 נק׳ - ליוצר)', callback_data: `fnd_id_ok_${iid}` }]
      ]
    }).catch(() => {});
  });

  // 2. /bug [תיאור] - דיווח באגים של צוות המייסדים
  bot.command('bug', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const text = (ctx.message.text || '').replace(/^\/bug(@\S+)?\s*/i, '').trim();
    if (!text) return ctx.reply('🐛 שימוש: `/bug [תיאור התקלה שמצאת]`', { parse_mode: 'Markdown' });
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const m = ensureMember(f, ctx.from);
    f.bugCounter = (f.bugCounter || 0) + 1;
    const bid = String(f.bugCounter);
    f.bugs[bid] = { num: f.bugCounter, authorId: ctx.from.id, authorName: m.name, text, fixed: false };
    await saveGroupData(FOUNDERS_CHAT_ID, data);

    const reporterLine = isCreator(ctx)
      ? `היוצר של וולטיק מוד: *${m.name}*`
      : `👤 *מדווח:* ${m.name}`;

    await ctx.reply(
      `🐛 *דיווח באג #${bid} – צוות המייסדים*\n${reporterLine}\n🔍 *תיאור:* ${text}`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔧 סמן כטופל (+20 נק׳ למדווח - ליוצר)', callback_data: `fnd_bug_fix_${bid}` }]] }
      }
    );
  });

  bot.action(/^fnd_bug_fix_(\d+)$/, async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ רק יוצר הבוט יכול לסמן באג כטופל!', { show_alert: true }).catch(() => {});
    const bid = ctx.match[1];
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const bug = f.bugs[bid];
    if (!bug || bug.fixed) return ctx.answerCbQuery('כבר טופל!').catch(() => {});
    bug.fixed = true;
    const reporterIsCreator = isCreatorId(bug.authorId);
    const author = f.members[String(bug.authorId)];
    if (author && !reporterIsCreator) {
      author.points = (author.points || 0) + 20;
      author.bugsFixed = (author.bugsFixed || 0) + 1;
    }
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.answerCbQuery('🔧 סומן כטופל!').catch(() => {});
    const reporterLine = reporterIsCreator
      ? `היוצר של וולטיק מוד: *${bug.authorName}*`
      : `👤 *מדווח:* ${bug.authorName} (זוכה ב-+20 נקודות מייסד!)`;
    await ctx.editMessageText(
      `✅ *באג #${bid} תוקן ע"י יוצר הבוט!*\n${reporterLine}\n🔍 *תיאור:* ${bug.text}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  });

  // 3. /credits + /addcredit - היכל הקרדיטים של הפקודות
  bot.command('credits', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    if (!f.credits.length) {
      return ctx.reply('🏅 *היכל הקרדיטים של וולטיק מוד:*\nעדיין לא נרשמו קרדיטים. שלחו רעיון עם `/idea` וברגע שהוא יאושר שמכם יופיע כאן לתמיד!', { parse_mode: 'Markdown' });
    }
    const list = f.credits.map((c, i) => `${i + 1}. 🌟 *${c.name}* – ${c.cmd}`).join('\n');
    await ctx.reply(`🏅 *היכל הקרדיטים – המייסדים שעיצבו את וולטיק מוד:*\n\n${list}`, { parse_mode: 'Markdown' });
  });

  bot.command('addcredit', async (ctx) => {
    if (!isFoundersGroup(ctx) || !isCreator(ctx)) return;
    const raw = (ctx.message.text || '').replace(/^\/addcredit(@\S+)?\s*/i, '').trim();
    if (!raw.includes('|')) return ctx.reply('שימוש ליוצר: `/addcredit שם המייסד | הפקודה שהציע`', { parse_mode: 'Markdown' });
    const [name, ...rest] = raw.split('|');
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    f.credits.push({ name: name.trim(), cmd: rest.join('|').trim() });
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.reply(`🏅 נוסף להיכל הקרדיטים: *${name.trim()}*!`, { parse_mode: 'Markdown' });
  });

  // 4. /founder - תעודת מייסד אישית (ועל היוצר כותב "היוצר של וולטיק מוד" ללא נקודות!)
  bot.command('founder', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const targetUser = ctx.message.reply_to_message?.from || ctx.from;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const m = ensureMember(f, targetUser);
    await saveGroupData(FOUNDERS_CHAT_ID, data);

    if (isCreatorId(targetUser.id)) {
      return ctx.reply(
        `👑 *תעודת יוצר רשמית – וולטיק מוד*\n\n` +
        `היוצר של וולטיק מוד: *${m.name}*\n` +
        `🏷️ *תואר:* ${m.title || 'היוצר והמפתח הראשי של וולטיק מוד'}\n` +
        `⚡ *מעמד:* מייסד ויוצר המערכת`,
        { parse_mode: 'Markdown' }
      );
    }

    await ctx.reply(
      `🪪 *תעודת מייסד רשמית – וולטיק מוד*\n\n` +
      `👤 *שם:* ${m.name} (מייסד #${m.number})\n` +
      `🏷️ *תואר אישי:* ${m.title}\n` +
      `🎖️ *דרגה:* ${getFounderRankName(m.points, targetUser.id)}\n` +
      `⭐ *נקודות מייסד:* ${m.points}\n` +
      `💡 *רעיונות שאושרו:* ${m.ideasApproved || 0}\n` +
      `🐛 *באגים שתיקן:* ${m.bugsFixed || 0}\n` +
      `🔥 *רצף התפקדות:* ${m.streak || 0} ימים`,
      { parse_mode: 'Markdown' }
    );
  });

  // 5. /rank - סולם דרגות צוות המייסדים
  bot.command('rank', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const m = ensureMember(f, ctx.from);
    await saveGroupData(FOUNDERS_CHAT_ID, data);

    const statusLine = isCreator(ctx)
      ? `👑 *היוצר של וולטיק מוד: ${m.name}*`
      : `🔹 *המצב שלך:* ${m.points} נקודות (${getFounderRankName(m.points, ctx.from.id)})`;

    await ctx.reply(
      `📈 *סולם הדרגות של צוות המייסדים:*\n\n` +
      `• 🌱 *מייסד מתלמד:* 0 – 29 נקודות\n` +
      `• ⚡ *מייסד פעיל:* 30 – 79 נקודות\n` +
      `• 🧠 *אדריכל פקודות:* 80 – 149 נקודות\n` +
      `• 👑 *מייסד על:* 150+ נקודות\n\n` +
      `${statusLine}\n` +
      `💡 *איך צוברים נקודות?* הצעת רעיונות (\`/idea\`), מציאת באגים (\`/bug\`), התפקדות יומית (\`/checkin\`) וביצוע משימות (\`/mission\`)!`,
      { parse_mode: 'Markdown' }
    );
  });

  // 6. /halloffame - היכל התהילה של 5 המייסדים המובילים (ללא דירוג נקודות על היוצר)
  bot.command('halloffame', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const creatorMember = f.members[String(CREATOR_ID)];
    const creatorHeader = creatorMember ? `👑 *היוצר של וולטיק מוד:* ${creatorMember.name}\n\n` : '';
    const top = Object.values(f.members)
      .filter((m) => !isCreatorId(m.id))
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 5);
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const rows = top.map((m, i) => `${medals[i]} *${m.name}* (${m.title}) – *${m.points} נק׳* | ${getFounderRankName(m.points, m.id)}`).join('\n');
    await ctx.reply(`🏆 *היכל התהילה – צוות המייסדים של וולטיק מוד:*\n\n${creatorHeader}${rows || 'עדיין אין מייסדים מדורגים.'}`, { parse_mode: 'Markdown' });
  });

  // 7. /title [כינוי] - בחירת תואר מייסד אישי
  bot.command('title', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const newTitle = (ctx.message.text || '').replace(/^\/title(@\S+)?\s*/i, '').trim();
    if (!newTitle || newTitle.length > 30) {
      return ctx.reply('🏷️ שימוש: `/title [התואר האישי שלך עד 30 תווים]`\nלמשל: `/title צייד הבאגים`', { parse_mode: 'Markdown' });
    }
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const m = ensureMember(f, ctx.from);
    m.title = newTitle;
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.reply(`🏷️ התואר האישי שלך עודכן ל: *"${newTitle}"*!`, { parse_mode: 'Markdown' });
  });

  // 8. /award [נקודות] - הענקת נקודות ומדליה ע"י היוצר
  bot.command('award', async (ctx) => {
    if (!isFoundersGroup(ctx) || !isCreator(ctx)) return;
    const replyUser = ctx.message.reply_to_message?.from;
    if (!replyUser) return ctx.reply('👑 השב להודעה של המייסד שתרצה לצ׳פר וכתוב `/award 30`', { parse_mode: 'Markdown' });
    if (isCreatorId(replyUser.id)) {
      return ctx.reply(`👑 היוצר של וולטיק מוד: *${replyUser.first_name}*`, { parse_mode: 'Markdown' });
    }
    const pts = parseInt((ctx.message.text || '').trim().split(/\s+/)[1] || '25', 10) || 25;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const m = ensureMember(f, replyUser);
    m.points = (m.points || 0) + pts;
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.reply(`🎖️ *אות הצטיינות מיוצר הבוט!*\nהמייסד *${m.name}* קיבל בונוס של *+${pts} נקודות מייסד*! (סה"כ: ${m.points} נק׳ – ${getFounderRankName(m.points, replyUser.id)})`, { parse_mode: 'Markdown' });
  });
  // 9. /preview [כפתור/הודעה] - הדמיית פקודה חיה בקבוצת המייסדים
  bot.command('preview', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const raw = (ctx.message.text || '').replace(/^\/preview(@\S+)?\s*/i, '').trim();
    if (!raw) {
      return ctx.reply('🎨 *הדמיית פקודה חיה:*\nשלח `/preview` ואחריו טקסט וכפתורים כדי להדגים לצוות איך תיראה פקודה חדשה:\n`/preview *כותרת מודגשת*\n{{כפתור לדוגמה}{https://t.me/VolticMod_bot}}`', { parse_mode: 'Markdown' });
    }
    await sendFormattedMessage(ctx, `🧪 *תצוגת הדמיה מאת ${ctx.from.first_name}:*\n\n${raw}`, { name: ctx.from.first_name || 'מייסד' });
  });

  // 10. /goal ו-/setgoal - מד יעד הצמיחה של וולטיק מוד
  bot.command('goal', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const ownerGlobal = await getGroupData('owner_global');
    const groupsCount = Object.keys(ownerGlobal?.groups || {}).length || 1;
    const usersCount = Object.keys(ownerGlobal?.users || {}).length || 1;
    const target = f.goalTarget || 50;
    const pct = Math.min(100, Math.round((groupsCount / target) * 100));
    const filled = Math.round(pct / 10);
    const bar = '█'.repeat(filled) + '▒'.repeat(10 - filled);

    await ctx.reply(
      `🎯 *מד יעד הצמיחה – וולטיק מוד:*\n\n` +
      `🏢 *קבוצות פעילות:* ${groupsCount} מתוך יעד של ${target} קבוצות\n` +
      `👥 *משתמשים שהכירו את הבוט:* ${usersCount}\n` +
      `📊 *התקדמות ליעד:* [${bar}] *${pct}%*\n\n` +
      `שלחו \`/sharebot\` כדי לשתף את הבוט ולהגיע ליעד יחד! 🚀`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('setgoal', async (ctx) => {
    if (!isFoundersGroup(ctx) || !isCreator(ctx)) return;
    const num = parseInt((ctx.message.text || '').trim().split(/\s+/)[1], 10);
    if (!num || num < 5) return ctx.reply('שימוש ליוצר: `/setgoal 100`', { parse_mode: 'Markdown' });
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    ensureFoundersData(data).goalTarget = num;
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.reply(`🎯 יעד הקבוצות החדש עודכן ל-*${num} קבוצות*!`, { parse_mode: 'Markdown' });
  });

  // 11. /sharebot - כרטיס שיתוף מהיר של הבוט
  bot.command('sharebot', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const botUsername = ctx.botInfo?.username || 'VolticMod_bot';
    await ctx.reply(
      `⚡ *וולטיק מוד – הבוט המתקדם לניהול והגנה על קבוצות בטלגרם!*\n\n` +
      `רוצים להגן על הקבוצה שלכם מספאם, להוסיף הגרלות, לחישות סודיות, אימות מצטרפים ועשרות פקודות חכמות בחינם?\n` +
      `לחצו על הכפתור למטה להוספת הבוט לקבוצה שלכם:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ הוסף את וולטיק מוד לקבוצה שלך', url: `https://t.me/${botUsername}?startgroup=true` }],
            [{ text: '🤖 כניסה לבוט בפרטי', url: `https://t.me/${botUsername}` }]
          ]
        }
      }
    );
  });

  // 12. /mvp - מייסד השבוע (בוחר מבין המייסדים ללא היוצר)
  bot.command('mvp', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const list = Object.values(f.members)
      .filter((m) => !isCreatorId(m.id))
      .sort((a, b) => (b.points || 0) - (a.points || 0));
    if (!list.length) return ctx.reply('⭐ עדיין אין מספיק נתונים לבחירת מייסד השבוע.');
    const winner = list[0];
    await ctx.reply(
      `⭐ *מייסד השבוע של וולטיק מוד!* ⭐\n\n` +
      `👑 *המייסד המוביל:* ${winner.name} (מייסד #${winner.number})\n` +
      `🏷️ *תואר:* ${winner.title}\n` +
      `🎖️ *דרגה:* ${getFounderRankName(winner.points, winner.id)}\n` +
      `🔥 *ניקוד מצטבר:* ${winner.points} נקודות!\n\n` +
      `כל הכבוד על התרומה האדירה לפיתוח הבוט! 👏`,
      { parse_mode: 'Markdown' }
    );
  });

  // 13. /mission ו-/setmission - משימת צוות המייסדים
  bot.command('mission', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const doneCount = Object.keys(f.mission.doneBy || {}).length;
    await ctx.reply(
      `📋 *המשימה הנוכחית של צוות המייסדים:*\n\n` +
      `🎯 *${f.mission.text}*\n\n` +
      `✅ השלימו את המשימה עד כה: *${doneCount} מייסדים*`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '✅ השלמתי את המשימה! (+10 נק׳)', callback_data: 'fnd_mis_done' }]] }
      }
    );
  });

  bot.command('setmission', async (ctx) => {
    if (!isFoundersGroup(ctx) || !isCreator(ctx)) return;
    const text = (ctx.message.text || '').replace(/^\/setmission(@\S+)?\s*/i, '').trim();
    if (!text) return ctx.reply('שימוש ליוצר: `/setmission [תיאור המשימה החדשה לצוות]`', { parse_mode: 'Markdown' });
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    ensureFoundersData(data).mission = { text, doneBy: {} };
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.reply(`📋 *משימה חדשה הוגדרה לצוות המייסדים!*\n🎯 ${text}`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '✅ השלמתי את המשימה! (+10 נק׳)', callback_data: 'fnd_mis_done' }]] }
    });
  });

  bot.action('fnd_mis_done', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const uid = String(ctx.from.id);
    if (f.mission.doneBy && f.mission.doneBy[uid]) {
      return ctx.answerCbQuery('כבר סימנת שהשלמת את המשימה הנוכחית! 💪', { show_alert: true }).catch(() => {});
    }
    f.mission.doneBy = f.mission.doneBy || {};
    f.mission.doneBy[uid] = true;
    const m = ensureMember(f, ctx.from);
    if (!isCreator(ctx)) {
      m.points = (m.points || 0) + 10;
    }
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.answerCbQuery(isCreator(ctx) ? `👑 היוצר של וולטיק מוד: ${m.name}` : '🎉 כל הכבוד! קיבלת +10 נקודות מייסד!').catch(() => {});
    const doneCount = Object.keys(f.mission.doneBy).length;
    await ctx.editMessageText(
      `📋 *המשימה הנוכחית של צוות המייסדים:*\n\n🎯 *${f.mission.text}*\n\n✅ השלימו את המשימה עד כה: *${doneCount} מייסדים*`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '✅ השלמתי את המשימה! (+10 נק׳)', callback_data: 'fnd_mis_done' }]] }
      }
    ).catch(() => {});
  });

  // 14. /checkin - התפקדות יומית של צוות המייסדים
  bot.command('checkin', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const today = getIsraelDateKey();
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const m = ensureMember(f, ctx.from);

    if (m.lastCheckin === today) {
      if (isCreator(ctx)) {
        return ctx.reply(`🔥 כבר התפקדת היום!\nהיוצר של וולטיק מוד: *${m.name}* (רצף של *${m.streak || 1} ימים*)`, { parse_mode: 'Markdown' });
      }
      return ctx.reply(`🔥 *${m.name}*, כבר התפקדת היום! רצף ההתפקדות שלך: *${m.streak || 1} ימים* (${m.points} נק׳).`, { parse_mode: 'Markdown' });
    }
    m.lastCheckin = today;
    m.streak = (m.streak || 0) + 1;
    if (!isCreator(ctx)) {
      m.points = (m.points || 0) + 5;
    }
    await saveGroupData(FOUNDERS_CHAT_ID, data);

    if (isCreator(ctx)) {
      return ctx.reply(
        `🔥 *התפקדות יומית הושלמה!*\n` +
        `היוצר של וולטיק מוד: *${m.name}*\n` +
        `📅 רצף התפקדות: *${m.streak} ימים*!`,
        { parse_mode: 'Markdown' }
      );
    }

    await ctx.reply(
      `🔥 *התפקדות יומית הושלמה – ${m.name}!*\n` +
      `➕ קיבלת *+5 נקודות מייסד* (סה"כ: ${m.points} נק׳)\n` +
      `📅 רצף התפקדות: *${m.streak} ימים*!`,
      { parse_mode: 'Markdown' }
    );
  });

  // 15. /ask [שאלה] - שאלה ישירה ליוצר הבוט
  bot.command('ask', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const q = (ctx.message.text || '').replace(/^\/ask(@\S+)?\s*/i, '').trim();
    if (!q) return ctx.reply('❓ שימוש: `/ask [השאלה שלך ליוצר הבוט]`', { parse_mode: 'Markdown' });
    await ctx.reply(`❓ *שאלה ליוצר הבוט מאת ${ctx.from.first_name}:*\n"${q}"\n\n*(השאלה הועברה ליוצר הבוט)*`, { parse_mode: 'Markdown' });
    await ctx.telegram.sendMessage(
      CREATOR_ID,
      `❓ *שאלה חדשה מקבוצת צוות המייסדים:*\n👤 מאת: ${ctx.from.first_name} (${ctx.from.username ? `@${ctx.from.username}` : ctx.from.id})\n💬 השאלה:\n${q}`
    ).catch(() => {});
  });

  // 16. /gold - שמירה וצפייה ב"רעיונות הזהב" מהצ'אט (ללא נקודות על היוצר!)
  bot.command('gold', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const reply = ctx.message.reply_to_message;

    if (reply && (reply.text || reply.caption)) {
      const txt = (reply.text || reply.caption).slice(0, 200);
      const author = reply.from?.first_name || 'מייסד';
      const replyIsCreator = isCreatorId(reply.from?.id);
      f.gold.push({ author, text: txt, savedBy: ctx.from.first_name || 'מייסד', isCreator: replyIsCreator });
      if (f.gold.length > 25) f.gold.shift();
      if (reply.from && !reply.from.is_bot && !replyIsCreator) {
        const m = ensureMember(f, reply.from);
        m.points = (m.points || 0) + 10;
      }
      await saveGroupData(FOUNDERS_CHAT_ID, data);
      if (replyIsCreator) {
        return ctx.reply(`🪙 *נשמר בלוח רעיונות הזהב!*\nהיוצר של וולטיק מוד: ${author}`, { parse_mode: 'Markdown' });
      }
      return ctx.reply(`🪙 *נשמר בלוח רעיונות הזהב!* (+10 נקודות מייסד ל-${author})`, { parse_mode: 'Markdown' });
    }

    if (!f.gold.length) {
      return ctx.reply('🪙 *לוח רעיונות הזהב ריק כרגע.*\nהשב להודעה מבריקה בצ׳אט עם הפקודה `/gold` כדי לשמור אותה כאן!', { parse_mode: 'Markdown' });
    }
    const list = f.gold.slice(-10).map((g, i) => {
      const prefix = g.isCreator ? `👑 *היוצר של וולטיק מוד (${g.author}):*` : `💡 *${g.author}:*`;
      return `${i + 1}. ${prefix} "${g.text}"`;
    }).join('\n\n');
    await ctx.reply(`🪙 *לוח רעיונות הזהב של צוות המייסדים:*\n\n${list}`, { parse_mode: 'Markdown' });
  });

  // 17. /feedback_bot - דירוג הבוט בכוכבים
  bot.command('feedback_bot', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const vals = Object.values(f.ratings || {});
    const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'טרם דורג';

    await ctx.reply(
      `⭐ *דירוג וולטיק מוד ע"י צוות המייסדים*\n` +
      `📊 דירוג ממוצע נוכחי: *${avg}* (${vals.length} מדרגים)\n\n` +
      `דרגו בכפתורים למטה איך הבוט מרגיש לכם עד עכשיו:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '1⭐', callback_data: 'fnd_rate_1' },
            { text: '2⭐', callback_data: 'fnd_rate_2' },
            { text: '3⭐', callback_data: 'fnd_rate_3' },
            { text: '4⭐', callback_data: 'fnd_rate_4' },
            { text: '5⭐', callback_data: 'fnd_rate_5' }
          ]]
        }
      }
    );
  });

  bot.action(/^fnd_rate_([1-5])$/, async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const stars = parseInt(ctx.match[1], 10);
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    f.ratings[String(ctx.from.id)] = stars;
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    const vals = Object.values(f.ratings);
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    await ctx.answerCbQuery(`תודה! דירגת ${stars} כוכבים ⭐`).catch(() => {});
    await ctx.editMessageText(
      `⭐ *דירוג וולטיק מוד ע"י צוות המייסדים*\n📊 דירוג ממוצע נוכחי: *${avg}/5* (${vals.length} מדרגים)\n\nתודה על הדירוג!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '1⭐', callback_data: 'fnd_rate_1' },
            { text: '2⭐', callback_data: 'fnd_rate_2' },
            { text: '3⭐', callback_data: 'fnd_rate_3' },
            { text: '4⭐', callback_data: 'fnd_rate_4' },
            { text: '5⭐', callback_data: 'fnd_rate_5' }
          ]]
        }
      }
    ).catch(() => {});
  });
};
