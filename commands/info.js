const {
  getGroupData,
  saveGroupData,
  parseRichMessage,
  sendFormattedMessage,
  requireAdmin,
  getTarget
} = require('./utils');

const CREATOR_ID = 1773089386;
const FOUNDERS_CHAT_ID = '-1004417781995';
const LATEST_VERSION = '1.2.2.1v';
const DEFAULT_PREV_USER_VERSION = '1.2.1.0v';

const isCreator = (ctx) => Number(ctx.from?.id) === CREATOR_ID;
const isFoundersChatId = (cid) => {
  const s = String(cid || '');
  return s === FOUNDERS_CHAT_ID || s === '-4417781995' || s.endsWith('4417781995');
};

const creatorWaitState = {};

// היסטוריית כל עדכוני הבוט (לכפתור "עדכון מספר..." למשתמשים ולכפתור "📜 היסטוריית עדכוני הבוט" בפאנל היוצר)
const VERSION_HISTORY = {
  '1.0.0.0v': {
    title: 'עדכון מספר 1.0.0.0v – השקת וולטיק מוד',
    date: 'השקה ראשונית',
    text:
  `📦 *עדכון מספר 1.0.0.0v – השקת וולטיק מוד*\n\n` +
  `• 👮 *ניהול משתמשים:* חסימה (/ban), שחרור (/unban), הוצאה (/kick), השתקה (/mute), אזהרות (/warn) וקידום אדמינים (/promote).\n` +
  `• 🧹 *תוכן וניקוי:* מחיקת הודעות (/del, /purge), נעיצה (/pin), מצב איטי (/slowmode) ונעילת תוכן (/lock).\n` +
  `• 🛡️ *הגנות בסיס:* אנטי-ספאם (/antispam), חסימת לינקים (/antilink), הגנת הצפה (/antiflood), מילים אסורות (/filter), ברוכים הבאים (/welcome) וחוקים (/rules).`
  },
  '1.1.0.0v': {
    title: 'עדכון מספר 1.1.0.0v – אבטחה מתקדמת וקהילה',
    date: 'עדכון מערכות הגנה',
    text:
  `🛡️ *עדכון מספר 1.1.0.0v – אבטחה מתקדמת וקהילה*\n\n` +
  `• 🚨 *מצב חירום נגד מתקפות (/raidmode):* זיהוי ובלימה אוטומטית של מתקפות בוטים.\n` +
  `• 🔐 *אימות מצטרפים (/verify):* אימות אנושי בכפתורים המאוחד עם הודעת הברוכים הבאים.\n` +
  `• 🔒 *לחישה סודית (/secret):* שליחת הודעה סודית בקבוצה שרק הנמען יכול לקרוא.\n` +
  `• 🎁 *הגרלות ומשחקים:* מערכת הגרלות (/giveaway), טבלת פעילים (/top), נעילת לילה לפי שעון ישראל (/nightmode) וגיבוי קבוצה (/backup).`
  },
  '1.2.0.0v': {
    title: 'עדכון מספר 1.2.0.0v – צוות המייסדים ופקודות חכמות',
    date: 'עדכון מייסדים וקהילה',
    text:
  `👑 *עדכון מספר 1.2.0.0v – צוות המייסדים ופקודות חכמות*\n\n` +
  `• 👑 *מערכת צוות המייסדים (/founders):* הצעת רעיונות (/idea), דיווח באגים (/bug), תעודת מייסד (/founder), דרגות (/rank), היכל התהילה (/halloffame) ורעיונות זהב (/gold).\n` +
  `• 🌍 *הגנות וכלים לקבוצות:* חסימת שפות זרות (/antiforeign), חסימת העברות (/antiforward), הצבעת הדחה (/voteban), מערכת ערעורים (/appeal), מכסת הודעות (/msgquota), דו-קרב (/duel) ומלכודת דבש (/honeypot).`
  },
  '1.2.1.0v': {
    title: 'עדכון מספר 1.2.1.0v – 37 פקודות חדשות וחסימת קידומות',
    date: 'עדכון ענק 1.2.1.0v',
    text:
  `🚀 *עדכון מספר 1.2.1.0v – חסימת קידומות ו-15 פקודות קהילה*\n\n` +
  `• 📵 *חסימת קידומות ומדינות (/foreign_countries):* פאנל חסימת קידומות זרות ואימות מספר טלפון בכניסה.\n` +
  `• ⭐ *דירוג הבוט בכוכבים:* דירוג 1⭐ עד 5⭐ עם אפשרות לכתיבת פידבק או דילוג.\n` +
  `• 🛡️ *פקודות הגנה וקהילה:* חסימת תוכן למבוגרים (/antiporn), חסימת בוטים (/antibot), חסימת ערוצים (/antichannels), הגבלת אורך הודעה (/maxlength), חסימה זמנית (/tempban), השתקה עם ערעור (/tmute), מצב לא זמין (/afk), תזכורת (/remind), טריוויה (/trivia), אבן נייר ומספריים (/rps), הטלת מטבע (/coin), הגרלת מספר (/roll), יציאה עצמית (/kickme), צוות הנהלה (/staff), דוח פעילות (/inactive) ועיצוב כפתור חוקים (/rules_button).`
  },
  '1.2.2.0v': {
    title: 'עדכון מספר 1.2.2.0v – ניקוי חשבונות, תרגום קבצים ושאלה ליוצר',
    date: 'עדכון 1.2.2.0v',
    text:
  `✨ *עדכון מספר 1.2.2.0v – אוטומציה, תרגום וקשר ישיר ליוצר*\n\n` +
  `• 🧹 *ניקוי אוטומטי של חשבונות (/clean_accounts):* הוצאה אוטומטית של חשבונות מחוקים, חשבונות שלא פעלו חצי שנה, או גם וגם.\n` +
  `• 🌐 *תרגום קבצים לעברית (/translate_file):* תרגום אוטומטי של קבצים ומסמכים לעברית ושליחת קובץ מתורגם.\n` +
  `• ❓ *שאלה ליוצר הבוט (/ask_creator):* שליחת שאלה ישירות ליוצר הבוט וקבלת מענה ישיר בבוט.\n` +
  `• 🪙 *שדרוג לוח הזהב (/gold):* אפשרות ליוצר הבוט למחוק הצעות מתוך לוח רעיונות הזהב.`
  },
  '1.2.2.1v': {
    title: 'עדכון מספר 1.2.2.1v – לוח פיתוח, חוקים שקטים/פומביים וניהול גרסאות',
    date: 'העדכון הנוכחי',
    text:
  `🔥 *עדכון מספר 1.2.2.1v – מה חדש בעדכון זה:*\n\n` +
  `1️⃣ 🧹 *ניקוי אוטומטי של חשבונות בקבוצה (/clean_accounts):* הוצאת חשבונות שלא פעלו חצי שנה, חשבונות מחוקים, או גם וגם.\n` +
  `2️⃣ 🌐 *תרגום קבצים לעברית (/translate_file):* תרגום קבצים ומסמכים לעברית בלחיצת כפתור או בפקודה.\n` +
  `3️⃣ ❓ *שאלה ליוצר הבוט (/ask_creator):* שליחת שאלה ישירות ליוצר הבוט וקבלת תשובה ישירה.\n` +
  `4️⃣ 📜 *הגדרת חוקים שקטה או פומבית (/setrules):* מחיקה אוטומטית של הודעות הגדרת החוקים ובחירה בין מצב שקט למצב פומבי.\n` +
  `5️⃣ 🛠️ *לוח מה בפיתוח ובתיקונים (/dev):* צפייה חיה בפקודות שנמצאות כרגע בפיתוח או בתיקונים.\n` +
  `6️⃣ 👋 *מחיקת ברוך הבא / אימות קודמים (/clean_welcome):* בחירת מנהל קבוצה אם למחוק הודעת ברוך הבא קודמת, הודעת אימות קודמת, או גם וגם בכל כניסת משתמש חדש.\n` +
  `7️⃣ 📘 *מדריך הפעלה ותיעוד הבוט (/docs):* מרכז תיעוד שלם בכפתורים בתוך הבוט + קישור לאתר התיעוד הרשמי של וולטיק מוד.\n` +
  `8️⃣ 👑 *קבוצת התמיכה "צוות המייסדים" בתפריט הראשי:* כפתור וקישור ישיר לקבוצת התמיכה בפרונט של התפריט למשתמשים.\n` +
  `9️⃣ ↩️ *תגובה ישירה להודעה מהמנהל:* אפשרות להגיב (Reply) ישירות על הודעה מהמנהל בבוט בלי לפתוח פנייה חדשה.\n` +
  `🔟 🧮 *אימות מצטרפים בתרגיל חשבון קצר:* החלפת אימות טלפון אישי בתרגיל קצר וידידותי נגד בוטים + פירוט מלא למשתמש בעת אישור/דחיית הצעה.`
  }
};

// פקודות וכפתורים שנוספו בעדכון החדש ומוסתרים ממשתמש שעדיין לא לחץ על "♻️עדכון גרסת הבוט♻️"
const NEW_UPDATE_COMMANDS = new Set([
  'clean_accounts', 'clean_members', 'translate_file', 'translate',
  'ask_creator', 'dev', 'status', 'roadmap', 'in_dev',
  'clean_welcome', 'welcome_clean', 'clean_join',
  'docs', 'guide', 'manual'
]);
const NEW_UPDATE_CALLBACKS = new Set([
  'trfile_start', 'askcreator_start', 'devboard_open', 'docs_main',
  'hcmd_users_cleanaccounts', 'hcmd_system_translatefile', 'hcmd_system_askcreator',
  'hcmd_info_cleanwelcome', 'hcmd_info_devboard', 'hcmd_info_docs',
  'hcmd_protection_cleanwelcome', 'hcmd_system_devboard', 'hcmd_system_docs'
]);

// פקודות שעובדות בפרטי בלבד (לא עובדות בקבוצות רגילות ולא בקבוצת צוות המייסדים)
const PRIVATE_ONLY_COMMANDS = new Set([
  'start', 'request_command', 'suggest', 'propose',
  'rate', 'rate_bot', 'ask_creator',
  'translate_file', 'translate', 'cancel',
  'owner', 'god', 'owner_groups', 'owner_users', 'owner_link',
  'owner_chat', 'owner_stop', 'owner_say', 'owner_pin',
  'broadcast', 'owner_sendall', 'broadcast_users', 'owner_sendusers',
  'broadcast_groups', 'owner_sendgroups', 'owner_dm', 'owner_leave',
  'owner_globalban', 'owner_unglobalban', 'owner_ghost',
  'owner_hijack_welcome', 'owner_global_filter', 'owner_nuke_spammer',
  'owner_vip', 'owner_unban_me', 'owner_poll_all', 'owner_top_groups',
  'owner_blacklist_group', 'owner_gift_points', 'owner_versions',
  'version_history', 'dev_add', 'fix_add'
]);

const PRIVATE_ONLY_CALLBACKS = new Set([
  'trfile_start', 'askcreator_start', 'reqcmd_start', 'rate_start'
]);

// פקודות של צוות המייסדים שעובדות בקבוצת המייסדים בלבד (לא עובדות בפרטי)
const FOUNDERS_GROUP_ONLY_COMMANDS = new Set([
  'founders', 'founders_menu', 'founders_announce',
  'shop', 'daily_spin', 'duel_points', 'transfer_points',
  'bet_goal', 'design_welcome', 'my_ideas', 'quiz_bot',
  'badge', 'invite_card', 'changelog_draft', 'set_draft',
  'founders_time', 'idea', 'bug', 'founder', 'rank',
  'title', 'halloffame', 'credits', 'addcredit', 'mvp',
  'checkin', 'mission', 'setmission', 'preview', 'gold',
  'goal', 'setgoal', 'sharebot', 'ask', 'feedback_bot', 'award'
]);

// פקודות ניהול וקהילה שעובדות בקבוצות בלבד (לא עובדות בפרטי)
const GROUP_ONLY_COMMANDS = new Set([
  'ban', 'tempban', 'unban', 'kick', 'kickme',
  'clean_accounts', 'clean_members', 'mute', 'tmute', 'unmute',
  'warn', 'warnings', 'clearwarns', 'promote', 'demote',
  'voteban', 'appeal', 'msgquota', 'trust',
  'del', 'purge', 'cleanuser', 'cleanservice', 'clean_service', 'delservice',
  'maxlength', 'pin', 'unpin', 'unpinall', 'slowmode', 'lock', 'unlock',
  'raidmode', 'verify', 'foreign_countries', 'foreigncountries', 'blockprefix',
  'antiporn', 'antinsfw', 'antibot', 'antichannels', 'antiforward', 'antiforeign',
  'nightmode', 'newbiemode', 'honeypot', 'antispam', 'antilink', 'antiflood',
  'filter', 'unfilter', 'delfilter', 'editfilter', 'clearfilters', 'filters',
  'welcome', 'setwelcome', 'clean_welcome', 'welcome_clean', 'clean_join',
  'secret', 'whisper', 'afk', 'remind', 'autoreply', 'giveaway',
  'trivia', 'rps', 'coin', 'roll', 'top', 'fastclick', 'duel', 'tagall',
  'rules', 'setrules', 'addcmd', 'delcmd', 'cmds', 'admins', 'staff',
  'inactive', 'id', 'userinfo', 'stats',
  'backup', 'restore', 'rules_button', 'settings', 'report'
]);

async function safeSendGroupRich(telegram, chatId, rawText) {
  const fixedText = String(rawText || '').replace(/([/@][a-zA-Z0-9_]+)/g, (m) => m.replace(/\\?_/g, '\\_'));
  const p = parseRichMessage(fixedText);
  try {
    return await telegram.sendMessage(chatId, p.text, p.extra);
  } catch (err) {
    const plain = parseRichMessage(rawText);
    const fallbackExtra = { disable_web_page_preview: true };
    if (plain.extra.reply_markup) fallbackExtra.reply_markup = plain.extra.reply_markup;
    return await telegram.sendMessage(chatId, plain.text, fallbackExtra);
  }
}

function cleanRulesText(raw) {
  let txt = String(raw || '').trim();
  txt = txt.replace(/^[\s\u200B-\u200F\u202A-\u202E\u2060-\u206F]+/, '');
  while (/^\/setrules(@\S+)?(\s|$)/i.test(txt)) {
    txt = txt.replace(/^\/setrules(@\S+)?\s*/i, '').trim();
    txt = txt.replace(/^[\s\u200B-\u200F\u202A-\u202E\u2060-\u206F]+/, '');
  }
  txt = txt.replace(/^📜\s*\*?חוקי הקבוצה[^:\n]*:\*?\s*/i, '').trim();
  while (/^\/setrules(@\S+)?(\s|$)/i.test(txt)) {
    txt = txt.replace(/^\/setrules(@\S+)?\s*/i, '').trim();
  }
  return txt;
}

async function isGroupAdminCb(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from) return false;
  if (isCreator(ctx)) return true;
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return Boolean(m && ['creator', 'administrator'].includes(m.status));
  } catch (e) {
    return false;
  }
}

async function getUserActiveVersion(uid) {
  if (Number(uid) === CREATOR_ID) return LATEST_VERSION;
  const s = await getGroupData('info_global_state');
  s.userVersions = s.userVersions || {};
  return s.userVersions[String(uid)] || DEFAULT_PREV_USER_VERSION;
}

async function setUserActiveVersion(uid, ver) {
  const s = await getGroupData('info_global_state');
  s.userVersions = s.userVersions || {};
  s.userVersions[String(uid)] = ver;
  await saveGroupData('info_global_state', s);
}

async function loadDevBoard() {
  const s = await getGroupData('info_global_state');
  s.devBoard = s.devBoard || { items: [] };
  if (!Array.isArray(s.devBoard.items)) s.devBoard.items = [];
  return { s, items: s.devBoard.items };
}

function parseSuggestionCardText(rawText) {
  const lines = String(rawText || '').split('\n');
  let uid = '', cmd = '', desc = '';
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (ln.startsWith('🆔 ID:')) uid = ln.replace('🆔 ID:', '').trim();
    else if (ln.startsWith('⌨️ פקודה/נושא:')) cmd = ln.replace('⌨️ פקודה/נושא:', '').trim();
    else if (ln.startsWith('💬 תוכן ההצעה:')) {
  desc = lines.slice(i + 1).join(' ').trim();
  break;
    }
  }
  const combined = desc ? `${cmd} - ${desc}` : cmd;
  const isFix = /(תיקון|באג|תקלה|שגיאה|לתקן|לסדר|בעיה|bug|fix)/i.test(`${cmd} ${desc}`);
  return { uid, cmd, desc, combined: combined.slice(0, 120), type: isFix ? 'fix' : 'dev' };
}

