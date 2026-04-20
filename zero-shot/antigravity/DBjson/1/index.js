const express = require('express');
const { getDB, updateDB } = require('./db');
const crypto = require('crypto');
const { register, login, authenticate } = require('./auth');
const { processQuery } = require('./queryParser');

const app = express();
app.use(express.json());

app.post('/auth/register', register);
app.post('/auth/login', login);

function hasAccess(item, user) {
    if (user.role === 'admin') return true;
    if (item.ownerId === user.id) return true;
    if (item.sharedWith && item.sharedWith.includes(user.id)) return true;
    return false;
}

// dynamic routing for GET all
app.get('/:resource', authenticate, async (req, res) => {
    try {
        const resource = req.params.resource;
        const db = await getDB();
        
        if (!db[resource]) {
            return res.json([]);
        }
        
        let items = db[resource];
        if (req.user.role !== 'admin') {
             items = items.filter(i => 
                i.ownerId === req.user.id || 
                (i.sharedWith && i.sharedWith.includes(req.user.id))
             );
        }
        
        items = processQuery(items, req.query);
        
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// dynamic routing for POST
app.post('/:resource', authenticate, async (req, res) => {
    try {
        const resource = req.params.resource;
        let newItem = req.body;
        newItem.id = crypto.randomUUID(); 
        newItem.ownerId = req.user.id;
        if (!newItem.sharedWith) newItem.sharedWith = [];
        
        await updateDB(async (db) => {
            if (!db[resource]) {
                db[resource] = [];
            }
            db[resource].push(newItem);
        });
        
        res.status(201).json(newItem);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/:resource/:id', authenticate, async (req, res) => {
    try {
        const { resource, id } = req.params;
        const db = await getDB();
        if (!db[resource]) return res.status(404).json({ error: 'Resource not found' });
        
        const item = db[resource].find(i => i.id === id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        
        if (!hasAccess(item, req.user)) {
             return res.status(403).json({ error: 'Forbidden' });
        }
        
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/:resource/:id', authenticate, async (req, res) => {
    try {
        const { resource, id } = req.params;
        let updatedItem = null;
        let forbidden = false;
        
        const result = await updateDB(async (db) => {
            if (!db[resource]) return false;
            
            const index = db[resource].findIndex(i => i.id === id);
            if (index === -1) return false;
            
            if (!hasAccess(db[resource][index], req.user)) {
                 forbidden = true;
                 return false;
            }
            
            // Ensure ownerId cannot be overwritten easily by user, preserve it
            const ownerId = db[resource][index].ownerId;
            const sharedWith = req.body.sharedWith !== undefined ? req.body.sharedWith : (db[resource][index].sharedWith || []);
            db[resource][index] = { ...req.body, id, ownerId, sharedWith };
            updatedItem = db[resource][index];
        });
        
        if (forbidden) return res.status(403).json({ error: 'Forbidden' });
        if (result === false) return res.status(404).json({ error: 'Resource or Item not found' });
        
        res.json(updatedItem);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.patch('/:resource/:id', authenticate, async (req, res) => {
    try {
        const { resource, id } = req.params;
        let updatedItem = null;
        let forbidden = false;
        
        const result = await updateDB(async (db) => {
            if (!db[resource]) return false;
            
            const index = db[resource].findIndex(i => i.id === id);
            if (index === -1) return false;
            
            if (!hasAccess(db[resource][index], req.user)) {
                 forbidden = true;
                 return false;
            }
            
            const ownerId = db[resource][index].ownerId;
            const sharedWith = req.body.sharedWith !== undefined ? req.body.sharedWith : (db[resource][index].sharedWith || []);
            db[resource][index] = { ...db[resource][index], ...req.body, id, ownerId, sharedWith };
            updatedItem = db[resource][index];
        });
        
        if (forbidden) return res.status(403).json({ error: 'Forbidden' });
        if (result === false) return res.status(404).json({ error: 'Resource or Item not found' });
        
        res.json(updatedItem);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/:resource/:id', authenticate, async (req, res) => {
    try {
        const { resource, id } = req.params;
        let forbidden = false;
        
        const result = await updateDB(async (db) => {
            if (!db[resource]) return false;
            
            const index = db[resource].findIndex(i => i.id === id);
            if (index === -1) return false;
            
            if (!hasAccess(db[resource][index], req.user)) {
                 forbidden = true;
                 return false;
            }
            
            db[resource].splice(index, 1);
        });
        
        if (forbidden) return res.status(403).json({ error: 'Forbidden' });
        if (result === false) return res.status(404).json({ error: 'Resource or Item not found' });
        
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
