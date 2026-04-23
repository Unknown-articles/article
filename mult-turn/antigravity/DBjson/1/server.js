const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || 'db.json';

app.use(express.json());

const initialDbShape = { _users: [], _teams: [] };

function initDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify(initialDbShape, null, 2));
        } else {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            if (!data.trim()) {
                fs.writeFileSync(DB_PATH, JSON.stringify(initialDbShape, null, 2));
            } else {
                JSON.parse(data);
            }
        }
    } catch (error) {
        console.error(`Error initializing database:`, error);
        process.exit(1);
    }
}

initDB();

// A simple task queue to avoid race conditions when reading/writing asynchronously
let dbQueue = Promise.resolve();

function enqueue(task) {
    return new Promise((resolve, reject) => {
        dbQueue = dbQueue.then(async () => {
            try {
                const res = await task();
                resolve(res);
            } catch (err) {
                reject(err);
            }
        });
    });
}

function readDB() {
    return enqueue(async () => {
        const data = await fs.promises.readFile(DB_PATH, 'utf8');
        return JSON.parse(data);
    });
}

function writeDB(action) {
    return enqueue(async () => {
        const data = await fs.promises.readFile(DB_PATH, 'utf8');
        const db = JSON.parse(data);
        const result = action(db);
        await fs.promises.writeFile(DB_PATH, JSON.stringify(db, null, 2));
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

        let isConflict = false;
        let newUser = null;

        await writeDB((db) => {
            if (!db._users) db._users = [];
            
            const existingUser = db._users.find(u => u.username === username);
            if (existingUser) {
                isConflict = true;
                return;
            }

            const role = db._users.length === 0 ? 'admin' : 'user';
            const hashedPassword = bcrypt.hashSync(password, 10);
            
            newUser = { id: crypto.randomUUID(), username, password: hashedPassword, role };
            db._users.push(newUser);
        });

        if (isConflict) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        res.status(201).json({
            id: newUser.id,
            username: newUser.username,
            role: newUser.role
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

        const db = await readDB();
        const users = db._users || [];
        const user = users.find(u => u.username === username);

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '1h' }
        );
        
        res.status(200).json({ token });

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid or expired token' });
        req.user = decoded;
        next();
    });
}

// GET /auth/me
app.get('/auth/me', authenticateToken, (req, res) => {
    res.status(200).json(req.user);
});

