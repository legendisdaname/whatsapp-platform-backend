const { supabaseAdmin } = require('../config/supabase');

/**
 * Database Helper Utilities
 * Provides safe database operations with retry logic and error handling
 */

/**
 * Execute a database operation with retry logic
 */
async function dbOperationWithRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Check if result has error property (Supabase style)
      if (result && result.error) {
        // If it's a connection error, retry
        if (isConnectionError(result.error)) {
          if (attempt < maxRetries) {
            console.warn(`⚠️  Database connection error, retrying (attempt ${attempt}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
            continue;
          }
        }
        // Non-retryable error or max retries reached
        throw result.error;
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error
      if (isConnectionError(error)) {
        if (attempt < maxRetries) {
          console.warn(`⚠️  Database connection error, retrying (attempt ${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
          continue;
        }
      } else {
        // Non-retryable error, throw immediately
        throw error;
      }
    }
  }
  
  // All retries exhausted
  console.error(`❌ Database operation failed after ${maxRetries} attempts:`, lastError?.message);
  throw lastError || new Error('Database operation failed');
}

/**
 * Check if error is a connection-related error
 */
function isConnectionError(error) {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  // Connection error indicators
  const connectionErrorIndicators = [
    'connection',
    'timeout',
    'network',
    'econnrefused',
    'enotfound',
    'eai_again',
    'fetch failed',
    'networkerror',
    'failed to fetch'
  ];
  
  return connectionErrorIndicators.some(indicator => 
    errorMessage.includes(indicator) || errorCode.includes(indicator)
  );
}

/**
 * Safe database insert with retry
 */
async function safeInsert(table, data, options = {}) {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client not initialized');
  }
  
  return dbOperationWithRetry(async () => {
    const query = supabaseAdmin.from(table).insert(data);
    
    if (options.select) {
      query.select(options.select);
    }
    
    return await query;
  }, options.maxRetries || 3);
}

/**
 * Safe database update with retry
 */
async function safeUpdate(table, data, filter, options = {}) {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client not initialized');
  }
  
  return dbOperationWithRetry(async () => {
    let query = supabaseAdmin.from(table).update(data);
    
    // Apply filters
    if (filter) {
      Object.keys(filter).forEach(key => {
        if (Array.isArray(filter[key])) {
          query = query.in(key, filter[key]);
        } else {
          query = query.eq(key, filter[key]);
        }
      });
    }
    
    if (options.select) {
      query = query.select(options.select);
    }
    
    return await query;
  }, options.maxRetries || 3);
}

/**
 * Safe database select with retry
 */
async function safeSelect(table, options = {}) {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client not initialized');
  }
  
  return dbOperationWithRetry(async () => {
    let query = supabaseAdmin.from(table).select(options.select || '*');
    
    // Apply filters
    if (options.filter) {
      Object.keys(options.filter).forEach(key => {
        const value = options.filter[key];
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      });
    }
    
    // Apply ordering
    if (options.orderBy) {
      query = query.order(options.orderBy, { 
        ascending: options.ascending !== false 
      });
    }
    
    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    return await query;
  }, options.maxRetries || 3);
}

/**
 * Safe database delete with retry
 */
async function safeDelete(table, filter, options = {}) {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client not initialized');
  }
  
  return dbOperationWithRetry(async () => {
    let query = supabaseAdmin.from(table).delete();
    
    // Apply filters
    if (filter) {
      Object.keys(filter).forEach(key => {
        if (Array.isArray(filter[key])) {
          query = query.in(key, filter[key]);
        } else {
          query = query.eq(key, filter[key]);
        }
      });
    }
    
    return await query;
  }, options.maxRetries || 3);
}

/**
 * Check database connection health
 */
async function checkConnectionHealth() {
  if (!supabaseAdmin) {
    return { healthy: false, error: 'Admin client not initialized' };
  }
  
  try {
    const { error } = await supabaseAdmin
      .from('sessions')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      return { healthy: false, error: error.message };
    }
    
    return { healthy: true };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

module.exports = {
  dbOperationWithRetry,
  isConnectionError,
  safeInsert,
  safeUpdate,
  safeSelect,
  safeDelete,
  checkConnectionHealth
};

