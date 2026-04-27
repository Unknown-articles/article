const { updateDB, readDB } = require('./db');
const { v4: uuidv4 } = require('uuid');

async function createTeam(name, ownerId) {
  return updateDB(data => {
    const team = {
      id: uuidv4(),
      name,
      ownerId,
      members: [ownerId],
      createdAt: new Date().toISOString()
    };
    data._teams.push(team);
    return team;
  });
}

async function getTeams(userId) {
  const data = await readDB();
  return data._teams.filter(t => t.members.includes(userId));
}

async function getTeam(id, userId) {
  const data = await readDB();
  const team = data._teams.find(t => t.id === id);
  if (!team || !team.members.includes(userId)) {
    throw new Error('Not found or not member');
  }
  return team;
}

async function addMember(teamId, userId, adderId) {
  return updateDB(data => {
    const team = data._teams.find(t => t.id === teamId);
    if (!team) throw new Error('Team not found');
    const adder = data._users.find(u => u.id === adderId);
    if (team.ownerId !== adderId && (!adder || adder.role !== 'admin')) throw new Error('Not authorized');
    if (!team.members.includes(userId)) {
      team.members.push(userId);
    }
    return team;
  });
}

async function removeMember(teamId, userId, removerId) {
  return updateDB(data => {
    const team = data._teams.find(t => t.id === teamId);
    if (!team) throw new Error('Team not found');
    if (team.ownerId !== removerId) throw new Error('Not owner');
    team.members = team.members.filter(m => m !== userId);
    return team;
  });
}

async function updateTeam(id, name, ownerId) {
  return updateDB(data => {
    const team = data._teams.find(t => t.id === id);
    if (!team || team.ownerId !== ownerId) throw new Error('Not found or not owner');
    team.name = name;
    return team;
  });
}

async function deleteTeam(id, ownerId) {
  updateDB(data => {
    const index = data._teams.findIndex(t => t.id === id && t.ownerId === ownerId);
    if (index === -1) throw new Error('Not found or not owner');
    data._teams.splice(index, 1);
  });
}

module.exports = { createTeam, getTeams, getTeam, addMember, removeMember, updateTeam, deleteTeam };