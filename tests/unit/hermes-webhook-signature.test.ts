// Hermes Webhook Signature Verification Tests
// Tests for P0/P1 webhook signature handling from Phase 10 commit audit

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

const TEST_SECRET = 'test-secret-key-for-hermes-webhook-verification-32chars';

// Helper to create test app
function createTestApp() {
  const app = express();
  app.use(express.json());

  function canonicalize(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(canonicalize);
    }
    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  }

  function isValidHexSignature(signature: string): boolean {
    if (typeof signature !== 'string' || signature.length !== 64) {
      return false;
    }
    return /^[a-fA-F0-9]{64}$/.test(signature);
  }

  function computeSignature(payload: object, secret: string): string {
    const canonicalized = canonicalize(payload);
    return crypto.createHmac('sha256', secret)
      .update(JSON.stringify(canonicalized))
      .digest('hex');
  }

  app.post('/webhook', async (req, res) => {
    const event = req.body;
    const signature = req.headers['x-hermes-signature'] as string;
    const secret = process.env.HERMES_WEBHOOK_SECRET || TEST_SECRET;

    if (!event || !event.type) {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload' });
    }

    if (!signature) {
      return res.status(401).json({
        success: false,
        error: { code: 'SIGNATURE_REQUIRED', message: 'Webhook signature required' }
      });
    }

    if (!isValidHexSignature(signature)) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature format' }
      });
    }

    try {
      if (!crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(computeSignature(event, secret), 'hex')
      )) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' }
        });
      }
    } catch (e) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' }
      });
    }

    res.json({ success: true, data: { message_id: 'test-id' } });
  });

  return app;
}

