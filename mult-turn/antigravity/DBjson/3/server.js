const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SIGNING_KEY = process.env.JWT_SECRET || 'super-secret-key';

const app = express();
const LISTEN_PORT = process.env.PORT || 3002;
const DB_FILE = process.env.DB_PATH || 'db.json';

app.use(express.json());

const baseSchema = { _users: [], _teams: [] };

function bootstrapDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify(baseSchema, null, 2));
        } else {
            const fileContents = fs.readFileSync(DB_FILE, 'utf8');
            if (!fileContents.trim()) {
                fs.writeFileSync(DB_FILE, JSON.stringify(baseSchema, null, 2));
            } else {
                JSON.parse(fileContents);
            }
        }
    } catch (error) {
        console.error(`Error initializing database:`, error);
        process.exit(1);
    }
}

bootstrapDB();

// A simple task queue to avoid race conditions when reading/writing asynchronously
let writeQueue = Promise.resolve();

function queueTask(task) {
    return new Promise((resolve, reject) => {
        writeQueue = writeQueue.then(async () => {
            try {
                const res = await task();
                resolve(res);
            } catch (err) {
                reject(err);
            }
        });
    });
}

function loadDB() {
    return queueTask(async () => {
        const fileContents = await fs.promises.readFile(DB_FILE, 'utf8');
        return JSON.parse(fileContents);
    });
}

