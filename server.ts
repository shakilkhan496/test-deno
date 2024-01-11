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
    httpClient: Stripe.createFetchHttpClient(),
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



//Main account status
// ***************************************************************
// This handler will be called for every incoming request.
// This handler will be called for every incoming request.
const signInSecret = 'whsec_6jeso8V1B5Sl7TK5UX89bdmMDHwQf6b4';

//supabase master function
async function supaUpdate(tableName, primaryFieldName, primaryFieldValue, updateFields) {
    try {
        console.log('Updating Supabase:', updateFields);

        const { error } = await supabase
            .from(tableName)
            .update(updateFields)
            .eq(primaryFieldName, primaryFieldValue)
            .select();

        if (error) {
            console.error('Error updating Supabase:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Unexpected error during Supabase update:', error);
        return false;
    }
}


async function handler(context) {
    console.log('Trigger server')
    const signature = context.request.headers.get('Stripe-Signature');

    const body = await context.request.body({ type:'text'}).value;
    
    let event;
    try {
        event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            signInSecret,
            undefined
        );
    } catch (err) {
        console.log(`❌ Error message: ${err.message}`);
        return new Response(err.message, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.amount_capturable_updated':
            const paymentIntentCaptured = event.data.object;
            // Then define and call a function to handle the event payment_intent.canceled
            const capturedFields = {
                payment_id: paymentIntentCaptured.id,
                payment_status: 'Captured',
            };
            setTimeout(async () => await supaUpdate('bookings', `id`, `${paymentIntentCaptured.metadata.id}`, capturedFields), 5000);
            break;
        case 'payment_intent.created':
            const paymentIntentCreated = event.data.object;
            console.log(`${paymentIntentCreated.metadata.id}`);
            const updateFields = {
                payment_id: paymentIntentCreated.id,
                payment_status: 'Incomplete'
            };
            console.log(updateFields);
            
            setTimeout(async () => await supaUpdate('bookings', `id`, `${paymentIntentCreated.metadata.id}`, updateFields), 5000);
            // Then define and call a function to handle the event payment_intent.created
            break;
        case 'payment_intent.payment_failed':
            const paymentIntentPaymentFailed = event.data.object;
            // Then define and call a function to handle the event payment_intent.payment_failed
            break;
        case 'payment_intent.processing':
            const paymentIntentProcessing = event.data.object;
            // Then define and call a function to handle the event payment_intent.processing
            break;
        case 'payment_intent.succeeded':
            const paymentIntentSucceeded = event.data.object;
            // Then define and call a function to handle the event payment_intent.succeeded
            const successFields = {
                payment_id: paymentIntentSucceeded.id,
                payment_status: 'Succeeded',
            };

            setTimeout(async () => await supaUpdate('bookings', `id`, `${paymentIntentSucceeded.metadata.id}`, successFields), 5000);

            break;
        // ... handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    context.response.status = 200;
    context.response.body = "Webhook processed successfully";
}

router.post('/test-shakil', async (context) => {
    await handler(context);
});






app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
console.log("Server running on http://localhost:8000");
