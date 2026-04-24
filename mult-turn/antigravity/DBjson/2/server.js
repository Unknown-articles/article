const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const TOKEN_SECRET = process.env.JWT_SECRET || 'super-secret-key';

const app = express();
const APP_PORT = process.env.PORT || 3001;
const STORE_FILE = process.env.DB_PATH || 'db.json';

app.use(express.json());

const emptyStoreShape = { _users: [], _teams: [] };

function setupStore() {
    try {
        if (!fs.existsSync(STORE_FILE)) {
            fs.writeFileSync(STORE_FILE, JSON.stringify(emptyStoreShape, null, 2));
        } else {
            const rawData = fs.readFileSync(STORE_FILE, 'utf8');
            if (!rawData.trim()) {
                fs.writeFileSync(STORE_FILE, JSON.stringify(emptyStoreShape, null, 2));
            } else {
                JSON.parse(rawData);
            }
        }
    } catch (error) {
        console.error(`Error initializing database:`, error);
        process.exit(1);
    }
}

setupStore();

// A simple task queue to avoid race conditions when reading/writing asynchronously
let taskQueue = Promise.resolve();

function addToQueue(task) {
    return new Promise((resolve, reject) => {
        taskQueue = taskQueue.then(async () => {
            try {
                const res = await task();
                resolve(res);
            } catch (err) {
                reject(err);
            }
        });
    });
}

function fetchStore() {
    return addToQueue(async () => {
        const rawData = await fs.promises.readFile(STORE_FILE, 'utf8');
        return JSON.parse(rawData);
    });
}

