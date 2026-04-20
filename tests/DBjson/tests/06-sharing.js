'use strict';

const { suite, test, assertStatus, assert, assertEqual } = require('./framework');

suite('6. Shared Ownership', async (ctx) => {

  // ── Per-user sharing ──────────────────────────────────────────────────────

  await test('Owner can share resource with another user (read access)', async () => {
    const created = await ctx.adminClient.post('/shared_docs', {
      title: 'Shared Read',
      sharedWith: [{ userId: ctx.userId, access: 'read' }],
    });
    assertStatus(created, [201, 200]);
    ctx.readSharedId = created.data.id;
    assert(
      created.data.sharedWith.some(s => s.userId === ctx.userId && s.access === 'read'),
      'sharedWith must reflect the read grant'
    );
  });

  await test('User with read access can GET the shared item', async () => {
    const res = await ctx.userClient.get(`/shared_docs/${ctx.readSharedId}`);
    assertStatus(res, 200);
    assertEqual(res.data.id, ctx.readSharedId);
  });

  await test('Shared item appears in list for the grantee', async () => {
    const res = await ctx.userClient.get('/shared_docs');
    assertStatus(res, 200);
    assert(
      res.data.data.some(d => d.id === ctx.readSharedId),
      'Shared read item must appear in user\'s list'
    );
  });

  await test('User with read-only access cannot PATCH the shared item', async () => {
    const res = await ctx.userClient.patch(`/shared_docs/${ctx.readSharedId}`, { title: 'hacked' });
    assertStatus(res, [403, 400]);
  });

  await test('Owner can share resource with write access', async () => {
    const created = await ctx.adminClient.post('/shared_docs', {
      title: 'Shared Write',
      sharedWith: [{ userId: ctx.userId, access: 'write' }],
    });
    assertStatus(created, [201, 200]);
    ctx.writeSharedId = created.data.id;
  });

  await test('User with write access can PATCH the shared item', async () => {
    const res = await ctx.userClient.patch(`/shared_docs/${ctx.writeSharedId}`, { note: 'added by user' });
    assertStatus(res, 200);
    assertEqual(res.data.note, 'added by user');
  });

  await test('User with write access can PUT the shared item', async () => {
    const res = await ctx.userClient.put(`/shared_docs/${ctx.writeSharedId}`, { title: 'Replaced' });
    assertStatus(res, 200);
    assertEqual(res.data.title, 'Replaced');
  });

  await test('User with write access cannot DELETE the shared item (owner-only)', async () => {
    const res = await ctx.userClient.delete(`/shared_docs/${ctx.writeSharedId}`);
    assertStatus(res, [403, 400]);
  });

  // ── Owner can update sharedWith via PATCH ─────────────────────────────────

  await test('Owner can update sharing config via PATCH', async () => {
    const res = await ctx.adminClient.patch(`/shared_docs/${ctx.readSharedId}`, {
      sharedWith: [{ userId: ctx.userId, access: 'write' }],
    });
    assertStatus(res, 200);
    assert(
      res.data.sharedWith.some(s => s.userId === ctx.userId && s.access === 'write'),
      'sharedWith must be updated to write'
    );
  });

  // ── Team-based sharing ────────────────────────────────────────────────────

  // Normaliza resposta de team: aceita { team: {...} } ou o objeto direto
  function extractTeam(data) {
    return data.team ?? data;
  }

  // Normaliza lista de teams: aceita { teams: [...] } ou array direto
  function extractTeams(data) {
    return data.teams ?? (Array.isArray(data) ? data : data.data ?? []);
  }

  await test('POST /auth/teams – owner can create a team', async () => {
    const res = await ctx.adminClient.post('/auth/teams', { name: 'Team Alpha' });
    assertStatus(res, [201, 200]);
    const team = extractTeam(res.data);
    assert(team.id, 'Team must have id');
    assertEqual(team.ownerId, ctx.adminId);
    assert(team.members.includes(ctx.adminId), 'Creator must be a member');
    ctx.teamId = team.id;
  });

  await test('POST /auth/teams/:id/members – admin can add user to team', async () => {
    const res = await ctx.adminClient.post(`/auth/teams/${ctx.teamId}/members`, { userId: ctx.userId });
    assertStatus(res, 200);
    const team = extractTeam(res.data);
    assert(team.members.includes(ctx.userId), 'User must be in team members');
  });

  await test('Resource shared with team is visible to team member', async () => {
    const created = await ctx.adminClient.post('/team_docs', {
      title: 'Team Doc',
      sharedWithTeams: [{ teamId: ctx.teamId, access: 'read' }],
    });
    assertStatus(created, [201, 200]);
    ctx.teamDocId = created.data.id;

    const res = await ctx.userClient.get(`/team_docs/${ctx.teamDocId}`);
    assertStatus(res, 200);
  });

  await test('Team doc appears in list for team member', async () => {
    const res = await ctx.userClient.get('/team_docs');
    assertStatus(res, 200);
    const docs = Array.isArray(res.data) ? res.data : res.data.data;
    assert(docs.some(d => d.id === ctx.teamDocId), 'Team doc must appear in list');
  });

  await test('Team member with read access cannot PATCH team-shared item', async () => {
    const res = await ctx.userClient.patch(`/team_docs/${ctx.teamDocId}`, { title: 'sneaky' });
    assertStatus(res, [403, 400]);
  });

  await test('Team member with write access can PATCH team-shared item', async () => {
    // Update sharing to write
    await ctx.adminClient.patch(`/team_docs/${ctx.teamDocId}`, {
      sharedWithTeams: [{ teamId: ctx.teamId, access: 'write' }],
    });
    const res = await ctx.userClient.patch(`/team_docs/${ctx.teamDocId}`, { note: 'team edit' });
    assertStatus(res, 200);
    assertEqual(res.data.note, 'team edit');
  });

  await test('GET /auth/teams – member can list their teams', async () => {
    const res = await ctx.userClient.get('/auth/teams');
    assertStatus(res, 200);
    const teams = extractTeams(res.data);
    assert(teams.some(t => t.id === ctx.teamId), 'User must see the team they belong to');
  });

  await test('GET /auth/teams/:id – member can view team details', async () => {
    const res = await ctx.userClient.get(`/auth/teams/${ctx.teamId}`);
    assertStatus(res, 200);
    const team = extractTeam(res.data);
    assertEqual(team.id, ctx.teamId);
  });

  await test('DELETE /auth/teams/:id/members/:userId – owner can remove member', async () => {
    const res = await ctx.adminClient.delete(`/auth/teams/${ctx.teamId}/members/${ctx.userId}`);
    assertStatus(res, 200);
    const team = extractTeam(res.data);
    assert(!team.members.includes(ctx.userId), 'User must be removed from team');
  });

  await test('After removal team doc is no longer accessible', async () => {
    const res = await ctx.userClient.get(`/team_docs/${ctx.teamDocId}`);
    assertStatus(res, [403, 400]);
  });

  await test('PATCH /auth/teams/:id – owner can rename team', async () => {
    const res = await ctx.adminClient.patch(`/auth/teams/${ctx.teamId}`, { name: 'Team Beta' });
    assertStatus(res, 200);
    const team = extractTeam(res.data);
    assertEqual(team.name, 'Team Beta');
  });

  await test('DELETE /auth/teams/:id – owner can delete team', async () => {
    const tmp = await ctx.adminClient.post('/auth/teams', { name: 'Temp Team' });
    assertStatus(tmp, [201, 200]);
    const tmpTeam = extractTeam(tmp.data);
    const res = await ctx.adminClient.delete(`/auth/teams/${tmpTeam.id}`);
    assertStatus(res, [204, 200]);
  });
});
