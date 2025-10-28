#!/usr/bin/env node

const fs = require('fs');

console.log('🔧 Restaurando configuração do Supabase...\n');

// Verificar se existe um backup ou arquivo de configuração anterior
const possibleConfigFiles = [
  '.env.local',
  '.env.backup',
  'supabase.config.js',
  'src/lib/supabase.ts'
];

console.log('🔍 Procurando configurações existentes do Supabase...');

// Verificar se o arquivo supabase.ts tem as configurações
const supabasePath = 'src/lib/supabase.ts';
if (fs.existsSync(supabasePath)) {
  const supabaseContent = fs.readFileSync(supabasePath, 'utf8');
  
  // Extrair URLs do código se existirem
  const urlMatch = supabaseContent.match(/VITE_SUPABASE_URL.*?=.*?['"`]([^'"`]+)['"`]/);
  const keyMatch = supabaseContent.match(/VITE_SUPABASE_ANON_KEY.*?=.*?['"`]([^'"`]+)['"`]/);
  
  if (urlMatch || keyMatch) {
    console.log('📋 Configurações encontradas no supabase.ts');
    
    // Ler .env atual
    let envContent = fs.readFileSync('.env', 'utf8');
    
    if (urlMatch && urlMatch[1] && !urlMatch[1].includes('your-project')) {
      envContent = envContent.replace(
        'VITE_SUPABASE_URL=https://seu-projeto.supabase.co',
        `VITE_SUPABASE_URL=${urlMatch[1]}`
      );
      console.log('✅ VITE_SUPABASE_URL restaurado');
    }
    
    if (keyMatch && keyMatch[1] && !keyMatch[1].includes('your-anon')) {
      envContent = envContent.replace(
        'VITE_SUPABASE_ANON_KEY=sua-anon-key',
        `VITE_SUPABASE_ANON_KEY=${keyMatch[1]}`
      );
      console.log('✅ VITE_SUPABASE_ANON_KEY restaurado');
    }
    
    fs.writeFileSync('.env', envContent);
    console.log('✅ Configurações do Supabase restauradas!');
  } else {
    console.log('⚠️ Não foi possível extrair configurações do supabase.ts');
  }
} else {
  console.log('⚠️ Arquivo supabase.ts não encontrado');
}

console.log('\n📝 IMPORTANTE:');
console.log('Se o login ainda não funcionar, você precisa configurar manualmente no .env:');
console.log('- VITE_SUPABASE_URL=https://seu-projeto.supabase.co');
console.log('- VITE_SUPABASE_ANON_KEY=sua-anon-key');

console.log('\n🔍 Você pode encontrar essas informações em:');
console.log('- Painel do Supabase > Settings > API');
console.log('- Ou no arquivo src/lib/supabase.ts se já estava funcionando antes');

console.log('\n✅ Correção concluída!');