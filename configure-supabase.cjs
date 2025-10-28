#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 Configuração do Supabase\n');
console.log('Para encontrar suas credenciais do Supabase:');
console.log('1. Acesse https://supabase.com/dashboard');
console.log('2. Selecione seu projeto');
console.log('3. Vá em Settings > API');
console.log('4. Copie a URL do projeto e as chaves\n');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function configureSupabase() {
  try {
    const supabaseUrl = await question('Digite a URL do seu projeto Supabase: ');
    const anonKey = await question('Digite a chave anon/public do Supabase: ');
    const serviceKey = await question('Digite a service_role key do Supabase (opcional): ');
    
    if (!supabaseUrl || !anonKey) {
      console.log('❌ URL e chave anon são obrigatórias!');
      process.exit(1);
    }
    
    // Ler arquivo .env atual
    let envContent = fs.readFileSync('.env', 'utf8');
    
    // Substituir configurações do Supabase
    envContent = envContent.replace(
      'SUPABASE_URL=https://your-project.supabase.co',
      `SUPABASE_URL=${supabaseUrl}`
    );
    
    envContent = envContent.replace(
      'SUPABASE_ANON_KEY=your-anon-key',
      `SUPABASE_ANON_KEY=${anonKey}`
    );
    
    if (serviceKey) {
      envContent = envContent.replace(
        'SUPABASE_SERVICE_ROLE_KEY=your-service-role-key',
        `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`
      );
    }
    
    envContent = envContent.replace(
      'VITE_SUPABASE_URL=https://your-project.supabase.co',
      `VITE_SUPABASE_URL=${supabaseUrl}`
    );
    
    envContent = envContent.replace(
      'VITE_SUPABASE_ANON_KEY=your-anon-key',
      `VITE_SUPABASE_ANON_KEY=${anonKey}`
    );
    
    // Salvar arquivo .env
    fs.writeFileSync('.env', envContent);
    
    console.log('\n✅ Configuração do Supabase salva com sucesso!');
    console.log('🔄 Reinicie o servidor para aplicar as mudanças.');
    
  } catch (error) {
    console.error('❌ Erro ao configurar Supabase:', error.message);
  } finally {
    rl.close();
  }
}

configureSupabase();