function commitDB(action) {
    return queueTask(async () => {
        const fileContents = await fs.promises.readFile(DB_FILE, 'utf8');
        const db = JSON.parse(fileContents);
        const result = action(db);
        await fs.promises.writeFile(DB_FILE, JSON.stringify(db, null, 2));
        return result;
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// POST /auth/register
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        let alreadyExists = false;
        let userRecord = null;

        await commitDB((db) => {
            if (!db._users) db._users = [];

            const foundUser = db._users.find(u => u.username === username);
            if (foundUser) {
                alreadyExists = true;
                return;
            }

            const role = db._users.length === 0 ? 'admin' : 'user';
            const hashedPassword = bcrypt.hashSync(password, 10);

            userRecord = { id: crypto.randomUUID(), username, password: hashedPassword, role };
            db._users.push(userRecord);
        });

        if (alreadyExists) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        res.status(201).json({
            id: userRecord.id,
            username: userRecord.username,
            role: userRecord.role
        });

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const db = await loadDB();
        const userList = db._users || [];
        const foundUser = userList.find(u => u.username === username);

        if (!foundUser || !bcrypt.compareSync(password, foundUser.password)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { id: foundUser.id, username: foundUser.username, role: foundUser.role },
            SIGNING_KEY,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, SIGNING_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid or expired token' });
        req.user = decoded;
        next();
    });
}

// GET /auth/me
app.get('/auth/me', requireAuth, (req, res) => {
    res.status(200).json(req.user);
});

// GET /auth/users (admin only)
app.get('/auth/users', requireAuth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const db = await loadDB();
        const userList = (db._users || []).map(u => ({
            id: u.id,
            username: u.username,
            role: u.role
        }));
        res.status(200).json(userList);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /auth/users/:id/role (admin only)
app.patch('/auth/users/:id/role', requireAuth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { role } = req.body || {};
    if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
    }

    try {
        const changedUser = await commitDB((db) => {
            const userList = db._users || [];
            const pos = userList.findIndex(u => u.id === req.params.id);
            if (pos === -1) return null;

            db._users[pos].role = role;
            return {
                id: db._users[pos].id,
                username: db._users[pos].username,
                role: db._users[pos].role
            };
        });

        if (!changedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(changedUser);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// TEAM MANAGEMENT ENDPOINTS

// POST /auth/teams
app.post('/auth/teams', requireAuth, async (req, res) => {
    try {
        const { name } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const teamRecord = await commitDB((db) => {
            if (!db._teams) db._teams = [];
            const team = {
                id: crypto.randomUUID(),
                name,
                ownerId: req.user.id,
                members: [req.user.id],
                createdAt: new Date().toISOString()
            };
            db._teams.push(team);
            return team;
        });

        res.status(201).json(teamRecord);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /auth/teams/:id/members
app.post('/auth/teams/:id/members', requireAuth, async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        let httpError = null;
        const changedTeam = await commitDB((db) => {
            const team = (db._teams || []).find(t => t.id === req.params.id);
            if (!team) { httpError = 404; return null; }
            if (req.user.role !== 'admin' && team.ownerId !== req.user.id) { httpError = 403; return null; }

            if (!Array.isArray(team.members)) team.members = [];
            if (!team.members.includes(userId)) {
                team.members.push(userId);
            }
            return team;
        });

        if (httpError === 404) return res.status(404).json({ error: 'Team not found' });
        if (httpError === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(changedTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /auth/teams/:id/members/:userId
app.delete('/auth/teams/:id/members/:userId', requireAuth, async (req, res) => {
    try {
        const { id, userId } = req.params;
        let httpError = null;

        const changedTeam = await commitDB((db) => {
            const team = (db._teams || []).find(t => t.id === id);
            if (!team) { httpError = 404; return null; }
            if (req.user.role !== 'admin' && team.ownerId !== req.user.id) { httpError = 403; return null; }

            if (Array.isArray(team.members)) {
                team.members = team.members.filter(uId => uId !== userId);
            }
            return team;
        });

        if (httpError === 404) return res.status(404).json({ error: 'Team not found' });
        if (httpError === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(changedTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /auth/teams
app.get('/auth/teams', requireAuth, async (req, res) => {
    try {
        const db = await loadDB();
        const teamList = db._teams || [];
        const visibleTeams = req.user.role === 'admin'
            ? teamList
            : teamList.filter(t => Array.isArray(t.members) && t.members.includes(req.user.id));
        res.status(200).json(visibleTeams);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /auth/teams/:id
app.get('/auth/teams/:id', requireAuth, async (req, res) => {
    try {
        const db = await loadDB();
        const team = (db._teams || []).find(t => t.id === req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        if (req.user.role !== 'admin' && (!Array.isArray(team.members) || !team.members.includes(req.user.id))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.status(200).json(team);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /auth/teams/:id
app.patch('/auth/teams/:id', requireAuth, async (req, res) => {
    try {
        const { name } = req.body || {};
        let httpError = null;

        const changedTeam = await commitDB((db) => {
            const team = (db._teams || []).find(t => t.id === req.params.id);
            if (!team) { httpError = 404; return null; }
            if (req.user.role !== 'admin' && team.ownerId !== req.user.id) { httpError = 403; return null; }

            if (name) team.name = name;
            return team;
        });

        if (httpError === 404) return res.status(404).json({ error: 'Team not found' });
        if (httpError === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(changedTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /auth/teams/:id
app.delete('/auth/teams/:id', requireAuth, async (req, res) => {
    try {
        let httpError = null;
        await commitDB((db) => {
            const pos = (db._teams || []).findIndex(t => t.id === req.params.id);
            if (pos === -1) { httpError = 404; return null; }
            if (req.user.role !== 'admin' && db._teams[pos].ownerId !== req.user.id) { httpError = 403; return null; }

            db._teams.splice(pos, 1);
            return true;
        });

        if (httpError === 404) return res.status(404).json({ error: 'Team not found' });
        if (httpError === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Protect all dynamic routes below with auth middleware
app.use(requireAuth);

// Block reserved collections for direct dynamic CRUD
app.use('/:resource', (req, res, next) => {
    if (req.params.resource === '_users' || req.params.resource === '_teams') {
        return res.status(403).json({ error: 'Access to reserved collections is forbidden' });
    }
    next();
});

// GET /:resource -> return all items in the collection
app.get('/:resource', async (req, res) => {
    try {
        const { resource } = req.params;
        const db = await loadDB();

        let docs = db[resource] || [];

        // 1. Ownership and sharing filters FIRST
        if (req.user.role !== 'admin') {
            const userGroups = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);

            docs = docs.filter(doc => {
                if (doc.ownerId === req.user.id) return true;
                if (Array.isArray(doc.sharedWith) && doc.sharedWith.some(s => s.userId === req.user.id)) return true;
                if (Array.isArray(doc.sharedWithTeams) && doc.sharedWithTeams.some(s => userGroups.includes(s.teamId))) return true;
                return false;
            });
        }

        // 2. Query Parameters (Filters)
        const { _sort, _order, _limit, _offset, _or, ...filters } = req.query;
        const orMode = _or === 'true';

        const queryKeys = Object.keys(filters);
        if (queryKeys.length > 0) {
            docs = docs.filter(doc => {
                let checks = queryKeys.map(key => {
                    let field = key;
                    let operator = 'eq';

                    if (key.includes('__')) {
                        const parts = key.split('__');
                        operator = parts.pop();
                        field = parts.join('__');
                    }

                    const queryVal = filters[key];
                    const docVal = doc[field];

                    const parseVal = (val, target) => {
                        if (val === 'null') return null;
                        if (typeof target === 'boolean') return val === 'true';
                        if (typeof target === 'number') return Number(val);
                        return val;
                    };

                    const expected = parseVal(queryVal, docVal);

                    switch (operator) {
                        case 'eq': return docVal === expected;
                        case 'ne': return docVal !== expected;
                        case 'gt': return docVal > Number(queryVal);
                        case 'gte': return docVal >= Number(queryVal);
                        case 'lt': return docVal < Number(queryVal);
                        case 'lte': return docVal <= Number(queryVal);
                        case 'between':
                            if (typeof queryVal !== 'string') return false;
                            const [min, max] = queryVal.split(',').map(Number);
                            return docVal >= min && docVal <= max;
                        case 'contains':
                            if (typeof docVal !== 'string') return false;
                            return docVal.toLowerCase().includes(String(queryVal).toLowerCase());
                        case 'startswith':
                            if (typeof docVal !== 'string') return false;
                            return docVal.toLowerCase().startsWith(String(queryVal).toLowerCase());
                        case 'endswith':
                            if (typeof docVal !== 'string') return false;
                            return docVal.toLowerCase().endsWith(String(queryVal).toLowerCase());
                        case 'in':
                            if (typeof queryVal !== 'string') return false;
                            const options = queryVal.split(',').map(v => parseVal(v, docVal));
                            return options.includes(docVal);
                        default:
                            return docVal === expected;
                    }
                });

                return orMode ? checks.some(r => r === true) : checks.every(r => r === true);
            });
        }

        // 3. Sorting
        if (_sort) {
            const direction = _order === 'desc' ? -1 : 1;
            docs.sort((a, b) => {
                if (a[_sort] < b[_sort]) return -1 * direction;
                if (a[_sort] > b[_sort]) return 1 * direction;
                return 0;
            });
        }

        // 4. Pagination
        const count = docs.length;
        const limitSet = typeof _limit !== 'undefined';
        const offsetSet = typeof _offset !== 'undefined';

        if (limitSet || offsetSet) {
            const take = limitSet ? parseInt(_limit, 10) : count;
            const skip = offsetSet ? parseInt(_offset, 10) : 0;
            const data = docs.slice(skip, skip + take);
            return res.status(200).json({ data, total: count, limit: take, offset: skip });
        }

        res.status(200).json(docs);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /:resource/:id -> return a single item by id; 404 if not found
app.get('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        const db = await loadDB();

        const docs = db[resource] || [];
        const doc = docs.find(i => i.id === id);

        if (!doc) {
            return res.status(404).json({ error: 'Item not found' });
        }

        if (req.user.role !== 'admin' && doc.ownerId !== req.user.id) {
            const userGroups = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);
            const sharedWithUser = Array.isArray(doc.sharedWith) && doc.sharedWith.some(s => s.userId === req.user.id);
            const sharedWithTeam = Array.isArray(doc.sharedWithTeams) && doc.sharedWithTeams.some(s => userGroups.includes(s.teamId));

            if (!sharedWithUser && !sharedWithTeam) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        res.status(200).json(doc);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /:resource -> create a new item
app.post('/:resource', async (req, res) => {
    try {
        const { resource } = req.params;
        const body = req.body || {};

        const savedItem = await commitDB((db) => {
            if (!db[resource] || !Array.isArray(db[resource])) {
                db[resource] = [];
            }

            const doc = {
                ...body,
                sharedWith: Array.isArray(body.sharedWith) ? body.sharedWith : [],
                sharedWithTeams: Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : [],
                id: crypto.randomUUID(),
                ownerId: req.user.id,
                createdAt: new Date().toISOString()
            };

            db[resource].push(doc);
            return doc;
        });

        res.status(201).json(savedItem);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /:resource/:id -> fully replace an item; 404 if not found
app.put('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        const body = req.body || {};

        let httpError = null;

        const newVersion = await commitDB((db) => {
            const docs = db[resource] || [];
            const pos = docs.findIndex(i => i.id === id);

            if (pos === -1) {
                httpError = 404;
                return null;
            }

            const existingItem = docs[pos];

            if (req.user.role !== 'admin' && existingItem.ownerId !== req.user.id) {
                const userGroups = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);
                const canWriteUser = Array.isArray(existingItem.sharedWith) && existingItem.sharedWith.some(s => s.userId === req.user.id && s.access === 'write');
                const canWriteTeam = Array.isArray(existingItem.sharedWithTeams) && existingItem.sharedWithTeams.some(s => userGroups.includes(s.teamId) && s.access === 'write');

                if (!canWriteUser && !canWriteTeam) {
                    httpError = 403;
                    return null;
                }
            }

            let changeTime = new Date().toISOString();
            if (changeTime === existingItem.createdAt) {
                changeTime = new Date(Date.now() + 1).toISOString();
            }

            const isPrivileged = req.user.role === 'admin' || existingItem.ownerId === req.user.id;

            const newSharedWith = Array.isArray(body.sharedWith) ? body.sharedWith : (existingItem.sharedWith || []);
            const finalSharedWith = isPrivileged ? newSharedWith : (existingItem.sharedWith || []);

            const newSharedWithTeams = Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : (existingItem.sharedWithTeams || []);
            const finalSharedWithTeams = isPrivileged ? newSharedWithTeams : (existingItem.sharedWithTeams || []);

            const replacement = {
                ...body,
                sharedWith: finalSharedWith,
                sharedWithTeams: finalSharedWithTeams,
                id: existingItem.id,
                ownerId: existingItem.ownerId,
                createdAt: existingItem.createdAt,
                updatedAt: changeTime
            };

            db[resource][pos] = replacement;
            return replacement;
        });

        if (httpError === 404) return res.status(404).json({ error: 'Item not found' });
        if (httpError === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(newVersion);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /:resource/:id -> partially update an item; 404 if not found
app.patch('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        const body = req.body || {};

        let httpError = null;

        const patched = await commitDB((db) => {
            const docs = db[resource] || [];
            const pos = docs.findIndex(i => i.id === id);

            if (pos === -1) {
                httpError = 404;
                return null;
            }

            const existingItem = docs[pos];

            if (req.user.role !== 'admin' && existingItem.ownerId !== req.user.id) {
                const userGroups = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);
                const canWriteUser = Array.isArray(existingItem.sharedWith) && existingItem.sharedWith.some(s => s.userId === req.user.id && s.access === 'write');
                const canWriteTeam = Array.isArray(existingItem.sharedWithTeams) && existingItem.sharedWithTeams.some(s => userGroups.includes(s.teamId) && s.access === 'write');

                if (!canWriteUser && !canWriteTeam) {
                    httpError = 403;
                    return null;
                }
            }

            let changeTime = new Date().toISOString();
            if (changeTime === existingItem.createdAt) {
                changeTime = new Date(Date.now() + 1).toISOString();
            }

            const isPrivileged = req.user.role === 'admin' || existingItem.ownerId === req.user.id;

            const newSharedWith = body.hasOwnProperty('sharedWith') ? (Array.isArray(body.sharedWith) ? body.sharedWith : []) : (existingItem.sharedWith || []);
            const finalSharedWith = isPrivileged ? newSharedWith : (existingItem.sharedWith || []);

            const newSharedWithTeams = body.hasOwnProperty('sharedWithTeams') ? (Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : []) : (existingItem.sharedWithTeams || []);
            const finalSharedWithTeams = isPrivileged ? newSharedWithTeams : (existingItem.sharedWithTeams || []);

            const result = {
                ...existingItem,
                ...body,
                sharedWith: finalSharedWith,
                sharedWithTeams: finalSharedWithTeams,
                id: existingItem.id,
                ownerId: existingItem.ownerId,
                createdAt: existingItem.createdAt,
                updatedAt: changeTime
            };

            db[resource][pos] = result;
            return result;
        });

        if (httpError === 404) return res.status(404).json({ error: 'Item not found' });
        if (httpError === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(patched);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /:resource/:id -> remove an item; 200/204 on success; 404 if not found
app.delete('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;

        let httpError = null;

        await commitDB((db) => {
            const docs = db[resource] || [];
            const pos = docs.findIndex(i => i.id === id);

            if (pos === -1) {
                httpError = 404;
                return null;
            }

            const existingItem = docs[pos];

            if (req.user.role !== 'admin' && existingItem.ownerId !== req.user.id) {
                httpError = 403;
                return null;
            }

            db[resource].splice(pos, 1);
            return true;
        });

        if (httpError === 404) return res.status(404).json({ error: 'Item not found' });
        if (httpError === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(LISTEN_PORT, () => {
    console.log(`running on port ${LISTEN_PORT}`);
});
