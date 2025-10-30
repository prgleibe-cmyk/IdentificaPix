import { Logger, Metrics } from "../../services/monitoringService.js"; // Caminho corrigido para raiz

export const handler = async (event) => {
  try {
    Logger.info("Função getAISuggestion chamada", { event });

    // Exemplo de incremento de métrica
    Metrics.increment("totalTransactions");

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Função executada com sucesso",
        metrics: Metrics.get(),
      }),
    };
  } catch (error) {
    Logger.error("Erro na função getAISuggestion", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro interno",
        error: error.message,
      }),
    };
  }
};