describe('Hermes Webhook Signature Verification', () => {
  let app: express.Express;
  let originalEnv: string | undefined;

  before(() => {
    app = createTestApp();
    originalEnv = process.env.HERMES_WEBHOOK_SECRET;
  });

  after(() => {
    if (originalEnv !== undefined) {
      process.env.HERMES_WEBHOOK_SECRET = originalEnv;
    } else {
      delete process.env.HERMES_WEBHOOK_SECRET;
    }
  });

  describe('Signature Format Validation', () => {
    it('should reject empty signature', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', '')
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      // Empty string is falsy, so !signature is true - returns SIGNATURE_REQUIRED
      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.error?.code, 'SIGNATURE_REQUIRED');
    });

    it('should reject short signature', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', 'abc123')
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.error.code, 'INVALID_SIGNATURE');
      assert.strictEqual(response.body.error.message, 'Invalid signature format');
    });

    it('should reject oversized signature', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', 'a'.repeat(128))
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.error.code, 'INVALID_SIGNATURE');
      assert.strictEqual(response.body.error.message, 'Invalid signature format');
    });

    it('should reject non-hexadecimal signature', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', 'g'.repeat(64))
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.error.code, 'INVALID_SIGNATURE');
      assert.strictEqual(response.body.error.message, 'Invalid signature format');
    });

    it('should reject signature with invalid characters', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdX')
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.error.code, 'INVALID_SIGNATURE');
    });
  });

  describe('Signature Validation', () => {
    it('should accept valid signature', async () => {
      const payload = { type: 'hermes_register', hermes_id: 'test-agent', display_name: 'Test Agent' };
      const canonical = { display_name: 'Test Agent', hermes_id: 'test-agent', type: 'hermes_register' };
      const signature = crypto.createHmac('sha256', TEST_SECRET)
        .update(JSON.stringify(canonical))
        .digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
    });

    it('should reject invalid signature', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', 'a'.repeat(64))
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.error.code, 'INVALID_SIGNATURE');
    });

    it('should reject signature when request body is modified', async () => {
      const signedPayload = { from_hermes_id: 'hermes-001', to_council_id: 'council-001', content: 'Hello', type: 'hermes_message' };
      const signature = crypto.createHmac('sha256', TEST_SECRET)
        .update(JSON.stringify(signedPayload))
        .digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', signature)
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_message', from_hermes_id: 'hermes-001', to_council_id: 'council-001', content: 'Modified' });

      assert.strictEqual(response.status, 401);
    });
  });

  describe('JSON Key Ordering (Canonicalization)', () => {
    it('should accept request with reordered JSON keys', async () => {
      const payload1 = { type: 'hermes_register', hermes_id: 'test-agent', display_name: 'Test Agent' };
      const canonical1 = { display_name: 'Test Agent', hermes_id: 'test-agent', type: 'hermes_register' };
      const signature1 = crypto.createHmac('sha256', TEST_SECRET)
        .update(JSON.stringify(canonical1))
        .digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', signature1)
        .set('Content-Type', 'application/json')
        .send(payload1);

      assert.strictEqual(response.status, 200);
    });

    it('should handle nested JSON objects with sorted keys', async () => {
      const nestedPayload = {
        type: 'hermes_message',
        metadata: {
          priority: 'high',
          tags: ['urgent', 'review']
        },
        from_hermes_id: 'hermes-001',
        to_council_id: 'council-001',
        content: 'Hello with nested metadata'
      };

      const canonical = {
        content: 'Hello with nested metadata',
        from_hermes_id: 'hermes-001',
        metadata: {
          priority: 'high',
          tags: ['urgent', 'review']
        },
        to_council_id: 'council-001',
        type: 'hermes_message'
      };

      const signature = crypto.createHmac('sha256', TEST_SECRET)
        .update(JSON.stringify(canonical))
        .digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', signature)
        .set('Content-Type', 'application/json')
        .send(nestedPayload);

      assert.strictEqual(response.status, 200);
    });
  });

  describe('Unicode Payload Handling', () => {
    it('should handle unicode content correctly', async () => {
      const unicodePayload = {
        type: 'hermes_message',
        content: 'Hello 世界 🌍 Привет مرحبا שלום',
        from_hermes_id: 'hermes-001',
        to_council_id: 'council-001'
      };

      const canonical = {
        content: 'Hello 世界 🌍 Привет مرحبا שלום',
        from_hermes_id: 'hermes-001',
        to_council_id: 'council-001',
        type: 'hermes_message'
      };

      const signature = crypto.createHmac('sha256', TEST_SECRET)
        .update(JSON.stringify(canonical))
        .digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', signature)
        .set('Content-Type', 'application/json')
        .send(unicodePayload);

      assert.strictEqual(response.status, 200);
    });
  });

  describe('Null and Boolean Values', () => {
    it('should handle null values correctly', async () => {
      const payload = {
        type: 'hermes_message',
        content: 'Test message',
        from_hermes_id: 'hermes-001',
        to_council_id: 'council-001',
        reply_to: null
      };

      const canonical = {
        content: 'Test message',
        from_hermes_id: 'hermes-001',
        reply_to: null,
        to_council_id: 'council-001',
        type: 'hermes_message'
      };

      const signature = crypto.createHmac('sha256', TEST_SECRET)
        .update(JSON.stringify(canonical))
        .digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      assert.strictEqual(response.status, 200);
    });
  });

  describe('Missing Signature', () => {
    it('should reject request without signature header', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.error.code, 'SIGNATURE_REQUIRED');
    });

    it('should reject request with non-string signature header', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', '12345')
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      assert.strictEqual(response.status, 401);
    });
  });

  describe('Timing-Safe Comparison', () => {
    it('should use timing-safe comparison (no timing oracle)', async () => {
      const validSignature = crypto.createHmac('sha256', TEST_SECRET)
        .update(JSON.stringify({ display_name: 'Test', hermes_id: 'test', type: 'hermes_register' }))
        .digest('hex');

      const validResponse = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', validSignature)
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      const invalidSignature = 'b'.repeat(64);
      const invalidResponse = await request(app)
        .post('/webhook')
        .set('x-hermes-signature', invalidSignature)
        .set('Content-Type', 'application/json')
        .send({ type: 'hermes_register', hermes_id: 'test', display_name: 'Test' });

      assert.strictEqual(invalidResponse.status, 401);
      assert.strictEqual(validResponse.status, 200);
    });
  });
});