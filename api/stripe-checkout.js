module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) return res.status(500).json({ error: 'No stripe key configured' });

        const Stripe = require('stripe');
        const stripe = new Stripe(key, { apiVersion: '2023-10-16' });

        const { packageId, amountPence, packageName, userId, creatorCode } = req.body;

        if (!amountPence) return res.status(400).json({ error: 'amountPence is required' });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'gbp',
                    product_data: { name: packageName || 'Velvet Credits' },
                    unit_amount: parseInt(amountPence),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: 'https://under450.github.io/Velvet-chat/velvet-purchase.html?success=true&packageId=' + (packageId||'') + '&userId=' + (userId||'') + '&creatorCode=' + (creatorCode||''),
            cancel_url: 'https://under450.github.io/Velvet-chat/velvet-purchase.html?cancelled=true',
            metadata: { packageId: packageId||'', userId: userId||'', creatorCode: creatorCode||'' }
        });

        return res.status(200).json({ url: session.url });

    } catch (e) {
        console.error('Stripe checkout error:', e);
        return res.status(500).json({ error: e.message, type: e.type || 'unknown' });
    }
};