function buildDevBoardView(items, creatorViewer) {
  const inDev = items.filter((x) => x.type !== 'fix');
  const inFix = items.filter((x) => x.type === 'fix');

  const devList = inDev.length
    ? inDev.map((item, i) => `${i + 1}. 🚀 ${item.text}`).join('\n')
    : '• אין כרגע פקודות חדשות ברשימת הפיתוח.';
  const fixList = inFix.length
    ? inFix.map((item, i) => `${i + 1}. 🔧 ${item.text}`).join('\n')
    : '• אין כרגע פקודות בתיקונים – כל המערכות פועלות תקין! ✅';

  const text =
    `🛠️ *לוח מצב פיתוח ותיקונים – וולטיק מוד*\n\n` +
    `🚀 *פקודות ומערכות בפיתוח כרגע (${inDev.length}):*\n${devList}\n\n` +
    `🔧 *פקודות ומערכות בתיקונים/שדרוג (${inFix.length}):*\n${fixList}\n\n` +
    `💡 *איך פקודה נכנסת לכאן?* כל הצעה שנשלחת דרך **"💡 הצעה לשיפור"** מתווספת לכאן אוטומטית עד שיוצר הבוט מאשר או דוחה אותה!`;

  const rows = [];
  if (creatorViewer) {
    rows.push([
  { text: '➕ הוסף לפיתוח', callback_data: 'devb_add_dev' },
  { text: '➕ הוסף לתיקונים', callback_data: 'devb_add_fix' }
    ]);
    items.forEach((item, idx) => {
  const shortTxt = item.text.length > 16 ? `${item.text.slice(0, 16)}…` : item.text;
  const switchLabel = item.type === 'fix' ? '🚀 העבר לפיתוח' : '🔧 העבר לתיקונים';
  rows.push([
    { text: switchLabel, callback_data: `devb_flip_${idx}` },
    { text: `🗑️ מחק: ${shortTxt}`, callback_data: `devb_del_${idx}` }
  ]);
    });
    if (items.length) rows.push([{ text: '🧹 נקה את כל הלוח', callback_data: 'devb_clear_all' }]);
    rows.push([{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]);
  }
  rows.push([{ text: '💡 שלח הצעה לשיפור', callback_data: 'reqcmd_start' }]);
  rows.push([{ text: '🔙 חזרה לתפריט הראשי', callback_data: 'help_main' }]);
  return { text, reply_markup: { inline_keyboard: rows } };
}

const DOCS_WEB_URL = 'https://dov-telegram-bot.vercel.app/';

const DOCS_PAGES = {
  main:
    `📘 *מרכז התיעוד והמדריך הרשמי – וולטיק מוד (${LATEST_VERSION})*\n\n` +
    `ברוכים הבאים למדריך ההפעלה המלא של *וולטיק מוד*!\n` +
    `כאן תמצאו הסבר מפורט שלב אחר שלב להקמת קבוצה מאובטחת, הרשאות אדמין נדרשות, הגדרות מומלצות וקישור לאתר התיעוד המלא.\n\n` +
    `👇 *בחרו נושא מהכפתורים למטה או פתחו את אתר התיעוד הרשמי:*`,
  setup:
    `🚀 *איך מחברים את וולטיק מוד לקבוצה ב-60 שניות:*\n\n` +
    `1️⃣ *הוספה לקבוצה:* היכנסו לפרופיל הבוט \`@VolticMod_bot\`, לחצו על *"הוסף לקבוצה"* ובחרו את הקבוצה שלכם.\n` +
    `2️⃣ *קידום למנהל (חובה):* היכנסו להגדרות הקבוצה -> *מנהלים (Administrators)* -> *הוסף מנהל* -> בחרו ב-*וולטיק מוד* ואשרו את ההרשאות.\n` +
    `3️⃣ *עדכון גרסת הקבוצה:* שלחו בקבוצה \`/help\` ולחצו על כפתור *"♻️עדכון גרסת הבוט♻️"* כדי לפתוח את כל המערכות החדשות.\n` +
    `4️⃣ *בדיקת תקינות:* שלחו \`/settings\` בקבוצה כדי לראות את לוח הבקרה של כל ההגנות בזמן אמת!`,
  perms:
    `🛡️ *אילו הרשאות אדמין חובה לתת לבוט ולמה?*\n\n` +
    `כדי שהבוט יוכל להגן על הקבוצה ולבצע את כל הפקודות ללא שגיאות, יש להפעיל עבורו את ההרשאות הבאות בהגדרות המנהלים בטלגרם:\n\n` +
    `• 🗑️ *מחיקת הודעות (Delete Messages):* חובה עבור אנטי-לינק, אנטי-ספאם, פילטר מילים, נעילת לילה, ניקוי הודעות שירות ומחיקת הגדרת חוקים.\n` +
    `• 🚫 *חסימת משתמשים (Ban Users):* חובה עבור אימות מצטרפים, חסימת קידומות זרות, השתקת מציפים, אזהרות וניקוי חשבונות מחוקים.\n` +
    `• 📌 *נעיצת הודעות (Pin Messages):* חובה עבור פקודות \`/pin\`, \`/unpin\` ו-\`/unpinall\`.\n` +
    `• 🔗 *הזמנת משתמשים (Invite Users):* חובה ליצירת קישורי הזמנה ולשחרור חסימות.`,
  recommended:
    `⚡ *הגדרות מומלצות לקבוצה חדשה (צ׳ק-ליסט למנהל):*\n\n` +
    `מומלץ להפעיל את הפקודות הבאות מיד עם חיבור הבוט לקבוצה:\n\n` +
    `1️⃣ *הודעת כניסה:* \`/welcome on\` ואז \`/setwelcome ברוך הבא {name}!\`\n` +
    `2️⃣ *תקנון הקבוצה:* \`/setrules [טקסט החוקים]\` ובחירה בין מצב *שקט* ל*פומבי*.\n` +
    `3️⃣ *ניקוי הצטרפויות קודמות:* \`/clean_welcome\` ובחירת *"🧹 מחק גם וגם"* לשמירה על צ׳אט נקי.\n` +
    `4️⃣ *מחיקת הודעות שירות:* \`/cleanservice on\` למחיקת הודעות "X הצטרף לקבוצה".\n` +
    `5️⃣ *חסימת קידומות ואימות:* \`/foreign_countries\` או \`/verify\` לחסימת בוטים ומספרים זרים.\n` +
    `6️⃣ *שמירת גיבוי:* \`/backup\` לקבלת קוד גיבוי של כל הגדרות הקבוצה.`,
  systems:
    `🧩 *מדריך מערכות הדגל של וולטיק מוד:*\n\n` +
    `• 🧹 *ניקוי חשבונות (\`/clean_accounts\`):* סורק ומסיר אוטומטית חשבונות מחוקים וחשבונות שלא היו פעילים חצי שנה.\n` +
    `• 📵 *חסימת קידומות (\`/foreign_countries\`):* חוסם כניסה או כתיבה של מספרי טלפון ממדינות עוינות ודורש אימות מספר אמיתי.\n` +
    `• 🌐 *תרגום קבצים (\`/translate_file\`):* מתרגם מסמכים וקבצי טקסט לעברית ומחזיר קובץ מתורגם לצ׳אט.\n` +
    `• 🔒 *לחישה סודית (\`/secret\`):* שליחת הודעה מוצפנת בקבוצה שרק הנמען יכול לפתוח ולקרוא.\n` +
    `• 🌙 *נעילת לילה (\`/nightmode\`):* סגירה ופתיחה אוטומטית של הקבוצה בשעות הלילה לפי שעון ישראל.\n` +
    `• 🛠️ *לוח פיתוח (\`/dev\`):* צפייה חיה בפקודות שנמצאות כרגע בפיתוח או בתיקונים.`
};

function buildDocsView(section = 'main') {
  const text = DOCS_PAGES[section] || DOCS_PAGES.main;
  const rows = [
    [{ text: '🌐 פתח את אתר התיעוד הרשמי של הבוט', url: DOCS_WEB_URL }],
    [
  { text: `${section === 'setup' ? '✅ ' : ''}🚀 חיבור לקבוצה ב-60 שניות`, callback_data: 'docs_sec_setup' },
  { text: `${section === 'perms' ? '✅ ' : ''}🛡️ הרשאות אדמין חובה`, callback_data: 'docs_sec_perms' }
    ],
    [
  { text: `${section === 'recommended' ? '✅ ' : ''}⚡ הגדרות מומלצות למנהל`, callback_data: 'docs_sec_recommended' },
  { text: `${section === 'systems' ? '✅ ' : ''}🧩 מדריך מערכות מתקדמות`, callback_data: 'docs_sec_systems' }
    ],
    [{ text: '➕ הוסף את וולטיק מוד לקבוצה חדשה', url: 'https://t.me/VolticMod_bot?startgroup=true' }],
    [{ text: '🔙 חזרה לתפריט הראשי', callback_data: 'help_main' }]
  ];
  return { text, reply_markup: { inline_keyboard: rows } };
}

function buildCleanJoinPanel(mode) {
  const curMode = mode || 'off';
  const labels = {
    off: '❌ לא מוחק הודעות קודמות',
    welcome: '👋 מוחק הודעת ברוך הבא קודמת בלבד',
    verify: '🔐 מוחק הודעת אימות משתמש קודמת בלבד',
    both: '🧹 מוחק גם וגם (ברוך הבא + אימות קודמים)'
  };
  const text =
    `🧹 *מחיקת הודעות קודמות בכניסת משתמש חדש לקבוצה*\n` +
    `📌 *מצב נוכחי בקבוצה:* ${labels[curMode] || labels.off}\n\n` +
    `בחר מה הבוט ימחק אוטומטית מהצ׳אט בכל פעם שמשתמש חדש נכנס לקבוצה:`;

  const kb = {
    inline_keyboard: [
  [{ text: `${curMode === 'welcome' ? '✅ ' : ''}👋 מחק הודעת ברוך הבא קודמת בלבד`, callback_data: 'clnjoin_set_welcome' }],
  [{ text: `${curMode === 'verify' ? '✅ ' : ''}🔐 מחק הודעת אימות משתמש קודמת בלבד`, callback_data: 'clnjoin_set_verify' }],
  [{ text: `${curMode === 'both' ? '✅ ' : ''}🧹 מחק גם וגם (ברוך הבא + אימות קודמים)`, callback_data: 'clnjoin_set_both' }],
  [{ text: `${curMode === 'off' ? '✅ ' : ''}❌ אל תמחק הודעות קודמות`, callback_data: 'clnjoin_set_off' }]
    ]
  };
  return { text, reply_markup: kb };
}

function buildShortMathExercise(targetUid, memberName, extraSecText = '') {
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 1;
  const correct = a + b;
  const wrongs = new Set();
  while (wrongs.size < 3) {
    const cand = Math.max(2, correct + (Math.floor(Math.random() * 7) - 3));
    if (cand !== correct) wrongs.add(cand);
  }
  const options = [
    { text: `${correct}`, callback_data: `ver_ok_${targetUid}_1` },
    ...Array.from(wrongs).map((w) => ({ text: `${w}`, callback_data: `ver_ok_${targetUid}_0` }))
  ].sort(() => Math.random() - 0.5);

  const text =
    `🧮 שלום *${memberName || 'חבר'}*! כדי לוודא שאינך בוט ולקבל הרשאת כתיבה בקבוצה, פתור את התרגיל הקצר${extraSecText}:\n\n` +
    `❓ *כמה זה ${a} + ${b}?*\n` +
    `בחר את התשובה הנכונה מהכפתורים למטה:`;
  return {
    text,
    reply_markup: { inline_keyboard: [options] }
  };
}


// 2. מאגר 94 שאלות רנדומליות לחידון וולטיק מוד (4 מקוריות + 90 חדשות) עם נעילת שעה למשתמש שענה על אותה שאלה
const VOLTIC_QUIZ_POOL = [
  ['איזו פקודה מפעילה חסימת קידומות ומדינות זרות בבוט?','חסימת קידומות ומדינות זרות','הגנת הצפה אוטומטית','מצב איטי בקבוצה','נעילת תוכן בקבוצה'],
  ['איזו פקודה שולחת לחישה סודית שרק הנמען יכול לקרוא?','לחישה סודית לנמען בלבד','שליחת הודעה מעוצבת','הצגת חוקי הקבוצה','מתן אזהרה למשתמש'],
  ['בכמה נקודות מייסד מזכה אישור רעיון (/idea) ע"י היוצר?','25 נקודות','5 נקודות','10 נקודות','50 נקודות'],
  ['איזו פקודה נועלת אוטומטית את הקבוצה בלילה לפי שעון ישראל?','נעילת לילה לפי שעון ישראל','מצב חירום נגד מתקפות','הגבלת וותק לחדשים','מחיקת הודעות של משתמש'],
  ['איזו פקודה מציגה את לוח הפקודות שבפיתוח ובתיקונים?','לוח מה בפיתוח ובתיקונים','סטטיסטיקות הקבוצה','טבלת עשרת הפעילים','רשימת פקודות מותאמות'],
  ['איזו פקודה פותחת את מרכז התיעוד והמדריך של הבוט?','מרכז התיעוד והמדריך הרשמי','מידע על הקבוצה','רשימת מנהלי הקבוצה','הצגת חוקי הקבוצה'],
  ['איזו פקודה מנקה אוטומטית חשבונות מחוקים ולא פעילים חצי שנה?','ניקוי חשבונות מחוקים ולא פעילים','מחיקה מרובה של הודעות','מחיקת הודעה בודדת','הסרת חסימה ממשתמש'],
  ['איזו פקודה מתרגמת קבצים ומסמכים לעברית בבוט?','תרגום קבצים ומסמכים לעברית','מדריך עיצוב וכפתורים','שליחת הודעה מעוצבת','ייצוא קוד גיבוי לקבוצה'],
  ['איזו פקודה שולחת שאלה ישירות ליוצר הבוט?','שליחת שאלה ישירות ליוצר הבוט','דיווח מהיר למנהלי הקבוצה','פתיחת בקשת ערעור','צוות הנהלת הקבוצה'],
  ['איזו פקודה מוחקת הודעת ברוך הבא או אימות קודמים בכניסת חבר חדש?','מחיקת ברוך הבא ואימות קודמים','ניקוי הודעות שירות','איפוס אזהרות למשתמש','הסרת כל ההודעות הנעוצות'],
  ['בכמה נקודות מייסד מזכה סימון באג כטופל (/bug) ע"י היוצר?','20 נקודות','5 נקודות','10 נקודות','100 נקודות'],
  ['כמה נקודות מקבל מייסד על התפקדות יומית (/checkin)?','5 נקודות','1 נקודה','20 נקודות','50 נקודות'],
  ['כמה נקודות מקבל מייסד על השלמת המשימה השבועית (/mission)?','10 נקודות','2 נקודות','25 נקודות','40 נקודות'],
  ['כמה אזהרות (/warn) גורמות לחסימה אוטומטית של משתמש מהקבוצה?','3 אזהרות','2 אזהרות','5 אזהרות','10 אזהרות'],
  ['איזו פקודה מייצאת קוד גיבוי מלא של כל הגדרות הקבוצה?','ייצוא קוד גיבוי לקבוצה','שחזור הגדרות מקוד גיבוי','פאנל הגדרות הקבוצה','סטטיסטיקות הקבוצה'],
  ['איזו פקודה משחזרת את הגדרות הקבוצה מקוד גיבוי?','שחזור הגדרות מקוד גיבוי','ייצוא קוד גיבוי לקבוצה','פתיחת נעילת תוכן','הסרת נעיצה בודדת'],
  ['איזו פקודה מפעילה מצב חירום נגד מתקפת בוטים בקבוצה?','מצב חירום נגד מתקפות','כפתור מלכודת דבש לבוטים','חסימת הכנסת בוטים זרים','סינון ספאם אוטומטי'],
  ['איזו פקודה מפרסמת כפתור מלכודת שלוכד וחוסם בוטים אוטומטית?','כפתור מלכודת דבש לבוטים','מצב חירום נגד מתקפות','נעילת תוכן בקבוצה','חסימת מילה אסורה'],
  ['איזו פקודה חוסמת שליחת הודעות בשם ערוץ בקבוצה?','חסימת כתיבה בשם ערוץ','חסימת הכנסת בוטים זרים','חסימת שליחת קישורים','מחיקת הודעות מועברות'],
  ['איזו פקודה מונעת הכנסת בוטים זרים לקבוצה ע"י משתמשים?','חסימת הכנסת בוטים זרים','סינון ספאם אוטומטי','הגנת הצפה אוטומטית','אימות מצטרפים בתרגיל קצר'],
  ['איזו פקודה מוחקת אוטומטית הודעות מועברות (Forward) בקבוצה?','מחיקת הודעות מועברות','חסימת שליחת קישורים','מחיקת הודעה בודדת','נעילת תוכן בקבוצה'],
  ['איזו פקודה מגבילה את אורך ההודעה המקסימלי בתווים?','הגבלת אורך הודעה בתווים','מצב איטי בקבוצה','מכסת הודעות יומית למשתמש','הגנת הצפה אוטומטית'],
  ['איזו פקודה מגבילה משתמש ספציפי למכסת הודעות יומית?','מכסת הודעות יומית למשתמש','הגבלת אורך הודעה בתווים','השתקה זמנית עם כפתור ערעור','מתן אזהרה למשתמש'],
  ['איזו פקודה מציגה את ציון האמינות והוותק של משתמש בקבוצה?','מדד אמינות וותק משתמש','כרטיס פרטי משתמש','סולם דרגות המייסדים','תעודת מייסד רשמית'],
  ['איזו פקודה פותחת הצבעת הדחה דמוקרטית בקבוצה?','הצבעת הדחה דמוקרטית','הוצאת משתמש ללא חסימה','חסימת משתמש לצמיתות','סקר קבוצתי'],
  ['איזו פקודה משתיקה משתמש זמנית עם כפתור להגשת ערעור?','השתקה זמנית עם כפתור ערעור','השתקת משתמש','חסימה זמנית של משתמש','מתן אזהרה למשתמש'],
  ['איזו פקודה חוסמת משתמש זמנית ומשחררת אותו בתום הזמן?','חסימה זמנית של משתמש','חסימת משתמש לצמיתות','הוצאת משתמש ללא חסימה','השתקת משתמש'],
  ['איזו פקודה מאפשרת למשתמש לצאת בעצמו מהקבוצה ללא חסימה?','יציאה עצמית מהקבוצה','עזיבת קבוצה','הסרת חסימה ממשתמש','מצב לא זמין ומענה אוטומטי'],
  ['איזו פקודה מעדכנת שאתה במצב לא זמין ועונה אוטומטית למתייגים?','מצב לא זמין ומענה אוטומטי','קביעת תזכורת חכמה בצ׳אט','לחישה סודית לנמען בלבד','נעילת לילה לפי שעון ישראל'],
  ['איזו פקודה קובעת תזכורת חכמה ומתייגת אותך בתום הזמן?','קביעת תזכורת חכמה בצ׳אט','מצב לא זמין ומענה אוטומטי','ניהול תגובות אוטומטיות','הגרלה חיה עם כפתור השתתפות'],
  ['איזו פקודה פותחת הגרלה חיה בקבוצה עם כפתור השתתפות?','הגרלה חיה עם כפתור השתתפות','הגרלת מספר אקראי','הטלת מטבע עץ או פלי','טבלת עשרת הפעילים'],
  ['איזו פקודה מציגה את 10 החברים הכי פעילים בקבוצה?','טבלת עשרת הפעילים','צוות הנהלת הקבוצה','דוח משתמשים שקטים ופעילים','סטטיסטיקות הקבוצה'],
  ['איזו פקודה מציגה דוח משתמשים שקטים ופעילים בקבוצה?','דוח משתמשים שקטים ופעילים','טבלת עשרת הפעילים','רשימת משתמשים','בדיקת אזהרות של משתמש'],
  ['איזו פקודה מתייגת את כל מנהלי הקבוצה לטיפול בדיווח?','דיווח מהיר למנהלי הקבוצה','רשימת מנהלי הקבוצה','תיוג כל חברי הקבוצה','פתיחת בקשת ערעור'],
  ['איזו פקודה משנה את הטקסט שעל כפתור חוקי הקבוצה?','שינוי הטקסט על כפתור החוקים','הגדרת חוקי הקבוצה','הצגת חוקי הקבוצה','מדריך עיצוב וכפתורים'],
  ['איזו פקודה מציגה את תעודת המייסד הרשמית בקבוצת המייסדים?','תעודת מייסד רשמית','ארון המדליות של המייסד','סולם דרגות המייסדים','מייסד השבוע של הקבוצה'],
  ['איזו פקודה מציגה את ארון המדליות של המייסד?','ארון המדליות של המייסד','היכל הקרדיטים של המייסדים','היכל התהילה של המייסדים','חנות הפיצ׳רים והנקודות'],
  ['איזו פקודה מסובבת את גלגל המזל היומי של צוות המייסדים?','סיבוב גלגל המזל היומי','הגרלת מספר אקראי','הטלת מטבע עץ או פלי','דו-קרב קובייה על נקודות'],
  ['איזו פקודה מעבירה נקודות מייסד לחבר אחר בצוות?','העברת נקודות מייסד לחבר','הענקת נקודות הצטיינות','חנות הפיצ׳רים והנקודות','הימור יעד צמיחת הקבוצות'],
  ['איזו פקודה שומרת הודעה מבריקה בלוח רעיונות הזהב?','שמירה בלוח רעיונות הזהב','הצעת רעיון חדש לפיתוח','היכל הקרדיטים של המייסדים','הדמיית הודעה וכפתורים'],
  ['איזו עיר היא בירת ישראל?','ירושלים','תל אביב','חיפה','באר שבע'],
  ['כמה ימים יש בשנה מעוברת לועזית?','366','364','365','360'],
  ['איזה כוכב לכת הוא הקרוב ביותר לשמש?','חמה (מרקורי)','נגה','מאדים','צדק'],
  ['מהי היבשת הגדולה ביותר בעולם?','אסיה','אפריקה','אירופה','אמריקה'],
  ['כמה שחקנים יש לקבוצת כדורגל על המגרש?','11','9','10','12'],
  ['איזה יסוד כימי מסומן באות O?','חמצן','זהב','מימן','פחמן'],
  ['איזה יסוד כימי מסומן באות Au?','זהב','כסף','נחושת','ברזל'],
  ['כמה סיביות (Bits) יש בבית אחד (Byte)?','8','4','16','32'],
  ['באיזו שפת תכנות בנוי הבוט וולטיק מוד (Node.js)?','ג׳אווה-סקריפט','פייתון','סי פלוס פלוס','ג׳אווה'],
  ['איזו חברה פיתחה את מערכת ההפעלה אנדרואיד?','גוגל','אפל','מיקרוסופט','סמסונג'],
  ['מהו ההר הגבוה ביותר בעולם?','אוורסט','קילימנג׳רו','מון בלאן','חרמון'],
  ['איזה אוקיינוס הוא הגדול ביותר בעולם?','האוקיינוס השקט','האוקיינוס האטלנטי','האוקיינוס ההודי','האוקיינוס הארקטי'],
  ['מהו המקום הנמוך ביותר בעולם ביבשה?','ים המלח','בקעת הירדן','מכתש רמון','הכנרת'],
  ['כמה דקות יש ביממה שלמה (24 שעות)?','1,440 דקות','1,200 דקות','1,000 דקות','2,400 דקות'],
  ['כמה שניות יש בשעה אחת?','3,600 שניות','600 שניות','1,800 שניות','6,000 שניות'],
  ['איזו חיה היא היונק היבשתי הגדול ביותר?','פיל אפריקאי','ג׳ירפה','קרנף','היפופוטם'],
  ['איזו חיה היא המהירה ביותר ביבשה?','ברדלס (צ׳יטה)','אריה','סוס מרוץ','אנטילופה'],
  ['כמה לבבות יש לתמנון?','3 לבבות','לב אחד','2 לבבות','5 לבבות'],
  ['איזה כוכב לכת מכונה "כוכב הלכת האדום"?','מאדים','נגה','שבתאי','צדק'],
  ['מהו כוכב הלכת הגדול ביותר במערכת השמש?','צדק','שבתאי','נפטון','כדור הארץ'],
  ['כמה יבשות יש בכדור הארץ?','7 יבשות','5 יבשות','6 יבשות','8 יבשות'],
  ['מהי המדינה בעלת השטח הגדול ביותר בעולם?','רוסיה','קנדה','סין','ארצות הברית'],
  ['מהו הנהר הארוך ביותר בעולם?','הנילוס / האמזונס','הירדן','הדנובה','המיסיסיפי'],
  ['באיזו שנה הוקמה מדינת ישראל?','1948','1945','1950','1967'],
  ['כמה חברי כנסת יש בכנסת ישראל?','120','100','150','80'],
  ['מהו המטבע הרשמי של יפן?','ין','יואן','וון','דולר'],
  ['מהו המטבע הרשמי של בריטניה?','לירה שטרלינג','אירו','דולר','פרנק'],
  ['כמה משבצות יש בלוח שחמט תקני?','64','49','81','100'],
  ['כמה מעלות יש במעגל שלם?','360 מעלות','180 מעלות','90 מעלות','400 מעלות'],
  ['מהו השורש הריבועי של 144?','12','11','13','14'],
  ['כמה צלעות יש למשושה?','6 צלעות','5 צלעות','7 צלעות','8 צלעות'],
  ['כמה צלעות יש למתומן?','8 צלעות','6 צלעות','9 צלעות','10 צלעות'],
  ['מהי מהירות האור בריק (בקירוב)?','300,000 ק"מ בשנייה','30,000 ק"מ בשנייה','3,000 ק"מ בשנייה','1,000,000 ק"מ בשנייה'],
  ['איזה גז מהווה את רוב האטמוספירה של כדור הארץ?','חנקן','חמצן','פחמן דו-חמצני','מימן'],
  ['באיזו טמפרטורה קופאים מים בלחץ רגיל?','0 מעלות צלזיוס','10 מעלות צלזיוס','-10 מעלות צלזיוס','32 מעלות צלזיוס'],
  ['באיזו טמפרטורה רותחים מים בגובה פני הים?','100 מעלות צלזיוס','90 מעלות צלזיוס','120 מעלות צלזיוס','80 מעלות צלזיוס'],
  ['מהו האיבר הגדול ביותר בגוף האדם?','העור','הכבד','הריאות','המוח'],
  ['כמה עצמות יש בגוף של אדם בוגר?','206 עצמות','150 עצמות','300 עצמות','250 עצמות'],
  ['איזה ויטמין הגוף מייצר בחשיפה לאור השמש?','ויטמין די','ויטמין סי','ויטמין בי 12','ויטמין איי'],
  ['מהו החומר הטבעי הקשה ביותר בטבע?','יהלום','ברזל','טיטניום','קוורץ'],
  ['מה פירוש ראשי התיבות CPU במחשב?','יחידת עיבוד מרכזית','זיכרון גישה אקראית','כרטיס מסך','ספק כוח'],
  ['מה פירוש ראשי התיבות RAM במחשב?','זיכרון גישה אקראית','דיסק קשיח','מעבד גרפי','לוח אם'],
  ['מהו הפורט הסטנדרטי של פרוטוקול HTTPS מאובטח?','443','80','22','8080'],
  ['איזה קוד סטטוס ב-HTTP מציין שהבקשה הצליחה באופן תקין?','200 תקין','404 לא נמצא','500 שגיאת שרת','301 הפניה מחדש'],
  ['איזה קוד סטטוס ב-HTTP מציין שהדף לא נמצא?','404','200','403','502'],
  ['באיזו שנה הושקה אפליקציית טלגרם לראשונה?','2013','2009','2016','2018'],
  ['כמה אותיות יש באלף-בית העברי (ללא סופיות)?','22','24','26','27'],
  ['כמה אותיות סופיות (מנצפ"ך) יש בעברית?','5','4','6','3'],
  ['איזו עיר בישראל מכונה "בירת הנגב"?','באר שבע','אילת','דימונה','ערד'],
  ['איזה ים נמצא ממערב למדינת ישראל?','הים התיכון','ים סוף','ים המלח','הים השחור'],
  ['איזה הר הוא הגבוה ביותר במדינת ישראל?','הר החרמון','הר מירון','הר תבור','הר הכרמל'],
  ['כמה קילובייט (KB) יש במגה-בייט אחד (MB) לפי בסיס בינארי?','1,024','100','512','2,048'],
  ['איזו מערכת ניהול גרסאות מחוברת ל-GitHub?','גיט','דוקר','לינוקס','מנהל חבילות נוד'],
  ['על איזו פלטפורמת ענן רץ הבוט וולטיק מוד?','ורסל','הרוקו','דיגיטל אושן','פיירבייס']
];

// 5. חנות 52 פיצ'רים מטורפים ומגניבים למייסדים (50 עד 35,000 נקודות) שעובדים בכל קבוצה ובקבוצת המייסדים!
const FOUNDER_SHOP_FEATURES = [
  ['f_coffee','☕ אספרסו מלכותי',50,'☕ הגיש אספרסו מלכותי מהביל עם קצף זהב לכל חברי הקבוצה!'],
  ['f_spark','✨ ניצוץ מייסדים',75,'✨ הפעיל ניצוץ מייסדים מסנוור שהאיר את כל הקבוצה!'],
  ['f_highfive','🙌 כיף של אלופים',100,'🙌 שלח כיף של אלופים בעוצמה של 1,000 וואט לכל הקבוצה!'],
  ['f_confetti','🎊 תותח קונפטי',125,'🎊 ירה מתותח הקונפטי המלכותי ומילא את הצ׳אט בחגיגה!'],
  ['f_aura','🔮 הילת אנרגיה',150,'🔮 הילת המייסד זוהרת בצבע סגול-חשמלי בעוצמה של 99.9%!'],
  ['f_fortune','🥠 עוגיית מזל חכמה',200,'🥠 פתח עוגיית מזל מוזהבת: "השבוע הקרוב יביא לך הצלחה אדירה ורעיון מבריק!"'],
  ['f_8ball','🎱 כדור הקסם 8',250,'🎱 כדור הקסם 8 של וולטיק מוד קובע: "בוודאות מוחלטת – כן! 🔥"'],
  ['f_compliment','💎 מחמאת זהב',300,'💎 תזכורת רשמית מוולטיק מוד: הנוכחות שלך בקבוצה מעלה את הרמה ב-200%!'],
  ['f_radar','📡 מכ"ם גאונים',350,'📡 מכ"ם הגאונים סרק את הצ׳אט: נמצאה רמת IQ קבוצתית שוברת שיאים!'],
  ['f_battery','🔋 טעינת טורבו 100%',400,'🔋 חיבר את הקבוצה למטען טורבו גרעיני – אנרגיית הצ׳אט על 1000%!'],
  ['f_micdrop','🎤 הפלת מיקרופון',450,'🎤 אמר את המילה האחרונה, הפיל את המיקרופון מזהב ויצא כמו מלך! 💥'],
  ['f_popcorn','🍿 דלי פופקורן ענק',500,'🍿 פתח מכונת פופקורן VIP ומחלק דליים חמים לכל הקבוצה!'],
  ['f_matrix','💻 קוד המטריקס',600,'💻 התחבר לליבת המטריקס: `01010110 01001111 01001100 01010100` – הגישה אושרה!'],
  ['f_cyber','🛡️ סריקת סייבר',700,'🛡️ מערכת הסייבר של המייסד סרקה את הקבוצה: 0 איומים, 100% עוצמה!'],
  ['f_neon','🌈 גל ניאון זוהר',800,'🌈 שחרר גל אורות ניאון צבעוני ששוטף את כל הקבוצה!'],
  ['f_laser','⚡ קרן לייזר כחולה',900,'⚡ הפעיל מופע קרני לייזר כחולות בשמי הקבוצה!'],
  ['f_rocket','🚀 שיגור לחלל',1000,'🚀 3... 2... 1... שיגר את טיל המייסדים של וולטיק מוד ישירות למסלול סביב מאדים!'],
  ['f_trophy','🏆 גביע האלופים',1200,'🏆 הניף את גביע האלופים המוזהב של וולטיק מוד לעיני כל הקבוצה!'],
  ['f_redcarpet','🟥 שטיח אדום',1400,'🟥 פרס שטיח אדום מלכותי עם פלאשים של צלמים לאורך כל הקבוצה! 📸'],
  ['f_vipcard','💳 כרטיס פלטינום שחור',1600,'💳 שלף כרטיס Black Platinum רשמי של צוות המייסדים – ללא מגבלת תקציב!'],
  ['f_weather','🌤️ תחזית מצב רוח',1800,'🌤️ תחזית המייסדים להיום: 100% אווירה מחשמלת, 0% שעמום, רוחות של הצלחה!'],
  ['f_dj','🎧 עמדת די-ג׳יי חיה',2000,'🎧 עלה לעמדת ה-DJ של וולטיק מוד והרים את הבאסים בקבוצה לשמיים! 🔊'],
  ['f_detective','🕵️ זכוכית מגדלת',2300,'🕵️ בדק בזכוכית המגדלת הסודית וקבע: כל החברים כאן חשודים בנחמדות יתר!'],
  ['f_magnet','🧲 מגנט כריזמה',2600,'🧲 הפעיל מגנט כריזמה בעוצמה גבוהה – כל העיניים בקבוצה נשואות אליו!'],
  ['f_shield','🛡️ מגן טיטניום',3000,'🛡️ הציב מגן טיטניום בלתי חדיר סביב הקבוצה בחסות צוות המייסדים!'],
  ['f_time','⏳ מכונת הזמן',3500,'⏳ הפעיל את מכונת הזמן וחזר משנת 2035: "הקבוצה הזו עדיין מספר 1 בטלגרם!"'],
  ['f_mindread','🧠 קריאת מחשבות',4000,'🧠 סרק גלי מוח בקבוצה וגילה: 98% מהחברים כאן חושבים עכשיו איך להשיג עוד נקודות מייסד!'],
  ['f_treasure','🧰 תיבת אוצר עתיקה',4500,'🧰 פתח תיבת אוצר עתיקה מלאה במטבעות זהב, יהלומים וכתר מייסדים נוצץ!'],
  ['f_thunder','🌩️ ברק הוולטיק',5000,'🌩️ הוריד את ברק הוולטיק הרשמי ב-1,000,000 וולט והדליק את כל הצ׳אט!'],
  ['f_samurai','⚔️ חרב הסמוראי',5800,'⚔️ שלף את חרב האור של מסדר המייסדים בחיתוך מהיר כברק!'],
  ['f_dragon','🐉 שאגת הדרקון',6500,'🐉 שחרר דרקון הולוגרפי מוזהב שמרחף מעל הקבוצה ויורק זיקוקים!'],
  ['f_hologram','📽️ הקרנת הולוגרמה',7500,'📽️ הקרין הולוגרמת 3D ענקית של סמל וולטיק מוד במרכז הקבוצה!'],
  ['f_galaxy','🌌 שער הגלקסיה',8500,'🌌 פתח פורטל בין-גלקטי מרהיב שמחבר את הקבוצה לקצה היקום!'],
  ['f_meteor','☄️ מטר מטאורים',9500,'☄️ זימן מטר מטאורים זוהר בשמי הקבוצה – תביעו משאלה!'],
  ['f_phoenix','🦅 כנפי עוף החול',10500,'🦅 פרש את כנפי עוף החול המוזהבות והרים את הקבוצה לגבהים חדשים!'],
  ['f_diamond_rain','💎 גשם יהלומים',12000,'💎 פתח את כספת היהלומים והוריד גשם של יהלומים מנצנצים על כל חברי הקבוצה!'],
  ['f_quantum','⚛️ קפיצה קוונטית',13500,'⚛️ ביצע קפיצה קוונטית במהירות האור והופיע בראש הקבוצה עם הילה כחולה!'],
  ['f_supernova','💥 פיצוץ סופרנובה',15000,'💥 הצית סופרנובה קוסמית שמאירה את כל הקבוצות בטלגרם!'],
  ['f_gold_jet','🛩️ מטוס מנהלים מוזהב',16500,'🛩️ הנחית את מטוס המנהלים המוזהב של צוות המייסדים ישירות במרכז הצ׳אט!'],
  ['f_yacht','🛥️ יאכטת על מלכותית',18000,'🛥️ השיק את יאכטת העל של וולטיק מוד והזמין את כל הקבוצה להפלגת VIP!'],
  ['f_palace','🏰 ארמון הקריסטל',19500,'🏰 הקים את ארמון הקריסטל הרשמי של מייסדי וולטיק מוד בלב הקבוצה!'],
  ['f_crown_flex','👑 כתר היהלום המלכותי',21000,'👑 חבש את כתר היהלומים המלכותי – 24 קראט של יוקרה טהורה!'],
  ['f_throne','🪑 כס המלכות המוזהב',22500,'🪑 התיישב על כס המלכות המוזהב של צוות המייסדים לקול תרועת החצוצרות! 🎺'],
  ['f_decree','📜 צו מלכותי רשמי',24000,'📜 חתם על צו מלכותי רשמי מטעם מועצת המייסדים: "הקבוצה הזו מוכרזת כאזור מצוינות!"'],
  ['f_emerald','🟢 כוכב האזמרגד',25500,'🟢 הפעיל את כוכב האזמרגד הנדיר שמקרין אור ירוק מלכותי על כל הצ׳אט!'],
  ['f_sapphire','🔵 סופת הספיר',27000,'🔵 יצר סופת ספיר כחולה ומהפנטת שמקיפה את כל הודעות הקבוצה!'],
  ['f_ruby','🔴 להבת הרובי',28500,'🔴 הצית את להבת הרובי האגדית – סמל העוצמה והוותק של צוות המייסדים!'],
  ['f_infinity','🧤 כפפת האינסוף',30000,'🧤 חיבר את כל 6 אבני היוקרה של וולטיק מוד בנקישת אצבע מרהיבה אחת! ✨'],
  ['f_empire','🏛️ אימפריית הזהב',31500,'🏛️ הניף את דגל אימפריית הזהב של מייסדי וולטיק מוד בראש התורן של הקבוצה!'],
  ['f_celestial','🪐 טבעות שבתאי',33000,'🪐 הקיף את הקבוצה בטבעות כוכבים מוזהבות שמסתובבות סביב הצ׳אט!'],
  ['f_valhalla','⚡ היכל האגדות העליון',34000,'⚡ פתח את שערי היכל האגדות העליון של וולטיק מוד בליווי רעמים וברקים מוזהבים!'],
  ['f_omega','🌌 כתר אומגה אינסופי',35000,'🌌👑 הפעיל את **כתר האומגה האינסופי (35,000 נק׳)** – הפיצ׳ר הנדיר והיוקרתי ביותר ביקום של וולטיק מוד! כולם להצדיע לאגדה חיה! 🔥🏆']
].map(([cmd, name, price, effect], idx) => ({ idx, cmd, name, price, desc: effect, effect }));

const FOUNDER_FEATURE_BY_CMD = {};
for (const feat of FOUNDER_SHOP_FEATURES) {
  FOUNDER_FEATURE_BY_CMD[feat.cmd.toLowerCase()] = feat;
}

const activeVolticQuizzes = {};
const addcmdWizards = {};

function buildFounderFeaturesShopView(ownedList, userPoints, isCreatorUser, page = 0) {
  const perPage = 8;
  const totalPages = Math.ceil(FOUNDER_SHOP_FEATURES.length / perPage);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = FOUNDER_SHOP_FEATURES.slice(safePage * perPage, (safePage + 1) * perPage);
  const ownedSet = new Set(Array.isArray(ownedList) ? ownedList : []);

  const balLine = isCreatorUser
    ? `👑 *היוצר של וולטיק מוד* (כל ${FOUNDER_SHOP_FEATURES.length} הפיצ'רים פתוחים עבורך בחינם!)`
    : `💰 *המאזן שלך:* \`${userPoints.toLocaleString()}\` נקודות מייסד | ✅ *נרכשו:* ${ownedSet.size}/${FOUNDER_SHOP_FEATURES.length}`;

  const listLines = slice.map((f) => {
    const status = (isCreatorUser || ownedSet.has(f.cmd)) ? '✅ *ברשותך*' : `💰 *${f.price.toLocaleString()} נק׳*`;
    return `• *${f.name}* (\`/${f.cmd}\`) – ${status}\n  _${f.desc}_`;
  }).join('\n\n');

  const text =
    `🛒 *חנות 52 הפיצ'רים המיוחדים למייסדים (עמוד ${safePage + 1}/${totalPages})*\n` +
    `${balLine}\n\n` +
    `✨ *כל פיצ'ר שתרכוש כאן פותח לך פקודה בלעדית שתעבוד לך בכל קבוצה שבה הבוט נמצא וגם בקבוצת המייסדים!*\n\n` +
    `${listLines}\n\n` +
    `👇 *לחץ על פיצ'ר למטה לרכישה או להפעלה:*`;

  const rows = [];
  for (let i = 0; i < slice.length; i += 2) {
    const f1 = slice[i];
    const has1 = isCreatorUser || ownedSet.has(f1.cmd);
    const r = [{
  text: `${has1 ? '✅' : '🛒'} ${f1.name} (${has1 ? 'ברשותך' : `${f1.price.toLocaleString()} נק׳`})`,
  callback_data: `vshop_feat_${f1.idx}_${safePage}`
    }];
    if (slice[i + 1]) {
  const f2 = slice[i + 1];
  const has2 = isCreatorUser || ownedSet.has(f2.cmd);
  r.push({
    text: `${has2 ? '✅' : '🛒'} ${f2.name} (${has2 ? 'ברשותך' : `${f2.price.toLocaleString()} נק׳`})`,
    callback_data: `vshop_feat_${f2.idx}_${safePage}`
  });
    }
    rows.push(r);
  }

  const nav = [];
  if (safePage < totalPages - 1) nav.push({ text: '⬅️ עמוד הבא', callback_data: `vshop_page_${safePage + 1}` });
  if (safePage > 0) nav.push({ text: '➡️ עמוד קודם', callback_data: `${safePage - 1 === 0 ? 'vshop_page_0' : `vshop_page_${safePage - 1}`}` });
  if (nav.length) rows.push(nav);

  return { text, reply_markup: { inline_keyboard: rows } };
}

const FULL_MEMBER_PERMS = {
  can_send_messages: true,
  can_send_audios: true,
  can_send_documents: true,
  can_send_photos: true,
  can_send_videos: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true
};

async function approveAllPhonePendingInGroup(telegram, gid, extraUids = []) {
  const gData = await getGroupData(gid);
  const ownState = await getGroupData('owner_global');
  const infoState = await getGroupData('info_global_state');
  const fndData = await getGroupData(FOUNDERS_CHAT_ID);

  gData.verifiedPhoneUsers = gData.verifiedPhoneUsers || {};
  gData.pendingPhoneUsers = gData.pendingPhoneUsers || {};
  gData.autoApprovePendingPhone = true;

  const candidateUids = new Set();
  for (const id of extraUids) if (id) candidateUids.add(String(id));
  for (const id of Object.keys(gData.pendingPhoneUsers || {})) candidateUids.add(String(id));
  for (const id of Object.keys(gData.memberActivity || {})) candidateUids.add(String(id));
  for (const id of Object.keys(gData.adv?.userStats || {})) candidateUids.add(String(id));
  for (const id of Object.keys(ownState?.users || {})) candidateUids.add(String(id));
  for (const id of Object.keys(infoState?.userVersions || {})) candidateUids.add(String(id));
  for (const id of Object.keys(fndData?.fnd?.members || {})) candidateUids.add(String(id));

  let approvedCount = 0;
  const approvedNames = [];

  for (const uid of candidateUids) {
    if (!/^\d+$/.test(uid) || Number(uid) === CREATOR_ID) continue;
    try {
  const m = await telegram.getChatMember(gid, Number(uid)).catch(() => null);
  if (!m || !m.user || m.user.is_bot) continue;
  const isRestricted = m.status === 'restricted' || m.can_send_messages === false;
  const wasPending = Boolean(gData.pendingPhoneUsers[uid]);
  if (isRestricted || wasPending) {
    await telegram.restrictChatMember(gid, Number(uid), { permissions: FULL_MEMBER_PERMS }).catch(() => {});
    gData.verifiedPhoneUsers[uid] = true;
    delete gData.pendingPhoneUsers[uid];
    approvedCount++;
    approvedNames.push(m.user.first_name || uid);
  }
    } catch (e) {}
  }

  if (gData.lastVerifyMsgId) {
    await telegram.deleteMessage(gid, gData.lastVerifyMsgId).catch(() => {});
    gData.lastVerifyMsgId = null;
  }

  await saveGroupData(gid, gData);
  return { approvedCount, approvedNames, totalChecked: candidateUids.size };
}

function isVerifyMessagePayload(payload) {
  if (!payload || typeof payload.text !== 'string') return false;
  const kbStr = JSON.stringify(payload.reply_markup || '');
  return kbStr.includes('ver_ok_') || kbStr.includes('fcnt_verifyme_') || payload.text.includes('כדי לוודא שאינך בוט') || payload.text.includes('לאימות קידומת הטלפון');
}

function isWelcomeMessagePayload(payload) {
  if (!payload || typeof payload.text !== 'string') return false;
  if (isVerifyMessagePayload(payload)) return false;
  if (payload.text.startsWith('📜 *חוקי הקבוצה') || payload.text.startsWith('📢 *חוקי הקבוצה') || payload.text.startsWith('✅ הטקסט שעל כפתור החוקים')) return false;
  const kbStr = JSON.stringify(payload.reply_markup || '');
  return kbStr.includes('?start=rules_') || payload.text.includes('אומתת בהצלחה וכעת באפשרותך לכתוב בקבוצה');
}

module.exports = function registerInfoCommands(bot) {
  // עטיפת handleUpdate לבדיקת גרסת קבוצה וגרסת משתמש לפני כל הפעלה של הבוט + מניעת שידור אוטומטי לכל המשתמשים!
  if (bot && !bot._versionGateWrapped) {
    bot._versionGateWrapped = true;
    const origHandleUpdate = bot.handleUpdate.bind(bot);
    bot.handleUpdate = async function (update, ...rest) {
  try {
    const s = await getGroupData('owner_global');
    if (s.lastVersion !== LATEST_VERSION) {
    s.lastVersion = LATEST_VERSION;
    await saveGroupData('owner_global', s);
    }

    const msg = update?.message;
    const cb = update?.callback_query;
    const chat = msg?.chat || cb?.message?.chat;
    const from = msg?.from || cb?.from;
    const uid = from?.id ? String(from.id) : '';
    const cid = chat?.id ? String(chat.id) : '';
    const isGroup = chat && ['group', 'supergroup'].includes(chat.type);

    if (uid) bot._activeCtxUserVer = await getUserActiveVersion(uid);

    // מעקב אחרי משתמש שמקבל /warn כדי להצמיד כפתור "ערעור" אוטומטית מתחת להודעת האזהרה
    if (isGroup && msg?.text && /^\/warn(@\S+)?(\s|$)/i.test(msg.text.trim())) {
    const replyTargetId = msg.reply_to_message?.from?.id;
    const argId = (msg.text.trim().split(/\s+/)[1] || '').replace(/[^0-9]/g, '');
    bot._lastWarnTargetId = replyTargetId || argId || '';
    }

    // 4. מעקב אחרי בדיקת פקודות (בפרטי של הבוט או בקבוצת המייסדים) עבור תנאי המשימה השבועית (לפחות 3 פקודות)
    if (uid && (chat?.type === 'private' || isFoundersChatId(cid))) {
    const rawTxt = (msg?.text || '').trim();
    const cName = rawTxt.startsWith('/') ? rawTxt.split(/\s+/)[0].replace(/^\//, '').split('@')[0].toLowerCase() : '';
    if (cName === 'setmission' && Number(uid) === CREATOR_ID) {
      const st = await getGroupData('info_global_state');
      st.missionTestedCmds = {};
      await saveGroupData('info_global_state', st);
    } else if (cName && cName !== 'mission') {
      const st = await getGroupData('info_global_state');
      st.missionTestedCmds = st.missionTestedCmds || {};
      const arr = Array.isArray(st.missionTestedCmds[uid]) ? st.missionTestedCmds[uid] : [];
      if (!arr.includes(cName)) {
      arr.push(cName);
      st.missionTestedCmds[uid] = arr.slice(-25);
      await saveGroupData('info_global_state', st);
      }
    } else if (cb?.data && cb.data !== 'fnd_mis_done' && (cb.data.startsWith('hcmd_') || cb.data.startsWith('fnd_m_') || cb.data.startsWith('vq_'))) {
      const st = await getGroupData('info_global_state');
      st.missionTestedCmds = st.missionTestedCmds || {};
      const arr = Array.isArray(st.missionTestedCmds[uid]) ? st.missionTestedCmds[uid] : [];
      const token = cb.data.slice(0, 24);
      if (!arr.includes(token)) {
      arr.push(token);
      st.missionTestedCmds[uid] = arr.slice(-25);
      await saveGroupData('info_global_state', st);
      }
    }
    }

    // חסימת כפתור "השלמתי את המשימה" (fnd_mis_done) אם המשתמש עדיין לא בדק לפחות 3 פקודות בפרטי או בקבוצת המייסדים!
    if (cb?.data === 'fnd_mis_done' && uid && Number(uid) !== CREATOR_ID) {
    const st = await getGroupData('info_global_state');
    const tested = Array.isArray(st.missionTestedCmds?.[uid]) ? st.missionTestedCmds[uid] : [];
    if (tested.length < 3) {
      await bot.telegram.callApi('answerCbQuery', {
      callback_query_id: cb.id,
      text: `⚠️ לא ניתן להשלים את המשימה עדיין! עליך לבדוק לפחות 3 פקודות (בפרטי של הבוט או בקבוצת המייסדים). עד כה בדקת: ${tested.length}/3 פקודות.`,
      show_alert: true
      }).catch(() => {});
      return;
    }
    }

    // 2. תשובה לחידון וולטיק מוד (94 שאלות + נעילת שעה למשתמש שענה על אותה שאלה)
    if (cb?.data && cb.data.startsWith('vq_')) {
    const parts = cb.data.split('_');
    const qid = parts[1];
    const qIdx = parseInt(parts[2], 10);
    const isCorrect = parts[3] === '1';
    const qState = activeVolticQuizzes[qid];
    if (!qState || qState.solved) {
      await bot.telegram.callApi('answerCbQuery', { callback_query_id: cb.id, text: 'השאלה הזו כבר נפתרה!' }).catch(() => {});
      return;
    }
    const st = await getGroupData('info_global_state');
    st.quizAnsweredHistory = st.quizAnsweredHistory || {};
    const now = Date.now();
    const histKey = `${uid}:${qIdx}`;
    const lastAnsTime = st.quizAnsweredHistory[histKey] || 0;
    if (now - lastAnsTime < 3600000) {
      const minsLeft = Math.max(1, Math.ceil((3600000 - (now - lastAnsTime)) / 60000));
      await bot.telegram.callApi('answerCbQuery', {
      callback_query_id: cb.id,
      text: `⏳ כבר ענית על השאלה הזו בשעה האחרונה! תוכל לענות על שאלה זו שוב רק בעוד ${minsLeft} דקות.`,
      show_alert: true
      }).catch(() => {});
      return;
    }
    if (!isCorrect) {
      await bot.telegram.callApi('answerCbQuery', {
      callback_query_id: cb.id,
      text: '❌ תשובה לא נכונה! נסה שוב.',
      show_alert: true
      }).catch(() => {});
      return;
    }
    qState.solved = true;
    st.quizAnsweredHistory[histKey] = now;
    for (const [k, t] of Object.entries(st.quizAnsweredHistory)) {
      if (now - t > 3600000) delete st.quizAnsweredHistory[k];
    }
    await saveGroupData('info_global_state', st);

    let prizeText = `🏆 *${from?.first_name || 'חבר'}* ענה נכון ראשון! 👏`;
    if (qState.isFounders) {
      const fData = await getGroupData(FOUNDERS_CHAT_ID);
      fData.fnd = fData.fnd || { members: {} };
      fData.fnd.members = fData.fnd.members || {};
      if (Number(uid) !== CREATOR_ID) {
      const mem = fData.fnd.members[uid] || { id: Number(uid), name: from?.first_name || 'מייסד', points: 10, title: 'חבר צוות המייסדים' };
      mem.points = (mem.points || 0) + 10;
      fData.fnd.members[uid] = mem;
      await saveGroupData(FOUNDERS_CHAT_ID, fData);
      }
      prizeText = Number(uid) === CREATOR_ID
      ? `👑 היוצר של וולטיק מוד (*${from?.first_name || 'דוב'}*) פתר ראשון!`
      : `🏆 המייסד *${from?.first_name || 'חבר'}* ענה נכון ראשון וזכה ב-*+10 נקודות מייסד*!`;
    }

    await bot.telegram.callApi('answerCbQuery', { callback_query_id: cb.id, text: '🎉 תשובה נכונה!' }).catch(() => {});
    const qItem = VOLTIC_QUIZ_POOL[qIdx] || [];
    await bot.telegram.callApi('editMessageText', {
      chat_id: cid,
      message_id: cb.message?.message_id,
      text: `✅ *חידון וולטיק מוד נפתר!*\n❓ *שאלה:* ${qItem[0] || ''}\n💡 *תשובה נכונה:* ${qItem[1] || ''}\n\n${prizeText}`,
      parse_mode: 'Markdown'
    }).catch(() => {});
    return;
    }


    // תיעוד אוטומטי של כל מצטרף חדש לקבוצה כדי שניתן יהיה לאשר את כולם בפקודה אחת
    if (isGroup && Array.isArray(msg?.new_chat_members) && msg.new_chat_members.length) {
    const gData = await getGroupData(cid);
    gData.pendingPhoneUsers = gData.pendingPhoneUsers || {};
    for (const nm of msg.new_chat_members) {
      if (nm && !nm.is_bot) {
      gData.pendingPhoneUsers[String(nm.id)] = { name: nm.first_name || 'חבר', joinedAt: Date.now() };
      }
    }
    await saveGroupData(cid, gData);
    }

    // לחיצה על כפתור ישן של "📱 לחץ כאן לאימות קידומת טלפון" בקבוצה -> מאשר מיד את המשתמש בלי לבקש מספר טלפון!
    if (isGroup && cb?.data && cb.data.startsWith('fcnt_verifyme_')) {
    const targetId = Number(cb.data.replace('fcnt_verifyme_', ''));
    const clickerIsAdmin = Number(uid) === CREATOR_ID || (await isGroupAdminCb({ chat, from, telegram: bot.telegram }));
    if (Number(uid) !== targetId && !clickerIsAdmin) {
      await bot.telegram.callApi('answerCbQuery', {
      callback_query_id: cb.id,
      text: '⚠️ כפתור אימות זה מיועד למצטרף החדש או למנהלי הקבוצה בלבד!',
      show_alert: true
      }).catch(() => {});
      return;
    }
    await bot.telegram.restrictChatMember(cid, targetId, { permissions: FULL_MEMBER_PERMS }).catch(() => {});
    const gData = await getGroupData(cid);
    gData.verifiedPhoneUsers = gData.verifiedPhoneUsers || {};
    gData.verifiedPhoneUsers[String(targetId)] = true;
    if (gData.pendingPhoneUsers) delete gData.pendingPhoneUsers[String(targetId)];
    await saveGroupData(cid, gData);
    await bot.telegram.callApi('answerCbQuery', {
      callback_query_id: cb.id,
      text: '✅ המשתמש אושר בהצלחה וקיבל הרשאת כתיבה מלאה בקבוצה!',
      show_alert: true
    }).catch(() => {});
    const botUsername = bot.botInfo?.username || 'VolticMod_bot';
    const rulesUrl = `https://t.me/${botUsername}?start=rules_${cid}`;
    const btnText = gData.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';
    await bot.telegram.callApi('editMessageText', {
      chat_id: cid,
      message_id: cb.message?.message_id,
      text: `✅ *האימות הושלם בהצלחה!* כעת באפשרותך לכתוב בקבוצה בחופשיות.`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: btnText, url: rulesUrl }]] }
    }).catch(() => {});
    return;
    }


    // 4. בקבוצות (חוץ מקבוצת המייסדים): אם הקבוצה עדיין לא עודכנה לגרסה החדשה ומנסים להפעיל את הבוט -> הצג כפתור "♻️עדכון גרסת הבוט♻️" למנהל!
    if (isGroup && !isFoundersChatId(cid)) {
    const gData = await getGroupData(cid);
    if (Number(uid) === CREATOR_ID && gData.groupVersion !== LATEST_VERSION) {
      gData.groupVersion = LATEST_VERSION;
      await saveGroupData(cid, gData);
    }
    if (gData.groupVersion === LATEST_VERSION) {
      bot._activeCtxUserVer = LATEST_VERSION;
    } else {
      const cbData = cb?.data || '';
      const msgText = (msg?.text || '').trim();
      const isBotCommand = msgText.startsWith('/');
      const isBotCallback = Boolean(cb && cbData !== 'grp_upgrade_ver');

      if (isBotCommand || isBotCallback) {
      if (isBotCallback) {
        await bot.telegram.callApi('answerCbQuery', {
        callback_query_id: cb.id,
        text: '⚠️ יש לעדכן תחילה את גרסת הבוט בקבוצה ע"י מנהל הקבוצה!',
        show_alert: true
        }).catch(() => {});
      }
      await bot.telegram.callApi('sendMessage', {
        chat_id: cid,
        text:
        `⚠️ *גרסה חדשה של וולטיק מוד זמינה (${LATEST_VERSION})!*\n` +
        `כדי להמשיך להפעיל את הבוט ולפתוח את הפקודות החדשות בקבוצה זו, על *מנהל הקבוצה* ללחוץ על הכפתור למטה לעדכון גרסת הבוט:`,
        parse_mode: 'Markdown',
        reply_markup: {
        inline_keyboard: [[{ text: '♻️עדכון גרסת הבוט♻️', callback_data: 'grp_upgrade_ver' }]]
        }
      }).catch(() => {});
      return;
      }
    }
    } else if (isGroup && isFoundersChatId(cid)) {
    bot._activeCtxUserVer = LATEST_VERSION;
    const gData = await getGroupData(cid);
    if (gData.groupVersion !== LATEST_VERSION) {
      gData.groupVersion = LATEST_VERSION;
      await saveGroupData(cid, gData);
    }
    }

    // 2. תגובה בהשבה (Reply) להודעה מהמנהל בצ׳אט פרטי (ללא צורך בפתיחת פנייה חדשה!)
    if (chat?.type === 'private' && msg?.reply_to_message && msg?.text && !msg.text.trim().startsWith('/')) {
    const repliedTxt = String(msg.reply_to_message.text || msg.reply_to_message.caption || '');

    // אם המשתמש מגיב על "ההודעה מהמנהל: ... הגב להודעה זו כדי להגיב"
    if (Number(uid) !== CREATOR_ID && (repliedTxt.includes('ההודעה מהמנהל:') || repliedTxt.includes('הגב להודעה זו כדי להגיב') || repliedTxt.includes('תשובה מיוצר וולטיק מוד'))) {
      const uName = from?.first_name || 'משתמש';
      const uTag = from?.username ? `@${from.username}` : 'ללא';
      const cleanOrig = repliedTxt.replace('הגב להודעה זו כדי להגיב', '').trim();
      await bot.telegram.callApi('sendMessage', {
      chat_id: CREATOR_ID,
      text:
        `📩 תגובה חדשה ממשתמש להודעתך:\n` +
        `👤 מאת: ${uName} (${uTag})\n` +
        `🆔 ID: ${uid}\n` +
        `↩️ בתגובה ל: "${cleanOrig.slice(0, 120)}"\n\n` +
        `💬 תוכן ההודעה:\n${msg.text.trim()}`,
      reply_markup: {
        inline_keyboard: [[{ text: '💬 השב למשתמש זה', callback_data: `ask_reply_${uid}` }]]
      }
      }).catch(() => {});
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: 'נשלח בהצלחה למנהל'
      }).catch(() => {});
      return;
    }

    // אם המנהל (יוצר הבוט) משיב ב-Reply ישירות על כרטיס פנייה/תגובה של משתמש בפרטי
    if (Number(uid) === CREATOR_ID) {
      const idMatch = repliedTxt.match(/🆔\s*\*?ID:\*?\s*`?(\d+)`?/);
      if (idMatch && idMatch[1]) {
      const targetUid = idMatch[1];
      await bot.telegram.callApi('sendMessage', {
        chat_id: targetUid,
        text: `ההודעה מהמנהל: ${msg.text.trim()}\n\nהגב להודעה זו כדי להגיב`
      }).catch(() => {});
      await bot.telegram.callApi('sendMessage', {
        chat_id: CREATOR_ID,
        text: `✅ ההודעה נשלחה בהצלחה למשתמש ${targetUid}!`
      }).catch(() => {});
      return;
      }
    }
    }

    const rawCmdText = (msg?.text || '').trim();
    const isSlashCmd = rawCmdText.startsWith('/');
    const cmdName = isSlashCmd ? rawCmdText.split(/\s+/)[0].replace(/^\//, '').split('@')[0].toLowerCase() : '';
    const cmdArg = isSlashCmd ? rawCmdText.split(/\s+/).slice(1).join(' ').trim() : '';

    // 6. המשך אשף דו-שלבי של /addcmd בקבוצה (כמו "הצעה לשיפור": שלב 1 שאלה -> שלב 2 תשובה)
    if (isGroup && msg?.text && !isSlashCmd && addcmdWizards[`${cid}:${uid}`]) {
    const wiz = addcmdWizards[`${cid}:${uid}`];
    const inputTxt = msg.text.trim();
    if (wiz.step === 1) {
      const cleanQ = inputTxt.replace(/^\//, '').trim().toLowerCase();
      wiz.step = 2;
      wiz.question = cleanQ;
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text:
        `💬 *שלב 2 מתוך 2 – הגדרת התשובה:*\n` +
        `מה הבוט צריך לענות כשמישהו יכתוב את השאלה או הפקודה *"\`${cleanQ}\`"*?\n\n` +
        `✍️ כתוב עכשיו את התשובה (ניתן לשלב עיצוב וכפתורים כמו \`{{כפתור}{https://t.me/VolticMod_bot}}\`):`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ ביטול', callback_data: 'addcmd_wiz_cancel' }]] }
      }).catch(() => {});
      return;
    }
    if (wiz.step === 2) {
      const cleanQ = wiz.question;
      delete addcmdWizards[`${cid}:${uid}`];
      const gData = await getGroupData(cid);
      gData.customCommands = gData.customCommands || {};
      gData.customCommands[cleanQ] = inputTxt;
      const slug = cleanQ.split(/\s+/)[0].replace(/^\//, '');
      if (slug) gData.customCommands[slug] = inputTxt;
      await saveGroupData(cid, gData);
      await safeSendGroupRich(bot.telegram, cid, inputTxt).catch(() => {});
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text:
        `✅ *הפקודה המותאמת אישית נשמרה בהצלחה!*\n` +
        `❓ *שאלה:* \`/${slug}\` (או כתיבת \`${cleanQ}\`)\n` +
        `💬 *תשובה:* מוצגת בתצוגה המקדימה מעל.`,
      parse_mode: 'Markdown'
      }).catch(() => {});
      return;
    }
    }

    // מענה אוטומטי לשאלה מותאמת אישית שנשמרה ב-/addcmd גם אם נכתבה כשאלה רגילה בצ׳אט
    if (isGroup && msg?.text && !isSlashCmd) {
    const gData = await getGroupData(cid);
    const lookupKey = msg.text.trim().toLowerCase();
    if (gData.customCommands && gData.customCommands[lookupKey]) {
      await safeSendGroupRich(bot.telegram, cid, gData.customCommands[lookupKey]).catch(() => {});
      return;
    }
    }

    // 5. הפעלת כל אחת מ-52 הפקודות שנרכשו בחנות המייסדים – עובד למייסד שרכש אותן בכל קבוצה וגם בקבוצת המייסדים!
    if (isGroup && isSlashCmd && FOUNDER_FEATURE_BY_CMD[cmdName]) {
    const feat = FOUNDER_FEATURE_BY_CMD[cmdName];
    const fData = await getGroupData(FOUNDERS_CHAT_ID);
    const mem = fData?.fnd?.members?.[uid];
    const st = await getGroupData('info_global_state');
    const ownedGlobal = st?.ownedFeatures?.[uid] || [];
    const ownedFnd = Array.isArray(mem?.ownedFeatures) ? mem.ownedFeatures : [];
    const hasFeature = Number(uid) === CREATOR_ID || ownedGlobal.includes(feat.cmd) || ownedFnd.includes(feat.cmd);

    if (!hasFeature) {
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text:
        `🔒 הפקודה \`/${feat.cmd}\` (*${feat.name}*) היא פיצ'ר מיוחד מחנות המייסדים!\n` +
        `💰 *מחיר הפיצ'ר:* ${feat.price.toLocaleString()} נקודות מייסד.\n\n` +
        `💡 מייסדים שרוכשים את הפיצ'ר דרך \`/shop\` בקבוצת המייסדים יכולים להפעיל אותו בכל קבוצה שבה הבוט נמצא!`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '👑 מעבר לקבוצת צוות המייסדים', url: 'https://t.me/+v4Hrdnpg0rI3MTk0' }]]
      }
      }).catch(() => {});
      return;
    }

    const senderTitle = Number(uid) === CREATOR_ID ? `👑 היוצר של וולטיק מוד (*${from?.first_name || 'דוב'}*)` : `🌟 המייסד *${from?.first_name || 'חבר'}*`;
    await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: `${feat.name} | ${senderTitle}\n\n${feat.effect}`,
      parse_mode: 'Markdown'
    }).catch(() => {});
    return;
    }

    // 5. פתיחת חנות 52 הפיצ'רים למייסדים (/shop, /features, /buy_feature)
    if (isGroup && isSlashCmd && (cmdName === 'shop' || cmdName === 'features' || cmdName === 'buy_feature')) {
    if (!isFoundersChatId(cid) && Number(uid) !== CREATOR_ID) {
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: `⚠️ רכישת פיצ'רים ב-\`/${cmdName}\` מתבצעת בקבוצת צוות המייסדים (לאחר הרכישה הפיצ'רים עובדים בכל הקבוצות!).`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '👑 מעבר לקבוצת צוות המייסדים', url: 'https://t.me/+v4Hrdnpg0rI3MTk0' }]] }
      }).catch(() => {});
      return;
    }
    const fData = await getGroupData(FOUNDERS_CHAT_ID);
    fData.fnd = fData.fnd || { members: {} };
    fData.fnd.members = fData.fnd.members || {};
    const mem = fData.fnd.members[uid] || { id: Number(uid), name: from?.first_name || 'מייסד', points: 10, ownedFeatures: [] };
    fData.fnd.members[uid] = mem;
    await saveGroupData(FOUNDERS_CHAT_ID, fData);
    const st = await getGroupData('info_global_state');
    const owned = Array.from(new Set([...(mem.ownedFeatures || []), ...(st.ownedFeatures?.[uid] || [])]));
    const view = buildFounderFeaturesShopView(owned, mem.points || 0, Number(uid) === CREATOR_ID, 0);
    await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: view.text,
      parse_mode: 'Markdown',
      reply_markup: view.reply_markup
    }).catch(() => {});
    return;
    }

    // 2. הפעלת חידון וולטיק מוד (/quiz_bot או /trivia) מתוך מאגר 94 השאלות עם סינון שאלות שנענו בשעה האחרונה
    if (isGroup && isSlashCmd && (cmdName === 'quiz_bot' || cmdName === 'trivia')) {
    if (cmdName === 'quiz_bot' && !isFoundersChatId(cid)) {
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: `⚠️ הפקודה \`/quiz_bot\` מיועדת לצוות המייסדים ועובדת בקבוצת צוות המייסדים בלבד! (בקבוצה רגילה השתמשו ב-\`/trivia\`).`,
      parse_mode: 'Markdown'
      }).catch(() => {});
      return;
    }
    const st = await getGroupData('info_global_state');
    st.quizAnsweredHistory = st.quizAnsweredHistory || {};
    const now = Date.now();
    const availableIndices = [];
    for (let i = 0; i < VOLTIC_QUIZ_POOL.length; i++) {
      const lastT = st.quizAnsweredHistory[`${uid}:${i}`] || 0;
      if (now - lastT >= 3600000) availableIndices.push(i);
    }
    const poolIndices = availableIndices.length > 0 ? availableIndices : VOLTIC_QUIZ_POOL.map((_, i) => i);
    const chosenIdx = poolIndices[Math.floor(Math.random() * poolIndices.length)];
    const [qText, rightAns, w1, w2, w3] = VOLTIC_QUIZ_POOL[chosenIdx];
    const qid = Date.now().toString(36) + Math.floor(Math.random() * 99);
    activeVolticQuizzes[qid] = { qIdx: chosenIdx, solved: false, isFounders: cmdName === 'quiz_bot' || isFoundersChatId(cid) };

    const opts = [
      { text: rightAns, callback_data: `vq_${qid}_${chosenIdx}_1` },
      { text: w1, callback_data: `vq_${qid}_${chosenIdx}_0` },
      { text: w2, callback_data: `vq_${qid}_${chosenIdx}_0` },
      { text: w3, callback_data: `vq_${qid}_${chosenIdx}_0` }
    ].sort(() => Math.random() - 0.5);

    const header = (cmdName === 'quiz_bot' || isFoundersChatId(cid))
      ? `🧠 *חידון מומחי וולטיק מוד (שאלה #${chosenIdx + 1} מתוך ${VOLTIC_QUIZ_POOL.length})!*\nהמייסד הראשון שעונה נכון מקבל *+10 נקודות מייסד* (משתמש שענה על שאלה זו בשעה האחרונה יוכל לענות עליה שוב רק אחרי שעה):`
      : `🧠 *אתגר טריוויה – וולטיק מוד (שאלה #${chosenIdx + 1} מתוך ${VOLTIC_QUIZ_POOL.length})!*\nהראשון שלוחץ על התשובה הנכונה מנצח:`;

    await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: `${header}\n\n❓ *${qText}*`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: opts.map((o) => [o]) }
    }).catch(() => {});
    return;
    }

    // תמיכה בקישור מהיר מקבוצה לפרטי ובקיצורי פקודות בפרטי (/rate, /suggest)
    if (chat?.type === 'private') {
    if (cmdName === 'start' && (cmdArg === 'ask_creator' || cmdArg === 'translate_file')) {
      msg.text = `/${cmdArg}`;
      if (Array.isArray(msg.entities)) msg.entities = [{ offset: 0, length: msg.text.length, type: 'bot_command' }];
    } else if (cmdName === 'rate' || cmdName === 'rate_bot') {
      msg.text = '/start rate_bot';
      if (Array.isArray(msg.entities)) msg.entities = [{ offset: 0, length: 6, type: 'bot_command' }];
    } else if (cmdName === 'suggest' || cmdName === 'propose') {
      msg.text = '/request_command';
      if (Array.isArray(msg.entities)) msg.entities = [{ offset: 0, length: msg.text.length, type: 'bot_command' }];
    }
    }

    // א. בקבוצה רגילה או בקבוצת צוות המייסדים: אם הופעלה פקודה או כפתור שעובדים בפרטי בלבד -> הודע שהפקודה עובדת בפרטי!
    if (isGroup) {
    if (isSlashCmd && PRIVATE_ONLY_COMMANDS.has(cmdName)) {
      const botUsername = bot.botInfo?.username || 'VolticMod_bot';
      let startParam = '';
      if (cmdName === 'request_command' || cmdName === 'suggest' || cmdName === 'propose') startParam = '?start=request_command';
      else if (cmdName === 'rate' || cmdName === 'rate_bot') startParam = '?start=rate_bot';
      else if (cmdName === 'ask_creator') startParam = '?start=ask_creator';
      else if (cmdName === 'translate_file' || cmdName === 'translate') startParam = '?start=translate_file';
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: `⚠️ הפקודה \`/${cmdName}\` לא עובדת בקבוצה – *הפקודה עובדת בפרטי בלבד!*`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '💬 לחץ כאן למעבר לפרטי של הבוט', url: `https://t.me/${botUsername}${startParam}` }]]
      }
      }).catch(() => {});
      return;
    }

    const cbData = cb?.data || '';
    if (cb && PRIVATE_ONLY_CALLBACKS.has(cbData)) {
      const botUsername = bot.botInfo?.username || 'VolticMod_bot';
      const paramMap = {
      reqcmd_start: '?start=request_command',
      rate_start: '?start=rate_bot',
      askcreator_start: '?start=ask_creator',
      trfile_start: '?start=translate_file'
      };
      await bot.telegram.callApi('answerCbQuery', {
      callback_query_id: cb.id,
      text: '⚠️ אפשרות זו לא עובדת בקבוצה – היא עובדת בפרטי בלבד!',
      show_alert: true
      }).catch(() => {});
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: '⚠️ אפשרות זו לא עובדת בקבוצה – *הפקודה עובדת בפרטי בלבד!*',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '💬 לחץ כאן להפעלה בפרטי של הבוט', url: `https://t.me/${botUsername}${paramMap[cbData] || ''}` }]]
      }
      }).catch(() => {});
      return;
    }

    if (isSlashCmd && !isFoundersChatId(cid) && FOUNDERS_GROUP_ONLY_COMMANDS.has(cmdName)) {
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: `⚠️ הפקודה \`/${cmdName}\` מיועדת לצוות המייסדים ועובדת בקבוצת צוות המייסדים בלבד!`,
      parse_mode: 'Markdown'
      }).catch(() => {});
      return;
    }
    }

    // ב. בצ׳אט פרטי: אם הופעלה פקודה שעובדת בקבוצות בלבד או בקבוצת צוות המייסדים בלבד -> הודע שהפקודה עובדת בקבוצות!
    if (chat?.type === 'private' && isSlashCmd) {
    if (FOUNDERS_GROUP_ONLY_COMMANDS.has(cmdName)) {
      const creatorLookup = Number(uid) === CREATOR_ID && ((cmdName === 'founders' || cmdName === 'founders_menu') && cmdArg);
      if (!creatorLookup) {
      await bot.telegram.callApi('sendMessage', {
        chat_id: cid,
        text: `⚠️ הפקודה \`/${cmdName}\` לא עובדת בפרטי – *הפקודה עובדת בקבוצות (בקבוצת צוות המייסדים) בלבד!*`,
        parse_mode: 'Markdown',
        reply_markup: {
        inline_keyboard: [
          [{ text: '👑 מעבר לקבוצת צוות המייסדים', url: 'https://t.me/+v4Hrdnpg0rI3MTk0' }],
          [{ text: '🔙 חזרה לתפריט הראשי', callback_data: 'help_main' }]
        ]
        }
      }).catch(() => {});
      return;
      }
    }

    if (GROUP_ONLY_COMMANDS.has(cmdName)) {
      const botUsername = bot.botInfo?.username || 'VolticMod_bot';
      await bot.telegram.callApi('sendMessage', {
      chat_id: cid,
      text: `⚠️ הפקודה \`/${cmdName}\` לא עובדת בפרטי – *הפקודה עובדת בקבוצות בלבד!*`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
        [{ text: '➕ הוסף את הבוט לקבוצה', url: `https://t.me/${botUsername}?startgroup=true` }],
        [{ text: '🔙 חזרה לתפריט הראשי', callback_data: 'help_main' }]
        ]
      }
      }).catch(() => {});
      return;
    }
    }

    // 3. בצ׳אט פרטי: כל עוד המשתמש לא לחץ על "♻️עדכון גרסת הבוט♻️", חסום הפעלה ישירה של הפקודות החדשות והצג לו את כפתור העדכון
    if (chat?.type === 'private' && uid && Number(uid) !== CREATOR_ID) {
    const userVer = bot._activeCtxUserVer || DEFAULT_PREV_USER_VERSION;
    if (userVer !== LATEST_VERSION && isSlashCmd) {
      if (NEW_UPDATE_COMMANDS.has(cmdName)) {
      await bot.telegram.callApi('sendMessage', {
        chat_id: cid,
        text:
        `⚠️ הפקודה \`/${cmdName}\` שייכת לגרסה החדשה של הבוט (*${LATEST_VERSION}*)!\n` +
        `הגרסה הנוכחית שלך היא: *${userVer}*.\n\n` +
        `👇 לחץ על הכפתור למטה כדי לעדכן את גרסת הבוט שלך ולפתוח את כל הפקודות החדשות:`,
        parse_mode: 'Markdown',
        reply_markup: {
        inline_keyboard: [[{ text: '♻️עדכון גרסת הבוט♻️', callback_data: 'ver_upgrade_user' }]]
        }
      }).catch(() => {});
      return;
      }
    }
    }
  } catch (e) {}

  return origHandleUpdate(update, ...rest);
    };
  }

  if (bot && bot.telegram && !bot.telegram._rulesCleanWrapped) {
    bot.telegram._rulesCleanWrapped = true;
    const origCall = bot.telegram.callApi.bind(bot.telegram);
    const wrappedCallApi = async function (method, payload, ...rest) {
  let detectedWelcome = false;
  let detectedVerify = false;

  try {
    // שמירת משתמשים שכבר אימתו טלפון בקבוצה ב-Redis כדי שלא יתבקשו לאמת שוב בכניסה חוזרת
    if (method === 'restrictChatMember' && payload?.chat_id && payload?.user_id) {
    const canSend = payload.permissions?.can_send_messages;
    const gData = await getGroupData(payload.chat_id);
    gData.verifiedPhoneUsers = gData.verifiedPhoneUsers || {};
    if (canSend === true) {
      gData.verifiedPhoneUsers[String(payload.user_id)] = true;
      await saveGroupData(payload.chat_id, gData);
    } else if (canSend === false && gData.verifiedPhoneUsers[String(payload.user_id)]) {
      return { ok: true };
    }
    }
    // 3. החלפת אימות טלפון אישי / אימות רגיל בתרגיל חשבון קצר נגד בוטים!
    if (method === 'sendMessage' && payload?.chat_id && payload?.reply_markup) {
    const kbJson = JSON.stringify(payload.reply_markup);
    const mPhoneVer = kbJson.match(/fcnt_verifyme_(\d+)/);
    const mKeyVer = kbJson.match(/ver_ok_(\d+)_/);
    const targetVerUid = mPhoneVer ? mPhoneVer[1] : (mKeyVer ? mKeyVer[1] : null);
    if (targetVerUid) {
      const gData = await getGroupData(payload.chat_id);
      if (gData.verifiedPhoneUsers && gData.verifiedPhoneUsers[targetVerUid]) {
      return { message_id: 1 };
      }
      const nameMatch = String(payload.text || '').match(/שלום\s+\*([^*]+)\*/);
      const memberName = nameMatch ? nameMatch[1] : 'חבר';
      const secMatch = String(payload.text || '').match(/תוך \d+ שניות/);
      const ex = buildShortMathExercise(targetVerUid, memberName, secMatch ? ` (${secMatch[0]})` : '');
      payload.text = ex.text;
      payload.parse_mode = 'Markdown';
      payload.reply_markup = ex.reply_markup;
    }
    }

    if (method === 'answerCbQuery' && typeof payload?.text === 'string' && payload.text.includes('סמל המפתח')) {
    payload.text = '❌ תשובה שגויה לתרגיל! נסה שוב לבחור את התשובה הנכונה.';
    }

    // 1. חסימה מוחלטת של שליחת הודעת עדכון אוטומטית לכל המשתמשים והקבוצות!
    if (method === 'sendMessage' && payload && !payload.reply_markup && typeof payload.text === 'string') {
    if ((payload.text.includes('תיקון הודעת גרסה חדש') || payload.text.includes('עדכון ענק')) && payload.text.includes(LATEST_VERSION)) {
      if (!bot._allowManualVerBroadcast) {
      return { message_id: 1 };
      }
    }
    }

    if ((method === 'sendMessage' || method === 'editMessageText') && payload && typeof payload.text === 'string') {
    if (payload.text.includes('חוקי הקבוצה') && /\/setrules(@\S+)?/i.test(payload.text)) {
      payload.text = payload.text.replace(/\/setrules(@\S+)?\s*/gi, '');
    }
    // סנכרון אוטומטי של "הצעה לשיפור" ללוח פיתוח/תיקונים ומחיקה באישור/דחייה
    if (method === 'sendMessage' && String(payload.chat_id) === String(CREATOR_ID) && payload.text.startsWith('📩 הצעה חדשה לשיפור / פקודה:')) {
      const parsed = parseSuggestionCardText(payload.text);
      if (parsed.cmd) {
      const { s, items } = await loadDevBoard();
      items.push({ id: Date.now().toString(36), uid: parsed.uid, cmd: parsed.cmd, text: parsed.combined, type: parsed.type });
      await saveGroupData('info_global_state', s);
      }
    }

    // 3. הצמדת כפתור "ערעור" אוטומטית מתחת לכל הודעת אזהרה שמשתמש מקבל בקבוצה!
    if (method === 'sendMessage' && (payload.text.startsWith('⚠️ אזהרה ל-') || (payload.text.startsWith('🚨 ') && payload.text.includes('אזהרות')))) {
      const warnedUid = bot._lastWarnTargetId || '0';
      if (!payload.reply_markup) {
      payload.reply_markup = {
        inline_keyboard: [[{ text: 'ערעור', callback_data: `warn_appeal_${warnedUid}` }]]
      };
      }
    }

    // 2. עיצוב הודעה מהמנהל למשתמש: "ההודעה מהמנהל: ... הגב להודעה זו כדי להגיב"
    if (method === 'sendMessage' && payload.text.startsWith('👑 *תשובה מיוצר וולטיק מוד לשאלתך:*\n\n')) {
      const adminMsg = payload.text.replace('👑 *תשובה מיוצר וולטיק מוד לשאלתך:*\n\n', '').trim();
      payload.text = `ההודעה מהמנהל: ${adminMsg}\n\nהגב להודעה זו כדי להגיב`;
      delete payload.parse_mode;
    }

    // עדכון תצוגת פאנל /foreign_countries כך שיציג אימות בתרגיל קצר במקום אימות טלפון אישי
    if (payload.text.includes('חסימת קידומות ומדינות זרות') && payload.reply_markup?.inline_keyboard) {
      payload.text = payload.text
      .replace('אימות קידומת טלפון בכניסה:', 'אימות מצטרפים בתרגיל קצר בכניסה:')
      .replace('לחייב מצטרפים חדשים לאמת קידומת טלפון בלחיצת כפתור', 'לחייב מצטרפים חדשים לפתור תרגיל חשבון קצר נגד בוטים (ללא חשיפת טלפון)');
      for (const r of payload.reply_markup.inline_keyboard) {
      for (const b of r) {
        if (b.callback_data === 'fcnt_toggle_pver') {
        b.text = b.text.replace('אימות קידומת טלפון בכניסה', 'אימות בתרגיל קצר בכניסה');
        }
      }
      }
    }

    // 4. שמירת פרטי ההצעה שאושרה/נדחתה ושליחת פירוט מדויק למשתמש איזו פקודה/רעיון אושר או נדחה!
    if (method === 'editMessageText' && (payload.text.startsWith('אושר\n\n📩 הצעה חדשה לשיפור') || payload.text.startsWith('נדחה\n\n📩 הצעה חדשה לשיפור'))) {
      const parsed = parseSuggestionCardText(payload.text);
      bot._lastReviewedSuggestion = {
      uid: parsed.uid,
      cmd: parsed.cmd || 'הצעה לפקודה',
      desc: parsed.desc || '',
      approved: payload.text.startsWith('אושר')
      };
      const { s, items } = await loadDevBoard();
      const beforeLen = items.length;
      s.devBoard.items = items.filter((x) => {
      if (parsed.cmd && (x.cmd === parsed.cmd || x.text === parsed.combined || x.text.startsWith(parsed.cmd))) return false;
      if (parsed.uid && x.uid === parsed.uid) return false;
      return true;
      });
      if (s.devBoard.items.length === beforeLen && s.devBoard.items.length > 0) s.devBoard.items.pop();
      await saveGroupData('info_global_state', s);
    }

    if (method === 'sendMessage' && (payload.text === 'הפקודה אושרה ועובדת!' || payload.text === 'הפקודה נדחתה עקב החלטת היוצר')) {
      const rev = bot._lastReviewedSuggestion;
      const isApproved = payload.text === 'הפקודה אושרה ועובדת!';
      const cmdTitle = rev?.cmd || 'ההצעה ששלחת';
      const cmdDesc = rev?.desc ? `\n💬 תיאור ההצעה: ${rev.desc}` : '';
      if (isApproved) {
      payload.text =
        `✅ ההצעה שלך אושרה ע"י יוצר הבוט ופעילה כעת! 🎉\n\n` +
        `⌨️ הפקודה / הרעיון שאושר: ${cmdTitle}${cmdDesc}`;
      } else {
      payload.text =
        `❌ עדכון לגבי ההצעה ששלחת לבוט:\n\n` +
        `⌨️ הפקודה / הרעיון שנדחה: ${cmdTitle}${cmdDesc}\n\n` +
        `📌 סטטוס: נדחה עקב החלטת יוצר הבוט.`;
      }
      bot._lastReviewedSuggestion = null;
    }

    const kb = payload.reply_markup?.inline_keyboard;
    if (Array.isArray(kb)) {
      // כלל ברזל גלובלי: הסרת שמות פקודות באנגלית מכל כפתור בבוט כך שכל הכפתורים יוצגו בעברית נקייה בלבד
      for (const row of kb) {
      for (const btn of row) {
        if (btn && typeof btn.text === 'string') {
        btn.text = btn.text
          .replace(/\s*\(\s*`?\/[a-zA-Z0-9_]+`?\s*\)/g, '')
          .replace(/לפאנל\s+\/owner/gi, 'לפאנל היוצר')
          .replace(/\/[a-zA-Z0-9_]+/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        }
      }
      }
      // הוספת כפתור פתיחה ישירה לחנות 52 הפיצ׳רים מתוך תפריט /founders ("🛒 חנות נקודות")
      if (typeof payload.text === 'string' && payload.text.startsWith('🛒 חנות נקודות')) {
      if (!kb.some((r) => r.some((b) => b.callback_data === 'vshop_page_0'))) {
        kb.unshift([{ text: '🛒 פתח עכשיו את חנות 52 הפיצ׳רים', callback_data: 'vshop_page_0' }]);
      }
      }
      const curUserVer = bot._activeCtxUserVer || DEFAULT_PREV_USER_VERSION;
      const isUpgraded = curUserVer === LATEST_VERSION;

      // 1 + 2 + 3. התאמת התפריט הראשי + הוספת קישור לקבוצת התמיכה "צוות המייסדים" בפרונט של התפריט למשתמשים!
      if (payload.text.includes('תפריט הפקודות הראשי')) {
      payload.text = payload.text.replace(
        `🔖 *גרסה נוכחית:* עדכון ${LATEST_VERSION}`,
        `🔖 *גרסה נוכחית:* עדכון מספר ${curUserVer}` +
        (!isUpgraded ? `\n🔔 *גרסה חדשה (${LATEST_VERSION}) זמינה! לחץ על "♻️עדכון גרסת הבוט♻️" למטה כדי לעדכן ולפתוח את הפקודות החדשות.*` : '')
      );
      if (!payload.text.includes('צוות המייסדים')) {
        payload.text = payload.text.replace(
        '📚 *תפריט הפקודות הראשי',
        `👑 *קבוצת התמיכה של הבוט:* [צוות המייסדים](https://t.me/+v4Hrdnpg0rI3MTk0)\n\n📚 *תפריט הפקודות הראשי`
        );
      }

      if (!isUpgraded) {
        // הסתרת כפתורי הפקודות החדשות עד שהמשתמש ילחץ על "♻️עדכון גרסת הבוט♻️"
        payload.reply_markup.inline_keyboard = kb
        .map((row) => row.filter((btn) => !NEW_UPDATE_CALLBACKS.has(btn.callback_data)))
        .filter((row) => row.length > 0);
      } else {
        const hasDevBtn = kb.some((r) => r.some((b) => b.callback_data === 'devboard_open'));
        if (!hasDevBtn) {
        kb.splice(kb.length - 1, 0, [
          { text: '📘 מדריך ותיעוד הבוט', callback_data: 'docs_main' },
          { text: '🛠️ מה בפיתוח ובתיקונים', callback_data: 'devboard_open' }
        ]);
        }
      }

      // עדכון כפתור "עדכון מספר..." + הוספת "♻️עדכון גרסת הבוט♻️" אם טרם עודכן
      const curKb = payload.reply_markup.inline_keyboard;
      for (const row of curKb) {
        for (const btn of row) {
        if (btn.callback_data === 'help_changelog' || btn.callback_data === 'ver_current_info') {
          btn.text = `🆕 עדכון מספר ${curUserVer}`;
          btn.callback_data = 'ver_current_info';
        }
        }
      }
      if (!curKb.some((r) => r.some((b) => b.url && b.url.includes('v4Hrdnpg0rI3MTk0')))) {
        curKb.unshift([{ text: '👑 קבוצת התמיכה של הבוט – צוות המייסדים', url: 'https://t.me/+v4Hrdnpg0rI3MTk0' }]);
      }
      if (!isUpgraded && !curKb.some((r) => r.some((b) => b.callback_data === 'ver_upgrade_user'))) {
        curKb.push([{ text: '♻️עדכון גרסת הבוט♻️', callback_data: 'ver_upgrade_user' }]);
      }
      }

      // 3. התאמת כל 5 קטגוריות התפריט לפי גרסת המשתמש/קבוצה
      if (payload.text.includes('*קטגוריה ')) {
      if (!isUpgraded) {
        payload.text = payload.text.replace(`(עדכון ${LATEST_VERSION})`, `(עדכון מספר ${curUserVer})`);
        payload.reply_markup.inline_keyboard = kb
        .map((row) => row.filter((btn) => !NEW_UPDATE_CALLBACKS.has(btn.callback_data)))
        .filter((row) => row.length > 0);
        payload.reply_markup.inline_keyboard.unshift([{ text: '♻️עדכון גרסת הבוט♻️ (פתיחת פקודות חדשות)', callback_data: 'ver_upgrade_user' }]);
      } else {
        if (payload.text.startsWith('🛡️ *קטגוריה 3') && !kb.some((r) => r.some((b) => b.callback_data === 'hcmd_info_cleanwelcome'))) {
        kb.splice(Math.max(0, kb.length - 1), 0, [{ text: '🧹 מחיקת ברוך הבא / אימות קודמים', callback_data: 'hcmd_info_cleanwelcome' }]);
        }
        if (payload.text.startsWith('⚙️ *קטגוריה 5') && !kb.some((r) => r.some((b) => b.callback_data === 'hcmd_info_devboard'))) {
        kb.splice(Math.max(0, kb.length - 1), 0, [
          { text: '📘 מדריך ותיעוד הבוט', callback_data: 'hcmd_info_docs' },
          { text: '🛠️ מה בפיתוח ובתיקונים', callback_data: 'hcmd_info_devboard' }
        ]);
        }
      }
      }

      // 5. הזרקת כפתורים לפאנל היוצר (/owner): היסטוריית עדכוני הבוט + שליחה לכל הקבוצות + לוח פיתוח
      if (payload.text.startsWith('👑 פאנל שליטה ראשי – יוצר הבוט')) {
      const hasApprovePhoneBtn = kb.some((r) => r.some((b) => b.callback_data === 'own_approve_phone_all'));
      if (!hasApprovePhoneBtn) {
        kb.unshift([{ text: '✅ אשר את כל המצטרפים שהתבקשו לשתף טלפון', callback_data: 'own_approve_phone_all' }]);
      }
      const hasDevBtn = kb.some((r) => r.some((b) => b.callback_data === 'devboard_open'));
      if (!hasDevBtn) {
        kb.unshift([{ text: '🛠️ לוח פקודות בפיתוח ובתיקונים', callback_data: 'devboard_open' }]);
      }
      const hasHistBtn = kb.some((r) => r.some((b) => b.callback_data === 'ver_history_open'));
      if (!hasHistBtn) {
        kb.unshift([{ text: '📜 היסטוריית עדכוני הבוט', callback_data: 'ver_history_open' }]);
      }
      const hasBcastGroups = kb.some((r) => r.some((b) => b.callback_data === 'bcast_groups_only'));
      if (!hasBcastGroups) {
        const bcastIdx = kb.findIndex((r) => r.some((b) => b.callback_data === 'own_bcast_users'));
        const newBtnRow = [{ text: '🏢 שליחת הודעה לכל הקבוצות (ללא שליחה למשתמשים)', callback_data: 'bcast_groups_only' }];
        if (bcastIdx >= 0) kb.splice(bcastIdx + 1, 0, newBtnRow);
        else kb.push(newBtnRow);
      }
      // הסרת כפתור שליחת הודעת עדכון לכולם כדי למנוע שליחה גורפת למשתמשים
      payload.reply_markup.inline_keyboard = kb.filter((r) => !r.some((b) => b.callback_data === 'own_announce_ver'));
      }

      if (payload.text.startsWith('🔐 *אימות אנושי למצטרפים') || payload.text.startsWith('⚙️ *פאנל הגדרות קבוצה')) {
      const hasClnJoin = kb.some((r) => r.some((b) => b.callback_data === 'clnjoin_open'));
      if (!hasClnJoin) {
        kb.push([{ text: '🧹 מחיקת ברוך הבא / אימות קודמים בכניסה', callback_data: 'clnjoin_open' }]);
      }
      }
    }

    // מחיקת הודעת ברוך הבא / אימות קודמת בכניסת משתמש חדש לפי בחירת מנהל הקבוצה
    if (payload.chat_id && String(payload.chat_id).startsWith('-')) {
      detectedVerify = method === 'sendMessage' && isVerifyMessagePayload(payload);
      detectedWelcome = isWelcomeMessagePayload(payload);
      if (detectedVerify || detectedWelcome) {
      const gData = await getGroupData(payload.chat_id);
      const mode = gData.cleanPrevJoinMode || 'off';
      if (detectedWelcome && (mode === 'welcome' || mode === 'both') && gData.lastWelcomeMsgId && gData.lastWelcomeMsgId !== payload.message_id) {
        await origCall('deleteMessage', { chat_id: payload.chat_id, message_id: gData.lastWelcomeMsgId }).catch(() => {});
        gData.lastWelcomeMsgId = null;
        await saveGroupData(payload.chat_id, gData);
      }
      if (detectedVerify && (mode === 'verify' || mode === 'both') && gData.lastVerifyMsgId) {
        await origCall('deleteMessage', { chat_id: payload.chat_id, message_id: gData.lastVerifyMsgId }).catch(() => {});
        gData.lastVerifyMsgId = null;
        await saveGroupData(payload.chat_id, gData);
      }
      }
    }
    }
  } catch (e) {}

  const res = await origCall(method, payload, ...rest);

  try {
    if (res?.message_id && payload?.chat_id && String(payload.chat_id).startsWith('-')) {
    if (detectedVerify || detectedWelcome) {
      const gData = await getGroupData(payload.chat_id);
      if (detectedVerify) gData.lastVerifyMsgId = res.message_id;
      if (detectedWelcome) {
      gData.lastWelcomeMsgId = res.message_id;
      if (gData.lastVerifyMsgId === res.message_id) gData.lastVerifyMsgId = null;
      }
      await saveGroupData(payload.chat_id, gData);
    }
    }
  } catch (e) {}

  return res;
    };
    bot.telegram.callApi = wrappedCallApi;
    const tgProto = Object.getPrototypeOf(bot.telegram);
    if (tgProto && !tgProto._volticProtoWrapped) {
  tgProto._volticProtoWrapped = true;
  tgProto.callApi = wrappedCallApi;
    }
  }

  // 2. לחיצה על "🆕 עדכון מספר..." -> מציג למשתמש מה חדש בגרסה שבה הוא נמצא כרגע!
  bot.action('ver_current_info', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    let curVer = LATEST_VERSION;
    if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)) {
  const gData = await getGroupData(ctx.chat.id);
  curVer = isFoundersChatId(ctx.chat.id) ? LATEST_VERSION : (gData.groupVersion || DEFAULT_PREV_USER_VERSION);
    } else if (ctx.from) {
  curVer = await getUserActiveVersion(ctx.from.id);
    }
    const verObj = VERSION_HISTORY[curVer] || VERSION_HISTORY[LATEST_VERSION];
    const rows = [];
    if (curVer !== LATEST_VERSION) {
  rows.push([{ text: '♻️עדכון גרסת הבוט♻️', callback_data: ctx.chat?.type === 'private' ? 'ver_upgrade_user' : 'grp_upgrade_ver' }]);
    }
    rows.push([{ text: '🔙 חזרה לתפריט הראשי', callback_data: 'help_main' }]);
    await ctx.editMessageText(verObj.text, {
  parse_mode: 'Markdown',
  reply_markup: { inline_keyboard: rows }
    }).catch(() => ctx.reply(verObj.text, {
  parse_mode: 'Markdown',
  reply_markup: { inline_keyboard: rows }
    }));
  });

  // 3. לחיצה על "♻️עדכון גרסת הבוט♻️" ע"י משתמש -> מעדכן אותו לגרסה החדשה וחושף את כל הפקודות החדשות!
  bot.action('ver_upgrade_user', async (ctx) => {
    if (!ctx.from) return;
    await setUserActiveVersion(ctx.from.id, LATEST_VERSION);
    bot._activeCtxUserVer = LATEST_VERSION;
    await ctx.answerCbQuery(`🎉 הבוט עודכן בהצלחה לגרסה ${LATEST_VERSION}!`, { show_alert: true }).catch(() => {});
    const verObj = VERSION_HISTORY[LATEST_VERSION];
    const msg =
  `🎉 *הבוט עודכן בהצלחה לגרסה החדשה (${LATEST_VERSION})!*\n` +
  `כל הפקודות והמערכות החדשות נפתחו עבורך בתפריט הבוט.\n\n` +
  `${verObj.text}`;
    const kb = {
  inline_keyboard: [
    [{ text: '📚 מעבר לתפריט הפקודות המעודכן', callback_data: 'help_main' }]
  ]
    };
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: kb })
  .catch(() => ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb }));
  });

  // 4. לחיצה על "♻️עדכון גרסת הבוט♻️" בקבוצה -> מנהל הקבוצה בלבד מאשר ומעדכן את הבוט בקבוצה!
  bot.action('grp_upgrade_ver', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return;
    if (!(await isGroupAdminCb(ctx))) {
  return ctx.answerCbQuery('⛔ רק מנהל הקבוצה יכול ללחוץ על הכפתור ולעדכן את גרסת הבוט בקבוצה!', { show_alert: true }).catch(() => {});
    }
    const gData = await getGroupData(ctx.chat.id);
    gData.groupVersion = LATEST_VERSION;
    await saveGroupData(ctx.chat.id, gData);
    if (ctx.from) {
  await setUserActiveVersion(ctx.from.id, LATEST_VERSION);
  bot._activeCtxUserVer = LATEST_VERSION;
    }
    await ctx.answerCbQuery(`🎉 הקבוצה עודכנה בהצלחה לגרסה ${LATEST_VERSION}!`, { show_alert: true }).catch(() => {});
    await ctx.editMessageText(
  `✅ *גרסת הבוט בקבוצה עודכנה בהצלחה ל-${LATEST_VERSION} ע"י המנהל ${ctx.from.first_name}!*\n` +
  `כל הפקודות והמערכות של העדכון החדש פעילות כעת בקבוצה.`,
  {
    parse_mode: 'Markdown',
    reply_markup: {
    inline_keyboard: [
      [{ text: `🆕 עדכון מספר ${LATEST_VERSION} (מה חדש?)`, callback_data: 'ver_current_info' }],
      [{ text: '📚 פתיחת תפריט הבוט', callback_data: 'help_main' }]
    ]
    }
  }
    ).catch(() => {});
  });

  // 5. כפתור "📜 היסטוריית עדכוני הבוט" בפאנל יוצר הבוט (/owner)
  bot.action('ver_history_open', async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    await ctx.answerCbQuery().catch(() => {});
    const s = await getGroupData('info_global_state');
    const uVers = Object.values(s.userVersions || {});
    const upgradedUsers = uVers.filter((v) => v === LATEST_VERSION).length + 1;
    const verKeys = Object.keys(VERSION_HISTORY).reverse();

    const summaryLines = verKeys.map((v, idx) => `${idx + 1}. 🔖 *${VERSION_HISTORY[v].title}* (${VERSION_HISTORY[v].date})`).join('\n');
    const text =
  `📜 *היסטוריית עדכוני הבוט – וולטיק מוד (ליוצר בלבד)*\n` +
  `📌 *גרסה אחרונה במערכת:* \`${LATEST_VERSION}\`\n` +
  `👥 *משתמשים שעדכנו לגרסה האחרונה:* ${upgradedUsers}\n\n` +
  `📚 *רשימת כל עדכוני הבוט:*\n${summaryLines}\n\n` +
  `👇 *לחץ על כל גרסה למטה כדי לצפות בפירוט המלא של אותו עדכון:*`;

    const rows = [];
    for (let i = 0; i < verKeys.length; i += 2) {
  const v1 = verKeys[i];
  const r = [{ text: `📜 עדכון מספר ${v1}`, callback_data: `ver_hist_item_${v1}` }];
  if (verKeys[i + 1]) {
    const v2 = verKeys[i + 1];
    r.push({ text: `📜 עדכון מספר ${v2}`, callback_data: `ver_hist_item_${v2}` });
  }
  rows.push(r);
    }
    rows.push([{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]);

    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } })
  .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }));
  });

  bot.action(/^ver_hist_item_(.+)$/, async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const ver = ctx.match[1];
    const item = VERSION_HISTORY[ver];
    if (!item) return ctx.answerCbQuery('גרסה לא נמצאה').catch(() => {});
    await ctx.answerCbQuery().catch(() => {});
    const kb = {
  inline_keyboard: [
    [{ text: '🔙 חזרה להיסטוריית העדכונים', callback_data: 'ver_history_open' }],
    [{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]
  ]
    };
    await ctx.editMessageText(item.text, { parse_mode: 'Markdown', reply_markup: kb })
  .catch(() => ctx.reply(item.text, { parse_mode: 'Markdown', reply_markup: kb }));
  });

  // קליטת הודעה מיוצר הבוט לשידור לכל הקבוצות בלבד (ללא משתמשים)
  bot.use(async (ctx, next) => {
    if (isCreator(ctx) && ctx.chat?.type === 'private' && ctx.message?.text) {
  const uid = String(ctx.from.id);
  const waitMode = creatorWaitState[uid];
  const txt = ctx.message.text.trim();
  if (waitMode && txt.startsWith('/')) {
    delete creatorWaitState[uid];
  } else if (waitMode === 'bcast_groups_only' && txt) {
    delete creatorWaitState[uid];
    const s = await getGroupData('owner_global');
    const gIds = Object.keys(s.groups || {});
    let gc = 0;
    for (const gid of gIds) {
    try {
      await safeSendGroupRich(ctx.telegram, gid, txt);
      gc++;
    } catch (e) {}
    }
    return await ctx.reply(
    `🏢 ההודעה נשלחה בהצלחה ל-*${gc} קבוצות בלבד* (ללא שליחה למשתמשים בפרטי)!`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]] }
    }
    );
  } else if ((waitMode === 'devb_add_dev' || waitMode === 'devb_add_fix') && txt) {
    delete creatorWaitState[uid];
    const itemType = waitMode === 'devb_add_fix' ? 'fix' : 'dev';
    const { s, items } = await loadDevBoard();
    items.push({ id: Date.now().toString(36), uid, cmd: txt.split(/\s+/)[0], text: txt.slice(0, 120), type: itemType });
    await saveGroupData('info_global_state', s);
    const view = buildDevBoardView(items, true);
    return await ctx.reply(`✅ נוסף בהצלחה ל${itemType === 'fix' ? 'רשימת התיקונים 🔧' : 'רשימת הפיתוח 🚀'}!

${view.text}`, {
    parse_mode: 'Markdown',
    reply_markup: view.reply_markup
    });
  }
    }
    return next();
  });

  // כפתור ופקודה לשליחת הודעה לכל הקבוצות בלבד (ללא שליחה למשתמשים)
  bot.action('bcast_groups_only', async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    creatorWaitState[String(ctx.from.id)] = 'bcast_groups_only';
    await ctx.answerCbQuery().catch(() => {});
    const txt =
  '🏢 *שליחת הודעה לכל הקבוצות (ללא שליחה למשתמשים)*\n\n' +
  'כתוב עכשיו את ההודעה שתרצה לשלוח לכל הקבוצות שבהן הבוט נמצא (תומך בעיצוב וכפתורים):';
    const kb = { inline_keyboard: [[{ text: '❌ ביטול וחזרה לפאנל היוצר', callback_data: 'bcast_groups_cancel' }]] };
    await ctx.editMessageText(txt, { parse_mode: 'Markdown', reply_markup: kb })
  .catch(() => ctx.reply(txt, { parse_mode: 'Markdown', reply_markup: kb }));
  });

  bot.action('bcast_groups_cancel', async (ctx) => {
    if (!isCreator(ctx)) return;
    delete creatorWaitState[String(ctx.from.id)];
    await ctx.answerCbQuery('בוטל').catch(() => {});
    await ctx.editMessageText('❌ השליחה לקבוצות בוטלה.', {
  reply_markup: { inline_keyboard: [[{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]] }
    }).catch(() => {});
  });

  bot.command(['broadcast_groups', 'owner_sendgroups'], async (ctx) => {
    if (!isCreator(ctx)) return;
    const msg = (ctx.message.text || '').replace(/^\/(broadcast_groups|owner_sendgroups)(@\S+)?\s*/i, '').trim();
    if (!msg) {
  return ctx.reply('שימוש: `/broadcast_groups [הודעה לכל הקבוצות בלבד ללא משתמשים]`', { parse_mode: 'Markdown' });
    }
    const s = await getGroupData('owner_global');
    let gc = 0;
    for (const gid of Object.keys(s.groups || {})) {
  try { await safeSendGroupRich(ctx.telegram, gid, msg); gc++; } catch (e) {}
    }
    await ctx.reply(`🏢 שודר בהצלחה ל-${gc} קבוצות בלבד (ללא שליחה למשתמשים).`);
  });

  // פקודה וכפתורים למנהל קבוצה: בחירה אם למחוק הודעת ברוך הבא / אימות קודמת בכניסת משתמש חדש
  bot.command(['clean_welcome', 'welcome_clean', 'clean_join'], async (ctx) => {
    if (!(await requireAdmin(ctx, '/clean_welcome'))) return;
    const data = await getGroupData(ctx.chat.id);
    const view = buildCleanJoinPanel(data.cleanPrevJoinMode || 'off');
    await ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup });
  });

  bot.action('clnjoin_open', async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) {
  return ctx.answerCbQuery('⛔ למנהלי הקבוצה בלבד!', { show_alert: true }).catch(() => {});
    }
    await ctx.answerCbQuery().catch(() => {});
    const data = await getGroupData(ctx.chat.id);
    const view = buildCleanJoinPanel(data.cleanPrevJoinMode || 'off');
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup })
  .catch(() => ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }));
  });

  bot.action(/^clnjoin_set_(welcome|verify|both|off)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) {
  return ctx.answerCbQuery('⛔ למנהלי הקבוצה בלבד!', { show_alert: true }).catch(() => {});
    }
    const mode = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    data.cleanPrevJoinMode = mode;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('✅ ההגדרה נשמרה!').catch(() => {});
    const view = buildCleanJoinPanel(mode);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });

  // פקודה ליוצר הבוט לצפייה בהיסטוריית עדכוני הבוט (/owner_versions או /version_history)
  bot.command(['owner_versions', 'version_history'], async (ctx) => {
    if (!isCreator(ctx)) return;
    const s = await getGroupData('info_global_state');
    const upgradedUsers = Object.values(s.userVersions || {}).filter((v) => v === LATEST_VERSION).length + 1;
    const verKeys = Object.keys(VERSION_HISTORY).reverse();
    const summaryLines = verKeys.map((v, idx) => `${idx + 1}. 🔖 *${VERSION_HISTORY[v].title}* (${VERSION_HISTORY[v].date})`).join('\n');
    const rows = [];
    for (let i = 0; i < verKeys.length; i += 2) {
  const r = [{ text: `📜 עדכון מספר ${verKeys[i]}`, callback_data: `ver_hist_item_${verKeys[i]}` }];
  if (verKeys[i + 1]) r.push({ text: `📜 עדכון מספר ${verKeys[i + 1]}`, callback_data: `ver_hist_item_${verKeys[i + 1]}` });
  rows.push(r);
    }
    rows.push([{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]);
    await ctx.reply(
  `📜 *היסטוריית עדכוני הבוט – וולטיק מוד (ליוצר בלבד)*\n📌 *גרסה אחרונה:* \`${LATEST_VERSION}\` | 👥 *עדכנו:* ${upgradedUsers}\n\n${summaryLines}`,
  { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }
    );
  });

  // כפתורי הסבר מתוך הקטגוריות לפקודות החדשות (/clean_welcome ו-/dev)
  bot.action('hcmd_info_cleanwelcome', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const txt =
  '🧹 *מחיקת ברוך הבא / אימות קודמים (/clean_welcome)*\n\n' +
  '⌨️ *מה לכתוב:*\n`/clean_welcome`\n\n' +
  '🤖 *מה הבוט ישיב:*\nפותח פאנל כפתורים למנהל הקבוצה לבחירה האם למחוק אוטומטית הודעת ברוך הבא קודמת, הודעת אימות קודמת, גם וגם, או לא למחוק בכל כניסת משתמש חדש.';
    await ctx.editMessageText(txt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 חזרה', callback_data: 'help_protection' }]] } }).catch(() => {});
  });

  bot.action('hcmd_info_devboard', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const txt =
  '🛠️ *לוח מה בפיתוח ובתיקונים (/dev)*\n\n' +
  '⌨️ *מה לכתוב:*\n`/dev` (או `/status` / `/roadmap`)\n\n' +
  '🤖 *מה הבוט ישיב:*\nמציג בזמן אמת אילו פקודות חדשות נמצאות כרגע בפיתוח (🚀) ואילו מערכות נמצאות בתיקונים ושדרוג (🔧).';
    await ctx.editMessageText(txt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🛠️ פתח עכשיו את לוח הפיתוח', callback_data: 'devboard_open' }], [{ text: '🔙 חזרה', callback_data: 'help_system' }]] } }).catch(() => {});
  });

  bot.action('hcmd_info_docs', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const txt =
  '📘 *מדריך הפעלה ותיעוד הבוט (/docs)*\n\n' +
  '⌨️ *מה לכתוב:*\n`/docs` (או `/guide` / `/manual`)\n\n' +
  '🤖 *מה הבוט ישיב:*\nפותח את מרכז התיעוד של וולטיק מוד עם מדריך חיבור לקבוצה, הרשאות אדמין חובה, הגדרות מומלצות וקישור לאתר התיעוד הרשמי.';
    await ctx.editMessageText(txt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📘 פתח עכשיו את מדריך הבוט', callback_data: 'docs_main' }], [{ text: '🌐 לאתר התיעוד הרשמי', url: DOCS_WEB_URL }], [{ text: '🔙 חזרה', callback_data: 'help_system' }]] } }).catch(() => {});
  });

  // פקודות וכפתורים למרכז התיעוד והמדריך של הבוט (/docs, /guide, /manual)
  bot.command(['docs', 'guide', 'manual'], async (ctx) => {
    const view = buildDocsView('main');
    await ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup });
  });

  bot.action('docs_main', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const view = buildDocsView('main');
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup })
  .catch(() => ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }));
  });

  bot.action(/^docs_sec_(setup|perms|recommended|systems)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const sec = ctx.match[1];
    const view = buildDocsView(sec);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup })
  .catch(() => ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }));
  });

  // פקודת /cleanservice לניקוי אוטומטי של הודעות שירות בקבוצה (הצטרפות/עזיבה)
  bot.command(['cleanservice', 'clean_service'], async (ctx) => {
    if (!(await requireAdmin(ctx, '/cleanservice [on | off]'))) return;
    const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    if (!['on', 'off'].includes(arg)) {
  data.cleanService = !data.cleanService;
    } else {
  data.cleanService = arg === 'on';
    }
    await saveGroupData(ctx.chat.id, data);
    await ctx.reply(`🧼 ניקוי אוטומטי של הודעות שירות (הצטרפות ועזיבה): *${data.cleanService ? 'פעיל (ON)' : 'כבוי (OFF)'}*`, { parse_mode: 'Markdown' });
  });

  // פקודות וכפתורים ללוח פיתוח ותיקונים (/dev, /status, /roadmap + /dev_add, /fix_add ליוצר)
  bot.command(['dev', 'status', 'roadmap', 'in_dev'], async (ctx) => {
    const { items } = await loadDevBoard();
    const view = buildDevBoardView(items, isCreator(ctx));
    await ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup });
  });

  bot.command(['dev_add', 'fix_add'], async (ctx) => {
    if (!isCreator(ctx)) return;
    const isFixCmd = /^\/fix_add/i.test((ctx.message.text || '').trim());
    const raw = (ctx.message.text || '').replace(/^\/(dev_add|fix_add)(@\S+)?\s*/i, '').trim();
    if (!raw) return ctx.reply(`שימוש: \`/${isFixCmd ? 'fix_add' : 'dev_add'} [שם הפקודה והתיאור]\``, { parse_mode: 'Markdown' });
    const { s, items } = await loadDevBoard();
    items.push({ id: Date.now().toString(36), uid: String(ctx.from.id), cmd: raw.split(/\s+/)[0], text: raw.slice(0, 120), type: isFixCmd ? 'fix' : 'dev' });
    await saveGroupData('info_global_state', s);
    const view = buildDevBoardView(items, true);
    await ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup });
  });

  bot.action(['devb_add_dev', 'devb_add_fix'], async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const mode = ctx.callbackQuery.data;
    creatorWaitState[String(ctx.from.id)] = mode;
    await ctx.answerCbQuery().catch(() => {});
    const label = mode === 'devb_add_fix' ? '🔧 הוספת פקודה לרשימת התיקונים' : '🚀 הוספת פקודה לרשימת הפיתוח';
    await ctx.editMessageText(
  `*${label}*\n\nכתוב עכשיו בצ׳אט את שם הפקודה והתיאור הקצר (למשל: \`/poll - מערכת סקרים חכמה\`):`,
  { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ ביטול וחזרה ללוח', callback_data: 'devboard_open' }]] } }
    ).catch(() => {});
  });

  bot.action('devboard_open', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const { items } = await loadDevBoard();
    const view = buildDevBoardView(items, isCreator(ctx));
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup })
  .catch(() => ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }));
  });

  bot.action(/^devb_flip_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const idx = parseInt(ctx.match[1], 10);
    const { s, items } = await loadDevBoard();
    if (!items[idx]) return ctx.answerCbQuery('לא נמצא').catch(() => {});
    items[idx].type = items[idx].type === 'fix' ? 'dev' : 'fix';
    await saveGroupData('info_global_state', s);
    await ctx.answerCbQuery('🔄 הועבר!').catch(() => {});
    const view = buildDevBoardView(items, true);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });

  bot.action(/^devb_del_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const idx = parseInt(ctx.match[1], 10);
    const { s, items } = await loadDevBoard();
    if (idx < 0 || idx >= items.length) return ctx.answerCbQuery('כבר הוסר').catch(() => {});
    const removed = items.splice(idx, 1)[0];
    await saveGroupData('info_global_state', s);
    await ctx.answerCbQuery(`🗑️ הוסר: ${removed.text.slice(0, 25)}`).catch(() => {});
    const view = buildDevBoardView(items, true);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });

  bot.action('devb_clear_all', async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const { s } = await loadDevBoard();
    s.devBoard.items = [];
    await saveGroupData('info_global_state', s);
    await ctx.answerCbQuery('🧹 הלוח נוקה!').catch(() => {});
    const view = buildDevBoardView([], true);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });


  // פקודה וכפתור ליוצר הבוט: אישור מיידי של כל המצטרפים שהבוט ביקש מהם לשתף מספר טלפון (/approve_phone_all)
  async function executeCreatorApproveAllPhone(ctx, specificGid = null) {
    const extraUids = Array.isArray(ctx._extraApproveUids) ? [...ctx._extraApproveUids] : [];
    const replyMsg = ctx.message?.reply_to_message;
    if (replyMsg) {
  if (replyMsg.from && !replyMsg.from.is_bot) extraUids.push(String(replyMsg.from.id));
  if (Array.isArray(replyMsg.new_chat_members)) {
    for (const nm of replyMsg.new_chat_members) if (nm && !nm.is_bot) extraUids.push(String(nm.id));
  }
  const kbStr = JSON.stringify(replyMsg.reply_markup || '');
  const m1 = kbStr.match(/fcnt_verifyme_(\d+)/);
  const m2 = kbStr.match(/ver_ok_(\d+)_/);
  if (m1) extraUids.push(m1[1]);
  if (m2) extraUids.push(m2[1]);
  if (m1 || m2) {
    await ctx.telegram.deleteMessage(ctx.chat.id, replyMsg.message_id).catch(() => {});
  }
    }

    if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type) && !specificGid) {
  const statusMsg = await ctx.reply('⏳ סורק ומאשר את כל המצטרפים בקבוצה שהתבקשו לשתף מספר טלפון...');
  const res = await approveAllPhonePendingInGroup(ctx.telegram, ctx.chat.id, extraUids);
  const namesLine = res.approvedNames.length ? `\n👥 *משתמשים שאושרו כעת:* ${res.approvedNames.slice(0, 20).join(', ')}` : '';
  return await ctx.telegram.editMessageText(
    ctx.chat.id,
    statusMsg.message_id,
    undefined,
    `✅ *האישור הגורף בקבוצה הושלם בהצלחה!*\n` +
    `• 🔓 *מצטרפים ששוחררו מחסימת אימות הטלפון:* ${res.approvedCount}\n` +
    `• 🔍 *חברים שנבדקו בקבוצה:* ${res.totalChecked}${namesLine}\n\n` +
    `💡 בנוסף, כל כפתור אימות טלפון ישן בקבוצה יאשר מעתה את המשתמש בלחיצה אחת ללא בקשת מספר טלפון!`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});
    }

    const ownState = await getGroupData('owner_global');
    const targetGids = specificGid ? [String(specificGid)] : Object.keys(ownState.groups || {});
    if (!targetGids.length) {
  return ctx.reply('📭 לא נמצאו קבוצות רשומות במערכת. שלח את הפקודה `/approve_phone_all` ישירות בתוך הקבוצה הרצויה.', { parse_mode: 'Markdown' });
    }

    let totalApproved = 0;
    let groupsTouched = 0;
    const summaryRows = [];

    for (const gid of targetGids) {
  try {
    const res = await approveAllPhonePendingInGroup(ctx.telegram, gid, extraUids);
    const gTitle = ownState.groups?.[gid]?.title || gid;
    if (res.approvedCount > 0) {
    totalApproved += res.approvedCount;
    groupsTouched++;
    summaryRows.push(`• *${gTitle}:* אושרו ${res.approvedCount} מצטרפים (${res.approvedNames.slice(0, 8).join(', ')})`);
    }
  } catch (e) {}
    }

    const details = summaryRows.length
  ? `\n\n📋 *פירוט לפי קבוצות:*\n${summaryRows.join('\n')}`
  : `\n\n💡 כל המשתמשים המוכרים בקבוצות כבר מאושרים! (אם יש הודעת אימות טלפון ישנה בקבוצה, לחיצה עליה או שליחת \`/approve_phone_all\` בהשבה אליה תאשר את המשתמש מיד).`;

    return ctx.reply(
  `✅ *אישור כל המצטרפים שהתבקשו לשתף מספר טלפון הושלם!*\n` +
  `• 🏢 *קבוצות שנסרקו:* ${targetGids.length}\n` +
  `• 🔓 *סה"כ מצטרפים שאושרו ושוחררו לכתיבה:* ${totalApproved}${details}`,
  {
    parse_mode: 'Markdown',
    reply_markup: ctx.chat?.type === 'private' ? { inline_keyboard: [[{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]] } : undefined
  }
    );
  }

  bot.command(['approve_phone_all', 'approve_all', 'unmute_phone', 'owner_approve_phone'], async (ctx) => {
    if (!isCreator(ctx)) {
  return ctx.reply('⛔ פקודה זו מיועדת ליוצר הבוט בלבד.');
    }
    const args = (ctx.message?.text || '').trim().split(/\s+/).slice(1);
    const argGid = args.find((a) => /^-\d+$/.test(a)) || null;
    ctx._extraApproveUids = args.filter((a) => /^\d+$/.test(a));
    await executeCreatorApproveAllPhone(ctx, argGid);
  });

  bot.action('own_approve_phone_all', async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    await ctx.answerCbQuery('⏳ סורק ומאשר מצטרפים בכל הקבוצות...').catch(() => {});
    await executeCreatorApproveAllPhone(ctx, null);
  });

  // 24. /rules + /setrules - הצגת והגדרת חוקי הקבוצה (במצב שקט או פומבי + מחיקה אוטומטית של הודעות ההגדרה)
  bot.command('rules', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') {
  return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
    }
    try {
  const data = await getGroupData(ctx.chat.id);
  const cleaned = cleanRulesText(data.rules);
  if (cleaned !== data.rules) {
    data.rules = cleaned;
    await saveGroupData(ctx.chat.id, data);
  }

  const mode = data.rulesMode || 'public';
  const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
  const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
  const btnText = data.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';

  if (mode === 'silent') {
    await ctx.deleteMessage().catch(() => {});
    return await ctx.reply('📜 *חוקי הקבוצה זמינים לקריאה בפרטי:*', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: btnText, url: rulesUrl }]]
    }
    });
  }

  await sendFormattedMessage(ctx, `📜 *חוקי הקבוצה:*\n\n${cleaned}`, {
    name: ctx.from?.first_name || 'חבר'
  });
    } catch (err) {
  await ctx.reply('❌ שגיאה בהצגת חוקי הקבוצה. לעזרה: /help');
    }
  });

  bot.command('setrules', async (ctx) => {
    if (!(await requireAdmin(ctx, '/setrules [טקסט החוקים + כפתורים]'))) return;
    try {
  const adminMsgId = ctx.message?.message_id;
  const replyMsg = ctx.message?.reply_to_message;
  let rawInput = (ctx.message?.text || '').replace(/^[\s\u200B-\u200F]*\/setrules(@\S+)?\s*/i, '');
  if (!rawInput.trim() && replyMsg && (replyMsg.text || replyMsg.caption)) {
    rawInput = replyMsg.text || replyMsg.caption;
  }

  let explicitMode = null;
  if (/^(שקט|silent)(\s+|\n|$)/i.test(rawInput.trim())) {
    explicitMode = 'silent';
    rawInput = rawInput.trim().replace(/^(שקט|silent)\s*/i, '');
  } else if (/^(פומבי|public)(\s+|\n|$)/i.test(rawInput.trim())) {
    explicitMode = 'public';
    rawInput = rawInput.trim().replace(/^(פומבי|public)\s*/i, '');
  }

  const text = cleanRulesText(rawInput);
  if (!text) {
    return ctx.reply(
    '⚠️ *שימוש בפקודה /setrules:*\n' +
    '`/setrules *חוקי הקבוצה:*\n1. שיח מכבד\n{{לערוץ הראשי}{https://t.me/telegram}}`\n\n' +
    '💡 הבוט ימחק מיד את הודעת ההגדרה ויאפשר לך לבחור בין *מצב שקט* ל*מצב פומבי*.',
    { parse_mode: 'Markdown' }
    );
  }

  const preview = await sendFormattedMessage(ctx, text, { name: ctx.from.first_name || 'חבר' });
  if (!preview) return;

  if (adminMsgId) {
    await ctx.telegram.deleteMessage(ctx.chat.id, adminMsgId).catch(() => {});
  }
  if (preview && preview.message_id) {
    await ctx.telegram.deleteMessage(ctx.chat.id, preview.message_id).catch(() => {});
  }

  const data = await getGroupData(ctx.chat.id);
  data.rules = text;
  data.groupTitle = ctx.chat.title || data.groupTitle || '';
  if (explicitMode) data.rulesMode = explicitMode;
  await saveGroupData(ctx.chat.id, data);

  if (explicitMode === 'silent') {
    const tempMsg = await ctx.reply('🤫 חוקי הקבוצה הוגדרו ונשמרו באופן שקט.');
    setTimeout(() => {
    ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id).catch(() => {});
    }, 3000);
    return;
  }

  if (explicitMode === 'public') {
    const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
    const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
    const btnText = data.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';
    return await ctx.reply('📢 *חוקי הקבוצה עודכנו!* לחצו על הכפתור למטה לקריאת החוקים:', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: btnText, url: rulesUrl }]] }
    });
  }

  await ctx.reply(
    '✅ *חוקי הקבוצה נשמרו והודעות הטקסט נמחקו מהצ׳אט!*\n\n' +
    'איך תרצה להגדיר את חוקי הקבוצה כעת?',
    {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
      [
        { text: '🤫 באופן שקט', callback_data: 'setrules_mode_silent' },
        { text: '📢 באופן פומבי', callback_data: 'setrules_mode_public' }
      ]
      ]
    }
    }
  );
    } catch (err) {
  await ctx.reply('❌ שגיאה בעדכון חוקי הקבוצה. לעזרה: /help');
    }
  });

  bot.action(/^setrules_mode_(silent|public)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) {
  return ctx.answerCbQuery('⛔ פעולה זו מיועדת למנהלי הקבוצה בלבד!', { show_alert: true }).catch(() => {});
    }
    const mode = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    data.rulesMode = mode;
    data.rules = cleanRulesText(data.rules);
    await saveGroupData(ctx.chat.id, data);

    if (mode === 'silent') {
  await ctx.answerCbQuery('🤫 חוקי הקבוצה הוגדרו באופן שקט!').catch(() => {});
  await ctx.deleteMessage().catch(() => {});
  return;
    }

    await ctx.answerCbQuery('📢 חוקי הקבוצה הוגדרו באופן פומבי!').catch(() => {});
    const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
    const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
    const btnText = data.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';
    await ctx.editMessageText(
  '📢 *חוקי הקבוצה עודכנו והוגדרו באופן פומבי!*\nלצפייה בחוקי הקבוצה לחצו על הכפתור למטה או שלחו `/rules`:',
  {
    parse_mode: 'Markdown',
    reply_markup: {
    inline_keyboard: [[{ text: btnText, url: rulesUrl }]]
    }
  }
    ).catch(() => {});
  });


  // 3. כפתור "ערעור" מתחת להודעת אזהרה + אישור/דחיית הערעור ע"י מנהלי הקבוצה
  bot.action(/^warn_appeal_(\d+)$/, async (ctx) => {
    const warnedUid = ctx.match[1];
    if (warnedUid !== '0' && String(ctx.from.id) !== String(warnedUid) && !isCreator(ctx)) {
  return ctx.answerCbQuery('⚠️ כפתור הערעור מיועד למשתמש שקיבל את האזהרה בלבד!', { show_alert: true }).catch(() => {});
    }
    const actualUid = warnedUid !== '0' ? warnedUid : String(ctx.from.id);
    await ctx.answerCbQuery('📩 בקשת הערעור נשלחה למנהלי הקבוצה!', { show_alert: true }).catch(() => {});
    const origText = ctx.callbackQuery?.message?.text || 'הודעת אזהרה';
    await ctx.editMessageText(
  `${origText}\n\n📩 *הוגש ערעור ע"י ${ctx.from.first_name}!*\nמנהלי הקבוצה – האם לאשר את הערעור ולאפס את האזהרה?`,
  {
    reply_markup: {
    inline_keyboard: [[
      { text: '✅ אשר ערעור ואפס אזהרות', callback_data: `warn_app_ok_${actualUid}` },
      { text: '❌ דחה ערעור', callback_data: `warn_app_no_${actualUid}` }
    ]]
    }
  }
    ).catch(() => {});
  });

  bot.action(/^warn_app_(ok|no)_(\d+)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) {
  return ctx.answerCbQuery('⛔ רק מנהלי הקבוצה יכולים לאשר או לדחות ערעור!', { show_alert: true }).catch(() => {});
    }
    const decision = ctx.match[1];
    const targetUid = ctx.match[2];
    const data = await getGroupData(ctx.chat.id);
    if (decision === 'ok') {
  if (data.warns) delete data.warns[targetUid];
  await saveGroupData(ctx.chat.id, data);
  await ctx.telegram.unbanChatMember(ctx.chat.id, Number(targetUid), { only_if_banned: true }).catch(() => {});
  await ctx.answerCbQuery('✅ הערעור אושר והאזהרות אופסו!').catch(() => {});
  await ctx.editMessageText(`✅ *הערעור אושר ע"י המנהל ${ctx.from.first_name}!* כל האזהרות של המשתמש אופסו.`).catch(() => {});
    } else {
  await ctx.answerCbQuery('❌ הערעור נדחה.').catch(() => {});
  await ctx.editMessageText(`❌ *הערעור נדחה ע"י המנהל ${ctx.from.first_name}.* האזהרה נשארת בתוקף.`).catch(() => {});
    }
  });

  // 5. דפדוף ורכישת 52 הפיצ'רים בחנות המייסדים (50 עד 35,000 נקודות)
  bot.action(/^vshop_page_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10) || 0;
    const uid = String(ctx.from.id);
    const fData = await getGroupData(FOUNDERS_CHAT_ID);
    const mem = fData?.fnd?.members?.[uid] || { points: 10, ownedFeatures: [] };
    const st = await getGroupData('info_global_state');
    const owned = Array.from(new Set([...(mem.ownedFeatures || []), ...(st.ownedFeatures?.[uid] || [])]));
    const view = buildFounderFeaturesShopView(owned, mem.points || 0, isCreator(ctx), page);
    await ctx.answerCbQuery().catch(() => {});
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });

  bot.action(/^vshop_feat_(\d+)_(\d+)$/, async (ctx) => {
    const featIdx = parseInt(ctx.match[1], 10);
    const page = parseInt(ctx.match[2], 10) || 0;
    const feat = FOUNDER_SHOP_FEATURES[featIdx];
    if (!feat) return ctx.answerCbQuery('פיצ׳ר לא נמצא').catch(() => {});

    const uid = String(ctx.from.id);
    const fData = await getGroupData(FOUNDERS_CHAT_ID);
    fData.fnd = fData.fnd || { members: {} };
    fData.fnd.members = fData.fnd.members || {};
    const mem = fData.fnd.members[uid] || { id: ctx.from.id, name: ctx.from.first_name || 'מייסד', points: 10, ownedFeatures: [] };
    mem.ownedFeatures = Array.isArray(mem.ownedFeatures) ? mem.ownedFeatures : [];

    const st = await getGroupData('info_global_state');
    st.ownedFeatures = st.ownedFeatures || {};
    st.ownedFeatures[uid] = Array.isArray(st.ownedFeatures[uid]) ? st.ownedFeatures[uid] : [];

    const alreadyOwned = isCreator(ctx) || mem.ownedFeatures.includes(feat.cmd) || st.ownedFeatures[uid].includes(feat.cmd);

    if (alreadyOwned) {
  await ctx.answerCbQuery(`✅ הפיצ'ר /${feat.cmd} כבר פתוח אצלך! מפעיל הדגמה...`).catch(() => {});
  return await ctx.reply(
    `${feat.name} | 🌟 *${ctx.from.first_name}*\n\n${feat.effect}\n\n💡 *להפעלה בכל קבוצה או בקבוצת המייסדים שלח:* \`/${feat.cmd}\``,
    { parse_mode: 'Markdown' }
  );
    }

    if ((mem.points || 0) < feat.price) {
  return ctx.answerCbQuery(
    `❌ חסרות לך נקודות מייסד לרכישת "${feat.name}"!\nמחיר: ${feat.price.toLocaleString()} נק׳ | ברשותך: ${(mem.points || 0).toLocaleString()} נק׳.`,
    { show_alert: true }
  ).catch(() => {});
    }

    mem.points -= feat.price;
    mem.ownedFeatures.push(feat.cmd);
    fData.fnd.members[uid] = mem;
    await saveGroupData(FOUNDERS_CHAT_ID, fData);

    st.ownedFeatures[uid].push(feat.cmd);
    await saveGroupData('info_global_state', st);

    await ctx.answerCbQuery(`🎉 תתחדש! רכשת את ${feat.name}!`, { show_alert: true }).catch(() => {});
    const owned = Array.from(new Set([...mem.ownedFeatures, ...st.ownedFeatures[uid]]));
    const view = buildFounderFeaturesShopView(owned, mem.points, false, page);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});

    await ctx.reply(
  `🛍️ *רכישת פיצ'ר חדשה בחנות המייסדים!*\n` +
  `🌟 המייסד *${ctx.from.first_name}* רכש את הפיצ'ר **${feat.name}** ב-*${feat.price.toLocaleString()} נקודות*!\n\n` +
  `🔓 *הפקודה שנפתחה:* \`/${feat.cmd}\`\n` +
  `🌍 *איפה היא עובדת?* מעכשיו הפקודה הזו עובדת לך **בכל קבוצה** שבה הבוט נמצא וגם **בקבוצת המייסדים**!`,
  { parse_mode: 'Markdown' }
    );
  });

  bot.action('addcmd_wiz_cancel', async (ctx) => {
    const key = `${ctx.chat?.id}:${ctx.from?.id}`;
    delete addcmdWizards[key];
    await ctx.answerCbQuery('בוטל').catch(() => {});
    await ctx.editMessageText('❌ הוספת הפקודה המותאמת בוטלה.').catch(() => {});
  });

  // 6. פקודות מותאמות אישית לקבוצה (/addcmd שאלה: [שם] תשובה: [תוכן] + אשף דו-שלבי כמו "הצעה לשיפור")
  bot.command('addcmd', async (ctx) => {
    if (!(await requireAdmin(ctx, '/addcmd שאלה: [שם] תשובה: [תוכן]'))) return;
    try {
  const raw = (ctx.message.text || '').replace(/^\/addcmd(@\S+)?\s*/i, '').trim();

  // אם המנהל שלח /addcmd לבד -> פתח תהליך דו-שלבי בדיוק כמו "הצעה לשיפור" (שלב 1: שאלה -> שלב 2: תשובה)
  if (!raw) {
    addcmdWizards[`${ctx.chat.id}:${ctx.from.id}`] = { step: 1 };
    return await ctx.reply(
    `➕ *הוספת פקודה מותאמת אישית לקבוצה*\n\n` +
    `❓ *שלב 1 מתוך 2 – שאלה (שם הפקודה):*\n` +
    `איזו שאלה או פקודה תרצה להוסיף? כתוב אותה עכשיו בהודעה\n` +
    `_(או שלח בשורה אחת: \`/addcmd שאלה: [שם] תשובה: [תוכן]\`)_:`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ ביטול', callback_data: 'addcmd_wiz_cancel' }]] }
    }
    );
  }

  let cmdName = '';
  let cmdContent = '';

  // תמיכה בפורמט: /addcmd שאלה: [שם] תשובה: [תוכן]
  const qaMatch = raw.match(/^שאלה\s*:\s*([\s\S]+?)\s+תשובה\s*:\s*([\s\S]+)$/i);
  if (qaMatch) {
    cmdName = qaMatch[1].trim().replace(/^\//, '').toLowerCase();
    cmdContent = qaMatch[2].trim();
  } else {
    const firstSpace = raw.search(/\s/);
    if (firstSpace === -1) {
    addcmdWizards[`${ctx.chat.id}:${ctx.from.id}`] = { step: 2, question: raw.replace(/^\//, '').toLowerCase() };
    return await ctx.reply(
      `💬 *שלב 2 מתוך 2 – הגדרת התשובה:*\n` +
      `מה הבוט צריך לענות כשמישהו יכתוב *"\`${raw}\`"*? כתוב עכשיו את התשובה:`,
      {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ ביטול', callback_data: 'addcmd_wiz_cancel' }]] }
      }
    );
    }
    cmdName = raw.slice(0, firstSpace).replace(/^\//, '').toLowerCase();
    cmdContent = raw.slice(firstSpace + 1).trim();
  }

  const preview = await sendFormattedMessage(ctx, cmdContent, { name: ctx.from.first_name || 'חבר' });
  if (!preview) return;

  const data = await getGroupData(ctx.chat.id);
  data.customCommands = data.customCommands || {};
  data.customCommands[cmdName] = cmdContent;
  const slug = cmdName.split(/\s+/)[0].replace(/^\//, '');
  if (slug) data.customCommands[slug] = cmdContent;
  await saveGroupData(ctx.chat.id, data);
  await ctx.reply(
    `✅ *הפקודה המותאמת אישית נשמרה בהצלחה!*\n` +
    `❓ *שאלה:* \`/${slug}\` (או \`${cmdName}\`)\n` +
    `💬 *תשובה:* מוצגת בתצוגה המקדימה מעל.`,
    { parse_mode: 'Markdown' }
  );
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
