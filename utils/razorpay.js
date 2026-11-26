const axios = require("axios");
const { createHmac, timingSafeEqual } = require("crypto");

const API_ROOT = "https://api.razorpay.com/v1";
const isConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

function auth() {
  if (!isConfigured()) throw new Error("Razorpay keys are not configured.");
  return { username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET };
}

async function createOrder({ amount, receipt, notes }) {
  const { data } = await axios.post(`${API_ROOT}/orders`, {
    amount,
    currency: "INR",
    receipt: String(receipt).slice(0, 40),
    notes,
  }, { auth: auth(), timeout: 12000 });
  return data;
}

async function fetchPayment(paymentId) {
  const { data } = await axios.get(`${API_ROOT}/payments/${encodeURIComponent(paymentId)}`, { auth: auth(), timeout: 12000 });
  return data;
}

async function capturePayment(paymentId, amount) {
  const { data } = await axios.post(`${API_ROOT}/payments/${encodeURIComponent(paymentId)}/capture`, {
    amount,
    currency: "INR",
  }, { auth: auth(), timeout: 12000 });
  return data;
}

async function refundPayment(paymentId, amount, receipt) {
  const { data } = await axios.post(`${API_ROOT}/payments/${encodeURIComponent(paymentId)}/refund`, {
    amount,
    receipt: String(receipt).slice(0, 40),
  }, { auth: auth(), timeout: 12000 });
  return data;
}

function safeEqualHex(expected, received) {
  if (typeof received !== "string" || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function verifyCheckoutSignature(orderId, paymentId, signature) {
  if (!isConfigured() || !orderId || !paymentId) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || typeof signature !== "string") return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

module.exports = {
  isConfigured,
  createOrder,
  fetchPayment,
  capturePayment,
  refundPayment,
  verifyCheckoutSignature,
  verifyWebhookSignature,
};
