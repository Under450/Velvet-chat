module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const raw = process.env.FIREBASE_PRIVATE_KEY || '';
    res.status(200).json({
        length: raw.length,
        hasLiteralN: raw.includes('\\n'),
        hasRealNewline: raw.includes('\n'),
        first50: raw.substring(0, 50),
        last50: raw.substring(raw.length - 50)
    });
};
