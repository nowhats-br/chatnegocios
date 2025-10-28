#!/usr/bin/env node

require('dotenv').config();

async function testSupabaseConnection() {
  console.log('🧪 Testando conexão com Supabase...\n');
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    console.log('❌ Configurações do Supabase não encontradas no .env');
    console.log('Execute: node configure-supabase.cjs');
    return;
  }
  
  if (supabaseUrl.includes('your-project') || anonKey.includes('your-anon')) {
    console.log('❌ Configurações do Supabase ainda não foram definidas');
    console.log('Execute: node configure-supabase.cjs');
    return;
  }
  
  console.log('📋 Configurações encontradas:');
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Anon Key: ${anonKey.substring(0, 20)}...`);
  
  try {
    // Testar se a URL é válida
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Conexão com Supabase estabelecida com sucesso!');
      console.log('🔐 Autenticação funcionando');
    } else {
      console.log('❌ Erro na conexão com Supabase');
      console.log(`Status: ${response.status}`);
      console.log(`Mensagem: ${response.statusText}`);
    }
    
  } catch (error) {
    console.log('❌ Erro ao conectar com Supabase:');
    console.log(error.message);
    console.log('\n🔍 Verifique se:');
    console.log('- A URL do projeto está correta');
    console.log('- A chave anon está correta');
    console.log('- Você tem acesso à internet');
  }
}

testSupabaseConnection();