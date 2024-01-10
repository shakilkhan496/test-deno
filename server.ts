import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
// const stripeApiKey = 'pk_test_51NvRBiJRdeoMFQJ2JCjY8own5mBCOGc1roVDihggm3BLN5YGmUAMtE9PMd5yh5WPPcM3fzvxyZNKl2eQfVnXOM2A00pMQ59XTj';
const supabaseUrl = "https://gmbsigznsbgjdxjjnwal.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtYnNpZ3puc2JnamR4ampud2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODExNjkyOTgsImV4cCI6MTk5Njc0NTI5OH0.FPvU92xu0leuAWBtJW8xAFbbo7NZfzl5wMnjMb7m3ck";
const supabase = createClient(supabaseUrl, supabaseKey);
import Stripe from "npm:stripe@^13.0.0";


const app = new Application();
const router = new Router();
const stripe = new Stripe("sk_test_51NvRBiJRdeoMFQJ2allxZegH8SWvyiI06kh8ro8rJnascmGTqmiiL6VPRGodJYrDX9cEqUWgy4V1INEwxIBQYsCY00cvy0l9ib", {
    apiVersion: "2023-08-16",
})



//Connected account status
// ***************************************************************

// Fonction pour obtenir le statut du compte Stripe
async function getStripeAccountStatus(stripeAccountId) {

    try {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        return account;
    } catch (error) {
        console.error("Erreur lors de la récupération du compte Stripe :", error);
        return null;
    }
}

// Fonction pour mettre à jour le statut dans Supabase
async function updateSupabase(stripeAccountId, stripeAccountStatus, url) {
    const { error } = await supabase
        .from('payment')
        .update({
            accountStatus: stripeAccountStatus,
            onboardingLink: url, //if account status is restricted
        })
        .eq('stripe_customer_id', stripeAccountId)
        .select();

    if (error) {
        console.error('Erreur de mise à jour de Supabase:', error);
        return false;
    }
    return true;
}

router.post("/webhook", async (context) => {
    try {
        const body = await context.request.body({ type: "json" }).value;
        console.log("Received event:", body.type);
        console.log("Event data:", body.data);

        let newStatus = 'enabled';

        switch (body.type) {
            case "account.external_account.created":
                newStatus = 'restricted';
                await updateSupabaseAfterDelay(body.data.object.id, newStatus, 'null');
                break;

            case "account.updated":
                const updatedData = body.data.object;
                if (updatedData.payouts_enabled === true && updatedData.charges_enabled === true){
                    const status = 'enabled';
                    await handleRejectedAccountUpdate(body.data.object.id, status);
                    const account = await stripe.accounts.update(
                        `${body.data.object.id}`,
                        {
                            metadata: {
                                order_id: 'no',
                            },
                        }
                    );
                    const { error } = await supabase
                        .from('payment')
                        .update({
                            accountInfo: account,
                        })
                        .eq('stripe_customer_id', body.data.object.id)
                        .select();
                } else{
                    const status2 ='restricted';
                    await handleRejectedAccountUpdate(body.data.object.id, status2);
                    const account = await stripe.accounts.update(
                        `${body.data.object.id}`,
                        {
                            metadata: {
                                order_id: 'no',
                            },
                        }
                    );
                    const { error } = await supabase
                        .from('payment')
                        .update({
                            accountInfo: account,
                        })
                        .eq('stripe_customer_id', body.data.object.id)
                        .select();

                }

                break;

            default:
            // Handle other cases if needed
        }

        context.response.status = 200;
        context.response.body = "Webhook processed successfully";
    } catch (error) {
        console.error("Error:", error);
        context.response.status = 500;
        context.response.body = "Internal Server Error";
    }
});

async function updateSupabaseAfterDelay(accountId:any, status:any, linkUrl:any) {
    setTimeout(async () => await updateSupabase(accountId, status, linkUrl), 5000);
}

async function handleRejectedAccountUpdate(accountId:any, status:any) {
    const accountLink = await createAccountLink(accountId);
    await updateSupabaseAfterDelay(accountId, status, accountLink.url);
}


async function createAccountLink(accountId) {
    return await stripe.accountLinks.create({
        account: accountId,
        refresh_url: 'https://lylydo.com',
        return_url: 'https://lylydo.com',
        type: 'account_onboarding',
    });
}

//
//Connected account status END
// ***************************************************************

router.get('/', async (req, res) => {
    res.send({
        message:'server is connected'
    })
});

//Main account status
// ***************************************************************
// This handler will be called for every incoming request.
// This handler will be called for every incoming request.
const signInSecret = 'whsec_mNEmSD5aLWwqB3GsYjwj2lWtZG1eCvlj';

async function handler(context) {
    console.log('this is context',context);
    const signature = context.request.headers.get('Stripe-Signature');
    const newBody = await context.text();
    console.log('this is new body', newBody);
    // Use context.request.body().value to get the raw body as Uint8Array.
    // const rawBody = await context.request.body().value;
    const body = await context.request.text();
    // console.log('this is rawBody',rawBody);
    // const body = JSON.stringify(rawBody);
    console.log('this is body',body);
    console.log('this is type of body',typeof(body));
    let event;
    try {
        event = await stripe.webhooks.constructEventAsync(
            newBody,
            signature,
            signInSecret,
            undefined
        );
    } catch (err) {
        console.log(`❌ Error message: ${err.message}`);
        return new Response(err.message, { status: 400 });
    }

    // Successfully constructed event
    console.log('✅ Success:', event.id);

    // Cast event data to Stripe object
    if (event.type === 'payment_intent.succeeded') {
        const stripeObject = event.data.object;
        console.log(`💰 PaymentIntent status: ${stripeObject.status}`);
    } else if (event.type === 'charge.succeeded') {
        const charge = event.data.object;
        console.log(`💵 Charge id: ${charge.id}`);
    } else {
        console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
}

router.post('/webhookMain', async (context) => {
    await handler(context);
});






app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
console.log("Server running on http://localhost:8000");
