const { supabaseAdmin } = require('./src/config/supabase');

async function clearAdmins() {
  try {
    console.log('Clearing admin accounts...');
    
    // Clear admins table
    const { error: adminsError } = await supabaseAdmin
      .from('admins')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all admins

    if (adminsError) {
      console.error('Error clearing admins:', adminsError);
      return;
    }

    console.log('✅ Admin accounts cleared successfully!');
    console.log('Now you can test the setup flow by visiting the admin panel at your configured URL');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

clearAdmins();
