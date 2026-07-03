const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function setupStripeProducts() {
  console.log('🔧 Setting up Stripe products and prices...\n');

  try {
    // Create Premium Product
    console.log('Creating Premium product...');
    const premiumProduct = await stripe.products.create({
      name: 'RecipeReborn Premium',
      description: 'Premium recipe generation with 100 recipes/month',
    });

    const premiumPrice = await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 999, // $9.99 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    console.log('✅ Premium Product Created');
    console.log('   Product ID:', premiumProduct.id);
    console.log('   Price ID:', premiumPrice.id);
    console.log('   Amount: $9.99/month\n');

    // Create Pro Product
    console.log('Creating Pro product...');
    const proProduct = await stripe.products.create({
      name: 'RecipeReborn Pro',
      description: 'Professional plan with unlimited recipes and all features',
    });

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 1999, // $19.99 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    console.log('✅ Pro Product Created');
    console.log('   Product ID:', proProduct.id);
    console.log('   Price ID:', proPrice.id);
    console.log('   Amount: $19.99/month\n');

    // Output the price IDs for environment variables
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ STRIPE SETUP COMPLETE ✨');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Add these to your .env file:\n');
    console.log(`STRIPE_PREMIUM_PRICE_ID=${premiumPrice.id}`);
    console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return {
      premiumPriceId: premiumPrice.id,
      proPriceId: proPrice.id,
    };
  } catch (error) {
    console.error('❌ Error setting up Stripe:', error.message);
    throw error;
  }
}

setupStripeProducts()
  .then((result) => {
    console.log('Price IDs saved to stripe-price-ids.json');
    require('fs').writeFileSync(
      'stripe-price-ids.json',
      JSON.stringify(result, null, 2)
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
