const { getGroupData, saveGroupData, sendFormattedMessage } = require('./utils');

const CREATOR_ID = 1773089386;
const FOUNDERS_CHAT_ID = '-1004417781995';
const FOUNDERS_VERSION = '1.2.0-Founders';

// בדיקה קשיחה שהפקודה מורצת אך ורק בקבוצת צוות המייסדים (-1004417781995)
function isFoundersGroup(ctx) {
  const cid = String(ctx.chat?.id || '');
  return cid === FOUNDERS_CHAT_ID || cid === '-4417781995' || cid.endsWith('4417781995');
}

function isCreator(ctx) {
  return Number(ctx.from?.id) === CREATOR_ID;
}

function getIsraelDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

function getFounderRankName(pts) {
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
  if (!f.members[uid]) {
    const nextNum = Object.keys(f.members).length + 1;
    f.members[uid] = {
      id: user.id,
      name: user.first_name || 'מייסד',
      username: user.username ? `@${user.username}` : '',
      number: nextNum,
      points: 10,
      ideasApproved: 0,
      bugsFixed: 0,
      title: 'חבר צוות המייסדים',
      streak: 0,
      lastCheckin: ''
    };
  } else {
    f.members[uid].name = user.first_name || f.members[uid].name;
    if (user.username) f.members[uid].username = `@${user.username}`;
  }
  return f.members[uid];
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
  `שלח בקבוצה: \`/founders_announce\``;

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
  { id: 'idea', label: '💡 הצעת רעיון', info: '💡 *העלאת רעיון לפיתוח בבוט*\n• *שימוש:* `/idea [תיאור הרעיון שלך]`\nהרעיון יפורסם עם כפתורי הצבעה לכל הצוות וכפתור אישור ליוצר!' },
  { id: 'bug', label: '🐛 דיווח באג', info: '🐛 *דיווח על תקלה או באג בבוט*\n• *שימוש:* `/bug [תיאור התקלה]`\nכשבאג שדיווחת מתוקן ע"י היוצר, תקבל אוטומטית +20 נקודות מייסד!' },
  { id: 'founder', label: '🪪 תעודת מייסד', info: '🪪 *הצגת תעודת המייסד הרשמית שלך*\n• *שימוש:* `/founder` (או בהשבה לחבר אחר בצוות)' },
  { id: 'rank', label: '📈 דרגות מייסדים', info: '📈 *סולם הדרגות של צוות המייסדים*\n• *שימוש:* `/rank`\nמציג את הדרגה שלך וכמה נקודות חסרות לך לדרגה הבאה!' },
  { id: 'title', label: '🏷️ בחירת תואר אישי', info: '🏷️ *קביעת תואר כבוד בתעודת המייסד שלך*\n• *שימוש:* `/title [התואר שלך]`\nלמשל: `/title אדריכל פקודות ראשי`' },
  { id: 'halloffame', label: '🏆 היכל התהילה', info: '🏆 *5 המייסדים המובילים של וולטיק מוד*\n• *שימוש:* `/halloffame`' },
  { id: 'credits', label: '🏅 היכל הקרדיטים', info: '🏅 *רשימת הפקודות שהוצעו ע"י חברי צוות המייסדים*\n• *שימוש:* `/credits`' },
  { id: 'mvp', label: '⭐ מייסד השבוע', info: '⭐ *הצגת המייסד המוביל והמשפיע ביותר השבוע*\n• *שימוש:* `/mvp`' },
  { id: 'checkin', label: '🔥 התפקדות יומית', info: '🔥 *צ׳ק-אין יומי לצוות המייסדים (+5 נקודות ורצף ימים)*\n• *שימוש:* `/checkin`' },
  { id: 'mission', label: '📋 משימת הצוות', info: '📋 *צפייה במשימה הנוכחית של צוות המייסדים ואישור ביצוע (+10 נק׳)*\n• *שימוש:* `/mission`' },
  { id: 'preview', label: '🎨 הדמיית פקודה', info: '🎨 *הדגמה חיה של הודעת בוט עם עיצוב וכפתורים*\n• *שימוש:* `/preview *טקסט לדוגמה*\n{{כפתור}{https://t.me/VolticMod_bot}}`' },
  { id: 'gold', label: '🪙 רעיונות זהב', info: '🪙 *לוח רעיונות הזהב של הקבוצה*\n• *לשמירת הודעה מהצ׳אט:* השב להודעה עם `/gold`\n• *לצפייה בכל רעיונות הזהב:* שלח `/gold`' },
  { id: 'goal', label: '🎯 יעד הצמיחה', info: '🎯 *מד התקדמות הקבוצות והמשתמשים של וולטיק מוד*\n• *שימוש:* `/goal`' },
  { id: 'sharebot', label: '🔗 שיתוף הבוט', info: '🔗 *קבלת כרטיס שיתוף מוכן עם כפתור להוספת הבוט לקבוצות*\n• *שימוש:* `/sharebot`' },
  { id: 'ask', label: '❓ שאלה ליוצר', info: '❓ *שליחת שאלה בולטת ישירות ליוצר הבוט*\n• *שימוש:* `/ask [השאלה שלך]`' },
  { id: 'feedback_bot', label: '⭐ דירוג הבוט', info: '⭐ *דירוג העדכונים וחוויית המשתמש בבוט (1-5 כוכבים)*\n• *שימוש:* `/feedback_bot`' },
  { id: 'award', label: '🎖️ הענקת מדליה', info: '🎖️ *הענקת נקודות הצטיינות למייסד (ליוצר הבוט בלבד)*\n• *שימוש בהשבה להודעה:* `/award [נקודות]`' }
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

module.exports = function registerFoundersCommands(bot) {
  // פרסום אוטומטי חד-פעמי של עדכון המייסדים אך ורק בקבוצת צוות המייסדים (-1004417781995)
  bot.use(async (ctx, next) => {
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

  // 18. /founders - תפריט קבוצת מייסדי הבוט + שליחת מדריך פקודות היוצר לפרטי של היוצר!
  bot.command(['founders', 'founders_menu'], async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    ensureMember(f, ctx.from);
    await saveGroupData(FOUNDERS_CHAT_ID, data);

    // שליחת הודעה לפרטי של יוצר הבוט עם כל הפקודות שעובדות רק לו בקבוצת המייסדים!
    const triggerName = ctx.from?.first_name || 'משתמש';
    await ctx.telegram.sendMessage(
      CREATOR_ID,
      `🔔 *${triggerName}* פתח כעת את תפריט צוות המייסדים (\`/founders\`).\n\n${CREATOR_SECRET_FOUNDERS_GUIDE}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});

    await ctx.reply(
      `👑 *פאנל צוות המייסדים – וולטיק מוד*\nבחר כלי או פקודה מהכפתורים למטה (פעיל אך ורק בקבוצת המייסדים):`,
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
        `👑 *פאנל צוות המייסדים – וולטיק מוד*\nבחר כלי או פקודה מהכפתורים למטה (פעיל אך ורק בקבוצת המייסדים):`,
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
    m.points += 5;
    const iid = Date.now().toString(36);
    f.ideas[iid] = { authorId: ctx.from.id, authorName: m.name, text, up: [ctx.from.id], down: [], approved: false };
    await saveGroupData(FOUNDERS_CHAT_ID, data);

    await ctx.reply(
      `💡 *הצעת פיתוח חדשה מצוות המייסדים!*\n` +
      `👤 *מאת:* ${m.name} (מייסד #${m.number})\n` +
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
      const author = f.members[String(idea.authorId)];
      if (author) {
        author.points = (author.points || 0) + 25;
        author.ideasApproved = (author.ideasApproved || 0) + 1;
      }
      f.credits.push({ name: idea.authorName, cmd: idea.text.slice(0, 50) });
      await saveGroupData(FOUNDERS_CHAT_ID, data);
      await ctx.answerCbQuery('✅ הרעיון אושר!').catch(() => {});
      return ctx.editMessageText(
        `✅ *רעיון אושר לפיתוח ע"י יוצר הבוט!*\n👤 *מאת:* ${idea.authorName} (קיבל +25 נקודות מייסד ונכנס להיכל הקרדיטים!)\n📝 *הרעיון:* ${idea.text}\n👍 תומכים: ${idea.up.length}`,
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

    await ctx.reply(
      `🐛 *דיווח באג #${bid} – צוות המייסדים*\n👤 *מדווח:* ${m.name}\n🔍 *תיאור:* ${text}`,
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
    const author = f.members[String(bug.authorId)];
    if (author) {
      author.points = (author.points || 0) + 20;
      author.bugsFixed = (author.bugsFixed || 0) + 1;
    }
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.answerCbQuery('🔧 סומן כטופל!').catch(() => {});
    await ctx.editMessageText(
      `✅ *באג #${bid} תוקן ע"י יוצר הבוט!*\n👤 *מדווח:* ${bug.authorName} (זוכה ב-+20 נקודות מייסד!)\n🔍 *תיאור:* ${bug.text}`,
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

  // 4. /founder - תעודת מייסד אישית
  bot.command('founder', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const targetUser = ctx.message.reply_to_message?.from || ctx.from;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const m = ensureMember(f, targetUser);
    await saveGroupData(FOUNDERS_CHAT_ID, data);

    await ctx.reply(
      `🪪 *תעודת מייסד רשמית – וולטיק מוד*\n\n` +
      `👤 *שם:* ${m.name} (מייסד #${m.number})\n` +
      `🏷️ *תואר אישי:* ${m.title}\n` +
      `🎖️ *דרגה:* ${getFounderRankName(m.points)}\n` +
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

    await ctx.reply(
      `📈 *סולם הדרגות של צוות המייסדים:*\n\n` +
      `• 🌱 *מייסד מתלמד:* 0 – 29 נקודות\n` +
      `• ⚡ *מייסד פעיל:* 30 – 79 נקודות\n` +
      `• 🧠 *אדריכל פקודות:* 80 – 149 נקודות\n` +
      `• 👑 *מייסד על:* 150+ נקודות\n\n` +
      `🔹 *המצב שלך:* ${m.points} נקודות (${getFounderRankName(m.points)})\n` +
      `💡 *איך צוברים נקודות?* הצעת רעיונות (\`/idea\`), מציאת באגים (\`/bug\`), התפקדות יומית (\`/checkin\`) וביצוע משימות (\`/mission\`)!`,
      { parse_mode: 'Markdown' }
    );
  });

  // 6. /halloffame - היכל התהילה של 5 המייסדים המובילים
  bot.command('halloffame', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const top = Object.values(f.members).sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 5);
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const rows = top.map((m, i) => `${medals[i]} *${m.name}* (${m.title}) – *${m.points} נק׳* | ${getFounderRankName(m.points)}`).join('\n');
    await ctx.reply(`🏆 *היכל התהילה – צוות המייסדים של וולטיק מוד:*\n\n${rows || 'עדיין אין נתונים.'}`, { parse_mode: 'Markdown' });
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
    await ctx.reply(`🏷️ התואר האישי שלך בתעודת המייסד עודכן ל: *"${newTitle}"*!`, { parse_mode: 'Markdown' });
  });

  // 8. /award [נקודות] - הענקת נקודות ומדליה ע"י היוצר
  bot.command('award', async (ctx) => {
    if (!isFoundersGroup(ctx) || !isCreator(ctx)) return;
    const replyUser = ctx.message.reply_to_message?.from;
    if (!replyUser) return ctx.reply('👑 השב להודעה של המייסד שתרצה לצ׳פר וכתוב `/award 30`', { parse_mode: 'Markdown' });
    const pts = parseInt((ctx.message.text || '').trim().split(/\s+/)[1] || '25', 10) || 25;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const m = ensureMember(f, replyUser);
    m.points = (m.points || 0) + pts;
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.reply(`🎖️ *אות הצטיינות מיוצר הבוט!*\nהמייסד *${m.name}* קיבל בונוס של *+${pts} נקודות מייסד*! (סה"כ: ${m.points} נק׳ – ${getFounderRankName(m.points)})`, { parse_mode: 'Markdown' });
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

  // 12. /mvp - מייסד השבוע
  bot.command('mvp', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const list = Object.values(f.members).sort((a, b) => (b.points || 0) - (a.points || 0));
    if (!list.length) return ctx.reply('⭐ עדיין אין מספיק נתונים לבחירת מייסד השבוע.');
    const winner = list[0];
    await ctx.reply(
      `⭐ *מייסד השבוע של וולטיק מוד!* ⭐\n\n` +
      `👑 *המייסד המוביל:* ${winner.name} (מייסד #${winner.number})\n` +
      `🏷️ *תואר:* ${winner.title}\n` +
      `🎖️ *דרגה:* ${getFounderRankName(winner.points)}\n` +
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
    m.points = (m.points || 0) + 10;
    await saveGroupData(FOUNDERS_CHAT_ID, data);
    await ctx.answerCbQuery('🎉 כל הכבוד! קיבלת +10 נקודות מייסד!').catch(() => {});
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
      return ctx.reply(`🔥 *${m.name}*, כבר התפקדת היום! רצף ההתפקדות שלך: *${m.streak || 1} ימים* (${m.points} נק׳).`, { parse_mode: 'Markdown' });
    }
    m.lastCheckin = today;
    m.streak = (m.streak || 0) + 1;
    m.points = (m.points || 0) + 5;
    await saveGroupData(FOUNDERS_CHAT_ID, data);
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

  // 16. /gold - שמירה וצפייה ב"רעיונות הזהב" מהצ'אט
  bot.command('gold', async (ctx) => {
    if (!isFoundersGroup(ctx)) return;
    const data = await getGroupData(FOUNDERS_CHAT_ID);
    const f = ensureFoundersData(data);
    const reply = ctx.message.reply_to_message;

    if (reply && (reply.text || reply.caption)) {
      const txt = (reply.text || reply.caption).slice(0, 200);
      const author = reply.from?.first_name || 'מייסד';
      f.gold.push({ author, text: txt, savedBy: ctx.from.first_name || 'מייסד' });
      if (f.gold.length > 25) f.gold.shift();
      if (reply.from && !reply.from.is_bot) {
        const m = ensureMember(f, reply.from);
        m.points = (m.points || 0) + 10;
      }
      await saveGroupData(FOUNDERS_CHAT_ID, data);
      return ctx.reply(`🪙 *נשמר בלוח רעיונות הזהב!* (+10 נקודות מייסד ל-${author})`);
    }

    if (!f.gold.length) {
      return ctx.reply('🪙 *לוח רעיונות הזהב ריק כרגע.*\nהשב להודעה מבריקה בצ׳אט עם הפקודה `/gold` כדי לשמור אותה כאן!', { parse_mode: 'Markdown' });
    }
    const list = f.gold.slice(-10).map((g, i) => `${i + 1}. 💡 *${g.author}:* "${g.text}"`).join('\n\n');
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
