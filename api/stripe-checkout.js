const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { packageId, amountPence, packageName, userId, creatorCode } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: packageName,
                        description: 'Velvet Credits - Cold Brew Coffee Co',
                    },
                    unit_amount: amountPence,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `https://under450.github.io/Velvet-chat/velvet-purchase.html?success=true&packageId=${packageId}&userId=${userId}&creatorCode=${creatorCode}`,
            cancel_url: `https://under450.github.io/Velvet-chat/velvet-purchase.html?cancelled=true`,
            metadata: {
                packageId,
                userId,
                creatorCode
            }
        });

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: error.message });
    }
};