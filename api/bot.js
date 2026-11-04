module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('הבוט פעיל ומוכן לקבל הודעות!');
  }

  try {
    const token = process.env.BOT_TOKEN;
    const body = req.body || {};
    const message = body.message;

    if (message && message.chat && message.text) {
      const chatId = message.chat.id;
      const userText = message.text;

      let replyText = `קיבלתי את ההודעה שלך: ${userText}`;
      if (userText === '/start') {
        replyText = 'שלום! הבוט שלך באוויר ועובד מעולה! 🚀 שלח לי כל הודעה ואענה לך.';
      }

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
        }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ ok: false });
  }
};
