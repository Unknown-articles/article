const path = require('path');
const fs = require('fs').promises;

process.env.DB_FILE = path.resolve(__dirname, 'test-db.json');
process.env.JWT_SECRET = 'testsecret';

const request = require('supertest');
const app = require('../src/app');

const testDb = process.env.DB_FILE;

async function resetDb() {
  await fs.rm(testDb, {force: true});
}

async function registerUser(username, password) {
  const response = await request(app).post('/auth/register').send({username, password});
  return response.body;
}

async function loginUser(username, password) {
  const response = await request(app).post('/auth/login').send({username, password});
  return response.body;
}

describe('Dynamic JSON REST API', () => {
  let adminToken;
  let userToken;
  let adminId;
  let userId;

  beforeEach(async () => {
    await resetDb();
  });

  test('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({status: 'ok'});
  });

  test('auth register, login, role, and profile flows', async () => {
    const first = await request(app).post('/auth/register').send({username: 'admin', password: 'pass'});
    expect(first.status).toBe(201);
    expect(first.body.user.role).toBe('admin');
    adminToken = first.body.token;
    adminId = first.body.user.id;

    const second = await request(app).post('/auth/register').send({username: 'alice', password: 'word'});
    expect(second.status).toBe(201);
    expect(second.body.user.role).toBe('user');
    userToken = second.body.token;
    userId = second.body.user.id;

    const duplicate = await request(app).post('/auth/register').send({username: 'admin', password: 'x'});
    expect(duplicate.status).toBe(400);

    const missing = await request(app).post('/auth/register').send({username: 'nope'});
    expect(missing.status).toBe(400);

    const loginAdmin = await request(app).post('/auth/login').send({username: 'admin', password: 'pass'});
    expect(loginAdmin.status).toBe(200);
    expect(loginAdmin.body.token).toBeDefined();

    const loginUser = await request(app).post('/auth/login').send({username: 'alice', password: 'word'});
    expect(loginUser.status).toBe(200);
    expect(loginUser.body.user.username).toBe('alice');

    const wrongPassword = await request(app).post('/auth/login').send({username: 'alice', password: 'bad'});
    expect(wrongPassword.status).toBe(401);

    const unknown = await request(app).post('/auth/login').send({username: 'no', password: 'no'});
    expect(unknown.status).toBe(401);

    const meFail = await request(app).get('/auth/me');
    expect(meFail.status).toBe(401);

    const meOk = await request(app).get('/auth/me').set('Authorization', `Bearer ${adminToken}`);
    expect(meOk.status).toBe(200);
    expect(meOk.body.username).toBe('admin');

    const usersListForbidden = await request(app).get('/auth/users').set('Authorization', `Bearer ${userToken}`);
    expect(usersListForbidden.status).toBe(403);

    const usersList = await request(app).get('/auth/users').set('Authorization', `Bearer ${adminToken}`);
    expect(usersList.status).toBe(200);
    expect(usersList.body).toHaveLength(2);

    const promote = await request(app)
      .patch(`/auth/users/${userId}/role`)
      .send({role: 'admin'})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(promote.status).toBe(200);
    expect(promote.body.role).toBe('admin');

    const demote = await request(app)
      .patch(`/auth/users/${userId}/role`)
      .send({role: 'user'})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(demote.status).toBe(200);
    expect(demote.body.role).toBe('user');

    const invalidRole = await request(app)
      .patch(`/auth/users/${userId}/role`)
      .send({role: 'manager'})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidRole.status).toBe(400);

    const nonAdminPromote = await request(app)
      .patch(`/auth/users/${adminId}/role`)
      .send({role: 'user'})
      .set('Authorization', `Bearer ${userToken}`);
    expect(nonAdminPromote.status).toBe(403);
  });

  test('dynamic resources and ownership rules', async () => {
    const admin = await request(app).post('/auth/register').send({username: 'admin', password: 'pass'});
    const user = await request(app).post('/auth/register').send({username: 'bob', password: 'pass'});
    adminToken = admin.body.token;
    userToken = user.body.token;
    adminId = admin.body.user.id;
    userId = user.body.user.id;

    const collectionCreate = await request(app)
      .post('/widgets')
      .send({name: 'widget-1', price: 10, ownerId: 'other', id: '123'})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(collectionCreate.status).toBe(201);
    expect(collectionCreate.body.id).toBeDefined();
    expect(collectionCreate.body.ownerId).toBe(adminId);
    expect(collectionCreate.body.name).toBe('widget-1');

    const listNoToken = await request(app).get('/widgets');
    expect(listNoToken.status).toBe(401);

    const listAdmin = await request(app).get('/widgets').set('Authorization', `Bearer ${adminToken}`);
    expect(listAdmin.status).toBe(200);
    expect(listAdmin.body.length).toBe(1);

    const resource = listAdmin.body[0];
    const getSingle = await request(app).get(`/widgets/${resource.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(getSingle.status).toBe(200);
    expect(getSingle.body.name).toBe('widget-1');

    const getUnknown = await request(app).get('/widgets/unknown').set('Authorization', `Bearer ${adminToken}`);
    expect(getUnknown.status).toBe(404);

    const putFail = await request(app)
      .put('/widgets/unknown')
      .send({name: 'no'})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(putFail.status).toBe(404);

    const createByUser = await request(app)
      .post('/widgets')
      .send({name: 'widget-2'})
      .set('Authorization', `Bearer ${userToken}`);
    expect(createByUser.status).toBe(201);
    expect(createByUser.body.ownerId).toBe(userId);

    const listUser = await request(app).get('/widgets').set('Authorization', `Bearer ${userToken}`);
    expect(listUser.status).toBe(200);
    expect(listUser.body.length).toBe(1);

    const notOwner = await request(app)
      .patch(`/widgets/${resource.id}`)
      .send({price: 20})
      .set('Authorization', `Bearer ${userToken}`);
    expect(notOwner.status).toBe(403);

    const shareRead = await request(app)
      .patch(`/widgets/${resource.id}`)
      .send({sharedWith: [{type: 'user', id: userId, access: 'read'}]})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(shareRead.status).toBe(200);
    expect(shareRead.body.sharedWith).toHaveLength(1);

    const sharedGet = await request(app).get(`/widgets/${resource.id}`).set('Authorization', `Bearer ${userToken}`);
    expect(sharedGet.status).toBe(200);

    const sharedPatchFail = await request(app)
      .patch(`/widgets/${resource.id}`)
      .send({price: 99})
      .set('Authorization', `Bearer ${userToken}`);
    expect(sharedPatchFail.status).toBe(403);

    const shareWrite = await request(app)
      .patch(`/widgets/${resource.id}`)
      .send({sharedWith: [{type: 'user', id: userId, access: 'write'}]})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(shareWrite.status).toBe(200);

    const sharedPatch = await request(app)
      .patch(`/widgets/${resource.id}`)
      .send({price: 99})
      .set('Authorization', `Bearer ${userToken}`);
    expect(sharedPatch.status).toBe(200);
    expect(sharedPatch.body.price).toBe(99);

    const sharedPut = await request(app)
      .put(`/widgets/${resource.id}`)
      .send({name: 'widget-1-updated', price: 50})
      .set('Authorization', `Bearer ${userToken}`);
    expect(sharedPut.status).toBe(200);
    expect(sharedPut.body.name).toBe('widget-1-updated');

    const deleteForbidden = await request(app)
      .delete(`/widgets/${resource.id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(deleteForbidden.status).toBe(403);

    const deleteAllowed = await request(app)
      .delete(`/widgets/${resource.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteAllowed.status).toBe(204);

    const reservedUnderscore = await request(app)
      .post('/_users')
      .send({test: 'value'})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reservedUnderscore.status).toBe(404);

    const reservedAuth = await request(app)
      .post('/auth')
      .send({test: 'value'})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reservedAuth.status).toBe(404);
  });

  test('team sharing and access control', async () => {
    const adminResp = await request(app).post('/auth/register').send({username: 'admin', password: 'pass'});
    const userAResp = await request(app).post('/auth/register').send({username: 'alice', password: 'pass'});
    const userBResp = await request(app).post('/auth/register').send({username: 'bob', password: 'pass'});

    adminToken = adminResp.body.token;
    userToken = userAResp.body.token;
    const bobToken = userBResp.body.token;
    const bobId = userBResp.body.user.id;
    const aliceId = userAResp.body.user.id;

    const team = await request(app)
      .post('/auth/teams')
      .send({name: 'devs'})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(team.status).toBe(201);
    const teamId = team.body.id;

    const addMember = await request(app)
      .post(`/auth/teams/${teamId}/members`)
      .send({userId: bobId})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(addMember.status).toBe(200);
    expect(addMember.body.members).toContain(bobId);

    const widget = await request(app)
      .post('/projects')
      .send({name: 'shared-by-team', sharedWith: [{type: 'team', id: teamId, access: 'read'}]})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(widget.status).toBe(201);

    const bobView = await request(app).get(`/projects/${widget.body.id}`).set('Authorization', `Bearer ${bobToken}`);
    expect(bobView.status).toBe(200);

    const bobPatchFail = await request(app)
      .patch(`/projects/${widget.body.id}`)
      .send({name: 'changed'})
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobPatchFail.status).toBe(403);

    const shareTeamWrite = await request(app)
      .patch(`/projects/${widget.body.id}`)
      .send({sharedWith: [{type: 'team', id: teamId, access: 'write'}]})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(shareTeamWrite.status).toBe(200);

    const bobPatch = await request(app)
      .patch(`/projects/${widget.body.id}`)
      .send({name: 'team-changed'})
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobPatch.status).toBe(200);

    const teamList = await request(app).get('/auth/teams').set('Authorization', `Bearer ${bobToken}`);
    expect(teamList.status).toBe(200);
    expect(teamList.body.some((t) => t.id === teamId)).toBe(true);

    const teamGet = await request(app).get(`/auth/teams/${teamId}`).set('Authorization', `Bearer ${bobToken}`);
    expect(teamGet.status).toBe(200);

    const removeMember = await request(app)
      .delete(`/auth/teams/${teamId}/members/${bobId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(removeMember.status).toBe(200);
    expect(removeMember.body.members).not.toContain(bobId);

    const bobNoLongerAccess = await request(app).get(`/projects/${widget.body.id}`).set('Authorization', `Bearer ${bobToken}`);
    expect(bobNoLongerAccess.status).toBe(403);

    const renameTeam = await request(app)
      .patch(`/auth/teams/${teamId}`)
      .send({name: 'dev-team'})
      .set('Authorization', `Bearer ${adminToken}`);
    expect(renameTeam.status).toBe(200);
    expect(renameTeam.body.name).toBe('dev-team');

    const deleteTeam = await request(app)
      .delete(`/auth/teams/${teamId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteTeam.status).toBe(204);
  });

  test('query, sort, pagination and concurrency', async () => {
    const adminResp = await request(app).post('/auth/register').send({username: 'admin', password: 'pass'});
    adminToken = adminResp.body.token;

    const create = async (item) => request(app).post('/products').send(item).set('Authorization', `Bearer ${adminToken}`);
    await create({name: 'Alpha', price: 20, active: true});
    await create({name: 'Bravo', price: 40, active: true});
    await create({name: 'Charlie', price: 10, active: false});
    await create({name: 'Delta', price: 30, active: true});

    const eqFilter = await request(app).get('/products?name=Alpha').set('Authorization', `Bearer ${adminToken}`);
    expect(eqFilter.body.length).toBe(1);

    const boolFilter = await request(app).get('/products?active=true').set('Authorization', `Bearer ${adminToken}`);
    expect(boolFilter.body.every((item) => item.active === true)).toBe(true);

    const neFilter = await request(app).get('/products?price__ne=20').set('Authorization', `Bearer ${adminToken}`);
    expect(neFilter.body.length).toBe(3);

    const gtFilter = await request(app).get('/products?price__gt=25').set('Authorization', `Bearer ${adminToken}`);
    expect(gtFilter.body.every((item) => item.price > 25)).toBe(true);

    const gteFilter = await request(app).get('/products?price__gte=30').set('Authorization', `Bearer ${adminToken}`);
    expect(gteFilter.body.every((item) => item.price >= 30)).toBe(true);

    const ltFilter = await request(app).get('/products?price__lt=30').set('Authorization', `Bearer ${adminToken}`);
    expect(ltFilter.body.every((item) => item.price < 30)).toBe(true);

    const lteFilter = await request(app).get('/products?price__lte=20').set('Authorization', `Bearer ${adminToken}`);
    expect(lteFilter.body.every((item) => item.price <= 20)).toBe(true);

    const betweenFilter = await request(app).get('/products?price__between=15,30').set('Authorization', `Bearer ${adminToken}`);
    expect(betweenFilter.body.every((item) => item.price >= 15 && item.price <= 30)).toBe(true);

    const containsFilter = await request(app).get('/products?name__contains=ar').set('Authorization', `Bearer ${adminToken}`);
    expect(containsFilter.body.every((item) => item.name.toLowerCase().includes('ar'))).toBe(true);

    const startsFilter = await request(app).get('/products?name__startswith=B').set('Authorization', `Bearer ${adminToken}`);
    expect(startsFilter.body.every((item) => item.name.startsWith('B'))).toBe(true);

    const endsFilter = await request(app).get('/products?name__endswith=a').set('Authorization', `Bearer ${adminToken}`);
    expect(endsFilter.body.every((item) => item.name.endsWith('a'))).toBe(true);

    const inFilter = await request(app).get('/products?name__in=Bravo,Delta').set('Authorization', `Bearer ${adminToken}`);
    expect(inFilter.body.length).toBe(2);

    const orFilter = await request(app).get('/products?name=Alpha&name=Charlie&_or=true').set('Authorization', `Bearer ${adminToken}`);
    expect(orFilter.body.length).toBe(2);

    const sortAsc = await request(app).get('/products?_sort=price').set('Authorization', `Bearer ${adminToken}`);
    expect(sortAsc.body.map((item) => item.price)).toEqual([10, 20, 30, 40]);

    const sortDesc = await request(app).get('/products?_sort=-price').set('Authorization', `Bearer ${adminToken}`);
    expect(sortDesc.body.map((item) => item.price)).toEqual([40, 30, 20, 10]);

    const sortName = await request(app).get('/products?_sort=name').set('Authorization', `Bearer ${adminToken}`);
    expect(sortName.body.map((item) => item.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);

    const limit = await request(app).get('/products?_limit=2').set('Authorization', `Bearer ${adminToken}`);
    expect(limit.body.length).toBe(2);

    const offset = await request(app).get('/products?_offset=2').set('Authorization', `Bearer ${adminToken}`);
    expect(offset.body.length).toBe(2);

    const limitOffset = await request(app).get('/products?_limit=2&_offset=1').set('Authorization', `Bearer ${adminToken}`);
    expect(limitOffset.body.length).toBe(2);

    const combined = await request(app)
      .get('/products?active=true&_sort=-price&_limit=2&_offset=0')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(combined.body.length).toBe(2);
    expect(combined.body[0].price).toBe(40);

    const concurrent = await Promise.all(
      Array.from({length: 5}, (_, idx) =>
        request(app)
          .post('/orders')
          .send({name: `order-${idx}`})
          .set('Authorization', `Bearer ${adminToken}`)
      )
    );
    expect(concurrent.every((res) => res.status === 201)).toBe(true);
    const ids = concurrent.map((res) => res.body.id);
    expect(new Set(ids).size).toBe(5);

    const concurrentReads = await Promise.all(
      Array.from({length: 3}, () => request(app).get('/orders').set('Authorization', `Bearer ${adminToken}`))
    );
    expect(concurrentReads.every((res) => res.status === 200)).toBe(true);
    expect(concurrentReads[0].body.length).toBe(5);

    const item = concurrent[0].body;
    const patchResults = await Promise.all(
      [0, 1, 2].map((suffix) =>
        request(app)
          .patch(`/orders/${item.id}`)
          .send({note: `n-${suffix}`})
          .set('Authorization', `Bearer ${adminToken}`)
      )
    );
    expect(patchResults.every((res) => res.status === 200)).toBe(true);
    const finalGet = await request(app).get(`/orders/${item.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(finalGet.status).toBe(200);

    const deleteConcurrent = await Promise.all(
      concurrent.slice(1).map((res) =>
        request(app).delete(`/orders/${res.body.id}`).set('Authorization', `Bearer ${adminToken}`)
      )
    );
    expect(deleteConcurrent.every((res) => res.status === 204)).toBe(true);
  });
});
