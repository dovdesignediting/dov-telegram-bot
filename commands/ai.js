const { getGroupData, saveGroupData, requireAdmin } = require('./utils');

const CREATOR_ID = 1773089386;
const COOLDOWN_MS = 15000;
const PENDING_TTL_MS = 5 * 60 * 1000;

const userCooldowns = new Map();
const pendingTopics = new Map();

const TOPICS = {
  sport: {
    label: '⚽ ספורט',
    promptHint: 'כתוב עכשיו כל שאלה על ספורט (כדורגל, כדורסל, שיאים, קבוצות או שחקנים):',
    system: 'אתה מומחה ספורט בעברית בבוט טלגרם. ענה בעברית טבעית, ברורה, מדויקת וקצרה (עד 8 שורות). הימנע משימוש מוגזם בסימני Markdown.'
  },
  movies: {
    label: '🎬 סרטים וסדרות',
    promptHint: 'כתוב שם של סרט או סדרה לקבלת תקציר בלי ספוילרים, או בקש המלצה לפי ז׳אנר:',
    system: 'אתה מומחה סרטים וסדרות בעברית בבוט טלגרם. תן תקציר מושך בלי ספוילרים, ז׳אנר, שנת יציאה והמלצה קצרה. כתוב בעברית טבעית ותמציתית.'
  },
  summary: {
    label: '📝 תקציר טקסט',
    promptHint: 'הדבק עכשיו טקסט ארוך שאסכם לך לנקודות קצרות (אפשר גם להשיב להודעה ארוכה בקבוצה עם הפקודה המתאימה):',
    system: 'סכם את הטקסט הבא בעברית ל-3 עד 5 נקודות קצרות, ברורות ומדויקות בלבד בלי הקדמות מיותרות.'
  },
  music: {
    label: '🎵 שירים ומוזיקה',
    promptHint: 'כתוב שם שיר, אמן, או בקש המלצות שירים לפי מצב רוח או סגנון:',
    system: 'אתה מומחה מוזיקה ושירים בעברית בבוט טלגרם. תן רקע מעניין, משמעות שיר או רשימת המלצות קצרה בעברית טבעית וזורמת.'
  },
  facts: {
    label: '🧠 עובדה מפתיעה',
    promptHint: 'כתוב נושא לעובדה מפתיעה (למשל: חלל, בעלי חיים, היסטוריה), או לחץ על הכפתור לעובדה אקראית:',
    system: 'שתף עובדה אחת אמיתית, מפתיעה ומרתקת בעברית ב-2 עד 4 משפטים קצרים בלבד.'
  },
  general: {
    label: '💬 שאלה חופשית',
    promptHint: 'כתוב עכשיו כל שאלה בכל נושא שתרצה:',
    system: 'אתה עוזר חכם וידידותי בבוט טלגרם בשם וולטיק מוד. ענה בעברית טבעית, ברורה וקצרה (עד 10 שורות).'
  }
};

function buildTopicsKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '⚽ ספורט', callback_data: 'ai_topic_sport' },
        { text: '🎬 סרטים וסדרות', callback_data: 'ai_topic_movies' }
      ],
      [
        { text: '📝 תקציר טקסט', callback_data: 'ai_topic_summary' },
        { text: '🎵 שירים ומוזיקה', callback_data: 'ai_topic_music' }
      ],
      [
        { text: '🧠 עובדה מפתיעה', callback_data: 'ai_topic_facts' },
        { text: '💬 שאלה חופשית', callback_data: 'ai_topic_general' }
      ],
      [{ text: '🎲 שלח לי עובדה אקראית עכשיו', callback_data: 'ai_random_fact' }]
    ]
  };
}

