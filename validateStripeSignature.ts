import { crypto } from "https://deno.land/std@0.207.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.207.0/encoding/hex.ts";

export async function validateStripeSignature(
  payload: Uint8Array,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  const parts = signature.split(',');
  const timestamp = parts[0].split('=')[1];
  const sig = parts[1].split('=')[1];

  const signedPayload = `${timestamp}.${new TextDecoder().decode(payload)}`;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signedPayload));
  const hashHex = encodeHex(new Uint8Array(hashBuffer));

  return sig === hashHex;
}
