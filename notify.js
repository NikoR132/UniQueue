const PROJECT_ID = 'dwdwdw-2d303';

const str = (f) => (f ? String(f.stringValue ?? f.integerValue ?? f.doubleValue ?? '') : '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    const { shopId, orderId } = req.body || {};
    if (!/^shop\d+$/.test(shopId || '') || !/^[A-Za-z0-9]+$/.test(orderId || '')) {
      return res.status(400).json({ error: 'bad request' });
    }

    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/orders_${shopId}/${orderId}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).json({ error: 'order not found', status: r.status });
    const f = (await r.json()).fields || {};

    const status = str(f.status);
    const chatId = str(f.telegramId);
    if (!chatId) return res.status(400).json({ error: 'no telegramId in order' });

    const items = (f.items?.arrayValue?.values || []).map((v) => {
      const m = v.mapValue.fields;
      return `- ${str(m.menu)} (${str(m.qty)} ชิ้น)`;
    });

    let text;
    if (status === 'cooking') {
      text = `🍳 ร้านเริ่มทำอาหารในตะกร้าคุณแล้ว!\n${items.join('\n')}`;
    } else if (status === 'completed') {
      text = `✅ อาหารของคุณเสร็จแล้ว! มารับได้เลยครับ\n${items.join('\n')}`;
    } else {
      return res.status(200).json({ ok: true, skipped: status });
    }

    const tg = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const tgData = await tg.json();
    if (!tgData.ok) return res.status(502).json({ error: 'telegram', detail: tgData.description });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
