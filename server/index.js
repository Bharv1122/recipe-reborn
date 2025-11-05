const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(bodyParser.json());

const dataDir = path.join(__dirname,'..','data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.post('/api/waitlist', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const file = path.join(dataDir,'waitlist.json');
  let list = [];
  try { list = JSON.parse(fs.readFileSync(file)); } catch (e) {}
  if (!list.includes(email)) list.push(email);
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
  res.json({ ok: true });
});

// Placeholder checkout endpoint - install stripe and set STRIPE_SECRET in env to use
app.post('/api/checkout', async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
  const Stripe = require('stripe');
  const stripe = Stripe(stripeKey);
  const { priceId } = req.body || {};
  if (!priceId) return res.status(400).json({ error: 'priceId required' });
  try{
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: req.body.success_url || 'https://recipereborn.com/success',
      cancel_url: req.body.cancel_url || 'https://recipereborn.com/cancel'
    });
    res.json({ id: session.id });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('API server running on', port));
