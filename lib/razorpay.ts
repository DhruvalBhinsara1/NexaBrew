import Razorpay from "razorpay";
import crypto from "crypto";
import { AppError } from "@/lib/utils/app-error";

function getCredentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new AppError("Razorpay credentials not configured", "RAZORPAY_NOT_CONFIGURED", 500);
  }
  return { keyId, keySecret };
}

export function getRazorpayClient(): Razorpay {
  const { keyId, keySecret } = getCredentials();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/** Verify the HMAC-SHA256 signature sent by Razorpay on payment success. */
export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): boolean {
  const { keySecret } = getCredentials();
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac("sha256", keySecret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
