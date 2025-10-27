import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface UrlValidatorProps {
  url: string;
  apiKey: string;
}

export function UrlValidator({ url, apiKey }: UrlValidatorProps) {
  const validateUrl = () => {
    const issues: string[] = [];
    
    if (!url) {
      return { valid: false, issues: ['URL é obrigatória'] };
    }
    
    if (!apiKey) {
      return { valid: false, issues: ['API Key é obrigatória'] };
    }
    
    // Verificar se é uma URL válida
    try {
      const urlObj = new URL(url);
      
      // Verificar protocolo
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        issues.push('URL deve usar protocolo HTTP ou HTTPS');
      }
      
      // Verificar se não tem path desnecessário
      if (urlObj.pathname !== '/' && urlObj.pathname !== '') {
        issues.push('URL não deve conter path adicional (ex: /api, /v1)');
      }
      
      // Verificar se não termina com /
      if (url.endsWith('/')) {
        issues.push('URL não deve terminar com barra (/)');
      }
      
      // Verificar padrões comuns de Evolution API
      const hostname = urlObj.hostname.toLowerCase();
      if (!hostname.includes('evolution') && !hostname.includes('evo') && !hostname.includes('api')) {
        issues.push('Verifique se esta é realmente a URL da Evolution API');
      }
      
    } catch (e) {
      issues.push('URL inválida - verifique o formato');
    }
    
    // Verificar API Key
    if (apiKey.length < 10) {
      issues.push('API Key parece muito curta');
    }
    
    if (!/^[A-Z0-9]+$/i.test(apiKey)) {
      issues.push('API Key deve conter apenas letras e números');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  };
  
  const validation = validateUrl();
  
  if (!url && !apiKey) {
    return null;
  }
  
  return (
    <div className="mt-2 p-3 rounded-lg border">
      <div className="flex items-center gap-2 mb-2">
        {validation.valid ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <span className={`text-sm font-medium ${validation.valid ? 'text-green-700' : 'text-red-700'}`}>
          {validation.valid ? 'Configuração válida' : 'Problemas encontrados'}
        </span>
      </div>
      
      {!validation.valid && (
        <ul className="text-sm text-red-600 space-y-1">
          {validation.issues.map((issue, index) => (
            <li key={index} className="flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              {issue}
            </li>
          ))}
        </ul>
      )}
      
      {validation.valid && (
        <div className="text-sm text-green-600">
          ✅ URL e API Key parecem corretas. Clique em "Testar Conexão" para verificar.
        </div>
      )}
    </div>
  );
}