// GET /auth/users (admin only)
app.get('/auth/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const db = await readDB();
        const users = (db._users || []).map(u => ({
            id: u.id,
            username: u.username,
            role: u.role
        }));
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /auth/users/:id/role (admin only)
app.patch('/auth/users/:id/role', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { role } = req.body || {};
    if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
    }

    try {
        const updatedUser = await writeDB((db) => {
            const users = db._users || [];
            const index = users.findIndex(u => u.id === req.params.id);
            if (index === -1) return null;
            
            db._users[index].role = role;
            return {
                id: db._users[index].id,
                username: db._users[index].username,
                role: db._users[index].role
            };
        });

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// TEAM MANAGEMENT ENDPOINTS

// POST /auth/teams
app.post('/auth/teams', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const newTeam = await writeDB((db) => {
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

        res.status(201).json(newTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /auth/teams/:id/members
app.post('/auth/teams/:id/members', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        let errorStatus = null;
        const updatedTeam = await writeDB((db) => {
            const team = (db._teams || []).find(t => t.id === req.params.id);
            if (!team) { errorStatus = 404; return null; }
            if (req.user.role !== 'admin' && team.ownerId !== req.user.id) { errorStatus = 403; return null; }

            if (!Array.isArray(team.members)) team.members = [];
            if (!team.members.includes(userId)) {
                team.members.push(userId);
            }
            return team;
        });

        if (errorStatus === 404) return res.status(404).json({ error: 'Team not found' });
        if (errorStatus === 403) return res.status(403).json({ error: 'Forbidden' });
        
        res.status(200).json(updatedTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /auth/teams/:id/members/:userId
app.delete('/auth/teams/:id/members/:userId', authenticateToken, async (req, res) => {
    try {
        const { id, userId } = req.params;
        let errorStatus = null;

        const updatedTeam = await writeDB((db) => {
            const team = (db._teams || []).find(t => t.id === id);
            if (!team) { errorStatus = 404; return null; }
            if (req.user.role !== 'admin' && team.ownerId !== req.user.id) { errorStatus = 403; return null; }

            if (Array.isArray(team.members)) {
                team.members = team.members.filter(uId => uId !== userId);
            }
            return team;
        });

        if (errorStatus === 404) return res.status(404).json({ error: 'Team not found' });
        if (errorStatus === 403) return res.status(403).json({ error: 'Forbidden' });
        
        res.status(200).json(updatedTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /auth/teams
app.get('/auth/teams', authenticateToken, async (req, res) => {
    try {
        const db = await readDB();
        const teams = db._teams || [];
        const userTeams = req.user.role === 'admin' 
            ? teams 
            : teams.filter(t => Array.isArray(t.members) && t.members.includes(req.user.id));
        res.status(200).json(userTeams);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /auth/teams/:id
app.get('/auth/teams/:id', authenticateToken, async (req, res) => {
    try {
        const db = await readDB();
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
app.patch('/auth/teams/:id', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body || {};
        let errorStatus = null;

        const updatedTeam = await writeDB((db) => {
            const team = (db._teams || []).find(t => t.id === req.params.id);
            if (!team) { errorStatus = 404; return null; }
            if (req.user.role !== 'admin' && team.ownerId !== req.user.id) { errorStatus = 403; return null; }

            if (name) team.name = name;
            return team;
        });

        if (errorStatus === 404) return res.status(404).json({ error: 'Team not found' });
        if (errorStatus === 403) return res.status(403).json({ error: 'Forbidden' });
        
        res.status(200).json(updatedTeam);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /auth/teams/:id
app.delete('/auth/teams/:id', authenticateToken, async (req, res) => {
    try {
        let errorStatus = null;
        await writeDB((db) => {
            const index = (db._teams || []).findIndex(t => t.id === req.params.id);
            if (index === -1) { errorStatus = 404; return null; }
            if (req.user.role !== 'admin' && db._teams[index].ownerId !== req.user.id) { errorStatus = 403; return null; }

            db._teams.splice(index, 1);
            return true;
        });

        if (errorStatus === 404) return res.status(404).json({ error: 'Team not found' });
        if (errorStatus === 403) return res.status(403).json({ error: 'Forbidden' });
        
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Protect all dynamic routes below with auth middleware
app.use(authenticateToken);

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
        const db = await readDB();
        
        let collection = db[resource] || [];

        // 1. Ownership and sharing filters FIRST
        if (req.user.role !== 'admin') {
            const userTeamIds = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);

            collection = collection.filter(i => {
                if (i.ownerId === req.user.id) return true;
                if (Array.isArray(i.sharedWith) && i.sharedWith.some(s => s.userId === req.user.id)) return true;
                if (Array.isArray(i.sharedWithTeams) && i.sharedWithTeams.some(s => userTeamIds.includes(s.teamId))) return true;
                return false;
            });
        }

        // 2. Query Parameters (Filters)
        const { _sort, _order, _limit, _offset, _or, ...filters } = req.query;
        const isOr = _or === 'true';

        const filterKeys = Object.keys(filters);
        if (filterKeys.length > 0) {
            collection = collection.filter(item => {
                let matchResults = filterKeys.map(key => {
                    let field = key;
                    let operator = 'eq';
                    
                    if (key.includes('__')) {
                        const parts = key.split('__');
                        operator = parts.pop();
                        field = parts.join('__');
                    }

                    const rawPattern = filters[key];
                    const itemVal = item[field];
                    
                    const parseVal = (val, target) => {
                        if (val === 'null') return null;
                        if (typeof target === 'boolean') return val === 'true';
                        if (typeof target === 'number') return Number(val);
                        return val;
                    };

                    const tgt = parseVal(rawPattern, itemVal);

                    switch (operator) {
                        case 'eq': return itemVal === tgt;
                        case 'ne': return itemVal !== tgt;
                        case 'gt': return itemVal > Number(rawPattern);
                        case 'gte': return itemVal >= Number(rawPattern);
                        case 'lt': return itemVal < Number(rawPattern);
                        case 'lte': return itemVal <= Number(rawPattern);
                        case 'between':
                            if (typeof rawPattern !== 'string') return false;
                            const [lo, hi] = rawPattern.split(',').map(Number);
                            return itemVal >= lo && itemVal <= hi;
                        case 'contains':
                            if (typeof itemVal !== 'string') return false;
                            return itemVal.toLowerCase().includes(String(rawPattern).toLowerCase());
                        case 'startswith':
                            if (typeof itemVal !== 'string') return false;
                            return itemVal.toLowerCase().startsWith(String(rawPattern).toLowerCase());
                        case 'endswith':
                            if (typeof itemVal !== 'string') return false;
                            return itemVal.toLowerCase().endsWith(String(rawPattern).toLowerCase());
                        case 'in':
                            if (typeof rawPattern !== 'string') return false;
                            const list = rawPattern.split(',').map(v => parseVal(v, itemVal));
                            return list.includes(itemVal);
                        default:
                            return itemVal === tgt;
                    }
                });

                return isOr ? matchResults.some(r => r === true) : matchResults.every(r => r === true);
            });
        }

        // 3. Sorting
        if (_sort) {
            const dir = _order === 'desc' ? -1 : 1;
            collection.sort((a, b) => {
                if (a[_sort] < b[_sort]) return -1 * dir;
                if (a[_sort] > b[_sort]) return 1 * dir;
                return 0;
            });
        }

        // 4. Pagination
        const total = collection.length;
        const hasLimit = typeof _limit !== 'undefined';
        const hasOffset = typeof _offset !== 'undefined';
        
        if (hasLimit || hasOffset) {
            const limit = hasLimit ? parseInt(_limit, 10) : total;
            const offset = hasOffset ? parseInt(_offset, 10) : 0;
            const data = collection.slice(offset, offset + limit);
            return res.status(200).json({ data, total, limit, offset });
        }

        res.status(200).json(collection);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /:resource/:id -> return a single item by id; 404 if not found
app.get('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        const db = await readDB();
        
        const collection = db[resource] || [];
        const item = collection.find(i => i.id === id);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        if (req.user.role !== 'admin' && item.ownerId !== req.user.id) {
            const userTeamIds = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);
            const isSharedUser = Array.isArray(item.sharedWith) && item.sharedWith.some(s => s.userId === req.user.id);
            const isSharedTeam = Array.isArray(item.sharedWithTeams) && item.sharedWithTeams.some(s => userTeamIds.includes(s.teamId));

            if (!isSharedUser && !isSharedTeam) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        res.status(200).json(item);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /:resource -> create a new item
app.post('/:resource', async (req, res) => {
    try {
        const { resource } = req.params;
        const body = req.body || {};
        
        const newItem = await writeDB((db) => {
            if (!db[resource] || !Array.isArray(db[resource])) {
                db[resource] = [];
            }
            
            const item = { 
                ...body, 
                sharedWith: Array.isArray(body.sharedWith) ? body.sharedWith : [],
                sharedWithTeams: Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : [],
                id: crypto.randomUUID(),
                ownerId: req.user.id,
                createdAt: new Date().toISOString()
            };

            db[resource].push(item);
            return item;
        });
        
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /:resource/:id -> fully replace an item; 404 if not found
app.put('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        const body = req.body || {};
        
        let errorStatus = null;

        const updatedItem = await writeDB((db) => {
            const collection = db[resource] || [];
            const index = collection.findIndex(i => i.id === id);
            
            if (index === -1) {
                errorStatus = 404;
                return null;
            }

            const existingItem = collection[index];

            if (req.user.role !== 'admin' && existingItem.ownerId !== req.user.id) {
                const userTeamIds = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);
                const isWriteSharedUser = Array.isArray(existingItem.sharedWith) && existingItem.sharedWith.some(s => s.userId === req.user.id && s.access === 'write');
                const isWriteSharedTeam = Array.isArray(existingItem.sharedWithTeams) && existingItem.sharedWithTeams.some(s => userTeamIds.includes(s.teamId) && s.access === 'write');

                if (!isWriteSharedUser && !isWriteSharedTeam) {
                    errorStatus = 403;
                    return null;
                }
            }

            let updatedTime = new Date().toISOString();
            if (updatedTime === existingItem.createdAt) {
                updatedTime = new Date(Date.now() + 1).toISOString();
            }

            const callerIsOwnerOrAdmin = req.user.role === 'admin' || existingItem.ownerId === req.user.id;
            
            const newSharedWith = Array.isArray(body.sharedWith) ? body.sharedWith : (existingItem.sharedWith || []);
            const finalSharedWith = callerIsOwnerOrAdmin ? newSharedWith : (existingItem.sharedWith || []);

            const newSharedWithTeams = Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : (existingItem.sharedWithTeams || []);
            const finalSharedWithTeams = callerIsOwnerOrAdmin ? newSharedWithTeams : (existingItem.sharedWithTeams || []);

            const replacement = { 
                ...body, 
                sharedWith: finalSharedWith,
                sharedWithTeams: finalSharedWithTeams,
                id: existingItem.id,
                ownerId: existingItem.ownerId,
                createdAt: existingItem.createdAt,
                updatedAt: updatedTime
            };
            
            db[resource][index] = replacement;
            return replacement;
        });

        if (errorStatus === 404) return res.status(404).json({ error: 'Item not found' });
        if (errorStatus === 403) return res.status(403).json({ error: 'Forbidden' });
        
        res.status(200).json(updatedItem);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /:resource/:id -> partially update an item; 404 if not found
app.patch('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        const body = req.body || {};
        
        let errorStatus = null;

        const updatedItem = await writeDB((db) => {
            const collection = db[resource] || [];
            const index = collection.findIndex(i => i.id === id);
            
            if (index === -1) {
                errorStatus = 404;
                return null;
            }

            const existingItem = collection[index];

            if (req.user.role !== 'admin' && existingItem.ownerId !== req.user.id) {
                const userTeamIds = (db._teams || []).filter(t => Array.isArray(t.members) && t.members.includes(req.user.id)).map(t => t.id);
                const isWriteSharedUser = Array.isArray(existingItem.sharedWith) && existingItem.sharedWith.some(s => s.userId === req.user.id && s.access === 'write');
                const isWriteSharedTeam = Array.isArray(existingItem.sharedWithTeams) && existingItem.sharedWithTeams.some(s => userTeamIds.includes(s.teamId) && s.access === 'write');

                if (!isWriteSharedUser && !isWriteSharedTeam) {
                    errorStatus = 403;
                    return null;
                }
            }

            let updatedTime = new Date().toISOString();
            if (updatedTime === existingItem.createdAt) {
                updatedTime = new Date(Date.now() + 1).toISOString();
            }

            const callerIsOwnerOrAdmin = req.user.role === 'admin' || existingItem.ownerId === req.user.id;
            
            const newSharedWith = body.hasOwnProperty('sharedWith') ? (Array.isArray(body.sharedWith) ? body.sharedWith : []) : (existingItem.sharedWith || []);
            const finalSharedWith = callerIsOwnerOrAdmin ? newSharedWith : (existingItem.sharedWith || []);

            const newSharedWithTeams = body.hasOwnProperty('sharedWithTeams') ? (Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : []) : (existingItem.sharedWithTeams || []);
            const finalSharedWithTeams = callerIsOwnerOrAdmin ? newSharedWithTeams : (existingItem.sharedWithTeams || []);

            const updated = { 
                ...existingItem,
                ...body, 
                sharedWith: finalSharedWith,
                sharedWithTeams: finalSharedWithTeams,
                id: existingItem.id,
                ownerId: existingItem.ownerId,
                createdAt: existingItem.createdAt,
                updatedAt: updatedTime
            };
            
            db[resource][index] = updated;
            return updated;
        });

        if (errorStatus === 404) return res.status(404).json({ error: 'Item not found' });
        if (errorStatus === 403) return res.status(403).json({ error: 'Forbidden' });
        
        res.status(200).json(updatedItem);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /:resource/:id -> remove an item; 200/204 on success; 404 if not found
app.delete('/:resource/:id', async (req, res) => {
    try {
        const { resource, id } = req.params;
        
        let errorStatus = null;

        await writeDB((db) => {
            const collection = db[resource] || [];
            const index = collection.findIndex(i => i.id === id);
            
            if (index === -1) {
                errorStatus = 404;
                return null;
            }

            const existingItem = collection[index];

            if (req.user.role !== 'admin' && existingItem.ownerId !== req.user.id) {
                errorStatus = 403;
                return null;
            }

            db[resource].splice(index, 1);
            return true;
        });
        
        if (errorStatus === 404) return res.status(404).json({ error: 'Item not found' });
        if (errorStatus === 403) return res.status(403).json({ error: 'Forbidden' });
        
        // Respond with 204 No Content
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`running on port ${PORT}`);
});