function updateStore(action) {
    return addToQueue(async () => {
        const rawData = await fs.promises.readFile(STORE_FILE, 'utf8');
        const db = JSON.parse(rawData);
        const result = action(db);
        await fs.promises.writeFile(STORE_FILE, JSON.stringify(db, null, 2));
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

        let duplicateFound = false;
        let registeredUser = null;

        await updateStore((db) => {
            if (!db._users) db._users = [];

            const matchedUser = db._users.find(u => u.username === username);
            if (matchedUser) {
                duplicateFound = true;
                return;
            }

            const role = db._users.length === 0 ? 'admin' : 'user';
            const hashedPassword = bcrypt.hashSync(password, 10);

            registeredUser = { id: crypto.randomUUID(), username, password: hashedPassword, role };
            db._users.push(registeredUser);
        });

        if (duplicateFound) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        res.status(201).json({
            id: registeredUser.id,
            username: registeredUser.username,
            role: registeredUser.role
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

        const db = await fetchStore();
        const accountList = db._users || [];
        const matchedUser = accountList.find(u => u.username === username);

        if (!matchedUser || !bcrypt.compareSync(password, matchedUser.password)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { id: matchedUser.id, username: matchedUser.username, role: matchedUser.role },
            TOKEN_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid or expired token' });
        req.user = decoded;
        next();
    });
}

// GET /auth/me
app.get('/auth/me', verifyToken, (req, res) => {
    res.status(200).json(req.user);
});

// GET /auth/users (admin only)
app.get('/auth/users', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const db = await fetchStore();
        const accountList = (db._users || []).map(u => ({
            id: u.id,
            username: u.username,
            role: u.role
        }));
        res.status(200).json(accountList);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /auth/users/:id/role (admin only)
app.patch('/auth/users/:id/role', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { role } = req.body || {};
    if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
    }

    try {
        const patchedUser = await updateStore((db) => {
            const accountList = db._users || [];
            const itemIndex = accountList.findIndex(u => u.id === req.params.id);
            if (itemIndex === -1) return null;

            db._users[itemIndex].role = role;
            return {
                id: db._users[itemIndex].id,
                username: db._users[itemIndex].username,
                role: db._users[itemIndex].role
            };
        });

        if (!patchedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(patchedUser);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// TEAM MANAGEMENT ENDPOINTS

// POST /auth/teams
app.post('/auth/teams', verifyToken, async (req, res) => {
    try {
        const { name } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const createdTeam = await updateStore((db) => {
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

        res.status(201).json(createdTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /auth/teams/:id/members
app.post('/auth/teams/:id/members', verifyToken, async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        let statusCode = null;
        const modifiedTeam = await updateStore((db) => {
            const team = (db._teams || []).find(t => t.id === req.params.id);
            if (!team) { statusCode = 404; return null; }
            if (req.user.role !== 'admin' && team.ownerId !== req.user.id) { statusCode = 403; return null; }

            if (!Array.isArray(team.members)) team.members = [];
            if (!team.members.includes(userId)) {
                team.members.push(userId);
            }
            return team;
        });

        if (statusCode === 404) return res.status(404).json({ error: 'Team not found' });
        if (statusCode === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(modifiedTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /auth/teams/:id/members/:userId
app.delete('/auth/teams/:id/members/:userId', verifyToken, async (req, res) => {
    try {
        const { id, userId } = req.params;
        let statusCode = null;

        const modifiedTeam = await updateStore((db) => {
            const team = (db._teams || []).find(t => t.id === id);
            if (!team) { statusCode = 404; return null; }
            if (req.user.role !== 'admin' && team.ownerId !== req.user.id) { statusCode = 403; return null; }

            if (Array.isArray(team.members)) {
                team.members = team.members.filter(uId => uId !== userId);
            }
            return team;
        });

        if (statusCode === 404) return res.status(404).json({ error: 'Team not found' });
        if (statusCode === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(modifiedTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /auth/teams
app.get('/auth/teams', verifyToken, async (req, res) => {
    try {
        const db = await fetchStore();
        const groupList = db._teams || [];
        const memberTeams = req.user.role === 'admin'
            ? groupList
            : groupList.filter(t => Array.isArray(t.members) && t.members.includes(req.user.id));
        res.status(200).json(memberTeams);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /auth/teams/:id
app.get('/auth/teams/:id', verifyToken, async (req, res) => {
    try {
        const db = await fetchStore();
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
app.patch('/auth/teams/:id', verifyToken, async (req, res) => {
    try {
        const { name } = req.body || {};
        let statusCode = null;

        const modifiedTeam = await updateStore((db) => {
            const team = (db._teams || []).find(t => t.id === req.params.id);
            if (!team) { statusCode = 404; return null; }
            if (req.user.role !== 'admin' && team.ownerId !== req.user.id) { statusCode = 403; return null; }

            if (name) team.name = name;
            return team;
        });

        if (statusCode === 404) return res.status(404).json({ error: 'Team not found' });
        if (statusCode === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(modifiedTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /auth/teams/:id
app.delete('/auth/teams/:id', verifyToken, async (req, res) => {
    try {
        let statusCode = null;
        await updateStore((db) => {
            const itemIndex = (db._teams || []).findIndex(t => t.id === req.params.id);
            if (itemIndex === -1) { statusCode = 404; return null; }
            if (req.user.role !== 'admin' && db._teams[itemIndex].ownerId !== req.user.id) { statusCode = 403; return null; }

            db._teams.splice(itemIndex, 1);
            return true;
        });

        if (statusCode === 404) return res.status(404).json({ error: 'Team not found' });
        if (statusCode === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Protect all dynamic routes below with auth middleware
app.use(verifyToken);

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
        const db = await fetchStore();

        let records = db[resource] || [];

        // 1. Ownership and sharing filters FIRST
        if (req.user.role !== 'admin') {
            const memberTeamIds = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);

            records = records.filter(entry => {
                if (entry.ownerId === req.user.id) return true;
                if (Array.isArray(entry.sharedWith) && entry.sharedWith.some(s => s.userId === req.user.id)) return true;
                if (Array.isArray(entry.sharedWithTeams) && entry.sharedWithTeams.some(s => memberTeamIds.includes(s.teamId))) return true;
                return false;
            });
        }

        // 2. Query Parameters (Filters)
        const { _sort, _order, _limit, _offset, _or, ...filters } = req.query;
        const useOrLogic = _or === 'true';

        const activeFilters = Object.keys(filters);
        if (activeFilters.length > 0) {
            records = records.filter(entry => {
                let filterResults = activeFilters.map(key => {
                    let field = key;
                    let operator = 'eq';

                    if (key.includes('__')) {
                        const parts = key.split('__');
                        operator = parts.pop();
                        field = parts.join('__');
                    }

                    const filterValue = filters[key];
                    const fieldValue = entry[field];

                    const parseVal = (val, target) => {
                        if (val === 'null') return null;
                        if (typeof target === 'boolean') return val === 'true';
                        if (typeof target === 'number') return Number(val);
                        return val;
                    };

                    const parsedValue = parseVal(filterValue, fieldValue);

                    switch (operator) {
                        case 'eq': return fieldValue === parsedValue;
                        case 'ne': return fieldValue !== parsedValue;
                        case 'gt': return fieldValue > Number(filterValue);
                        case 'gte': return fieldValue >= Number(filterValue);
                        case 'lt': return fieldValue < Number(filterValue);
                        case 'lte': return fieldValue <= Number(filterValue);
                        case 'between':
                            if (typeof filterValue !== 'string') return false;
                            const [rangeMin, rangeMax] = filterValue.split(',').map(Number);
                            return fieldValue >= rangeMin && fieldValue <= rangeMax;
                        case 'contains':
                            if (typeof fieldValue !== 'string') return false;
                            return fieldValue.toLowerCase().includes(String(filterValue).toLowerCase());
                        case 'startswith':
                            if (typeof fieldValue !== 'string') return false;
                            return fieldValue.toLowerCase().startsWith(String(filterValue).toLowerCase());
                        case 'endswith':
                            if (typeof fieldValue !== 'string') return false;
                            return fieldValue.toLowerCase().endsWith(String(filterValue).toLowerCase());
                        case 'in':
                            if (typeof filterValue !== 'string') return false;
                            const allowedValues = filterValue.split(',').map(v => parseVal(v, fieldValue));
                            return allowedValues.includes(fieldValue);
                        default:
                            return fieldValue === parsedValue;
                    }
                });

                return useOrLogic ? filterResults.some(r => r === true) : filterResults.every(r => r === true);
            });
        }

        // 3. Sorting
        if (_sort) {
            const sortDir = _order === 'desc' ? -1 : 1;
            records.sort((a, b) => {
                if (a[_sort] < b[_sort]) return -1 * sortDir;
                if (a[_sort] > b[_sort]) return 1 * sortDir;
                return 0;
            });
        }

        // 4. Pagination
        const itemCount = records.length;
        const limitProvided = typeof _limit !== 'undefined';
        const offsetProvided = typeof _offset !== 'undefined';

        if (limitProvided || offsetProvided) {
            const pageSize = limitProvided ? parseInt(_limit, 10) : itemCount;
            const startFrom = offsetProvided ? parseInt(_offset, 10) : 0;
            const data = records.slice(startFrom, startFrom + pageSize);
            return res.status(200).json({ data, total: itemCount, limit: pageSize, offset: startFrom });
        }

        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /:resource/:id -> return a single item by id; 404 if not found
app.get('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        const db = await fetchStore();

        const records = db[resource] || [];
        const entry = records.find(i => i.id === id);

        if (!entry) {
            return res.status(404).json({ error: 'Item not found' });
        }

        if (req.user.role !== 'admin' && entry.ownerId !== req.user.id) {
            const memberTeamIds = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);
            const sharedToUser = Array.isArray(entry.sharedWith) && entry.sharedWith.some(s => s.userId === req.user.id);
            const sharedToTeam = Array.isArray(entry.sharedWithTeams) && entry.sharedWithTeams.some(s => memberTeamIds.includes(s.teamId));

            if (!sharedToUser && !sharedToTeam) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        res.status(200).json(entry);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /:resource -> create a new item
app.post('/:resource', async (req, res) => {
    try {
        const { resource } = req.params;
        const body = req.body || {};

        const createdEntry = await updateStore((db) => {
            if (!db[resource] || !Array.isArray(db[resource])) {
                db[resource] = [];
            }

            const entry = {
                ...body,
                sharedWith: Array.isArray(body.sharedWith) ? body.sharedWith : [],
                sharedWithTeams: Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : [],
                id: crypto.randomUUID(),
                ownerId: req.user.id,
                createdAt: new Date().toISOString()
            };

            db[resource].push(entry);
            return entry;
        });

        res.status(201).json(createdEntry);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /:resource/:id -> fully replace an item; 404 if not found
app.put('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        const body = req.body || {};

        let statusCode = null;

        const modifiedItem = await updateStore((db) => {
            const records = db[resource] || [];
            const itemIndex = records.findIndex(i => i.id === id);

            if (itemIndex === -1) {
                statusCode = 404;
                return null;
            }

            const existingItem = records[itemIndex];

            if (req.user.role !== 'admin' && existingItem.ownerId !== req.user.id) {
                const memberTeamIds = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);
                const userHasWriteAccess = Array.isArray(existingItem.sharedWith) && existingItem.sharedWith.some(s => s.userId === req.user.id && s.access === 'write');
                const teamHasWriteAccess = Array.isArray(existingItem.sharedWithTeams) && existingItem.sharedWithTeams.some(s => memberTeamIds.includes(s.teamId) && s.access === 'write');

                if (!userHasWriteAccess && !teamHasWriteAccess) {
                    statusCode = 403;
                    return null;
                }
            }

            let modifiedAt = new Date().toISOString();
            if (modifiedAt === existingItem.createdAt) {
                modifiedAt = new Date(Date.now() + 1).toISOString();
            }

            const hasOwnership = req.user.role === 'admin' || existingItem.ownerId === req.user.id;

            const newSharedWith = Array.isArray(body.sharedWith) ? body.sharedWith : (existingItem.sharedWith || []);
            const finalSharedWith = hasOwnership ? newSharedWith : (existingItem.sharedWith || []);

            const newSharedWithTeams = Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : (existingItem.sharedWithTeams || []);
            const finalSharedWithTeams = hasOwnership ? newSharedWithTeams : (existingItem.sharedWithTeams || []);

            const fullReplacement = {
                ...body,
                sharedWith: finalSharedWith,
                sharedWithTeams: finalSharedWithTeams,
                id: existingItem.id,
                ownerId: existingItem.ownerId,
                createdAt: existingItem.createdAt,
                updatedAt: modifiedAt
            };

            db[resource][itemIndex] = fullReplacement;
            return fullReplacement;
        });

        if (statusCode === 404) return res.status(404).json({ error: 'Item not found' });
        if (statusCode === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(modifiedItem);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /:resource/:id -> partially update an item; 404 if not found
app.patch('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        const body = req.body || {};

        let statusCode = null;

        const modifiedItem = await updateStore((db) => {
            const records = db[resource] || [];
            const itemIndex = records.findIndex(i => i.id === id);

            if (itemIndex === -1) {
                statusCode = 404;
                return null;
            }

            const existingItem = records[itemIndex];

            if (req.user.role !== 'admin' && existingItem.ownerId !== req.user.id) {
                const memberTeamIds = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);
                const userHasWriteAccess = Array.isArray(existingItem.sharedWith) && existingItem.sharedWith.some(s => s.userId === req.user.id && s.access === 'write');
                const teamHasWriteAccess = Array.isArray(existingItem.sharedWithTeams) && existingItem.sharedWithTeams.some(s => memberTeamIds.includes(s.teamId) && s.access === 'write');

                if (!userHasWriteAccess && !teamHasWriteAccess) {
                    statusCode = 403;
                    return null;
                }
            }

            let modifiedAt = new Date().toISOString();
            if (modifiedAt === existingItem.createdAt) {
                modifiedAt = new Date(Date.now() + 1).toISOString();
            }

            const hasOwnership = req.user.role === 'admin' || existingItem.ownerId === req.user.id;

            const newSharedWith = body.hasOwnProperty('sharedWith') ? (Array.isArray(body.sharedWith) ? body.sharedWith : []) : (existingItem.sharedWith || []);
            const finalSharedWith = hasOwnership ? newSharedWith : (existingItem.sharedWith || []);

            const newSharedWithTeams = body.hasOwnProperty('sharedWithTeams') ? (Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : []) : (existingItem.sharedWithTeams || []);
            const finalSharedWithTeams = hasOwnership ? newSharedWithTeams : (existingItem.sharedWithTeams || []);

            const mergedItem = {
                ...existingItem,
                ...body,
                sharedWith: finalSharedWith,
                sharedWithTeams: finalSharedWithTeams,
                id: existingItem.id,
                ownerId: existingItem.ownerId,
                createdAt: existingItem.createdAt,
                updatedAt: modifiedAt
            };

            db[resource][itemIndex] = mergedItem;
            return mergedItem;
        });

        if (statusCode === 404) return res.status(404).json({ error: 'Item not found' });
        if (statusCode === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(200).json(modifiedItem);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /:resource/:id -> remove an item; 200/204 on success; 404 if not found
app.delete('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;

        let statusCode = null;

        await updateStore((db) => {
            const records = db[resource] || [];
            const itemIndex = records.findIndex(i => i.id === id);

            if (itemIndex === -1) {
                statusCode = 404;
                return null;
            }

            const existingItem = records[itemIndex];

            if (req.user.role !== 'admin' && existingItem.ownerId !== req.user.id) {
                statusCode = 403;
                return null;
            }

            db[resource].splice(itemIndex, 1);
            return true;
        });

        if (statusCode === 404) return res.status(404).json({ error: 'Item not found' });
        if (statusCode === 403) return res.status(403).json({ error: 'Forbidden' });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(APP_PORT, () => {
    console.log(`running on port ${APP_PORT}`);
});
