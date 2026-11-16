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

        // 4. בקבוצות (חוץ מקבוצת המייסדים): אם הקבוצה עדיין לא עודכנה לגרסה החדשה ומנסים להפעיל את הבוט -> הצג כפתור "♻️עדכון גרסת הבוט♻️" למנהל!
        if (isGroup && !isFoundersChatId(cid)) {
          const gData = await getGroupData(cid);
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

  // פקודות מותאמות אישית לקבוצה (/addcmd, /delcmd, /cmds) עם תמיכה בעיצוב וכפתורים
  bot.command('addcmd', async (ctx) => {
    if (!(await requireAdmin(ctx, '/addcmd [שם פקודה] [תוכן מעוצב + כפתורים]'))) return;
    try {
      const raw = (ctx.message.text || '').replace(/^\/addcmd(@\S+)?\s*/i, '');
      const firstSpace = raw.search(/\s/);
      if (firstSpace === -1) {
        return ctx.reply(
          '⚠️ שימוש: `/addcmd שם_פקודה תוכן ההודעה המעוצבת`\nלדוגמה:\n`/addcmd site *האתר שלנו:*\n{{כניסה לאתר}{https://google.com}}`',
          { parse_mode: 'Markdown' }
        );
      }
      const cmdName = raw.slice(0, firstSpace).replace(/^\//, '').toLowerCase();
      const cmdContent = raw.slice(firstSpace + 1).trim();
      const preview = await sendFormattedMessage(ctx, cmdContent, { name: ctx.from.first_name || 'חבר' });
      if (!preview) return;

      const data = await getGroupData(ctx.chat.id);
      data.customCommands = data.customCommands || {};
      data.customCommands[cmdName] = cmdContent;
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`✅ הפקודה המותאמת \`/${cmdName}\` נשמרה! (מעל מופיעה תצוגה מקדימה)`, { parse_mode: 'Markdown' });
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
