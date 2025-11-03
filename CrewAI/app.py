from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import sys
import os
import time
from datetime import datetime
from litellm.exceptions import RateLimitError

# Add the current directory to the path so we can import teste_otimizado
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:8100", "http://127.0.0.1:8100"]}})

# Criar um RateLimiter compatível
class AppRateLimiter:
    def __init__(self, max_requests=25, time_window=60):
        import time
        from collections import deque
        import threading
        self.requests = deque()
        self.max_requests = max_requests
        self.time_window = time_window
        self.lock = threading.Lock()

    def wait_if_needed(self):
        with self.lock:
            now = time.time()
            # Remove registros mais antigos que a janela de tempo
            while self.requests and self.requests[0] <= now - self.time_window:
                self.requests.popleft()
            
            if len(self.requests) >= self.max_requests:
                sleep_time = (self.requests[0] + self.time_window) - now
                if sleep_time > 0:
                    time.sleep(sleep_time)
            
            self.requests.append(time.time())

# Inicializar o rate limiter (25 requisições por minuto)
rate_limiter = AppRateLimiter(max_requests=25, time_window=60)

# Configurar o LLM
llm = None
try:
    from teste_otimizado import setup_llm, ChatLiteLLM
    from litellm.exceptions import RateLimitError
    llm = setup_llm()
except ImportError as e:
    print(f"⚠️ Erro ao importar dependências: {e}")
    print("Por favor, instale as dependências necessárias com: pip install litellm langchain_community")
except Exception as e:
    print(f"⚠️ Aviso: Não foi possível configurar o LLM: {e}")
    print("Verifique se a chave da API GROQ está configurada corretamente.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/noticias', methods=['POST'])
def obter_noticias():
    try:
        data = request.get_json()
        ticker = data.get('ticker', '').strip().upper()
        
        if not ticker:
            return jsonify({'error': 'Ticker não pode estar vazio'}), 400
            
        # Verificar se o LLM foi configurado corretamente
        if llm is None:
            return jsonify({'error': 'Serviço de notícias não disponível no momento'}), 503
            
        # Importar a função process_ticker localmente
        from teste_otimizado import process_ticker
        
        # Chamar a função para obter as notícias
        resultado = process_ticker(
            ticker=ticker,
            rate_limiter=rate_limiter,
            llm=llm,
            retry_count=0
        )
        
        if not resultado:
            return jsonify({
                'error': 'Não foi possível obter notícias para este ativo no momento.'
            }), 404
            
        # Processar o resultado
        resultado_str = str(resultado)
        resumo = ""
        impacto = "neutro"
        
        if 'RESUMO:' in resultado_str and 'IMPACTO:' in resultado_str:
            partes = resultado_str.split('IMPACTO:')
            if len(partes) == 2:
                resumo = partes[0].replace('RESUMO:', '').strip()
                impacto = partes[1].strip().lower()
        
        return jsonify({
            'ticker': ticker,
            'resumo': resumo,
            'impacto': impacto,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Erro ao processar notícias: {str(e)}")
        return jsonify({'error': 'Erro ao processar a solicitação de notícias'}), 500

@app.route('/analisar', methods=['POST'])
def analisar():
    try:
        # Obter o ticker do formulário
        ticker = request.form.get('ticker', '').strip().upper()
        if not ticker:
            return jsonify({'error': 'Ticker não pode estar vazio'}), 400
        
        # Verificar se o LLM foi configurado corretamente
        if llm is None:
            error_msg = 'Erro na configuração do modelo de linguagem. Verifique o console para mais detalhes.'
            print("❌ Erro: LLM não foi configurado corretamente")
            return jsonify({'error': error_msg}), 500
        
        # Importar a função process_ticker localmente para evitar problemas de importação circular
        from teste_otimizado import process_ticker
        
        try:
            # Chamar a função com os parâmetros necessários
            resultado = process_ticker(
                ticker=ticker,
                rate_limiter=rate_limiter,
                llm=llm,
                retry_count=0
            )
            
            if not resultado:
                return jsonify({
                    'error': 'Não foi possível obter uma análise para este ticker. Tente novamente mais tarde.'
                }), 404
            
            # Converter o resultado para string se for um objeto CrewOutput
            resultado_str = str(resultado)
                
            # Processar o resultado para exibição mais limpa
            resultado_formatado = resultado_str
            if 'RESUMO:' in resultado_str and 'IMPACTO:' in resultado_str:
                partes = resultado_str.split('IMPACTO:')
                if len(partes) == 2:
                    resumo = partes[0].replace('RESUMO:', '').strip()
                    impacto = partes[1].strip()
                    # Normalizar o impacto para garantir que está em minúsculas
                    impacto_classe = impacto.lower().split()[0]  # Pega a primeira palavra em minúsculas
                    
                    resultado_formatado = f"""
                    <div class="resultado-analise">
                        <h3>Análise para {ticker}</h3>
                        <div class="resumo">
                            <h4>Resumo:</h4>
                            <p>{resumo}</p>
                        </div>
                        <div class="impacto">
                            <h4>Impacto:</h4>
                            <p class="impacto-{impacto_classe}">{impacto}</p>
                        </div>
                    </div>
                    """
            
            return jsonify({
                'result': resultado_formatado,
                'raw_result': resultado_str
            })
            
        except RateLimitError as e:
            print(f"⚠️ Limite de taxa atingido para {ticker}: {str(e)}")
            return jsonify({
                'error': 'Limite de requisições atingido. Por favor, aguarde um minuto antes de tentar novamente.'
            }), 429
            
        except Exception as e:
            error_msg = f'Erro ao processar o ticker {ticker}: {str(e)}'
            print(f"❌ {error_msg}")
            return jsonify({'error': error_msg}), 500
            
    except Exception as e:
        error_msg = f'Erro inesperado: {str(e)}'
        print(f"❌ {error_msg}")
        return jsonify({'error': error_msg}), 500

if __name__ == '__main__':
    # Create templates directory if it doesn't exist
    os.makedirs('templates', exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=True)
