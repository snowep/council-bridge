import { generateFounderKeyPair, signFounderRequest, verifyFounderRequest, canonicalizeForSigning } from './src/auth/founder.js';

const keyPair = generateFounderKeyPair();
const operation = 'approve_execution';
const payload = { action: 'approve_execution', execution_id: 'exec-123', approved: true };
const tamperedPayload = { action: 'approve_execution', execution_id: 'exec-123', approved: false };

console.log('Payload:', JSON.stringify(payload));
console.log('Tampered:', JSON.stringify(tamperedPayload));

const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

console.log('Signed payload:', JSON.stringify(signed.payload));
console.log('Signed operation:', signed.operation);

const origCanonical = canonicalizeForSigning(operation, payload, signed.timestamp, signed.nonce, keyPair.key_id);
const tamperedCanonical = canonicalizeForSigning(operation, tamperedPayload, signed.timestamp, signed.nonce, keyPair.key_id);

console.log('Original canonical:', origCanonical);
console.log('Tampered canonical:', tamperedCanonical);
console.log('Are they different?', origCanonical !== tamperedCanonical);
console.log('');

const valid1 = verifyFounderRequest(operation, payload, signed.timestamp, signed.nonce, signed.signature, keyPair.public_key, keyPair.key_id);
const valid2 = verifyFounderRequest(operation, tamperedPayload, signed.timestamp, signed.nonce, signed.signature, keyPair.public_key, keyPair.key_id);
console.log('Original valid:', valid1);
console.log('Tampered valid:', valid2);