import os
import time
import threading
import concurrent.futures
from collections import deque
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from crewai import Agent, Task, Crew, Process
from crewai_tools import ScrapeWebsiteTool
import litellm
from litellm.exceptions import RateLimitError
from langchain_community.chat_models.litellm import ChatLiteLLM

# Configurações
otimizacoes = {
    'max_workers': 5,  # Número de threads paralelas (ajuste conforme nescessário)
    'max_requests_per_minute': 25,  # Mantém abaixo do limite de 30 para segurança
    'retry_attempts': 10,  # Número de tentativas por ticker
    'base_delay': 10,  # Delay base entre requisições em segundos
}

# Configuração da API
def setup_llm():
    os.environ["GROQ_API_KEY"] = "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"
   # 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
    litellm.set_verbose = False
    return ChatLiteLLM(model="groq/llama-3.3-70b-versatile", temperature=0.7)

# Controle de taxa de requisições
class RateLimiter:
    def __init__(self, max_requests: int, time_window: int = 60):
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

# Processa um único ticker com tratamento de erros
def process_ticker(ticker: str, rate_limiter: RateLimiter, llm: ChatLiteLLM, retry_count: int = 0) -> Optional[str]:
    if retry_count >= otimizacoes['retry_attempts']:
        print(f"❌ Máximo de tentativas atingido para {ticker}")
        return None
    
    try:
        rate_limiter.wait_if_needed()
        print(f"🔄 Processando {ticker} (tentativa {retry_count + 1}/{otimizacoes['retry_attempts']})")
        
        # Cria o agente e a tarefa
        news_scraper_tool = ScrapeWebsiteTool(
            website_url=f"https://news.google.com/search?q={ticker}&tbs=qdr:m"
        )
        
        news_agent = Agent(
            role="Analista de Notícias Financeiras Sênior",
            goal="Encontrar e resumir notícias relevantes sobre ativos de mercado",
            backstory=("Você é um analista financeiro experiente, especializado em coletar "
                     "notícias recentes e identificar o sentimento do mercado."),
            tools=[news_scraper_tool],
            llm=llm,
            verbose=False,
            allow_delegation=False
        )
        
        # Instruções otimizadas para usar menos tokens
        task_description = (
            f"Analise brevemente o ativo {ticker} e retorne APENAS:\n"
            "1. **Resumo Geral** (máx 3 linhas)\n"
            "Formato exato de saída (obrigatório):\n"
            "RESUMO: [texto conciso]\n"
            "IMPACTO: [Positivo/Neutro/Negativo]"
        )
        
        # Formato simplificado de saída
        expected_output = (
            "RESUMO: Breve análise do cenário atual do ativo.\n"
            "IMPACTO: Positivo"
        )
        
        # Criando a tarefa
        news_task = Task(
            description=task_description,
            expected_output=expected_output,
            tools=[news_scraper_tool],
            agent=news_agent
        )
        
        crew = Crew(
            agents=[news_agent],
            tasks=[news_task],
            process=Process.sequential,
            verbose=False
        )
        
        return crew.kickoff()
        
    except RateLimitError as e:
        wait_time = (retry_count + 1) * 15  # Aumenta o tempo de espera a cada tentativa
        print(f"⚠️ RateLimitError em {ticker}. Tentando novamente em {wait_time} segundos...")
        time.sleep(wait_time)
        return process_ticker(ticker, rate_limiter, llm, retry_count + 1)
        
    except Exception as e:
        print(f"❌ Erro ao processar {ticker}: {str(e)}")
        return None

def main():
    # Lista de tickers (mantive apenas alguns para teste)
    tickers_to_process = [
         "ITUB4.SA"
    ]
    
    print(f"🚀 Iniciando processamento de {len(tickers_to_process)} tickers")
    print(f"⚙️  Configurações: {otimizacoes}")
    
    llm = setup_llm()
    rate_limiter = RateLimiter(max_requests=otimizacoes['max_requests_per_minute'])
    results = {}
    
    start_time = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=otimizacoes['max_workers']) as executor:
        future_to_ticker = {
            executor.submit(process_ticker, ticker, rate_limiter, llm): ticker 
            for ticker in tickers_to_process
        }
        
        for future in concurrent.futures.as_completed(future_to_ticker):
            ticker = future_to_ticker[future]
            try:
                result = future.result()
                if result:
                    # Converte o resultado para string se for um objeto CrewOutput
                    result_str = str(result)
                    results[ticker] = result_str
                    print(f"✅ {ticker} processado com sucesso!")
                else:
                    print(f"⚠️  {ticker} não retornou resultados")
            except Exception as e:
                print(f"❌ Erro ao processar {ticker}: {str(e)}")
    
    # Exibe estatísticas
    elapsed = time.time() - start_time
    print(f"\n🏁 Processamento concluído em {elapsed:.2f} segundos")
    print(f"📊 {len(results)} de {len(tickers_to_process)} tickers processados com sucesso")
    
    with open('resultados_analise.txt', 'w', encoding='utf-8') as f:
        for ticker, result in results.items():
            f.write(f"\n{'='*50}\n")
            f.write(f"📈 ANÁLISE PARA {ticker}\n")
            f.write(f"{'='*50}\n\n")
            # Garante que o resultado seja tratado como string
            result_str = str(result).strip()
            # Adiciona formatação consistente se necessário
            if not result_str.startswith("**Análise de Notícias para"):
                f.write(f"**Análise de Notícias para {ticker}**\n\n")
            f.write(f"{result_str}\n\n")
    
    print("\n📝 Resultados salvos em 'resultados_analise.txt'")

if __name__ == "__main__":
    main()
