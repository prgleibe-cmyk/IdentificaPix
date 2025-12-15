
import { Contributor, Transaction } from '../types';
import { Logger, Metrics } from './monitoringService';

export const getAISuggestion = async (
  transaction: Transaction,
  contributors: Contributor[]
): Promise<string> => {
  // Construir payload simplificado para o backend
  const contributorNames = contributors.map(c => c.name).join(', ');
  
  try {
    const response = await fetch('/api/ai/suggestion', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            transactionDescription: transaction.description,
            contributorNames: contributorNames
        })
    });

    if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    return data.text || "Nenhuma sugestão clara";

  } catch (error) {
    Logger.error("Error calling AI Backend", error);
    Metrics.increment('apiErrors');
    return "Erro ao contatar a IA.";
  }
};
