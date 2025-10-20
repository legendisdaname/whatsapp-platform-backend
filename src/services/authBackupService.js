const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');

/**
 * Auth Backup Service
 * 
 * Provides optional backup of WhatsApp authentication data to database
 * This is useful for:
 * - Recovery after auth folder deletion
 * - Migration between servers
 * - Extra redundancy
 * 
 * NOTE: Auth data is sensitive! Ensure database is properly secured.
 */
class AuthBackupService {
  constructor() {
    this.authDataPath = path.join(process.cwd(), '.wwebjs_auth');
    this.backupEnabled = process.env.ENABLE_AUTH_BACKUP === 'true';
  }

  /**
   * Backup session auth data to database
   * @param {string} sessionId - Session UUID
   */
  async backupAuthData(sessionId) {
    if (!this.backupEnabled) {
      return; // Backup disabled
    }

    try {
      const sessionAuthPath = path.join(this.authDataPath, `session-${sessionId}`);
      
      if (!fs.existsSync(sessionAuthPath)) {
        console.log(`⚠️ No auth data to backup for session ${sessionId}`);
        return;
      }

      // Create a simple marker file to indicate auth exists
      // We don't backup the entire Chrome profile (too large)
      // Just backup critical metadata
      const authExists = fs.existsSync(path.join(sessionAuthPath, 'Default'));
      const authSize = this.getDirectorySize(sessionAuthPath);
      
      await supabaseAdmin
        .from('session_auth_backups')
        .upsert({
          session_id: sessionId,
          auth_exists: authExists,
          auth_size_bytes: authSize,
          last_backup_at: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        });

      console.log(`✅ Auth backup metadata saved for session ${sessionId}`);
    } catch (error) {
      console.error(`Failed to backup auth data for session ${sessionId}:`, error);
    }
  }

  /**
   * Check if auth data exists in filesystem
   * @param {string} sessionId 
   * @returns {boolean}
   */
  authDataExists(sessionId) {
    const sessionAuthPath = path.join(this.authDataPath, `session-${sessionId}`);
    return fs.existsSync(sessionAuthPath) && 
           fs.existsSync(path.join(sessionAuthPath, 'Default'));
  }

  /**
   * Get backup status from database
   * @param {string} sessionId 
   * @returns {Object|null}
   */
  async getBackupStatus(sessionId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('session_auth_backups')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify auth data integrity
   * @param {string} sessionId 
   * @returns {Object} Status object
   */
  async verifyAuthData(sessionId) {
    const fileExists = this.authDataExists(sessionId);
    const backupStatus = await this.getBackupStatus(sessionId);
    
    return {
      fileExists,
      backupExists: backupStatus !== null,
      lastBackup: backupStatus?.last_backup_at,
      authSize: backupStatus?.auth_size_bytes,
      status: fileExists ? 'healthy' : (backupStatus ? 'file_missing' : 'no_auth')
    };
  }

  /**
   * Get directory size recursively
   * @param {string} dirPath 
   * @returns {number} Size in bytes
   */
  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`Error calculating directory size: ${error.message}`);
    }
    
    return totalSize;
  }

  /**
   * Clean up backup records for deleted sessions
   */
  async cleanupOrphanedBackups() {
    try {
      // Get all session IDs from database
      const { data: sessions, error: sessionError } = await supabaseAdmin
        .from('sessions')
        .select('id');

      if (sessionError) throw sessionError;

      const sessionIds = sessions.map(s => s.id);

      // Delete backup records for non-existent sessions
      const { error: deleteError } = await supabaseAdmin
        .from('session_auth_backups')
        .delete()
        .not('session_id', 'in', `(${sessionIds.join(',')})`);

      if (deleteError) throw deleteError;

      console.log('✅ Cleaned up orphaned auth backup records');
    } catch (error) {
      console.error('Failed to cleanup orphaned backups:', error);
    }
  }

  /**
   * Generate backup report for all sessions
   * @returns {Array} Report array
   */
  async generateBackupReport() {
    try {
      const { data: sessions, error } = await supabaseAdmin
        .from('sessions')
        .select('id, session_name, phone_number, status');

      if (error) throw error;

      const report = [];

      for (const session of sessions) {
        const verification = await this.verifyAuthData(session.id);
        report.push({
          sessionName: session.session_name,
          phoneNumber: session.phone_number,
          status: session.status,
          authStatus: verification.status,
          fileExists: verification.fileExists,
          backupExists: verification.backupExists,
          lastBackup: verification.lastBackup
        });
      }

      return report;
    } catch (error) {
      console.error('Failed to generate backup report:', error);
      return [];
    }
  }
}

module.exports = new AuthBackupService();

