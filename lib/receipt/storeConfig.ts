/**
 * Store identity printed on thermal receipts. Edit these to match the venue.
 */
export const STORE_INFO = {
  name: "NexaBrew Cafe",
  gstin: "29ABCDE1234F1Z5",
  addressLines: ["Parul University", "Lakshay 2047 Building"],
  phone: "XXXXXXXX",
  email: "hello@nexabrew.com",
  taxLabel: "GST",
  footerLines: ["Keep this bill for exchange within 7 days.", "Valid only at the issuing store. T&C apply."],
  thanks: "THANK YOU & VISIT AGAIN",
} as const;
