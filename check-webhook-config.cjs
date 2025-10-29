#!/usr/bin/env node

require('dotenv').config();

async function checkWebhookConfig() {
  console.log('🔍 VERIFICANDO CONFIGURAÇÃO DO WEBHOOK\n');
  
  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
  const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3002';
  
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.log('❌ Evolution API não configurada no .env');
    return;
  }
  
  console.log('📋 Configurações:');
  console.log(`   - Evolution API URL: ${EVOLUTION_API_URL}`);
  console.log(`   - Evolution API Key: ${EVOLUTION_API_KEY ? '***configurada***' : 'não configurada'}`);
  console.log(`   - Backend URL: ${backendUrl}`);
  
  try {
    // 1. Listar instâncias
    console.log('\n1️⃣ Listando instâncias na Evolution API...');
    const instancesResponse = await fetch(`${EVOLUTION_API_URL}/manager/findInstances`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        'X-API-Key': EVOLUTION_API_KEY,
        'Authorization': `Bearer ${EVOLUTION_API_KEY}`,
      },
    });
    
    if (instancesResponse.ok) {
      const instances = await instancesResponse.json();
      console.log(`✅ Encontradas ${instances.length} instâncias:`);
      
      instances.forEach((instance, index) => {
        console.log(`   ${index + 1}. ${instance.instanceName} - Status: ${instance.status}`);
      });
      
      // 2. Verificar webhook de cada instância
      console.log('\n2️⃣ Verificando webhook de cada instância...');
      
      for (const instance of instances) {
        console.log(`\n🔍 Verificando webhook da instância: ${instance.instanceName}`);
        
        try {
          const webhookResponse = await fetch(`${EVOLUTION_API_URL}/webhook/find/${instance.instanceName}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY,
              'X-API-Key': EVOLUTION_API_KEY,
              'Authorization': `Bearer ${EVOLUTION_API_KEY}`,
            },
          });
          
          if (webhookResponse.ok) {
            const webhookData = await webhookResponse.json();
            console.log(`   ✅ Webhook configurado:`);
            console.log(`      - URL: ${webhookData.webhook?.url || 'Não configurado'}`);
            console.log(`      - Eventos: ${webhookData.webhook?.events?.join(', ') || 'Nenhum'}`);
            
            // Verificar se a URL do webhook está correta
            const expectedWebhookUrl = `${backendUrl}/api/whatsapp/webhook`;
            if (webhookData.webhook?.url && !webhookData.webhook.url.includes('/api/whatsapp/webhook')) {
              console.log(`   ⚠️  URL do webhook pode estar incorreta`);
              console.log(`      Esperado: ${expectedWebhookUrl}?uid=USER_ID`);
              console.log(`      Atual: ${webhookData.webhook.url}`);
            }
            
          } else {
            console.log(`   ❌ Erro ao verificar webhook: ${webhookResponse.status}`);
          }
          
        } catch (error) {
          console.log(`   ❌ Erro ao verificar webhook: ${error.message}`);
        }
      }
      
    } else {
      console.log('❌ Erro ao listar instâncias:', instancesResponse.status);
    }
    
    // 3. Instruções para configurar webhook manualmente
    console.log('\n3️⃣ CONFIGURAR WEBHOOK MANUALMENTE:');
    console.log('Se o webhook não estiver configurado, execute:');
    console.log(`curl -X POST "${EVOLUTION_API_URL}/webhook/set/SUA_INSTANCIA" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "apikey: ${EVOLUTION_API_KEY}" \\`);
    console.log(`  -d '{`);
    console.log(`    "webhook": {`);
    console.log(`      "url": "${backendUrl}/api/whatsapp/webhook?uid=SEU_USER_ID",`);
    console.log(`      "events": ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"]`);
    console.log(`    }`);
    console.log(`  }'`);
    
    console.log('\n4️⃣ TESTE FINAL:');
    console.log('1. Configure o webhook com o comando acima');
    console.log('2. Envie uma mensagem para o WhatsApp');
    console.log('3. Verifique os logs do servidor');
    console.log('4. Verifique se aparece na tela de atendimentos');
    
  } catch (error) {
    console.error('❌ Erro durante verificação:', error.message);
  }
}

checkWebhookConfig();