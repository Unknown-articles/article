function applyFilter(item, filter) {
    if (!filter) return true;
    
    for (const key in filter) {
        if (key === '$and') {
             if (!Array.isArray(filter['$and'])) return false;
             return filter['$and'].every(f => applyFilter(item, f));
        }
        if (key === '$or') {
             if (!Array.isArray(filter['$or'])) return false;
             return filter['$or'].some(f => applyFilter(item, f));
        }
        
        const value = filter[key];
        const itemValue = item[key];
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            for (const op in value) {
                const opVal = value[op];
                if (op === '$eq' && itemValue !== opVal) return false;
                if (op === '$ne' && itemValue === opVal) return false;
                if (op === '$gt' && !(itemValue > opVal)) return false;
                if (op === '$lt' && !(itemValue < opVal)) return false;
                if (op === '$gte' && !(itemValue >= opVal)) return false;
                if (op === '$lte' && !(itemValue <= opVal)) return false;
                if (op === '$contains' && typeof itemValue === 'string' && !itemValue.includes(opVal)) return false;
            }
        } else {
             // Default is equality
             if (itemValue != value) return false;
        }
    }
    return true;
}

exports.processQuery = (items, query) => {
    let result = [...items];
    
    // Filtering
    if (query.where) {
         try {
             const filterObj = JSON.parse(query.where);
             result = result.filter(item => applyFilter(item, filterObj));
         } catch (err) {
             console.error("Invalid where clause", err);
         }
    }
    
    // Sorting (e.g. sort=name:asc)
    if (query.sort) {
         const [field, order] = query.sort.split(':');
         result.sort((a, b) => {
             if (a[field] < b[field]) return order === 'desc' ? 1 : -1;
             if (a[field] > b[field]) return order === 'desc' ? -1 : 1;
             return 0;
         });
    }
    
    // Pagination
    if (query.limit || query.offset) {
         const offset = parseInt(query.offset) || 0;
         const limit = parseInt(query.limit) || result.length;
         result = result.slice(offset, offset + limit);
    }
    
    return result;
}