async function callGeminiFree(userText, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const models = [
    process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    'gemini-2.5-flash'
  ];

  let lastErr = null;
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig: { maxOutputTokens: 550 }
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
        if (out) return out;
      }
      lastErr = new Error(data.error?.message || `Gemini HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Gemini API error');
}

async function callOpenAICompatible({ url, apiKey, model, userText, systemPrompt, extraHeaders = {} }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      max_tokens: 550
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `AI HTTP ${res.status}`);
  }
  const out = data.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error('תשובה ריקה מהשרת');
  return out;
}

async function askFreeAI(userText, topicKey = 'general') {
  const topic = TOPICS[topicKey] || TOPICS.general;
  const providers = [];

  if (process.env.GEMINI_API_KEY) {
    providers.push(() => callGeminiFree(userText, topic.system));
  }
  if (process.env.GROQ_API_KEY) {
    providers.push(() =>
      callOpenAICompatible({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        userText,
        systemPrompt: topic.system
      })
    );
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push(() =>
      callOpenAICompatible({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'openrouter/free',
        userText,
        systemPrompt: topic.system,
        extraHeaders: { 'X-Title': 'VolticMod Telegram Bot' }
      })
    );
  }

  if (!providers.length) {
    return {
      ok: false,
      error: '⚠️ מנוע ה-AI עדיין לא הוגדר בשרת.\nיש להוסיף ב-Vercel מפתח חינמי אחד לפחות: GEMINI_API_KEY או GROQ_API_KEY או OPENROUTER_API_KEY ולבצע Redeploy.'
    };
  }

  let lastError = null;
  for (const runProvider of providers) {
    try {
      const answer = await runProvider();
      if (answer) return { ok: true, text: answer.slice(0, 3800) };
    } catch (err) {
      lastError = err;
    }
  }
  return {
    ok: false,
    error: `⏳ שירות ה-AI עמוס כרגע או שהמכסה הזמנית הסתיימה. נסה שוב בעוד כמה שניות.\n(${lastError?.message || 'שגיאת חיבור'})`
  };
}

async function checkGroupAiAllowed(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return true;
  const data = await getGroupData(ctx.chat.id);
  if (data.aiEnabled === false) {
    await ctx.reply('🚫 מערכת ה-AI כבויה כרגע בקבוצה זו ע"י המנהלים.');
    return false;
  }
  return true;
}

function checkCooldown(userId) {
  if (Number(userId) === CREATOR_ID) return 0;
  const last = userCooldowns.get(String(userId)) || 0;
  const diff = Date.now() - last;
  if (diff < COOLDOWN_MS) {
    return Math.ceil((COOLDOWN_MS - diff) / 1000);
  }
  userCooldowns.set(String(userId), Date.now());
  return 0;
}

async function executeAiQuery(ctx, userText, topicKey = 'general') {
  if (!(await checkGroupAiAllowed(ctx))) return;
  const waitSec = checkCooldown(ctx.from?.id);
  if (waitSec > 0) {
    return ctx.reply(`⏳ המתן ${waitSec} שניות לפני השאלה הבאה.`);
  }

  const topic = TOPICS[topicKey] || TOPICS.general;
  await ctx.sendChatAction('typing').catch(() => {});

  const result = await askFreeAI(userText, topicKey);
  if (!result.ok) {
    return ctx.reply(result.error, { disable_web_page_preview: true });
  }

  const footerRow =
    topicKey === 'facts'
      ? [
          { text: '🎲 עוד עובדה מפתיעה', callback_data: 'ai_random_fact' },
          { text: '🤖 תפריט נושאים', callback_data: 'ai_menu' }
        ]
      : [{ text: '🤖 בחירת נושא נוסף', callback_data: 'ai_menu' }];

  const extra = {
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [footerRow] }
  };
  if (ctx.chat?.type !== 'private' && ctx.message?.message_id) {
    extra.reply_to_message_id = ctx.message.message_id;
  }

  return ctx.reply(`${topic.label}\n\n${result.text}`, extra);
}

module.exports = function registerAiCommands(bot) {
  // פתיחת פאנל הנושאים או מענה ישיר לשאלה: /ai [שאלה]
  bot.command('ai', async (ctx) => {
    if (!(await checkGroupAiAllowed(ctx))) return;
    const query = (ctx.message?.text || '').replace(/^\/ai(@\S+)?\s*/i, '').trim();
    if (!query) {
      return ctx.reply(
        '🤖 עוזר חכם לכל נושא (ספורט, סרטים, תקצירים, שירים, עובדות ועוד)\n\nבחר נושא מהכפתורים למטה:',
        { reply_markup: buildTopicsKeyboard() }
      );
    }
    return executeAiQuery(ctx, query, 'general');
  });

  // פקודות קיצור ישירות לנושאים
  bot.command('sport', async (ctx) => {
    const q = (ctx.message?.text || '').replace(/^\/sport(@\S+)?\s*/i, '').trim();
    if (!q) return ctx.reply('⚽ כתוב שאלה אחרי הפקודה, או בחר נושא מהתפריט:', { reply_markup: buildTopicsKeyboard() });
    return executeAiQuery(ctx, q, 'sport');
  });

  bot.command(['movie', 'movies'], async (ctx) => {
    const q = (ctx.message?.text || '').replace(/^\/movies?(@\S+)?\s*/i, '').trim();
    if (!q) return ctx.reply('🎬 כתוב שם סרט או סדרה לקבלת תקציר בלי ספוילרים:', { reply_markup: buildTopicsKeyboard() });
    return executeAiQuery(ctx, q, 'movies');
  });

  bot.command(['summary', 'tldr'], async (ctx) => {
    const direct = (ctx.message?.text || '').replace(/^\/(summary|tldr)(@\S+)?\s*/i, '').trim();
    const replied = ctx.message?.reply_to_message?.text || ctx.message?.reply_to_message?.caption || '';
    const sourceText = direct || replied;
    if (!sourceText) {
      return ctx.reply('📝 השב להודעה ארוכה כדי לקבל תקציר, או שלח טקסט אחרי הפקודה.');
    }
    return executeAiQuery(ctx, sourceText, 'summary');
  });

  bot.command('music', async (ctx) => {
    const q = (ctx.message?.text || '').replace(/^\/music(@\S+)?\s*/i, '').trim();
    if (!q) return ctx.reply('🎵 כתוב שם שיר, אמן או סגנון מבוקש:', { reply_markup: buildTopicsKeyboard() });
    return executeAiQuery(ctx, q, 'music');
  });

  bot.command('fact', async (ctx) => {
    const q = (ctx.message?.text || '').replace(/^\/fact(@\S+)?\s*/i, '').trim();
    const prompt = q ? `תן לי עובדה מפתיעה ומעניינת על: ${q}` : 'תן לי עובדה מפתיעה, נדירה ומרתקת בנושא אקראי.';
    return executeAiQuery(ctx, prompt, 'facts');
  });

  // הפעלה / כיבוי של AI בקבוצה למנהלים בלבד
  bot.command('ai_toggle', async (ctx) => {
    if (!(await requireAdmin(ctx, '/ai_toggle [on | off]'))) return;
    const arg = ((ctx.message?.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    if (arg === 'on' || arg === 'off') {
      data.aiEnabled = arg === 'on';
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`🤖 מערכת ה-AI בקבוצה כעת: ${data.aiEnabled ? 'פעילה ✅' : 'כבויה ❌'}`);
    }
    const isOn = data.aiEnabled !== false;
    return ctx.reply(`🤖 מצב מערכת ה-AI בקבוצה: ${isOn ? 'פעיל ✅' : 'כבוי ❌'}`, {
      reply_markup: {
        inline_keyboard: [[
          { text: isOn ? '🔴 כבה עוזר חכם בקבוצה' : '🟢 הפעל עוזר חכם בקבוצה', callback_data: 'ai_admin_toggle' }
        ]]
      }
    });
  });

  // כפתורי תפריט ונושאים
  bot.action('ai_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const txt = '🤖 עוזר חכם לכל נושא (ספורט, סרטים, תקצירים, שירים, עובדות ועוד)\n\nבחר נושא מהכפתורים למטה:';
    return ctx.reply(txt, { reply_markup: buildTopicsKeyboard() });
  });

  bot.action('ai_random_fact', async (ctx) => {
    await ctx.answerCbQuery('מביא עובדה מפתיעה...').catch(() => {});
    return executeAiQuery(ctx, 'תן לי עובדה מפתיעה, נדירה ומרתקת בנושא אקראי.', 'facts');
  });

  bot.action(/^ai_topic_(sport|movies|summary|music|facts|general)$/, async (ctx) => {
    const topicKey = ctx.match[1];
    const topic = TOPICS[topicKey];
    await ctx.answerCbQuery().catch(() => {});
    if (!(await checkGroupAiAllowed(ctx))) return;

    const pKey = `${ctx.chat?.id}:${ctx.from?.id}`;
    pendingTopics.set(pKey, { topicKey, expiresAt: Date.now() + PENDING_TTL_MS });

    const kb = [];
    if (topicKey === 'facts') {
      kb.push([{ text: '🎲 עובדה אקראית עכשיו', callback_data: 'ai_random_fact' }]);
    }
    kb.push([{ text: '❌ ביטול', callback_data: 'ai_cancel_pending' }]);

    return ctx.reply(`${topic.label}\n\n${topic.promptHint}`, {
      reply_markup: { inline_keyboard: kb }
    });
  });

  bot.action('ai_cancel_pending', async (ctx) => {
    const pKey = `${ctx.chat?.id}:${ctx.from?.id}`;
    pendingTopics.delete(pKey);
    await ctx.answerCbQuery('בוטל').catch(() => {});
    return ctx.editMessageText('❌ הבקשה בוטלה.', {
      reply_markup: { inline_keyboard: [[{ text: '🤖 פתיחת תפריט נושאים', callback_data: 'ai_menu' }]] }
    }).catch(() => {});
  });

  bot.action('ai_admin_toggle', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return ctx.answerCbQuery().catch(() => {});
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id).catch(() => null);
    if (!member || !['creator', 'administrator'].includes(member.status)) {
      return ctx.answerCbQuery('⛔ פעולה זו מיועדת למנהלים בלבד.', { show_alert: true }).catch(() => {});
    }
    const data = await getGroupData(ctx.chat.id);
    data.aiEnabled = data.aiEnabled === false;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery(data.aiEnabled ? 'הופעל ✅' : 'כובה ❌').catch(() => {});
    return ctx.editMessageText(`🤖 מצב מערכת ה-AI בקבוצה: ${data.aiEnabled ? 'פעיל ✅' : 'כבוי ❌'}`, {
      reply_markup: {
        inline_keyboard: [[
          { text: data.aiEnabled ? '🔴 כבה עוזר חכם בקבוצה' : '🟢 הפעל עוזר חכם בקבוצה', callback_data: 'ai_admin_toggle' }
        ]]
      }
    }).catch(() => {});
  });

  // טיפול בהודעת ההמשך לאחר שהמשתמש בחר נושא מהכפתורים
  bot.on('text', async (ctx, next) => {
    const text = (ctx.message?.text || '').trim();
    if (!text || text.startsWith('/')) return next();

    const pKey = `${ctx.chat?.id}:${ctx.from?.id}`;
    const pending = pendingTopics.get(pKey);
    if (!pending) return next();

    pendingTopics.delete(pKey);
    if (Date.now() > pending.expiresAt) return next();

    return executeAiQuery(ctx, text, pending.topicKey);
  });
};
