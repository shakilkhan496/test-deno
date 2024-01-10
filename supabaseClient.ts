import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Remplacez ces valeurs par vos informations d'authentification Supabase
const supabaseUrl = 'https://gmbsigznsbgjdxjjnwal.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtYnNpZ3puc2JnamR4ampud2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODExNjkyOTgsImV4cCI6MTk5Njc0NTI5OH0.FPvU92xu0leuAWBtJW8xAFbbo7NZfzl5wMnjMb7m3ck';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function updateStripeAccountStatus(accountId: string, status: string) {
  const { data, error } = await supabase
    .from('users')
    .update({ stripeAccountStatus: status })
    .eq('stripeAccount', accountId);

  if (error) {
    console.error('Erreur de mise à jour de Supabase:', error);
    return false;
  } else {
    console.log('Mise à jour réussie:', data);
    return true;
  }
}
