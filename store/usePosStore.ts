"use client";

import { create } from "zustand";

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  taxRate: number;
  quantity: number;
}

interface PosStore {
  // Session
  sessionId: string | null;
  setSession: (id: string) => void;

  // Table
  tableId: string | null;
  tableNumber: number | null;
  setTable: (id: string, num: number) => void;
  clearTable: () => void;

  // Cart
  cartItems: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clearCart: () => void;

  // Customer (optional — links the order so it shows in the customer's My Orders)
  customerId: string | null;
  customerName: string | null;
  setCustomer: (id: string | null, name: string | null) => void;

  // Coupon
  couponCode: string;
  setCouponCode: (code: string) => void;

  // Current order (after send-to-kitchen)
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  setOrder: (id: string, num: string, status: string) => void;
  updateStatus: (status: string) => void;

  // Reset everything (after payment)
  reset: () => void;
}

export const usePosStore = create<PosStore>((set) => ({
  sessionId: null,
  setSession: (id) => set({ sessionId: id }),

  tableId: null,
  tableNumber: null,
  setTable: (id, num) => set({ tableId: id, tableNumber: num }),
  clearTable: () => set({ tableId: null, tableNumber: null }),

  cartItems: [],
  addItem: (item) =>
    set((s) => {
      const existing = s.cartItems.find((c) => c.productId === item.productId);
      if (existing) {
        return {
          cartItems: s.cartItems.map((c) =>
            c.productId === item.productId ? { ...c, quantity: c.quantity + 1 } : c
          ),
        };
      }
      return { cartItems: [...s.cartItems, { ...item, quantity: 1 }] };
    }),
  removeItem: (productId) =>
    set((s) => ({ cartItems: s.cartItems.filter((c) => c.productId !== productId) })),
  setQty: (productId, qty) =>
    set((s) => ({
      cartItems:
        qty <= 0
          ? s.cartItems.filter((c) => c.productId !== productId)
          : s.cartItems.map((c) => (c.productId === productId ? { ...c, quantity: qty } : c)),
    })),
  clearCart: () => set({ cartItems: [] }),

  customerId: null,
  customerName: null,
  setCustomer: (id, name) => set({ customerId: id, customerName: name }),

  couponCode: "",
  setCouponCode: (code) => set({ couponCode: code }),

  orderId: null,
  orderNumber: null,
  orderStatus: null,
  setOrder: (id, num, status) => set({ orderId: id, orderNumber: num, orderStatus: status }),
  updateStatus: (status) => set({ orderStatus: status }),

  reset: () =>
    set({
      cartItems: [],
      couponCode: "",
      customerId: null,
      customerName: null,
      orderId: null,
      orderNumber: null,
      orderStatus: null,
      tableId: null,
      tableNumber: null,
    }),
}));
