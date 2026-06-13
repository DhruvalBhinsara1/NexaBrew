-- Allow 'razorpay' as a payment_method_type in the payments table.
-- Razorpay is a payment gateway (handles card, UPI, netbanking, wallets) and
-- is recorded as a distinct type so reporting can distinguish gateway vs cash.

alter table payments
  drop constraint if exists payments_payment_method_type_check;

alter table payments
  add constraint payments_payment_method_type_check
  check (payment_method_type in ('cash', 'card', 'upi', 'razorpay'));
