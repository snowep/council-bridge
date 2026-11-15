import { test, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createTestDatabase } from './test-database.js';

test('creates isolated database with unique path', () => {
  const db1 = createTestDatabase('test-1');
  const db2 = createTestDatabase('test-2');

  assert.notStrictEqual(db1.path, db2.path);
  assert.ok(db1.path.includes('test-1'));
  assert.ok(db2.path.includes('test-2'));

  db1.instance.close();
  db2.instance.close();
});

test('cleans up database files on close', () => {
  const db = createTestDatabase('cleanup-test');
  const dbPath = db.path;

  db.close();

  assert.ok(!fs.existsSync(dbPath), 'main db file should be removed');
  assert.ok(!fs.existsSync(dbPath + '-wal'), 'wal file should be removed');
  assert.ok(!fs.existsSync(dbPath + '-shm'), 'shm file should be removed');
});

test('can execute queries on created database', () => {
  const db = createTestDatabase('query-test');

  const result = db.instance.query('SELECT 1 as test');
  assert.strictEqual(result[0].test, 1);

  db.close();
});

test('each test gets independent database', () => {
  const db1 = createTestDatabase('independent-1');
  const db2 = createTestDatabase('independent-2');

  db1.instance.runPreparedStatement('insertAgent', ['id1', 'agent1', 'Agent 1', 'claude']);
  db2.instance.runPreparedStatement('insertAgent', ['id2', 'agent2', 'Agent 2', 'claude']);

  const agent1 = db1.instance.query('SELECT * FROM agents WHERE agent_id = ?', ['agent1']);
  const agent2 = db2.instance.query('SELECT * FROM agents WHERE agent_id = ?', ['agent2']);

  assert.strictEqual(agent1.length, 1);
  assert.strictEqual(agent2.length, 1);
  assert.strictEqual(agent1[0].display_name, 'Agent 1');
  assert.strictEqual(agent2[0].display_name, 'Agent 2');

  // Verify isolation - db1 should not see db2's agent
  const crossCheck = db1.instance.query('SELECT * FROM agents WHERE agent_id = ?', ['agent2']);
  assert.strictEqual(crossCheck.length, 0);

  db1.close();
  db2.close();
});