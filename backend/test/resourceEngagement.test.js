const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const sequelize = require('../database/config/database');
const controller = require('../api/controllers/resourceEngagementController');

const originalQuery = sequelize.query;

function responseMock() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

afterEach(() => {
  sequelize.query = originalQuery;
});

test('publishes aggregate ratings without exposing individual accounts', async () => {
  const summary = [{
    resourceId: 'sh:documents/bio/paper.pdf',
    upVotes: 18,
    downVotes: 6,
    totalVotes: 24,
    shareCount: 9,
  }];
  sequelize.query = async (_sql, options) => {
    assert.equal(options.type, 'SELECT');
    assert.match(_sql, /study_hub_resource_shares/);
    return summary;
  };
  const res = responseMock();

  await controller.getStats({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.resources, summary);
  assert.equal(JSON.stringify(res.body).includes('userId'), false);
});

test('saves thumbs-up and thumbs-down ratings for the authenticated account', async () => {
  sequelize.query = async (sql, options) => {
    assert.match(sql, /ON CONFLICT/);
    assert.deepEqual(options.replacements, {
      resourceId: 'ft:https://example.test/resource.pdf',
      userId: 42,
      vote: -1,
    });
    return [];
  };
  const res = responseMock();

  await controller.saveVote({
    body: { resourceId: 'ft:https://example.test/resource.pdf', vote: -1 },
    user: { id: 42 },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.vote, -1);
});

test('rejects malformed resource IDs and invalid vote values', async () => {
  let queried = false;
  sequelize.query = async () => {
    queried = true;
    return [];
  };
  const badIdResponse = responseMock();
  await controller.saveBookmark({ body: { resourceId: 'unknown:document' }, user: { id: 42 } }, badIdResponse);
  assert.equal(badIdResponse.statusCode, 400);

  const badVoteResponse = responseMock();
  await controller.saveVote({ body: { resourceId: 'sh:notes/file.pdf', vote: 0 }, user: { id: 42 } }, badVoteResponse);
  assert.equal(badVoteResponse.statusCode, 400);
  assert.equal(queried, false);
});

test('records a resource share without requiring an account', async () => {
  sequelize.query = async (sql, options) => {
    assert.match(sql, /INSERT INTO public\.study_hub_resource_shares/);
    assert.deepEqual(options.replacements, { resourceId: 'sh:documents/bio/paper.pdf' });
    return [];
  };
  const res = responseMock();

  await controller.saveShare({ body: { resourceId: 'sh:documents/bio/paper.pdf' } }, res);

  assert.equal(res.statusCode, 204);
});

test('stores bookmarks independently by resource and account', async () => {
  sequelize.query = async (sql, options) => {
    assert.match(sql, /study_hub_resource_bookmarks/);
    assert.deepEqual(options.replacements, {
      resourceId: 'sh:documents/chemistry/notes.pdf',
      userId: 7,
    });
    return [];
  };
  const res = responseMock();

  await controller.saveBookmark({
    body: { resourceId: 'sh:documents/chemistry/notes.pdf' },
    user: { id: 7 },
  }, res);

  assert.equal(res.statusCode, 204);
});
